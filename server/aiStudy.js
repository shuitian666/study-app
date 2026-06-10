import crypto from 'node:crypto';
import { db, nowIso } from './db.js';

const MAX_PLAN_CHAPTERS = 3;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function option(id, text) {
  return { id, text };
}

function subjectName(payload) {
  return cleanText(payload?.subject?.name, '当前学科');
}

function relevanceScore(text, goal) {
  const normalizedText = cleanText(text).toLowerCase();
  const normalizedGoal = cleanText(goal).toLowerCase();
  if (!normalizedText || !normalizedGoal) return 0;
  if (normalizedText.includes(normalizedGoal) || normalizedGoal.includes(normalizedText)) return 1000;

  const ignoredTerms = new Set([
    '重点',
    '学习',
    '掌握',
    '理解',
    '了解',
    '内容',
    '知识',
    '相关',
    '有关',
    '一下',
    '这次',
    '想学',
  ]);
  const terms = new Set();
  for (const segment of normalizedGoal.split(/[\s,，。；;、?!？！/]+/)) {
    const latinTerms = segment.match(/[a-z0-9][a-z0-9_-]+/g) || [];
    latinTerms.forEach(term => terms.add(term));

    const chineseSegments = segment.match(/[\u3400-\u9fff]+/g) || [];
    for (const chinese of chineseSegments) {
      const maxLength = Math.min(6, chinese.length);
      for (let length = maxLength; length >= 2; length -= 1) {
        for (let start = 0; start <= chinese.length - length; start += 1) {
          const term = chinese.slice(start, start + length);
          if (!ignoredTerms.has(term)) terms.add(term);
        }
      }
    }
  }

  return Array.from(terms).reduce(
    (score, term) => score + (normalizedText.includes(term) ? Math.pow(term.length, 3) : 0),
    0,
  );
}

function selectedChapters(payload) {
  const requestedChapterIds = new Set(asArray(payload?.chapterIds).map(String));
  const allChapters = asArray(payload?.chapters);
  const matching = requestedChapterIds.size > 0
    ? allChapters.filter(chapter => requestedChapterIds.has(String(chapter.id)))
    : allChapters;
  return matching
    .filter(chapter => knowledgePointsForChapter(payload, chapter.id).length > 0)
    .map(chapter => ({
      chapter,
      score: relevanceScore(
        [
          chapter.name,
          ...knowledgePointsForChapter(payload, chapter.id).flatMap(kp => [kp.name, kp.explanation]),
        ].join(' '),
        payload?.goal,
      ),
    }))
    .sort((a, b) => b.score - a.score || Number(a.chapter.order || 0) - Number(b.chapter.order || 0))
    .slice(0, MAX_PLAN_CHAPTERS)
    .map(({ chapter }) => ({
      id: String(chapter.id),
      name: cleanText(chapter.name, '未命名章节'),
      order: Number(chapter.order || 0),
    }));
}

function knowledgePointsForChapter(payload, chapterId) {
  const requestedKpIds = new Set(asArray(payload?.knowledgePointIds).map(String));
  return asArray(payload?.knowledgePoints)
    .filter(kp => String(kp.chapterId) === String(chapterId))
    .filter(kp => requestedKpIds.size === 0 || requestedKpIds.has(String(kp.id)))
    .map(kp => ({
      kp,
      score: relevanceScore(`${kp.name || ''} ${kp.explanation || ''}`, payload?.goal),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ kp }) => ({
      id: String(kp.id),
      name: cleanText(kp.name, '未命名知识点'),
      explanation: cleanText(kp.explanation),
      proficiency: kp.proficiency || 'none',
    }));
}

export function buildStudyPlan(payload = {}) {
  const chapters = selectedChapters(payload);
  const goal = cleanText(payload?.goal);
  const planChapters = chapters.map(chapter => {
    const kps = knowledgePointsForChapter(payload, chapter.id);
    return {
      id: chapter.id,
      name: chapter.name,
      goal: `先理解「${chapter.name}」的核心概念，再用基础题确认是否真的会用。`,
      knowledgePoints: kps.map((kp, index) => ({
        id: kp.id,
        name: kp.name,
        goal: `用自己的话说清「${kp.name}」，并完成 3 道由浅入深的练习。`,
        difficulty: index < 2 ? 'basic' : 'standard',
      })),
    };
  }).filter(chapter => chapter.knowledgePoints.length > 0);

  return {
    id: `ai-plan-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    subjectId: String(payload?.subject?.id || payload?.subjectId || ''),
    subjectName: subjectName(payload),
    goal: goal || undefined,
    chapters: planChapters,
    createdAt: nowIso(),
  };
}

export function buildStudyExplanation(payload = {}) {
  const kp = payload.knowledgePoint || {};
  const name = cleanText(kp.name, '这个知识点');
  const explanation = cleanText(kp.explanation, '暂无原始解析。');
  const goal = cleanText(payload.goal, `理解 ${name} 的含义和用法。`);

  return {
    title: name,
    memoryTip: `${name}：先记核心含义，再记适用条件和常见误区。`,
    explanation: [
      `学习目标：${goal}`,
      `先抓核心：${explanation}`,
      `容易混淆的地方：不要只记结论，要说清它适用的条件、关键判断点和常见错误选项。`,
      `下一步：先复述一遍，再做 3 道基础练习。`,
    ].join('\n\n'),
  };
}

export function buildStudyPractice(payload = {}) {
  const kp = payload.knowledgePoint || {};
  const name = cleanText(kp.name, '当前知识点');
  const explanation = cleanText(kp.explanation, `${name} 的基础含义`);
  const subjectId = String(payload.subjectId || kp.subjectId || '');
  const knowledgePointId = String(kp.id || '');
  const baseId = `ai-practice-${knowledgePointId || 'kp'}`;

  return {
    questions: [
      {
        id: `${baseId}-1`,
        knowledgePointId,
        subjectId,
        type: 'single_choice',
        stem: `关于「${name}」，最先应该掌握的核心是什么？`,
        options: [
          option('a', explanation.slice(0, 80) || `${name} 的基本概念`),
          option('b', '只记一个孤立结论，不需要理解条件'),
          option('c', '跳过基础，直接做综合题'),
          option('d', '只关注题目选项的字面相似度'),
        ],
        correctAnswers: ['a'],
        explanation: `先抓住「${name}」的核心含义，再进入题目练习。`,
      },
      {
        id: `${baseId}-2`,
        knowledgePointId,
        subjectId,
        type: 'true_false',
        stem: `学习「${name}」时，只要背下结论，不需要知道适用条件。`,
        options: [option('true', '正确'), option('false', '错误')],
        correctAnswers: ['false'],
        explanation: '自主学习要能说明条件、边界和常见误区，不能只背结论。',
      },
      {
        id: `${baseId}-3`,
        knowledgePointId,
        subjectId,
        type: 'single_choice',
        stem: `如果你做错了「${name}」相关题，最应该先复盘哪一项？`,
        options: [
          option('a', '错在概念、条件、还是选项辨析'),
          option('b', '马上换一个完全无关知识点'),
          option('c', '只看正确答案字母'),
          option('d', '直接提高到更难题目'),
        ],
        correctAnswers: ['a'],
        explanation: '先定位错因，再决定是否继续基础题或进入标准题。',
      },
    ],
  };
}

export function buildChapterSynthesis(payload = {}) {
  const chapter = payload.chapter || {};
  const subjectId = String(payload.subjectId || '');
  const chapterId = String(chapter.id || '');
  const names = asArray(payload.knowledgePoints).map(kp => cleanText(kp.name)).filter(Boolean).slice(0, 5);
  const baseId = `ai-synthesis-${chapterId || 'chapter'}`;
  return {
    questions: [
      {
        id: `${baseId}-1`,
        chapterId,
        subjectId,
        type: 'single_choice',
        stem: `本章综合复盘：学习 ${names.join('、') || '这些知识点'} 后，最好的串联方式是什么？`,
        options: [
          option('a', '按概念、条件、常见误区和应用题依次整理'),
          option('b', '只记每个知识点的名字'),
          option('c', '只做难题，不回顾基础'),
          option('d', '把不同学科内容混在一起记'),
        ],
        correctAnswers: ['a'],
        explanation: '章内综合应先在同一学科内建立关系，再逐步提高题目难度。',
      },
    ],
  };
}

function rowToSummary(row) {
  const payload = JSON.parse(row.payload || '{}');
  return {
    ...payload,
    id: row.id,
    subjectId: row.subject_id || payload.subjectId,
    chapterIds: JSON.parse(row.chapter_ids || '[]'),
    knowledgePointIds: JSON.parse(row.knowledge_point_ids || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function saveStudySummary(userId, payload = {}) {
  const createdAt = nowIso();
  const id = String(payload.id || `ai-summary-${crypto.randomUUID()}`);
  const chapterIds = asArray(payload.chapterIds).map(String);
  const knowledgePointIds = asArray(payload.knowledgePointIds).map(String);
  const correctCount = Number(payload.correctCount || 0);
  const totalQuestions = Number(payload.totalQuestions || 0);
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const summary = cleanText(
    payload.summary,
    `本次完成 ${asArray(payload.knowledgePointNames).length} 个知识点，练习正确率 ${accuracy}%。`,
  );
  const advice = cleanText(
    payload.advice,
    accuracy >= 80 ? '下次可以进入后续章节，并在复习模块中巩固今天的卡片。' : '下次先复习薄弱点，再进入新的章节规划。',
  );
  const record = {
    ...payload,
    id,
    chapterIds,
    knowledgePointIds,
    summary,
    advice,
    createdAt,
    updatedAt: createdAt,
  };

  db.prepare(`
    INSERT INTO ai_study_summaries (id, user_id, subject_id, chapter_ids, knowledge_point_ids, payload, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    payload.subjectId || null,
    JSON.stringify(chapterIds),
    JSON.stringify(knowledgePointIds),
    JSON.stringify(record),
    createdAt,
    createdAt,
  );

  return record;
}

export function listStudySummaries(userId) {
  return db.prepare(`
    SELECT * FROM ai_study_summaries
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId).map(rowToSummary);
}
