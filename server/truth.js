import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { db, nowIso } from './db.js';
import { chatCompletion, extractContent, getAiConfigStatus } from './providers.js';
import { getAdminStatus, hasPermission } from './admin.js';

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
export const truthImageDir = path.join(dataDir, 'truth-images');
export const truthOriginalDir = path.join(truthImageDir, 'originals');
export const truthThumbnailDir = path.join(truthImageDir, 'thumbnails');
export const truthTempDir = path.join(truthImageDir, 'tmp');
export const truthAttachmentDir = path.join(truthImageDir, 'attachments');

for (const directory of [truthOriginalDir, truthThumbnailDir, truthTempDir, truthAttachmentDir]) {
  fs.mkdirSync(directory, { recursive: true });
}
for (const entry of fs.readdirSync(truthTempDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const filePath = path.join(truthTempDir, entry.name);
  try {
    if (Date.now() - fs.statSync(filePath).mtimeMs > 24 * 60 * 60 * 1000) {
      fs.rmSync(filePath, { force: true });
    }
  } catch {
    // Temporary-file cleanup is best-effort.
  }
}

const VALID_STATUSES = new Set(['draft', 'pending', 'published', 'archived']);
const VALID_PHASES = new Set(['control', 'dosing', 'withdrawal', 'unknown']);
const VALID_SEXES = new Set(['female', 'male', 'unknown']);
const VALID_TIME_UNITS = new Set(['hour', 'day']);
const MAX_REPORT_ASSETS = 30;
const VALID_CAPTURE_STAGES = new Set(['before', 'after', 'unknown']);
const VALID_IMAGE_TYPES = new Set(['thermal', 'visible', 'unknown']);

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function cleanText(value, max = 200) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanOptional(value, max = 200) {
  const text = cleanText(value, max);
  return text || null;
}

function cleanList(value, maxItems = 30, itemLength = 60) {
  const items = Array.isArray(value)
    ? value
    : String(value || '').split(/[,，;；\n]/);
  return [...new Set(items.map(item => cleanText(item, itemLength)).filter(Boolean))].slice(0, maxItems);
}

function aliasKey(value) {
  return cleanText(value, 100).toLowerCase().replace(/[\s_-]+/g, '');
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function truthModeEnabled() {
  return process.env.TRUTH_MODE_ENABLED !== 'false';
}

export function isTruthAdmin(user) {
  return hasPermission(user, 'truth.assets.edit');
}

export function getTruthStatus(user) {
  const admin = getAdminStatus(user);
  return {
    enabled: truthModeEnabled(),
    isAdmin: hasPermission(user, 'truth.assets.edit'),
    role: admin.role,
    permissions: admin.permissions,
    limits: {
      maxFiles: 100,
      maxFileBytes: 20 * 1024 * 1024,
      acceptedTypes: ['image/jpeg', 'image/png'],
    },
  };
}

function normalizeSex(value) {
  const text = cleanText(value, 20).toLowerCase();
  if (['female', 'f', '雌', '雌性', '雌鼠'].includes(text)) return 'female';
  if (['male', 'm', '雄', '雄性', '雄鼠'].includes(text)) return 'male';
  if (['unknown', '未知', '不明'].includes(text)) return 'unknown';
  return text;
}

function normalizePhase(value) {
  const text = cleanText(value, 30).toLowerCase();
  if (['dosing', '给药', '给药中', '给药阶段'].includes(text)) return 'dosing';
  if (['withdrawal', '停药', '停药后', '撤药', '撤药后'].includes(text)) return 'withdrawal';
  if (['control', '对照', '对照组'].includes(text)) return 'control';
  return text;
}

function normalizeTimeUnit(value) {
  const text = cleanText(value, 20).toLowerCase();
  if (['day', 'days', 'd', '天', '日'].includes(text)) return 'day';
  if (['hour', 'hours', 'h', '小时', '时'].includes(text)) return 'hour';
  return text;
}

function normalizeNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}

function relativeSourcePath(value) {
  const source = cleanOptional(value, 1000)?.replace(/\\/g, '/');
  if (!source) return null;
  if (path.posix.isAbsolute(source) || /^[a-z]:/i.test(source) || source.split('/').includes('..')) {
    throw httpError(400, '来源路径必须是资料目录内的相对路径');
  }
  return source;
}

function validateMetadata(input = {}) {
  const metadata = {
    batchCode: cleanText(input.batchCode, 100),
    animalId: cleanOptional(input.animalId, 100),
    species: cleanText(input.species || '小鼠', 100),
    strain: cleanOptional(input.strain, 100),
    sex: normalizeSex(input.sex),
    drugName: cleanOptional(input.drugName, 100),
    drugAliases: cleanList(input.drugAliases, 20, 100),
    doseValue: cleanOptional(input.doseValue, 50),
    doseUnit: cleanOptional(input.doseUnit, 50),
    administrationRoute: cleanOptional(input.administrationRoute, 100),
    phase: normalizePhase(input.phase),
    timeValue: normalizeNumber(input.timeValue),
    timeUnit: input.timeValue === '' || input.timeValue === null || input.timeValue === undefined
      ? null
      : normalizeTimeUnit(input.timeUnit),
    bodyPart: cleanOptional(input.bodyPart, 100),
    observation: cleanOptional(input.observation, 2000),
    tags: cleanList(input.tags),
    groupName: cleanOptional(input.groupName, 100),
    captureStage: input.captureStage || 'unknown',
    imageType: input.imageType || 'unknown',
    sourcePath: relativeSourcePath(input.sourcePath),
    captureId: cleanOptional(input.captureId, 200),
    status: VALID_STATUSES.has(input.status) ? input.status : 'draft',
  };

  if (!metadata.batchCode) throw httpError(400, '实验批次不能为空');
  if (!metadata.species) throw httpError(400, '物种不能为空');
  if (!VALID_SEXES.has(metadata.sex)) throw httpError(400, '性别字段无效');
  if (!VALID_PHASES.has(metadata.phase)) throw httpError(400, '实验阶段无效');
  if (['dosing', 'withdrawal'].includes(metadata.phase) && metadata.timeValue === null) {
    throw httpError(400, '给药或停药阶段必须填写时间点');
  }
  if (metadata.timeValue !== null && !VALID_TIME_UNITS.has(metadata.timeUnit)) {
    throw httpError(400, '时间单位无效');
  }
  if (!VALID_CAPTURE_STAGES.has(metadata.captureStage)) throw httpError(400, '拍摄阶段无效');
  if (!VALID_IMAGE_TYPES.has(metadata.imageType)) throw httpError(400, '图片类型无效');
  return metadata;
}

function fileSignature(buffer) {
  if (buffer.length >= 8
    && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) {
    return { mimeType: 'image/png', extension: '.png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: '.jpg' };
  }
  return null;
}

function rowToAttachment(row) {
  return {
    id: row.id, originalName: row.original_name, fileName: row.original_name,
    mimeType: row.mime_type, sizeBytes: row.size_bytes, sourcePath: row.source_path,
    previewUrl: `/api/truth/attachments/${row.id}/preview`,
    downloadUrl: `/api/truth/attachments/${row.id}/download`,
  };
}

function capturePeers(row) {
  if (!row.capture_id || !row.group_name || !row.animal_id || row.sex === 'unknown') return [row.id];
  return db.prepare(`SELECT id FROM truth_assets WHERE capture_id = ? AND batch_code = ?
    AND group_name = ? AND sex = ? AND animal_id = ? AND phase = ?
    AND time_value IS ? AND time_unit IS ? AND capture_stage = ?`).all(
    row.capture_id, row.batch_code, row.group_name, row.sex, row.animal_id,
    row.phase, row.time_value, row.time_unit, row.capture_stage,
  ).map(item => item.id);
}

function assetAttachments(row, pending = false) {
  const ids = pending ? [row.id] : capturePeers(row);
  return db.prepare(`SELECT a.* FROM truth_attachments a JOIN truth_assets t ON t.id = a.asset_id
    WHERE (a.asset_id IN (${ids.map(() => '?').join(',')})
      ${pending ? '' : 'OR EXISTS (SELECT 1 FROM truth_attachment_assets l WHERE l.attachment_id = a.id AND l.asset_id = ?)'}
    ) AND a.published_version IS ${pending ? '' : 'NOT '}NULL
    ${pending ? '' : "AND (a.asset_id = ? OR t.status = 'published')"}
    ORDER BY a.created_at, a.id`).all(...ids, ...(pending ? [] : [row.id, row.id])).map(rowToAttachment);
}

function rowToAsset(row, management = false) {
  if (!row) return null;
  return {
    id: row.id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    batchCode: row.batch_code,
    animalId: row.animal_id,
    species: row.species,
    strain: row.strain,
    sex: row.sex,
    drugName: row.drug_name,
    drugAliases: parseJson(row.drug_aliases, []),
    doseValue: row.dose_value,
    doseUnit: row.dose_unit,
    administrationRoute: row.administration_route,
    phase: row.phase,
    timeValue: row.time_value,
    timeUnit: row.time_unit,
    bodyPart: row.body_part,
    observation: row.observation,
    tags: parseJson(row.tags, []),
    groupName: row.group_name,
    captureStage: row.capture_stage,
    imageType: row.image_type,
    sourcePath: row.source_path,
    captureId: row.capture_id,
    version: row.version,
    attachments: assetAttachments(row),
    ...(management ? {
      revisionStatus: row.revision_status || undefined,
      pendingRevision: row.pending_revision ? {
        ...parseJson(row.pending_revision, {}), revisionStatus: row.revision_status || 'draft',
      } : null,
      pendingAttachments: assetAttachments(row, true),
    } : {}),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    previewUrl: `/api/truth/assets/${row.id}/preview`,
    originalUrl: `/api/truth/assets/${row.id}/original`,
    downloadUrl: `/api/truth/assets/${row.id}/download`,
  };
}

function upsertDrugAliases(metadata) {
  if (!metadata.drugName) return;
  const aliases = [metadata.drugName, ...metadata.drugAliases];
  const statement = db.prepare(`
    INSERT INTO truth_drug_aliases (alias_key, alias, canonical_name, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(alias_key) DO UPDATE SET
      alias = excluded.alias,
      canonical_name = excluded.canonical_name,
      updated_at = excluded.updated_at
  `);
  for (const alias of aliases) {
    statement.run(aliasKey(alias), alias, metadata.drugName, nowIso());
  }
}

export async function createTruthAssets(userId, files, payload = {}) {
  if (!Array.isArray(files) || files.length === 0) throw httpError(400, '请选择图片');
  if (files.length > 100) throw httpError(400, '单批最多上传100张图片');

  const common = payload.common || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const created = [];
  const duplicates = [];
  const failed = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    let originalPath = null;
    let thumbnailPath = null;
    try {
      const buffer = fs.readFileSync(file.path);
      const signature = fileSignature(buffer);
      const extension = path.extname(file.originalname).toLowerCase();
      if (!signature || !['.jpg', '.jpeg', '.png'].includes(extension) || signature.mimeType !== file.mimetype) {
        throw httpError(400, '文件类型与图片内容不一致');
      }
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const existing = db.prepare('SELECT * FROM truth_assets WHERE sha256 = ?').get(sha256);
      if (existing) {
        duplicates.push({ fileName: file.originalname, existing: rowToAsset(existing) });
        continue;
      }

      const metadata = validateMetadata({ ...common, ...(items[index] || {}), status: 'draft' });
      const id = `truth_${crypto.randomUUID()}`;
      const storedName = `${id}${signature.extension}`;
      const thumbnailName = `${id}.jpg`;
      originalPath = path.join(truthOriginalDir, storedName);
      thumbnailPath = path.join(truthThumbnailDir, thumbnailName);

      fs.renameSync(file.path, originalPath);
      await sharp(originalPath)
        .rotate()
        .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(thumbnailPath);

      const timestamp = nowIso();
      db.prepare(`
        INSERT INTO truth_assets (
          id, sha256, original_name, stored_name, thumbnail_name, mime_type, size_bytes,
          batch_code, animal_id, species, strain, sex, drug_name, drug_aliases,
          dose_value, dose_unit, administration_route, phase, time_value, time_unit,
          body_part, observation, tags, status, uploaded_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, sha256, cleanText(file.originalname, 255), storedName, thumbnailName,
        signature.mimeType, file.size, metadata.batchCode, metadata.animalId,
        metadata.species, metadata.strain, metadata.sex, metadata.drugName,
        JSON.stringify(metadata.drugAliases), metadata.doseValue, metadata.doseUnit,
        metadata.administrationRoute, metadata.phase, metadata.timeValue, metadata.timeUnit,
        metadata.bodyPart, metadata.observation, JSON.stringify(metadata.tags),
        metadata.status, userId, timestamp, timestamp,
      );
      writeMetadata(id, metadata, timestamp);
      upsertDrugAliases(metadata);
      created.push(rowToAsset(db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(id), true));
    } catch (error) {
      if (originalPath && fs.existsSync(originalPath)) fs.rmSync(originalPath, { force: true });
      if (thumbnailPath && fs.existsSync(thumbnailPath)) fs.rmSync(thumbnailPath, { force: true });
      failed.push({
        fileName: file.originalname,
        error: error instanceof Error ? error.message : '上传失败',
      });
    } finally {
      if (fs.existsSync(file.path)) fs.rmSync(file.path, { force: true });
    }
  }

  return { created, duplicates, failed };
}

export function listTruthAssets({ status, limit = 100, offset = 0 } = {}) {
  const params = [];
  let where = '';
  if (VALID_STATUSES.has(status)) {
    where = 'WHERE status = ?';
    params.push(status);
  }
  const rows = db.prepare(`
    SELECT * FROM truth_assets
    ${where}
    ORDER BY created_at DESC, id
    LIMIT ? OFFSET ?
  `).all(...params, Math.min(Math.max(Number(limit) || 100, 1), 200), Math.max(Number(offset) || 0, 0));
  return rows.map(row => rowToAsset(row, true));
}

export function countTruthAssets({ status } = {}) {
  return VALID_STATUSES.has(status)
    ? db.prepare('SELECT COUNT(*) AS total FROM truth_assets WHERE status = ?').get(status).total
    : db.prepare('SELECT COUNT(*) AS total FROM truth_assets').get().total;
}

function writeMetadata(id, metadata, timestamp = nowIso()) {
  db.prepare(`
    UPDATE truth_assets SET
      batch_code = ?, animal_id = ?, species = ?, strain = ?, sex = ?,
      drug_name = ?, drug_aliases = ?, dose_value = ?, dose_unit = ?,
      administration_route = ?, phase = ?, time_value = ?, time_unit = ?,
      body_part = ?, observation = ?, tags = ?, group_name = ?, capture_stage = ?,
      image_type = ?, source_path = ?, capture_id = ?, updated_at = ?
    WHERE id = ?
  `).run(
    metadata.batchCode, metadata.animalId, metadata.species, metadata.strain,
    metadata.sex, metadata.drugName, JSON.stringify(metadata.drugAliases),
    metadata.doseValue, metadata.doseUnit, metadata.administrationRoute,
    metadata.phase, metadata.timeValue, metadata.timeUnit, metadata.bodyPart,
    metadata.observation, JSON.stringify(metadata.tags), metadata.groupName, metadata.captureStage,
    metadata.imageType, metadata.sourcePath, metadata.captureId, timestamp, id,
  );
}

export function updateTruthAsset(id, patch = {}) {
  const current = db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(id);
  if (!current) throw httpError(404, '图片不存在');
  const metadata = validateMetadata({
    ...rowToAsset(current), ...parseJson(current.pending_revision, {}), ...patch, status: current.status,
  });
  const timestamp = nowIso();
  if (current.status === 'published' || current.status === 'archived') {
    db.prepare("UPDATE truth_assets SET pending_revision = ?, revision_status = 'draft', updated_at = ? WHERE id = ?")
      .run(JSON.stringify(metadata), timestamp, id);
  } else {
    writeMetadata(id, metadata, timestamp);
  }
  upsertDrugAliases(metadata);
  return rowToAsset(db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(id), true);
}

export function setTruthAssetStatus(id, status) {
  if (!VALID_STATUSES.has(status)) throw httpError(400, '图片状态无效');
  const row = db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(id);
  if (!row) throw httpError(404, '图片不存在');
  const timestamp = nowIso();
  db.exec('BEGIN');
  try {
    if (status === 'pending' && ['published', 'archived'].includes(row.status)) {
      if (!row.pending_revision) throw httpError(400, '没有待提交的修改');
      db.prepare("UPDATE truth_assets SET revision_status = 'pending', updated_at = ? WHERE id = ?").run(timestamp, id);
    } else if (status === 'published') {
      // Store the current live revision before applying an approved replacement.
      const alreadyPublished = db.prepare('SELECT 1 FROM truth_asset_versions WHERE asset_id = ? LIMIT 1').get(id)
        || ['published', 'archived'].includes(row.status);
      if (alreadyPublished) savePublishedVersion(row, timestamp);
      if (row.pending_revision) writeMetadata(id, validateMetadata(parseJson(row.pending_revision, {})), timestamp);
      const version = row.version + (alreadyPublished && row.pending_revision ? 1 : 0);
      db.prepare(`UPDATE truth_assets SET status = 'published', version = ?, pending_revision = NULL,
        revision_status = NULL, updated_at = ?, archived_at = NULL WHERE id = ?`).run(version, timestamp, id);
      db.prepare('UPDATE truth_attachments SET published_version = ? WHERE asset_id = ? AND published_version IS NULL')
        .run(version, id);
      savePublishedVersion(db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(id), timestamp);
    } else {
      if (status === 'draft' && ['published', 'archived'].includes(row.status)) {
        throw httpError(400, '已发布资料请通过修订与审核更新');
      }
      db.prepare('UPDATE truth_assets SET status = ?, updated_at = ?, archived_at = ? WHERE id = ?')
        .run(status, timestamp, status === 'archived' ? timestamp : null, id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return rowToAsset(db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(id), true);
}

function savePublishedVersion(row, timestamp) {
  db.prepare(`INSERT OR IGNORE INTO truth_asset_versions (asset_id, version, asset_snapshot, published_at)
    VALUES (?, ?, ?, ?)`).run(row.id, row.version, JSON.stringify(assetSnapshot(rowToAsset(row))), timestamp);
}

function findCanonicalDrug(query) {
  const normalizedQuery = aliasKey(query);
  // Only released metadata may influence user-facing query interpretation.
  const aliases = db.prepare("SELECT drug_name, drug_aliases FROM truth_assets WHERE status = 'published'").all()
    .flatMap(row => [row.drug_name, ...parseJson(row.drug_aliases, [])].filter(Boolean)
      .map(alias => ({ alias_key: aliasKey(alias), canonical_name: row.drug_name })))
    .sort((a, b) => b.alias_key.length - a.alias_key.length);
  const match = aliases.find(row => normalizedQuery.includes(row.alias_key));
  return match?.canonical_name || null;
}

function chineseNumber(text) {
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  let total = 0;
  let digit = 0;
  for (const char of text) {
    if (char === '十' || char === '百') { total += (digit || 1) * (char === '十' ? 10 : 100); digit = 0; }
    else if (digits[char] !== undefined) digit = digits[char];
    else return null;
  }
  return total + digit;
}

export function parseTruthQuery(query, inputFilter = {}) {
  const text = cleanText(query, 1000);
  const filter = {
    batchCode: cleanOptional(inputFilter.batchCode, 100),
    animalId: cleanOptional(inputFilter.animalId, 100),
    species: cleanOptional(inputFilter.species, 100),
    strain: cleanOptional(inputFilter.strain, 100),
    sex: inputFilter.sex ? normalizeSex(inputFilter.sex) : null,
    drugName: cleanOptional(inputFilter.drugName, 100) || findCanonicalDrug(text),
    phase: inputFilter.phase ? normalizePhase(inputFilter.phase) : null,
    timeValue: normalizeNumber(inputFilter.timeValue),
    timeUnit: inputFilter.timeUnit ? normalizeTimeUnit(inputFilter.timeUnit) : null,
    bodyPart: cleanOptional(inputFilter.bodyPart, 100),
    groupName: cleanOptional(inputFilter.groupName, 100),
    captureStage: cleanOptional(inputFilter.captureStage, 20),
    imageType: cleanOptional(inputFilter.imageType, 20),
  };
  for (const [field, values] of [['sex', VALID_SEXES], ['phase', VALID_PHASES],
    ['timeUnit', VALID_TIME_UNITS], ['captureStage', VALID_CAPTURE_STAGES], ['imageType', VALID_IMAGE_TYPES]]) {
    if (filter[field] && !values.has(filter[field])) throw httpError(400, `${field} 筛选值无效`);
  }
  if (inputFilter.timeValue !== undefined && inputFilter.timeValue !== null && inputFilter.timeValue !== '' && filter.timeValue === null) {
    throw httpError(400, '时间点必须为非负数字');
  }

  const known = availableValues();
  for (const [field, key] of [['batchCode', 'batchCodes'], ['animalId', 'animalIds'],
    ['species', 'species'], ['strain', 'strains'], ['bodyPart', 'bodyParts'], ['groupName', 'groupNames']]) {
    if (filter[field]) continue;
    const matches = known[key].filter(value => value && text.includes(String(value))
      && (field !== 'animalId' || !/^\d+$/.test(String(value)) || new RegExp(`(?:编号|动物|鼠)\\s*[:：#]?\\s*${value}(?!\\d)`).test(text)))
      .sort((a, b) => String(b).length - String(a).length);
    if (matches.length === 1 || (matches[0] && matches.slice(1).every(value => String(matches[0]).includes(String(value))))) {
      filter[field] = matches[0];
    }
  }
  // Named identifiers are strict filters even when the library does not contain them.
  for (const [field, expression] of [['batchCode', /(?:批次|批号)\s*[:：#]?\s*([\w-]+)/i],
    ['animalId', /(?:动物编号|编号)\s*[:：#]?\s*([\w-]+)/i]]) {
    const match = text.match(expression);
    if (!filter[field] && match) filter[field] = match[1];
  }

  if (!filter.sex) {
    if (/(雌鼠|雌性|female)/i.test(text)) filter.sex = 'female';
    else if (/(雄鼠|雄性|male)/i.test(text)) filter.sex = 'male';
  }
  if (!filter.phase) {
    if (/(停药|撤药)/.test(text)) filter.phase = 'withdrawal';
    else if (/给药/.test(text)) filter.phase = 'dosing';
    else if (/对照/.test(text)) filter.phase = 'control';
  }
  if (!filter.groupName) {
    if (/空白组/.test(text)) filter.groupName = '空白组';
    else if (/处理组/.test(text)) filter.groupName = '处理组';
  }
  if (!filter.captureStage) {
    if (/实验前|拍摄前|before/i.test(text)) filter.captureStage = 'before';
    else if (/实验后|拍摄后|after/i.test(text)) filter.captureStage = 'after';
  }
  if (!filter.imageType) {
    if (/热成像|红外|\bIRI\b/i.test(text)) filter.imageType = 'thermal';
    else if (/可见光|\bVIS\b/i.test(text)) filter.imageType = 'visible';
  }

  if (filter.timeValue === null) {
    const timeMatch = text.match(/(?:第\s*)?(\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百]+)\s*(小时|时|天|日)/);
    if (timeMatch) {
      filter.timeValue = chineseNumber(timeMatch[1]);
      filter.timeUnit = ['小时', '时'].includes(timeMatch[2]) ? 'hour' : 'day';
    }
  }
  if (filter.timeValue !== null && !filter.timeUnit) throw httpError(400, '请选择时间单位');

  let remainder = text;
  const consumedValues = Object.entries(filter).filter(([key, value]) => value !== null
    && !['sex', 'phase', 'timeValue', 'timeUnit', 'captureStage', 'imageType'].includes(key));
  for (const [, value] of consumedValues.sort((a, b) => String(b[1]).length - String(a[1]).length)) {
    remainder = remainder.split(String(value)).join(' ');
  }
  if (filter.drugName) {
    const rows = db.prepare("SELECT drug_aliases FROM truth_assets WHERE drug_name = ? AND status = 'published'").all(filter.drugName);
    for (const alias of rows.flatMap(row => parseJson(row.drug_aliases, []))) remainder = remainder.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  remainder = remainder
    .replace(/(?:第\s*)?(?:\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百]+)\s*(?:小时|时|天|日)/g, ' ')
    .replace(/雌鼠|雄鼠|雌性|雄性|female|male|停药后?|撤药后?|给药阶段|给药|对照组?|实验前|实验后|拍摄前|拍摄后|before|after|热成像|红外|可见光|\bIRI\b|\bVIS\b/gi, ' ')
    .replace(/动物编号|批次|批号|编号|图片|照片|图像|资料|图库|查看|全部|所有|帮我|请|找到|找出|查询|检索|看看|显示|搜索|的|中|下/g, ' ')
    .replace(/[\s,，。；;:：#、()（）]+/g, ' ').trim();
  const unrecognized = remainder ? remainder.split(' ') : [];
  const warnings = unrecognized.length ? [`尚未确认的检索内容：${unrecognized.join('、')}。请补充或调整筛选条件。`] : [];
  const stated = [
    ['sex', '性别', [[/雌鼠|雌性|female/i, 'female'], [/雄鼠|雄性|\bmale\b/i, 'male']]],
    ['phase', '实验阶段', [[/给药/, 'dosing'], [/停药|撤药/, 'withdrawal']]],
    ['captureStage', '实验前后', [[/实验前|before/i, 'before'], [/实验后|after/i, 'after']]],
    ['imageType', '图片类型', [[/热成像|红外|\bIRI\b/i, 'thermal'], [/可见光|\bVIS\b/i, 'visible']]],
  ];
  for (const [field, label, candidates] of stated) {
    const requested = candidates.filter(([pattern]) => pattern.test(text)).map(([, value]) => value);
    if (requested.length > 1 || (requested.length && inputFilter[field] && !requested.includes(filter[field]))) {
      warnings.push(`${label}包含多个或相互冲突的条件；当前仅应用上方显示的筛选，请确认后分别检索。`);
    }
  }
  const timeMentions = [...text.matchAll(/(?:第\s*)?(\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百]+)\s*(小时|时|天|日)/g)]
    .map(match => `${chineseNumber(match[1])}:${['小时', '时'].includes(match[2]) ? 'hour' : 'day'}`);
  if (new Set(timeMentions).size > 1 || (timeMentions.length && inputFilter.timeValue != null && !timeMentions.includes(`${filter.timeValue}:${filter.timeUnit}`))) {
    warnings.push('描述中的时间点存在多个值或与筛选不同，请确认当前应用的时间后分别检索。');
  }

  const clarification = filter.timeValue !== null && !filter.phase
    ? {
        field: 'phase',
        message: `“${filter.timeValue}${filter.timeUnit === 'hour' ? '小时' : '天'}”属于给药阶段还是停药后？`,
        options: [
          { value: 'dosing', label: '给药阶段' },
          { value: 'withdrawal', label: '停药后' },
        ],
      }
    : null;

  return {
    query: text, filter, clarification,
    recognizedConditions: Object.entries(filter).filter(([, value]) => value !== null).map(([field, value]) => ({ field, value })),
    unrecognized, unrecognizedTerms: unrecognized, warnings,
  };
}

function availableValues() {
  const rows = db.prepare(`
    SELECT drug_name, phase, time_value, time_unit, sex, batch_code, species, strain, body_part,
      group_name, capture_stage, image_type, animal_id
    FROM truth_assets WHERE status = 'published'
  `).all();
  const distinct = key => [...new Set(rows.map(row => row[key]).filter(value => value !== null && value !== ''))];
  return {
    drugNames: distinct('drug_name'),
    phases: distinct('phase'),
    sexes: distinct('sex'),
    batchCodes: distinct('batch_code'),
    species: distinct('species'),
    strains: distinct('strain'),
    bodyParts: distinct('body_part'),
    groupNames: distinct('group_name'),
    captureStages: distinct('capture_stage'),
    imageTypes: distinct('image_type'),
    animalIds: distinct('animal_id'),
    timePoints: [...new Set(rows
      .filter(row => row.time_value !== null && row.time_unit)
      .map(row => `${row.phase}:${row.time_value}:${row.time_unit}`))],
  };
}

export function searchTruthAssets(query, inputFilter = {}, pagination = {}) {
  return searchLibrary(query, inputFilter, pagination, false);
}

export function listTruthLibrary({ query = '', limit = 48, offset = 0, ...filter } = {}) {
  return searchLibrary(query, filter, { limit, offset }, true);
}

function searchLibrary(query, inputFilter, pagination, browse) {
  const parsed = parseTruthQuery(query, inputFilter);
  const limit = Math.min(200, Math.max(1, Math.floor(Number(pagination.limit) || (browse ? 48 : 200))));
  const offset = Math.max(0, Math.floor(Number(pagination.offset) || 0));
  const base = { ...parsed, limit, offset, availableValues: availableValues() };
  if (parsed.clarification) {
    return { ...base, assets: [], total: 0, hasMore: false };
  }
  const hasFilter = Object.values(parsed.filter).some(
    value => value !== null && value !== undefined && value !== '',
  );
  if (!hasFilter && (!browse || parsed.unrecognized.length)) {
    return { ...base, assets: [], total: 0, hasMore: false };
  }

  const clauses = ["status = 'published'"];
  const params = [];
  const columns = {
    batchCode: 'batch_code',
    animalId: 'animal_id',
    species: 'species',
    strain: 'strain',
    sex: 'sex',
    drugName: 'drug_name',
    phase: 'phase',
    timeValue: 'time_value',
    timeUnit: 'time_unit',
    bodyPart: 'body_part',
    groupName: 'group_name',
    captureStage: 'capture_stage',
    imageType: 'image_type',
  };
  for (const [key, column] of Object.entries(columns)) {
    const value = parsed.filter[key];
    if (value === null || value === undefined || value === '') continue;
    clauses.push(`${column} = ?`);
    params.push(value);
  }

  const rows = db.prepare(`
    SELECT * FROM truth_assets
    WHERE ${clauses.join(' AND ')}
    ORDER BY batch_code, group_name, sex, animal_id, phase, time_value, capture_stage, created_at, id
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) AS total FROM truth_assets WHERE ${clauses.join(' AND ')}`).get(...params).total;
  return {
    ...base,
    assets: rows.map(row => rowToAsset(row)),
    total, hasMore: offset + rows.length < total,
  };
}

export async function createTruthAttachments(userId, assetId, files, payload = {}) {
  const asset = db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(assetId);
  if (!asset) throw httpError(404, '图片不存在');
  if (!Array.isArray(files) || !files.length || files.length > 100) throw httpError(400, '请选择 1–100 份 PDF 附件');
  const result = { created: [], duplicates: [], failed: [] };
  for (const [index, file] of files.entries()) {
    let storedPath;
    try {
      const content = fs.readFileSync(file.path);
      if (file.mimetype !== 'application/pdf' || path.extname(file.originalname).toLowerCase() !== '.pdf'
        || content.subarray(0, 5).toString('ascii') !== '%PDF-' || !content.subarray(-4096).includes(Buffer.from('%%EOF'))) {
        throw httpError(400, '附件必须是有效的 PDF 文件');
      }
      if (content.length > 64 * 1024 * 1024) throw httpError(400, '附件不能超过 64 MB');
      const sourcePath = relativeSourcePath(payload.sourcePaths?.[index] ?? payload.sourcePath);
      const sha256 = crypto.createHash('sha256').update(content).digest('hex');
      const duplicate = db.prepare('SELECT * FROM truth_attachments WHERE asset_id = ? AND sha256 = ?').get(assetId, sha256);
      if (duplicate) { result.duplicates.push({ fileName: file.originalname, existing: rowToAttachment(duplicate) }); continue; }
      const id = `truth_attachment_${crypto.randomUUID()}`;
      const storedName = `${id}.pdf`;
      storedPath = path.join(truthAttachmentDir, storedName);
      fs.renameSync(file.path, storedPath);
      db.exec('BEGIN');
      try {
        db.prepare(`INSERT INTO truth_attachments
          (id, asset_id, sha256, original_name, stored_name, size_bytes, source_path, uploaded_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, assetId, sha256, cleanText(file.originalname, 255),
          storedName, content.length, sourcePath, userId, nowIso());
        if (['published', 'archived'].includes(asset.status)) {
          const current = db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(assetId);
          const metadata = parseJson(current.pending_revision, null) || validateMetadata(rowToAsset(current));
          db.prepare("UPDATE truth_assets SET pending_revision = ?, revision_status = 'draft', updated_at = ? WHERE id = ?")
            .run(JSON.stringify(metadata), nowIso(), assetId);
        }
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      result.created.push(rowToAttachment(db.prepare('SELECT * FROM truth_attachments WHERE id = ?').get(id)));
    } catch (error) {
      if (storedPath && fs.existsSync(storedPath)) fs.rmSync(storedPath, { force: true });
      result.failed.push({ fileName: file.originalname, error: error.message || '附件上传失败' });
    } finally {
      if (fs.existsSync(file.path)) fs.rmSync(file.path, { force: true });
    }
  }
  return result;
}

// Used by the isolated source importer before publication. A folder PDF is stored once
// and linked only to draft images in the exact same source directory.
export function linkTruthAttachmentToDraftAssets(attachmentId, assetIds) {
  const attachment = db.prepare('SELECT * FROM truth_attachments WHERE id = ?').get(attachmentId);
  if (!attachment || attachment.published_version !== null || !attachment.source_path) {
    throw httpError(400, '附件不处于可关联的草稿状态');
  }
  const owner = db.prepare('SELECT status, source_path FROM truth_assets WHERE id = ?').get(attachment.asset_id);
  const directory = path.posix.dirname(attachment.source_path);
  if (owner?.status !== 'draft' || !owner.source_path || path.posix.dirname(owner.source_path) !== directory) {
    throw httpError(400, '附件与主图片不在同一草稿目录');
  }
  const targets = [...new Set(assetIds)];
  if (!targets.length || targets.length > 1000) throw httpError(400, '关联图片数量无效');
  for (const id of targets) {
    const asset = db.prepare('SELECT status, source_path FROM truth_assets WHERE id = ?').get(id);
    if (asset?.status !== 'draft' || !asset.source_path || path.posix.dirname(asset.source_path) !== directory) {
      throw httpError(400, '只能关联同目录的草稿图片');
    }
  }
  db.exec('BEGIN');
  try {
    const insert = db.prepare('INSERT OR IGNORE INTO truth_attachment_assets (attachment_id, asset_id) VALUES (?, ?)');
    for (const id of targets) if (id !== attachment.asset_id) insert.run(attachmentId, id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return targets.length;
}

export function getTruthAttachmentFile(id, user) {
  const attachment = db.prepare('SELECT * FROM truth_attachments WHERE id = ?').get(id);
  if (!attachment) throw httpError(404, '附件不存在');
  const asset = db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(attachment.asset_id);
  let allowed = hasPermission(user, 'truth.assets.edit');
  if (!allowed && attachment.published_version !== null) {
    // A peer may expose only files whose original owner has been published.
    allowed = asset.status === 'published';
    if (!allowed && user) {
      const snapshots = db.prepare(`SELECT ra.asset_snapshot FROM truth_report_assets ra
        JOIN truth_reports r ON r.id = ra.report_id WHERE r.user_id = ?`).all(user.id);
      allowed = snapshots.some(row => parseJson(row.asset_snapshot, {}).attachments?.some(item => item.id === id));
    }
  }
  if (!allowed) throw httpError(404, '附件不存在');
  const resolvedRoot = path.resolve(truthAttachmentDir);
  const filePath = path.resolve(truthAttachmentDir, attachment.stored_name);
  if (!filePath.startsWith(`${resolvedRoot}${path.sep}`) || !fs.existsSync(filePath)) {
    throw httpError(404, '附件文件不存在');
  }
  return { filePath, mimeType: attachment.mime_type, downloadName: attachment.original_name };
}

export function getTruthAssetFile(id, variant, user) {
  const row = db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(id);
  if (!row) throw httpError(404, '图片不存在');
  const reportAccess = user
    ? db.prepare(`
        SELECT 1 FROM truth_report_assets ra
        JOIN truth_reports r ON r.id = ra.report_id
        WHERE ra.asset_id = ? AND r.user_id = ? LIMIT 1
      `).get(id, user.id)
    : null;
  if (row.status !== 'published' && !hasPermission(user, 'truth.assets.edit') && !reportAccess) {
    throw httpError(404, '图片不存在');
  }
  const thumbnail = variant === 'preview';
  const filePath = path.join(
    thumbnail ? truthThumbnailDir : truthOriginalDir,
    thumbnail ? row.thumbnail_name : row.stored_name,
  );
  const resolvedRoot = path.resolve(thumbnail ? truthThumbnailDir : truthOriginalDir);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(`${resolvedRoot}${path.sep}`) || !fs.existsSync(resolvedFile)) {
    throw httpError(404, '图片文件不存在');
  }
  return {
    asset: rowToAsset(row),
    filePath: resolvedFile,
    mimeType: thumbnail ? 'image/jpeg' : row.mime_type,
    downloadName: row.original_name,
  };
}

function assetSnapshot(asset) {
  const {
    id, originalName, batchCode, animalId, species, strain, sex, drugName,
    drugAliases, doseValue, doseUnit, administrationRoute, phase, timeValue,
    timeUnit, bodyPart, observation, tags, createdAt, groupName, captureStage,
    imageType, sourcePath, captureId, version, attachments,
  } = asset;
  return {
    id, originalName, batchCode, animalId, species, strain, sex, drugName,
    drugAliases, doseValue, doseUnit, administrationRoute, phase, timeValue,
    timeUnit, bodyPart, observation, tags, createdAt, groupName, captureStage,
    imageType, sourcePath, captureId, version, attachments,
  };
}

function fallbackReportContent(assets) {
  const lines = [
    '本报告依据系统中已发布的热成像图片及管理员录入的实验元数据生成。',
    '',
    `本次共选取 ${assets.length} 张图片，涉及批次：${[...new Set(assets.map(item => item.batchCode))].join('、')}。`,
    '',
    '图片记录：',
  ];
  assets.forEach((asset, index) => {
    const phase = phaseLabel(asset.phase);
    const time = asset.timeValue === null ? '' : `${asset.timeValue}${asset.timeUnit === 'hour' ? '小时' : '天'}`;
    lines.push(
      `${index + 1}. ${asset.drugName || '未记录药物'}，${phase}${time ? ` ${time}` : ''}，`
      + `${asset.sex === 'female' ? '雌性' : asset.sex === 'male' ? '雄性' : '性别未知'}，`
      + `动物编号 ${asset.animalId || '未记录'}。${asset.observation ? `人工观察：${asset.observation}` : ''}`,
    );
  });
  lines.push('', '说明：本报告不包含自动温度提取、热区识别、医学诊断或科研结论。');
  return lines.join('\n');
}

async function generateReportContent(userId, title, queryText, filter, assets) {
  const selectedIds = new Set(assets.map(asset => asset.id));
  try {
    const response = await chatCompletion(userId, [
      {
        role: 'system',
        content: [
          '你是科研资料整理助手。只能依据提供的热成像图片元数据和管理员人工观察撰写中文记录报告。',
          '不得推断温度、热区、疗效、病理、医学诊断或科研结论。',
          '不得补充输入中不存在的实验事实。',
          '报告应包含：检索条件、资料概览、逐图记录、限制说明。',
          '逐图记录只能使用提供的图片ID。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          title,
          queryText,
          filter,
          assets: assets.map(assetSnapshot),
        }),
      },
    ], { stream: false, temperature: 0.2, maxTokens: 1800 });
    const content = await extractContent(response);
    const referencedIds = content.match(/truth_[0-9a-f-]+/gi) || [];
    if (!content || referencedIds.some(id => !selectedIds.has(id))) throw new Error('报告引用了未选择的图片');
    return content;
  } catch {
    return fallbackReportContent(assets);
  }
}

function rowToReport(row, snapshots = []) {
  return {
    id: row.id,
    title: row.title,
    queryText: row.query_text,
    filter: parseJson(row.filter_snapshot, {}),
    content: row.content,
    modelInfo: parseJson(row.model_info, {}),
    assets: snapshots,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createTruthReport(userId, payload = {}) {
  const assetIds = [...new Set(
    (Array.isArray(payload.assetIds) ? payload.assetIds : [])
      .map(id => cleanText(id, 100))
      .filter(Boolean),
  )].slice(0, MAX_REPORT_ASSETS);
  if (assetIds.length === 0) throw httpError(400, '请至少选择一张图片');
  const placeholders = assetIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT * FROM truth_assets
    WHERE status = 'published' AND id IN (${placeholders})
  `).all(...assetIds);
  if (rows.length !== assetIds.length) throw httpError(400, '部分图片不存在或不可用于报告');
  if (payload.assetVersions && rows.some(row => payload.assetVersions[row.id] !== row.version)) {
    throw httpError(409, '资料已更新，请重新选择图片后生成报告');
  }
  const byId = new Map(rows.map(row => [row.id, rowToAsset(row)]));
  const assets = assetIds.map(id => byId.get(id));
  const title = cleanText(payload.title || '热成像资料求真报告', 120);
  const queryText = cleanOptional(payload.queryText, 1000);
  const filter = parseTruthQuery('', payload.filter && typeof payload.filter === 'object' ? payload.filter : {}).filter;
  const content = await generateReportContent(userId, title, queryText, filter, assets);
  const modelInfo = getAiConfigStatus(userId);
  const id = `truth_report_${crypto.randomUUID()}`;
  const timestamp = nowIso();

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO truth_reports (
        id, user_id, title, query_text, filter_snapshot, content, model_info, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, userId, title, queryText, JSON.stringify(filter), content,
      JSON.stringify({ mode: modelInfo.mode, model: modelInfo.model || 'platform' }),
      timestamp, timestamp,
    );
    const insertReference = db.prepare(`
      INSERT INTO truth_report_assets (report_id, asset_id, position, asset_snapshot)
      VALUES (?, ?, ?, ?)
    `);
    assets.forEach((asset, index) => {
      insertReference.run(id, asset.id, index, JSON.stringify(assetSnapshot(asset)));
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return getTruthReport(userId, id);
}

export function listTruthReports(userId) {
  return db.prepare(`
    SELECT r.*, COUNT(ra.asset_id) AS asset_count
    FROM truth_reports r
    LEFT JOIN truth_report_assets ra ON ra.report_id = r.id
    WHERE r.user_id = ?
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `).all(userId).map(row => ({ ...rowToReport(row), assetCount: row.asset_count }));
}

export function getTruthReport(userId, id) {
  const row = db.prepare('SELECT * FROM truth_reports WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) throw httpError(404, '报告不存在');
  const snapshots = db.prepare(`
    SELECT asset_snapshot FROM truth_report_assets
    WHERE report_id = ? ORDER BY position
  `).all(id).map(item => parseJson(item.asset_snapshot, {}));
  return rowToReport(row, snapshots);
}

function resolvePdfFont() {
  const candidates = [
    process.env.TRUTH_PDF_FONT_PATH,
    'C:\\Windows\\Fonts\\NotoSansSC-VF.ttf',
    'C:\\Windows\\Fonts\\msyh.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function phaseLabel(phase) {
  if (phase === 'dosing') return '给药阶段';
  if (phase === 'withdrawal') return '停药后';
  return phase === 'control' ? '对照阶段' : '未记录阶段';
}

export function streamTruthReportPdf(userId, id, response) {
  const report = getTruthReport(userId, id);
  const document = new PDFDocument({ size: 'A4', margin: 42, info: { Title: report.title } });
  const font = resolvePdfFont();
  if (font) document.font(font);
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="truth-report-${id}.pdf"`);
  document.pipe(response);

  document.fontSize(20).text(report.title);
  document.moveDown(0.5).fontSize(9).fillColor('#64748b').text(`生成时间：${report.createdAt}`);
  document.moveDown().fillColor('#111827').fontSize(11).text(report.content, { lineGap: 4 });

  for (let index = 0; index < report.assets.length; index += 1) {
    const snapshot = report.assets[index];
    const file = db.prepare('SELECT stored_name FROM truth_assets WHERE id = ?').get(snapshot.id);
    if (!file) continue;
    const imagePath = path.join(truthOriginalDir, file.stored_name);
    if (!fs.existsSync(imagePath)) continue;
    document.addPage();
    document.fontSize(15).fillColor('#111827').text(`图片 ${index + 1}`);
    document.moveDown(0.5);
    try {
      document.image(imagePath, { fit: [510, 500], align: 'center', valign: 'center' });
      document.moveDown();
    } catch {
      document.fontSize(10).fillColor('#b91c1c').text('原图暂时无法嵌入。');
    }
    document.fontSize(10).fillColor('#111827').text([
      `图片ID：${snapshot.id}`,
      `批次：${snapshot.batchCode}`,
      `动物编号：${snapshot.animalId || '未记录'}`,
      `物种/品系：${snapshot.species}${snapshot.strain ? ` / ${snapshot.strain}` : ''}`,
      `性别：${snapshot.sex === 'female' ? '雌性' : snapshot.sex === 'male' ? '雄性' : '未知'}`,
      `药物：${snapshot.drugName || '未记录'}`,
      `阶段：${phaseLabel(snapshot.phase)}${snapshot.timeValue === null ? '' : ` ${snapshot.timeValue}${snapshot.timeUnit === 'hour' ? '小时' : '天'}`}`,
      `人工观察：${snapshot.observation || '无'}`,
    ].join('\n'), { lineGap: 3 });
  }
  document.end();
}
