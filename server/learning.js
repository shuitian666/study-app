import crypto from 'node:crypto';
import { db, nowIso } from './db.js';

const CONTENT_TABLES = {
  subjects: 'user_subjects',
  chapters: 'user_chapters',
  knowledgePoints: 'user_knowledge_points',
  questions: 'user_questions',
};

const PROGRESS_TABLES = {
  progress: 'user_learning_progress',
  wrongRecords: 'user_wrong_records',
  questionExplanations: 'user_question_explanations',
  importHistory: 'user_import_history',
};

const ALL_TABLES = { ...CONTENT_TABLES, ...PROGRESS_TABLES };

function safeJson(value, fallback = {}) {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeSourceType(value, fallback = 'manual') {
  return ['manual', 'local-import', 'cloud-import'].includes(value) ? value : fallback;
}

function recordUpdatedAt(record, fallback = nowIso()) {
  return String(record?.updatedAt || record?.updated_at || record?.createdAt || record?.created_at || fallback);
}

function recordDeletedAt(record) {
  const deletedAt = record?.deletedAt ?? record?.deleted_at ?? null;
  return deletedAt ? String(deletedAt) : null;
}

function makePayload(record, userId, tableKey, timestamp) {
  return {
    ...record,
    id: String(record.id),
    ownerUserId: record.ownerUserId || userId,
    sourceType: normalizeSourceType(record.sourceType || record.source_type, tableKey === 'importHistory' ? 'local-import' : 'manual'),
    updatedAt: recordUpdatedAt(record, timestamp),
    deletedAt: recordDeletedAt(record),
  };
}

function getRecordId(record, prefix) {
  return String(record?.id || `${prefix}_${crypto.randomUUID()}`);
}

function getStorageId(userId, recordId) {
  return `${userId}:${recordId}`;
}

function rowToPayload(row) {
  const payload = safeJson(row.payload);
  return {
    ...payload,
    id: payload.id || row.id,
    ownerUserId: row.user_id,
    sourceType: row.source_type || payload.sourceType || 'manual',
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function listRecords(userId, table) {
  const records = db.prepare(`
    SELECT * FROM ${table}
    WHERE user_id = ?
    ORDER BY updated_at ASC
  `).all(userId).map(rowToPayload);

  const latestByClientId = new Map();
  for (const record of records) {
    const previous = latestByClientId.get(record.id);
    if (!previous || String(record.updatedAt) >= String(previous.updatedAt)) {
      latestByClientId.set(record.id, record);
    }
  }

  return [...latestByClientId.values()].sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
}

function shouldApplyIncoming(existing, incomingUpdatedAt) {
  if (!existing) return true;
  return String(incomingUpdatedAt) >= String(existing.updated_at);
}

function getExistingRecord(userId, table, storageId, legacyId) {
  return db.prepare(`
    SELECT * FROM ${table}
    WHERE user_id = ? AND id IN (?, ?)
    ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
    LIMIT 1
  `).get(userId, storageId, legacyId, storageId);
}

function migrateLegacyStorageId(userId, table, storageId, legacyId) {
  if (storageId === legacyId) return;
  const storageRow = db.prepare(`SELECT id FROM ${table} WHERE user_id = ? AND id = ?`).get(userId, storageId);
  if (storageRow) return;
  db.prepare(`UPDATE ${table} SET id = ? WHERE user_id = ? AND id = ?`).run(storageId, userId, legacyId);
}

function upsertRecord(userId, tableKey, rawRecord, options = {}) {
  if (!rawRecord || typeof rawRecord !== 'object') return null;

  const table = ALL_TABLES[tableKey];
  if (!table) {
    const err = new Error(`Unsupported learning table: ${tableKey}`);
    err.status = 400;
    throw err;
  }

  const timestamp = options.timestamp || nowIso();
  const id = getRecordId(rawRecord, tableKey);
  const storageId = getStorageId(userId, id);
  const normalizedImportId = rawRecord.importId || rawRecord.import_id || options.importId || null;
  const record = { ...rawRecord, id, ...(normalizedImportId ? { importId: normalizedImportId } : {}) };
  const updatedAt = recordUpdatedAt(record, timestamp);
  const deletedAt = recordDeletedAt(record);
  const sourceType = normalizeSourceType(record.sourceType || record.source_type, tableKey === 'importHistory' ? 'local-import' : options.sourceType || 'manual');
  const payload = makePayload({ ...record, sourceType, updatedAt, deletedAt }, userId, tableKey, timestamp);
  let existing = getExistingRecord(userId, table, storageId, id);
  if (existing && existing.id !== storageId) {
    migrateLegacyStorageId(userId, table, storageId, id);
    existing = getExistingRecord(userId, table, storageId, id);
  }

  if (!shouldApplyIncoming(existing, updatedAt)) {
    return getExistingRecord(userId, table, storageId, id);
  }

  if (tableKey === 'subjects') {
    db.prepare(`
      INSERT INTO user_subjects (id, user_id, source_type, payload, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_type = excluded.source_type,
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
      WHERE user_subjects.user_id = excluded.user_id AND excluded.updated_at >= user_subjects.updated_at
    `).run(storageId, userId, sourceType, JSON.stringify(payload), record.createdAt || timestamp, updatedAt, deletedAt);
  } else if (tableKey === 'chapters') {
    db.prepare(`
      INSERT INTO user_chapters (id, user_id, subject_id, source_type, payload, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        subject_id = excluded.subject_id,
        source_type = excluded.source_type,
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
      WHERE user_chapters.user_id = excluded.user_id AND excluded.updated_at >= user_chapters.updated_at
    `).run(storageId, userId, record.subjectId || record.subject_id || null, sourceType, JSON.stringify(payload), record.createdAt || timestamp, updatedAt, deletedAt);
  } else if (tableKey === 'knowledgePoints') {
    db.prepare(`
      INSERT INTO user_knowledge_points (id, user_id, subject_id, chapter_id, import_id, source_type, payload, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        subject_id = excluded.subject_id,
        chapter_id = excluded.chapter_id,
        import_id = excluded.import_id,
        source_type = excluded.source_type,
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
      WHERE user_knowledge_points.user_id = excluded.user_id AND excluded.updated_at >= user_knowledge_points.updated_at
    `).run(
      storageId,
      userId,
      record.subjectId || record.subject_id || null,
      record.chapterId || record.chapter_id || null,
      record.importId || record.import_id || options.importId || null,
      sourceType,
      JSON.stringify(payload),
      record.createdAt || timestamp,
      updatedAt,
      deletedAt,
    );
  } else if (tableKey === 'questions') {
    db.prepare(`
      INSERT INTO user_questions (id, user_id, knowledge_point_id, import_id, source_type, payload, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        knowledge_point_id = excluded.knowledge_point_id,
        import_id = excluded.import_id,
        source_type = excluded.source_type,
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
      WHERE user_questions.user_id = excluded.user_id AND excluded.updated_at >= user_questions.updated_at
    `).run(
      storageId,
      userId,
      record.knowledgePointId || record.knowledge_point_id || null,
      record.importId || record.import_id || options.importId || null,
      sourceType,
      JSON.stringify(payload),
      record.createdAt || timestamp,
      updatedAt,
      deletedAt,
    );
  } else if (tableKey === 'progress') {
    const knowledgePointId = record.knowledgePointId || record.knowledge_point_id || id;
    db.prepare(`
      INSERT INTO user_learning_progress (id, user_id, knowledge_point_id, payload, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, knowledge_point_id) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
      WHERE excluded.updated_at >= user_learning_progress.updated_at
    `).run(storageId, userId, knowledgePointId, JSON.stringify(payload), record.createdAt || timestamp, updatedAt, deletedAt);
  } else if (tableKey === 'wrongRecords') {
    db.prepare(`
      INSERT INTO user_wrong_records (id, user_id, question_id, payload, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        question_id = excluded.question_id,
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
      WHERE user_wrong_records.user_id = excluded.user_id AND excluded.updated_at >= user_wrong_records.updated_at
    `).run(storageId, userId, record.questionId || record.question_id || id, JSON.stringify(payload), record.createdAt || timestamp, updatedAt, deletedAt);
  } else if (tableKey === 'questionExplanations') {
    const questionId = record.questionId || record.question_id || id;
    db.prepare(`
      INSERT INTO user_question_explanations (id, user_id, question_id, payload, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, question_id) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
      WHERE excluded.updated_at >= user_question_explanations.updated_at
    `).run(storageId, userId, questionId, JSON.stringify(payload), record.createdAt || timestamp, updatedAt, deletedAt);
  } else if (tableKey === 'importHistory') {
    db.prepare(`
      INSERT INTO user_import_history (id, user_id, source_type, payload, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_type = excluded.source_type,
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
      WHERE user_import_history.user_id = excluded.user_id AND excluded.updated_at >= user_import_history.updated_at
    `).run(storageId, userId, sourceType, JSON.stringify(payload), record.createdAt || timestamp, updatedAt, deletedAt);
  }

  return db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(storageId, userId);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function getLearningBootstrap(userId) {
  const payload = {
    subjects: listRecords(userId, CONTENT_TABLES.subjects),
    chapters: listRecords(userId, CONTENT_TABLES.chapters),
    knowledgePoints: listRecords(userId, CONTENT_TABLES.knowledgePoints),
    questions: listRecords(userId, CONTENT_TABLES.questions),
    progress: listRecords(userId, PROGRESS_TABLES.progress),
    wrongRecords: listRecords(userId, PROGRESS_TABLES.wrongRecords),
    questionExplanations: listRecords(userId, PROGRESS_TABLES.questionExplanations),
    importHistory: listRecords(userId, PROGRESS_TABLES.importHistory),
  };

  const allUpdatedAt = Object.values(payload).flat().map(record => record.updatedAt).filter(Boolean);
  return {
    ...payload,
    version: allUpdatedAt.sort().at(-1) || null,
  };
}

export function importLearningBatch(userId, batch = {}) {
  const timestamp = nowIso();
  const importHistory = normalizeArray(batch.importHistory);
  const importId = batch.importId || importHistory[0]?.id || `imp_${crypto.randomUUID()}`;
  const sourceType = normalizeSourceType(batch.sourceType, 'local-import');

  db.exec('BEGIN');
  try {
    normalizeArray(batch.subjects).forEach(record => upsertRecord(userId, 'subjects', record, { timestamp, sourceType }));
    normalizeArray(batch.chapters).forEach(record => upsertRecord(userId, 'chapters', record, { timestamp, sourceType }));
    normalizeArray(batch.knowledgePoints).forEach(record => upsertRecord(userId, 'knowledgePoints', record, { timestamp, importId, sourceType }));
    normalizeArray(batch.questions).forEach(record => upsertRecord(userId, 'questions', record, { timestamp, importId, sourceType }));

    if (importHistory.length > 0) {
      importHistory.forEach(record => upsertRecord(userId, 'importHistory', record, { timestamp, sourceType }));
    } else {
      upsertRecord(userId, 'importHistory', {
        id: importId,
        sourceType,
        label: batch.label || 'Local import',
        knowledgePointIds: normalizeArray(batch.knowledgePoints).map(record => record.id).filter(Boolean),
        questionIds: normalizeArray(batch.questions).map(record => record.id).filter(Boolean),
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      }, { timestamp, sourceType });
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return getLearningBootstrap(userId);
}

export function patchLearningProgress(userId, patch = {}) {
  const timestamp = nowIso();

  db.exec('BEGIN');
  try {
    normalizeArray(patch.progress).forEach(record => upsertRecord(userId, 'progress', record, { timestamp }));
    normalizeArray(patch.wrongRecords).forEach(record => upsertRecord(userId, 'wrongRecords', record, { timestamp }));
    normalizeArray(patch.questionExplanations).forEach(record => upsertRecord(userId, 'questionExplanations', record, { timestamp }));
    normalizeArray(patch.importHistory).forEach(record => upsertRecord(userId, 'importHistory', record, { timestamp, sourceType: 'local-import' }));
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return getLearningBootstrap(userId);
}

function softDeleteById(userId, tableKey, id, deletedAt) {
  const table = ALL_TABLES[tableKey];
  if (!table || !id) return;
  const storageId = getStorageId(userId, id);
  db.prepare(`
    UPDATE ${table}
    SET deleted_at = ?, updated_at = ?,
      payload = json_set(payload, '$.deletedAt', ?, '$.updatedAt', ?)
    WHERE user_id = ? AND id IN (?, ?)
  `).run(deletedAt, deletedAt, deletedAt, deletedAt, userId, storageId, id);
}

export function deleteLearningRecords(userId, payload = {}) {
  const deletedAt = String(payload.deletedAt || nowIso());

  db.exec('BEGIN');
  try {
    for (const [tableKey, ids] of Object.entries(payload.records || {})) {
      normalizeArray(ids).forEach(id => softDeleteById(userId, tableKey, String(id), deletedAt));
    }

    if (payload.importId) {
      const importId = String(payload.importId);
      softDeleteById(userId, 'importHistory', importId, deletedAt);
      db.prepare(`
        UPDATE user_knowledge_points
        SET deleted_at = ?, updated_at = ?, payload = json_set(payload, '$.deletedAt', ?, '$.updatedAt', ?)
        WHERE user_id = ? AND import_id = ?
      `).run(deletedAt, deletedAt, deletedAt, deletedAt, userId, importId);
      db.prepare(`
        UPDATE user_questions
        SET deleted_at = ?, updated_at = ?, payload = json_set(payload, '$.deletedAt', ?, '$.updatedAt', ?)
        WHERE user_id = ? AND import_id = ?
      `).run(deletedAt, deletedAt, deletedAt, deletedAt, userId, importId);
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return getLearningBootstrap(userId);
}
