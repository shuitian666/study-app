import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test, { after, beforeEach } from 'node:test';
import sharp from 'sharp';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'study-truth-'));
process.env.TRUTH_ADMIN_EMAILS = '3546064605@qq.com';

const { db, createUser, nowIso } = await import('./db.js');
const {
  createTruthAssets,
  createTruthReport,
  getTruthAssetFile,
  isTruthAdmin,
  parseTruthQuery,
  searchTruthAssets,
  setTruthAssetStatus,
  streamTruthReportPdf,
  listTruthLibrary,
  updateTruthAsset,
  createTruthAttachments,
  getTruthAttachmentFile,
  getTruthReport,
  linkTruthAttachmentToDraftAssets,
} = await import('./truth.js');

function clearDb() {
  for (const table of [
    'truth_report_assets',
    'truth_reports',
    'truth_drug_aliases',
    'truth_assets',
    'ai_quota',
    'user_ai_configs',
    'user_game_state',
    'user_assets',
    'users',
  ]) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
}

function makeUser(email = `user-${crypto.randomUUID()}@example.com`) {
  return createUser(email, 'hash');
}

function insertAsset(overrides = {}) {
  const user = overrides.user || makeUser();
  const id = overrides.id || `truth_${crypto.randomUUID()}`;
  const storedName = `${id}.jpg`;
  const thumbnailName = `${id}.thumb.jpg`;
  const timestamp = nowIso();
  const originalDir = path.join(process.env.DATA_DIR, 'truth-images', 'originals');
  const thumbnailDir = path.join(process.env.DATA_DIR, 'truth-images', 'thumbnails');
  fs.mkdirSync(originalDir, { recursive: true });
  fs.mkdirSync(thumbnailDir, { recursive: true });
  fs.writeFileSync(path.join(originalDir, storedName), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  fs.writeFileSync(path.join(thumbnailDir, thumbnailName), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  db.prepare(`
    INSERT INTO truth_assets (
      id, sha256, original_name, stored_name, thumbnail_name, mime_type, size_bytes,
      batch_code, animal_id, species, strain, sex, drug_name, drug_aliases,
      phase, time_value, time_unit, tags, status, uploaded_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'image/jpeg', 4, ?, ?, '小鼠', '昆明鼠', ?, '大黄', '["Rhubarb"]',
      ?, ?, ?, '[]', ?, ?, ?, ?)
  `).run(
    id,
    crypto.randomBytes(32).toString('hex'),
    `${id}.jpg`,
    storedName,
    thumbnailName,
    overrides.batchCode || 'batch-1',
    overrides.animalId || 'mouse-1',
    overrides.sex || 'female',
    overrides.phase || 'dosing',
    overrides.timeValue ?? 3,
    overrides.timeUnit || 'day',
    overrides.status || 'published',
    user.id,
    timestamp,
    timestamp,
  );
  db.prepare(`
    INSERT OR REPLACE INTO truth_drug_aliases (alias_key, alias, canonical_name, updated_at)
    VALUES ('大黄', '大黄', '大黄', ?), ('rhubarb', 'Rhubarb', '大黄', ?)
  `).run(timestamp, timestamp);
  return { id, user };
}

beforeEach(clearDb);

after(() => {
  db.close?.();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

test('administrator whitelist uses the normalized account email', () => {
  assert.equal(isTruthAdmin({ phone: '3546064605@qq.com' }), true);
  assert.equal(isTruthAdmin({ phone: 'other@example.com' }), false);
});

test('query parser distinguishes dosing day 3 from withdrawal day 3', () => {
  const dosing = parseTruthQuery('大黄，给药3天，雌鼠');
  const withdrawal = parseTruthQuery('大黄，停药后3天，雌鼠');

  assert.equal(dosing.filter.phase, 'dosing');
  assert.equal(dosing.filter.timeValue, 3);
  assert.equal(dosing.filter.timeUnit, 'day');
  assert.equal(dosing.filter.sex, 'female');
  assert.equal(withdrawal.filter.phase, 'withdrawal');
});

test('query parser requires clarification for a bare time point', () => {
  const result = parseTruthQuery('大黄，第3天，雌鼠');

  assert.equal(result.filter.timeValue, 3);
  assert.equal(result.filter.phase, null);
  assert.equal(result.clarification.field, 'phase');
});

test('search returns only exact matches for all explicit conditions', () => {
  insertAsset({ phase: 'dosing', timeValue: 3, sex: 'female', animalId: 'female-day3' });
  insertAsset({ phase: 'withdrawal', timeValue: 3, sex: 'female', animalId: 'withdrawal-day3' });
  insertAsset({ phase: 'dosing', timeValue: 5, sex: 'female', animalId: 'female-day5' });
  insertAsset({ phase: 'dosing', timeValue: 3, sex: 'male', animalId: 'male-day3' });

  const result = searchTruthAssets('大黄，给药3天，雌鼠');

  assert.equal(result.total, 1);
  assert.equal(result.assets[0].animalId, 'female-day3');
});

test('search without a recognized filter never returns the full published library', () => {
  insertAsset();

  const result = searchTruthAssets('show me every image');

  assert.equal(result.total, 0);
  assert.equal(result.assets.length, 0);
  assert.equal(result.availableValues.drugNames.length, 1);
});

test('archived assets disappear from search but remain accessible to administrators', () => {
  const { id, user } = insertAsset();
  setTruthAssetStatus(id, 'archived');

  assert.equal(searchTruthAssets('大黄，给药3天，雌鼠').total, 0);
  assert.throws(() => getTruthAssetFile(id, 'original', makeUser()), /图片不存在/);
  assert.doesNotThrow(() => getTruthAssetFile(id, 'original', { ...user, phone: '3546064605@qq.com' }));
});

test('real PNG upload creates a thumbnail and supports report PDF export', async () => {
  const user = makeUser();
  const uploadPath = path.join(process.env.DATA_DIR, `upload-${crypto.randomUUID()}.tmp`);
  await sharp({
    create: {
      width: 24,
      height: 24,
      channels: 3,
      background: { r: 220, g: 45, b: 40 },
    },
  }).png().toFile(uploadPath);
  const stat = fs.statSync(uploadPath);

  const uploaded = await createTruthAssets(user.id, [{
    path: uploadPath,
    originalname: 'thermal.png',
    mimetype: 'image/png',
    size: stat.size,
  }], {
    common: {
      batchCode: 'batch-upload',
      animalId: 'mouse-upload',
      species: '小鼠',
      strain: '昆明鼠',
      sex: 'female',
      drugName: '大黄',
      drugAliases: ['Rhubarb'],
      phase: 'dosing',
      timeValue: 3,
      timeUnit: 'day',
      observation: '管理员确认的人工观察。',
    },
  });

  assert.equal(uploaded.created.length, 1);
  const asset = uploaded.created[0];
  assert.equal(fs.existsSync(getTruthAssetFile(asset.id, 'preview', { ...user, phone: '3546064605@qq.com' }).filePath), true);

  setTruthAssetStatus(asset.id, 'published');
  assert.equal(searchTruthAssets('Rhubarb，给药3天，雌鼠').total, 1);

  const report = await createTruthReport(user.id, {
    assetIds: [asset.id],
    queryText: '大黄，给药3天，雌鼠',
    filter: {
      drugName: '大黄',
      phase: 'dosing',
      timeValue: 3,
      timeUnit: 'day',
      sex: 'female',
      ignoredField: 'must not be persisted',
    },
  });
  assert.equal(report.assets.length, 1);
  assert.equal(report.content.length > 40, true);
  assert.equal('ignoredField' in report.filter, false);

  const output = new PassThrough();
  const chunks = [];
  output.setHeader = () => {};
  output.on('data', chunk => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => {
    output.on('finish', resolve);
    output.on('error', reject);
  });
  streamTruthReportPdf(user.id, report.id, output);
  await finished;
  assert.equal(Buffer.concat(chunks).subarray(0, 4).toString(), '%PDF');
});


test('published browsing paginates beyond 200 with exact totals and stable order', () => {
  const user = makeUser();
  for (let i = 0; i < 205; i++) insertAsset({ user, animalId: 'mouse-' + i });
  insertAsset({ user, status: 'draft' });
  const first = listTruthLibrary({ limit: 200 });
  const next = listTruthLibrary({ limit: 200, offset: 200 });
  assert.equal(first.total, 205);
  assert.equal(first.assets.length, 200);
  assert.equal(next.assets.length, 5);
  assert.equal(new Set([...first.assets, ...next.assets].map(a => a.id)).size, 205);
  assert.equal(first.hasMore, true);
  assert.equal(next.hasMore, false);
});

test('Chinese day, identifiers and unresolved constraints remain visible', () => {
  insertAsset({ batchCode: 'batch-9', animalId: 'female-10' });
  const result = listTruthLibrary({ query: '大黄，批次 batch-9，编号 female-10，给药第三天，雌性，背部特殊要求' });
  assert.equal(result.filter.batchCode, 'batch-9');
  assert.equal(result.filter.animalId, 'female-10');
  assert.equal(result.filter.timeValue, 3);
  assert.equal(result.total, 1);
  assert(result.unrecognizedTerms.some(t => t.includes('背部')));
  assert(result.warnings.length > 0);
  assert.equal(listTruthLibrary({ query: '大黄，批次 nonexistent' }).total, 0);
  assert(parseTruthQuery('雌性，雄性，给药第三天，停药第五天').warnings.length >= 3);
  assert(parseTruthQuery('雄性', { sex: 'female' }).warnings.length > 0);
});

test('control times survive editing; published edits are isolated until release', () => {
  const { id } = insertAsset({ phase: 'control', timeValue: 3 });
  const edited = updateTruthAsset(id, { timeValue: 5, groupName: '空白组', captureStage: 'before' });
  assert.equal(edited.timeValue, 3);
  assert.equal(edited.pendingRevision.timeValue, 5);
  assert.equal(listTruthLibrary({ phase: 'control', timeValue: 3, timeUnit: 'day' }).total, 1);
  setTruthAssetStatus(id, 'pending');
  assert.equal(listTruthLibrary().total, 1);
  const published = setTruthAssetStatus(id, 'published');
  assert.equal(published.timeValue, 5);
  assert.equal(published.groupName, '空白组');
  assert.equal(published.version, 2);
  assert.equal(published.pendingRevision, null);
});

test('unpublished aliases cannot change published search interpretation', () => {
  const { id } = insertAsset();
  updateTruthAsset(id, { drugName: '尚未审核', drugAliases: ['Rhubarb'] });
  assert.equal(parseTruthQuery('Rhubarb').filter.drugName, '大黄');
  assert.equal(parseTruthQuery('尚未审核').filter.drugName, null);
});

test('reports freeze approved revisions and reject stale client versions', async () => {
  const { id, user } = insertAsset();
  const report = await createTruthReport(user.id, { assetIds: [id] });
  updateTruthAsset(id, { observation: '新的人工观察' });
  setTruthAssetStatus(id, 'published');
  assert.equal(getTruthReport(user.id, report.id).assets[0].version, 1);
  assert.notEqual(getTruthReport(user.id, report.id).assets[0].observation, '新的人工观察');
  await assert.rejects(() => createTruthReport(user.id, { assetIds: [id], assetVersions: { [id]: 1 } }), /资料已更新/);
  assert.throws(() => getTruthReport(makeUser().id, report.id));
});

test('PDF additions stay private until publication and old report access is snapshot scoped', async () => {
  const { id, user } = insertAsset();
  const oldReport = await createTruthReport(user.id, { assetIds: [id] });
  const pdfPath = path.join(process.env.DATA_DIR, 'attachment.pdf');
  fs.writeFileSync(pdfPath, '%PDF-1.4\n% valid test header\n%%EOF');
  const upload = await createTruthAttachments(user.id, id, [{ path: pdfPath, originalname: 'record.pdf', mimetype: 'application/pdf', size: fs.statSync(pdfPath).size }]);
  assert.equal(upload.failed.length, 0);
  const attachment = upload.created[0];
  assert.throws(() => getTruthAttachmentFile(attachment.id, user));
  assert.equal(listTruthLibrary().assets[0].attachments.length, 0);
  setTruthAssetStatus(id, 'published');
  assert.doesNotThrow(() => getTruthAttachmentFile(attachment.id, user));
  const reader = makeUser();
  const newReport = await createTruthReport(reader.id, { assetIds: [id] });
  assert.equal(newReport.assets[0].attachments.length, 1);
  setTruthAssetStatus(id, 'archived');
  assert.equal(getTruthReport(user.id, oldReport.id).assets[0].attachments.length, 0);
  assert.throws(() => getTruthAttachmentFile(attachment.id, user));
  assert.doesNotThrow(() => getTruthAttachmentFile(attachment.id, reader));
});

test('one folder PDF is stored once, linked to draft siblings, and published per image', async () => {
  const owner = makeUser();
  const first = insertAsset({ user: owner, status: 'draft' });
  const second = insertAsset({ user: owner, status: 'draft' });
  const elsewhere = insertAsset({ user: owner, status: 'draft' });
  for (const [id, source] of [[first.id, '低剂量组/first.jpg'], [second.id, '低剂量组/second.jpg'],
    [elsewhere.id, '高剂量组/third.jpg']]) {
    db.prepare('UPDATE truth_assets SET source_path = ? WHERE id = ?').run(source, id);
  }
  const pdfPath = path.join(process.env.DATA_DIR, 'shared-folder.pdf');
  fs.writeFileSync(pdfPath, '%PDF-1.4\n% folder PDF\n%%EOF');
  const uploaded = await createTruthAttachments(owner.id, first.id,
    [{ path: pdfPath, originalname: 'images.pdf', mimetype: 'application/pdf', size: fs.statSync(pdfPath).size }],
    { sourcePaths: ['低剂量组/images.pdf'] });
  assert.equal(uploaded.failed.length, 0);
  const attachment = uploaded.created[0];
  assert.throws(() => linkTruthAttachmentToDraftAssets(attachment.id, [first.id, elsewhere.id]), /同目录/);
  assert.equal(linkTruthAttachmentToDraftAssets(attachment.id, [first.id, second.id]), 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM truth_attachments WHERE id = ?').get(attachment.id).total, 1);
  assert.equal(listTruthLibrary().total, 0);
  setTruthAssetStatus(first.id, 'published');
  assert.equal(listTruthLibrary().assets[0].attachments[0].id, attachment.id);
  setTruthAssetStatus(second.id, 'published');
  assert.equal(listTruthLibrary().assets.find(asset => asset.id === second.id).attachments[0].id, attachment.id);
  assert.doesNotThrow(() => getTruthAttachmentFile(attachment.id, owner));
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM truth_attachment_assets WHERE attachment_id = ?').get(attachment.id).total, 1);
});

test('upload ignores supplied published status and validates relative provenance', async () => {
  const user = makeUser();
  const uploadPath = path.join(process.env.DATA_DIR, 'draft-only.png');
  await sharp({ create: { width: 20, height: 20, channels: 3, background: '#3388aa' } }).png().toFile(uploadPath);
  const result = await createTruthAssets(user.id, [{ path: uploadPath, originalname: 'draft.png', mimetype: 'image/png', size: fs.statSync(uploadPath).size }], { common: { batchCode: 'test', species: 'unknown', sex: 'unknown', phase: 'unknown', status: 'published' } });
  assert.equal(result.created[0].status, 'draft');
  assert.equal(listTruthLibrary().total, 0);
  assert.throws(() => updateTruthAsset(result.created[0].id, { sourcePath: '../outside.jpg' }));
});
