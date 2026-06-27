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

for (const directory of [truthOriginalDir, truthThumbnailDir, truthTempDir]) {
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
const VALID_PHASES = new Set(['control', 'dosing', 'withdrawal']);
const VALID_SEXES = new Set(['female', 'male', 'unknown']);
const VALID_TIME_UNITS = new Set(['hour', 'day']);
const MAX_REPORT_ASSETS = 30;

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
    status: VALID_STATUSES.has(input.status) ? input.status : 'draft',
  };

  if (!metadata.batchCode) throw httpError(400, '实验批次不能为空');
  if (!metadata.species) throw httpError(400, '物种不能为空');
  if (!VALID_SEXES.has(metadata.sex)) throw httpError(400, '性别字段无效');
  if (!VALID_PHASES.has(metadata.phase)) throw httpError(400, '实验阶段无效');
  if (metadata.phase !== 'control' && metadata.timeValue === null) {
    throw httpError(400, '给药或停药阶段必须填写时间点');
  }
  if (metadata.timeValue !== null && !VALID_TIME_UNITS.has(metadata.timeUnit)) {
    throw httpError(400, '时间单位无效');
  }
  if (metadata.phase === 'control') {
    metadata.timeValue = null;
    metadata.timeUnit = null;
  }
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

function rowToAsset(row) {
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

      const metadata = validateMetadata({ ...common, ...(items[index] || {}) });
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
      upsertDrugAliases(metadata);
      created.push(rowToAsset(db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(id)));
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
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Math.min(Math.max(Number(limit) || 100, 1), 200), Math.max(Number(offset) || 0, 0));
  return rows.map(rowToAsset);
}

export function updateTruthAsset(id, patch = {}) {
  const current = db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(id);
  if (!current) throw httpError(404, '图片不存在');
  const metadata = validateMetadata({
    ...rowToAsset(current),
    ...patch,
    status: current.status,
  });
  const timestamp = nowIso();
  db.prepare(`
    UPDATE truth_assets SET
      batch_code = ?, animal_id = ?, species = ?, strain = ?, sex = ?,
      drug_name = ?, drug_aliases = ?, dose_value = ?, dose_unit = ?,
      administration_route = ?, phase = ?, time_value = ?, time_unit = ?,
      body_part = ?, observation = ?, tags = ?, updated_at = ?
    WHERE id = ?
  `).run(
    metadata.batchCode, metadata.animalId, metadata.species, metadata.strain,
    metadata.sex, metadata.drugName, JSON.stringify(metadata.drugAliases),
    metadata.doseValue, metadata.doseUnit, metadata.administrationRoute,
    metadata.phase, metadata.timeValue, metadata.timeUnit, metadata.bodyPart,
    metadata.observation, JSON.stringify(metadata.tags), timestamp, id,
  );
  upsertDrugAliases(metadata);
  return rowToAsset(db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(id));
}

export function setTruthAssetStatus(id, status) {
  if (!VALID_STATUSES.has(status)) throw httpError(400, '图片状态无效');
  const row = db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(id);
  if (!row) throw httpError(404, '图片不存在');
  const timestamp = nowIso();
  db.prepare(`
    UPDATE truth_assets
    SET status = ?, updated_at = ?, archived_at = ?
    WHERE id = ?
  `).run(status, timestamp, status === 'archived' ? timestamp : null, id);
  return rowToAsset(db.prepare('SELECT * FROM truth_assets WHERE id = ?').get(id));
}

function findCanonicalDrug(query) {
  const normalizedQuery = aliasKey(query);
  const aliases = db.prepare('SELECT * FROM truth_drug_aliases ORDER BY length(alias_key) DESC').all();
  const match = aliases.find(row => normalizedQuery.includes(row.alias_key));
  return match?.canonical_name || null;
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
  };

  if (!filter.sex) {
    if (/(雌鼠|雌性|female)/i.test(text)) filter.sex = 'female';
    else if (/(雄鼠|雄性|male)/i.test(text)) filter.sex = 'male';
  }
  if (!filter.phase) {
    if (/(停药|撤药)/.test(text)) filter.phase = 'withdrawal';
    else if (/给药/.test(text)) filter.phase = 'dosing';
    else if (/对照/.test(text)) filter.phase = 'control';
  }

  if (filter.timeValue === null) {
    const timeMatch = text.match(/(?:第\s*)?(\d+(?:\.\d+)?)\s*(小时|时|天|日)/);
    if (timeMatch) {
      filter.timeValue = Number(timeMatch[1]);
      filter.timeUnit = ['小时', '时'].includes(timeMatch[2]) ? 'hour' : 'day';
    }
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

  return { query: text, filter, clarification };
}

function availableValues() {
  const rows = db.prepare(`
    SELECT drug_name, phase, time_value, time_unit, sex, batch_code, species, strain, body_part
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
    timePoints: [...new Set(rows
      .filter(row => row.time_value !== null && row.time_unit)
      .map(row => `${row.phase}:${row.time_value}:${row.time_unit}`))],
  };
}

export function searchTruthAssets(query, inputFilter = {}) {
  const parsed = parseTruthQuery(query, inputFilter);
  if (parsed.clarification) {
    return { ...parsed, assets: [], total: 0, availableValues: availableValues() };
  }
  const hasFilter = Object.values(parsed.filter).some(
    value => value !== null && value !== undefined && value !== '',
  );
  if (!hasFilter) {
    return { ...parsed, assets: [], total: 0, availableValues: availableValues() };
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
    ORDER BY batch_code, time_value, animal_id, created_at
    LIMIT 200
  `).all(...params);
  return {
    ...parsed,
    assets: rows.map(rowToAsset),
    total: rows.length,
    availableValues: rows.length === 0 ? availableValues() : undefined,
  };
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
    timeUnit, bodyPart, observation, tags, createdAt,
  } = asset;
  return {
    id, originalName, batchCode, animalId, species, strain, sex, drugName,
    drugAliases, doseValue, doseUnit, administrationRoute, phase, timeValue,
    timeUnit, bodyPart, observation, tags, createdAt,
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
    const phase = asset.phase === 'dosing' ? '给药阶段' : asset.phase === 'withdrawal' ? '停药后' : '对照组';
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
  return '对照组';
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
