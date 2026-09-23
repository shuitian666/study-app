// Serves a fresh isolated Fangfeng fixture with local test accounts. No real AI calls.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createIsolatedTruthDirectory, importFangfengManifest, scanFangfengSource, writeManifest } from './truth-import-fangfeng.mjs';

const args = process.argv.slice(2);
const sourceRoot = args.includes('--source') ? args[args.indexOf('--source') + 1] : process.env.TRUTH_VERIFY_SOURCE;
if (!sourceRoot) throw new Error('Pass --source <read-only-source-directory> or TRUTH_VERIFY_SOURCE');
const dataDir = createIsolatedTruthDirectory();
process.env.DATA_DIR = dataDir;
const freePort = await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => resolve(port)); });
});
process.env.PORT = process.env.TRUTH_VERIFY_PORT || String(freePort);
process.env.SUPER_ADMIN_EMAILS = 'truth-super@example.test';
process.env.TRUTH_MODE_ENABLED = 'true';
process.env.DEEPSEEK_API_KEY = '';
process.env.CORS_ORIGINS = `http://localhost:${process.env.PORT},http://127.0.0.1:${process.env.PORT},http://localhost:5173,http://127.0.0.1:5173`;
const outputDirectory = path.resolve('output/truth-verification');
fs.mkdirSync(outputDirectory, { recursive: true });

const { createUser, db, nowIso } = await import('../server/db.js');
const { hashPassword } = await import('../server/security.js');
const { grantRole } = await import('../server/admin.js');
const accounts = {};
for (const [key, nickname] of Object.entries({ superAdmin: '求真测试超级管理员', admin: '求真测试管理员', subAdmin: '求真测试副管理员', user: '求真测试普通用户', otherUser: '求真测试另一用户' })) {
  const email = key === 'superAdmin' ? 'truth-super@example.test' : `truth-${key.toLowerCase()}@example.test`;
  const password = `TruthVerify-${crypto.randomBytes(12).toString('hex')}!`;
  const user = createUser(email, hashPassword(password));
  db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nickname, user.id);
  const token = `ses_${crypto.randomUUID()}`;
  db.prepare('INSERT INTO sessions (id,user_id,expires_at,created_at) VALUES (?,?,?,?)').run(token, user.id, new Date(Date.now() + 86400000).toISOString(), nowIso());
  accounts[key] = { id: user.id, phone: email, email, password, token };
}
grantRole(accounts.superAdmin, accounts.admin.id, 'admin');
grantRole(accounts.superAdmin, accounts.subAdmin.id, 'sub_admin');
const manifest = scanFangfengSource(sourceRoot);
console.log(`Scanning complete: ${manifest.summary.uniqueImages} unique images, ${manifest.summary.linkedPdfs} linked PDFs. Importing isolated copies.`);
await importFangfengManifest(manifest, accounts.admin.id, { publish: true, onProgress: progress => console.log(`Fixture ${progress.stage}: ${progress.processed}/${progress.total}`) });
writeManifest(manifest, outputDirectory);

// Keep source assets available for UI tests and add independent synthetic permission fixtures.
const { default: sharp } = await import('../server/node_modules/sharp/lib/index.js');
const { createTruthAssets, createTruthAttachments, createTruthReport, setTruthAssetStatus } = await import('../server/truth.js');
const boundaryAssets = {};
for (const status of ['draft', 'pending', 'archived']) {
  const uploadPath = path.join(dataDir, `boundary-${status}.png`);
  const colors = { draft: '#dd2244', pending: '#2244dd', archived: '#22dd44' };
  await sharp({ create: { width: 32, height: 32, channels: 3, background: colors[status] } }).png().toFile(uploadPath);
  const uploaded = await createTruthAssets(accounts.admin.id, [{ path: uploadPath, originalname: `${status}.png`, mimetype: 'image/png', size: fs.statSync(uploadPath).size }], { common: {
    batchCode: 'TEST-PERMISSIONS', species: '测试图', sex: 'unknown', phase: 'unknown', imageType: 'unknown', groupName: '测试组',
  } });
  if (uploaded.failed.length) throw new Error(JSON.stringify(uploaded.failed));
  const asset = uploaded.created[0];
  if (status !== 'draft') setTruthAssetStatus(asset.id, status);
  boundaryAssets[status] = asset.id;
  const pdfPath = path.join(dataDir, `boundary-${status}.pdf`);
  fs.writeFileSync(pdfPath, `%PDF-1.4\n% Boundary ${status} fixture, not a source attachment.\n%%EOF`);
  const attached = await createTruthAttachments(accounts.admin.id, asset.id, [{ path: pdfPath, originalname: `${status}.pdf`, mimetype: 'application/pdf', size: fs.statSync(pdfPath).size }]);
  if (attached.failed.length) throw new Error(JSON.stringify(attached.failed));
  boundaryAssets[`${status}Attachment`] = attached.created[0]?.id;
}
const reportAssets = manifest.images.filter(image => image.metadata.phase === 'dosing' && image.metadata.timeValue === 3 && image.metadata.sex === 'female' && image.metadata.captureStage === 'before').slice(0, 2).map(image => image.assetId);
const report = await createTruthReport(accounts.user.id, { assetIds: reportAssets, title: '防风给药第三天雌性实验前资料记录', query: '防风，给药第三天，雌性，实验前', purpose: '资料整理', notes: '隔离测试，仅根据目录记录生成。' });
const connection = { baseUrl: `http://localhost:${process.env.PORT}`, dataDir, outputDirectory, sourceRoot: manifest.sourceRoot, accounts, boundaryAssets, reportId: report.id };
fs.writeFileSync(path.join(outputDirectory, 'connection.local.json'), JSON.stringify(connection, null, 2));
console.log(`Fixture ready. Connection/account details saved only to ${path.join(outputDirectory, 'connection.local.json')}`);
await import('../server/index.js');
