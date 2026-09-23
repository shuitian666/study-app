// Import the verified Fangfeng source into an explicitly selected real gallery.
// No source files are changed. The output directory is ignored by Git.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { scanFangfengSource } from './truth-import-fangfeng.mjs';

const MARKER = '防风正式图库试用导入-v1';
const modes = ['--plan', '--apply', '--archive', '--restore'].filter(flag => process.argv.includes(flag));
assert.equal(modes.length, 1, 'Specify exactly one of --plan, --apply, --archive, --restore');
const option = name => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const dataArg = option('--data-dir');
assert(dataArg, 'Specify --data-dir explicitly');
const dataDir = fs.realpathSync(dataArg);
assert(!fs.existsSync(path.join(dataDir, '.truth-test-only')), 'An isolated test fixture is not a real gallery');
const databaseFile = path.join(dataDir, 'app.sqlite');
assert(fs.existsSync(databaseFile), 'The target gallery must already have an application database');
const sourceArg = option('--source');
const mode = modes[0];
assert(mode !== '--apply' && mode !== '--plan' || sourceArg, '--plan and --apply require --source');
const sourceRoot = sourceArg ? fs.realpathSync(sourceArg) : null;
if (sourceRoot) {
  const relative = path.relative(sourceRoot, dataDir);
  assert(sourceRoot !== dataDir && (relative.startsWith('..') || path.isAbsolute(relative)), 'Source and target must be separate');
}

const hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hasMarker = row => {
  try { return JSON.parse(row.tags || '[]').includes(MARKER); } catch { return false; }
};
const existingDb = new DatabaseSync(databaseFile, { readOnly: true });
let manifest;
try {
  if (sourceRoot) manifest = scanFangfengSource(sourceRoot);
  if (mode === '--plan') {
    const existing = manifest.images.filter(item => !!existingDb.prepare('SELECT id FROM truth_assets WHERE sha256 = ?').get(item.sha256));
    console.log(JSON.stringify({ target: dataDir, source: sourceRoot, summary: manifest.summary,
      alreadyPresent: existing.length, newImages: manifest.images.length - existing.length }, null, 2));
    process.exit(0);
  }
} finally { existingDb.close(); }

const outputDir = path.resolve('output/truth-library');
fs.mkdirSync(outputDir, { recursive: true });
const backupPath = path.join(outputDir, `before-${mode.slice(2)}-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
const backupDb = new DatabaseSync(databaseFile);
try { await backup(backupDb, backupPath); } finally { backupDb.close(); }
assert(fs.statSync(backupPath).size > 0, 'Database backup failed');
console.log(`Database backup: ${backupPath}`);

process.env.DATA_DIR = dataDir;
const { db, getUserByPhone } = await import('../server/db.js');
const { hasPermission } = await import('../server/admin.js');
const { createTruthAssets, createTruthAttachments, linkTruthAttachmentToDraftAssets,
  setTruthAssetStatus } = await import('../server/truth.js');
const adminEmail = option('--admin-email');
const candidates = adminEmail ? [getUserByPhone(adminEmail)] : db.prepare('SELECT * FROM users').all();
const admin = candidates.find(user => user && hasPermission(user, 'truth.assets.upload') && hasPermission(user, 'truth.assets.publish'));
assert(admin, 'An existing administrator with upload and publish permissions is required');

const ownedRows = () => db.prepare('SELECT id, status, tags FROM truth_assets').all().filter(hasMarker);
if (mode === '--archive' || mode === '--restore') {
  const targets = ownedRows().filter(row => mode === '--archive' ? row.status !== 'archived' : row.status === 'archived');
  for (const [index, row] of targets.entries()) {
    setTruthAssetStatus(row.id, mode === '--archive' ? 'archived' : 'published');
    if ((index + 1) % 100 === 0) console.log(`${mode.slice(2)}: ${index + 1}/${targets.length}`);
  }
  console.log(JSON.stringify({ action: mode.slice(2), changed: targets.length, remainingPublished: ownedRows().filter(row => row.status === 'published').length }));
  db.close();
  process.exit(0);
}

assert.equal(manifest.summary.uniqueImages, 690, 'Unexpected image count; review the source before applying');
assert.equal(manifest.summary.uniquePdfs, 332, 'Unexpected PDF count; review the source before applying');
assert.equal(manifest.summary.directoryImageLinks, 42, 'Unexpected folder associations; review the source before applying');
const sourceFile = entry => path.join(sourceRoot, ...entry.sourcePath.split('/'));
const copyForUpload = entry => {
  const original = sourceFile(entry);
  assert.equal(hashFile(original), entry.sha256, `Source changed: ${entry.sourcePath}`);
  const target = path.join(dataDir, 'truth-images', 'tmp', `formal-import-${crypto.randomUUID()}.tmp`);
  fs.copyFileSync(original, target);
  const copiedAt = new Date();
  fs.utimesSync(target, copiedAt, copiedAt);
  return { path: target, originalname: path.basename(original),
    mimetype: entry.kind === 'pdf' ? 'application/pdf' : 'image/jpeg', size: entry.sizeBytes };
};
const formalMetadata = entry => {
  const metadata = entry.metadata;
  return { ...metadata,
    batchCode: `待核对-防风-${entry.sourcePath.split('/')[0]}`,
    captureId: metadata.captureId.replace(/^TEST-capture-/, '待核对-capture-'),
    tags: ['防风资料集', '试用资料', '批次与动物身份待核对', MARKER],
    observation: '防风原始资料试用导入；标签仅按目录和文件名整理。尚未人工确认真实批次、动物跨时间身份，也未读取图片或提取 PDF 内容。',
  };
};
const assetIds = new Map();
for (let start = 0; start < manifest.images.length; start += 50) {
  const batch = manifest.images.slice(start, start + 50);
  const fresh = [];
  for (const entry of batch) {
    const row = db.prepare('SELECT id, source_path, tags FROM truth_assets WHERE sha256 = ?').get(entry.sha256);
    if (row) {
      assert(hasMarker(row) && row.source_path === entry.sourcePath,
        `Existing image is not part of this controlled import: ${entry.sourcePath}`);
      assetIds.set(entry.sha256, row.id);
    } else fresh.push(entry);
  }
  if (fresh.length) {
    const result = await createTruthAssets(admin.id, fresh.map(copyForUpload), { items: fresh.map(formalMetadata) });
    assert.equal(result.failed.length, 0, `Image import failed: ${JSON.stringify(result.failed)}`);
    for (const entry of fresh) {
      const asset = result.created.find(item => item.sourcePath === entry.sourcePath);
      assert(asset, `Image missing after import: ${entry.sourcePath}`);
      assetIds.set(entry.sha256, asset.id);
    }
  }
  console.log(`Images: ${Math.min(start + 50, manifest.images.length)}/${manifest.images.length}`);
}

let linkedPdfs = 0;
for (const attachment of manifest.attachments) {
  assert(attachment.imageSha256, `PDF needs review: ${attachment.sourcePath}`);
  const ownerId = assetIds.get(attachment.imageSha256);
  const existing = db.prepare('SELECT id FROM truth_attachments WHERE asset_id = ? AND sha256 = ?')
    .get(ownerId, attachment.sha256);
  let attachmentId = existing?.id;
  if (!attachmentId) {
    const result = await createTruthAttachments(admin.id, ownerId, [copyForUpload(attachment)],
      { sourcePaths: [attachment.sourcePath] });
    assert.equal(result.failed.length, 0, `PDF import failed: ${JSON.stringify(result.failed)}`);
    attachmentId = result.created[0]?.id;
  }
  assert(attachmentId, `PDF missing after import: ${attachment.sourcePath}`);
  if (attachment.associationScope === 'directory') {
    const owner = db.prepare('SELECT status FROM truth_assets WHERE id = ?').get(ownerId);
    if (owner.status === 'draft') {
      const ids = attachment.imageSha256s.map(sha256 => assetIds.get(sha256));
      assert(ids.every(Boolean), `Folder images missing: ${attachment.sourcePath}`);
      linkTruthAttachmentToDraftAssets(attachmentId, ids);
    }
  }
  linkedPdfs++;
  if (linkedPdfs % 50 === 0) console.log(`PDFs: ${linkedPdfs}/${manifest.attachments.length}`);
}
assert.equal(assetIds.size, manifest.images.length);
assert.equal(linkedPdfs, manifest.attachments.length);
for (const entry of manifest.images) {
  const row = db.prepare('SELECT stored_name FROM truth_assets WHERE id = ?').get(assetIds.get(entry.sha256));
  assert.equal(hashFile(path.join(dataDir, 'truth-images', 'originals', row.stored_name)), entry.sha256, entry.sourcePath);
}
for (const entry of manifest.attachments) {
  const ownerId = assetIds.get(entry.imageSha256);
  const row = db.prepare('SELECT stored_name FROM truth_attachments WHERE asset_id = ? AND sha256 = ?').get(ownerId, entry.sha256);
  assert.equal(hashFile(path.join(dataDir, 'truth-images', 'attachments', row.stored_name)), entry.sha256, entry.sourcePath);
}
for (const [index, assetId] of [...assetIds.values()].entries()) {
  const row = db.prepare('SELECT status FROM truth_assets WHERE id = ?').get(assetId);
  assert(row.status !== 'archived', 'Archived trial assets require --restore, not --apply');
  if (row.status !== 'published') setTruthAssetStatus(assetId, 'published');
  if ((index + 1) % 100 === 0) console.log(`Published: ${index + 1}/${assetIds.size}`);
}
const record = { completedAt: new Date().toISOString(), target: dataDir, source: sourceRoot,
  marker: MARKER, backupPath, images: assetIds.size, pdfs: linkedPdfs, directoryPdfs: manifest.summary.directoryPdfs,
  directoryImageLinks: manifest.summary.directoryImageLinks };
fs.writeFileSync(path.join(outputDir, 'last-import.json'), JSON.stringify(record, null, 2));
console.log(JSON.stringify(record, null, 2));
db.close();
