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
