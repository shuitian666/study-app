import crypto from 'node:crypto';
import { db, nowIso } from './db.js';
import { chatCompletion, extractContent } from './providers.js';

const MAX_PLAN_CHAPTERS = 3;
const MIN_POINTS_PER_CHAPTER = 2;
const MAX_POINTS_PER_CHAPTER = 4;
const VALID_DIFFICULTIES = new Set(['basic', 'standard', 'challenge']);
const VALID_QUESTION_TYPES = new Set(['single_choice', 'multi_choice', 'true_false']);
const EXPLANATION_SECTION_TYPES = ['core', 'intuition', 'example', 'pitfall'];
const TUTOR_MODES = new Set(['explain', 'question_hint', 'question_review']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function normalizeName(value) {
  return cleanText(value).toLocaleLowerCase('zh-CN').replace(/[\s·•,，。:：;；()（）[\]【】_-]+/g, '');
}

function stableGeneratedId(prefix, ...parts) {
  const digest = crypto.createHash('sha256').update(parts.map(cleanText).join('|')).digest('hex').slice(0, 16);
  return `${prefix}-${digest}`;
}

function parseModelJson(text) {
  const cleaned = cleanText(text)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // Throw the stable validation error below.
      }
    }
  }
  const error = new Error('AI 返回的学习计划格式无效，请重试');
  error.status = 502;
  throw error;
}

function catalogForScope(payload) {
  const subjects = asArray(payload.subjects);
  const chapters = asArray(payload.chapters);
  const knowledgePoints = asArray(payload.knowledgePoints);
  const scopeSubjectId = cleanText(payload.scopeSubjectId);
  const scopedSubjects = scopeSubjectId
    ? subjects.filter(subject => String(subject.id) === scopeSubjectId)
    : subjects;
  const subjectIds = new Set(scopedSubjects.map(subject => String(subject.id)));
  const scopedChapters = chapters.filter(chapter => subjectIds.has(String(chapter.subjectId)));
  const chapterIds = new Set(scopedChapters.map(chapter => String(chapter.id)));
  const scopedKnowledgePoints = knowledgePoints.filter(kp =>
    subjectIds.has(String(kp.subjectId)) && chapterIds.has(String(kp.chapterId))
  );
  return {
    subjects: scopedSubjects,
    chapters: scopedChapters,
    knowledgePoints: scopedKnowledgePoints,
  };
}

function compactCatalog(payload) {
  const catalog = catalogForScope(payload);
  const chapterNameById = new Map(catalog.chapters.map(chapter => [String(chapter.id), cleanText(chapter.name)]));
  return {
    subjects: catalog.subjects.map(subject => ({
      id: String(subject.id),
      name: cleanText(subject.name),
    })),
    chapters: catalog.chapters.map(chapter => ({
      id: String(chapter.id),
      subjectId: String(chapter.subjectId),
      name: cleanText(chapter.name),
    })),
    knowledgePoints: catalog.knowledgePoints.slice(0, 240).map(kp => ({
      id: String(kp.id),
      subjectId: String(kp.subjectId),
      chapterId: String(kp.chapterId),
      chapterName: chapterNameById.get(String(kp.chapterId)) || '',
      name: cleanText(kp.name),
      explanation: cleanText(kp.explanation).slice(0, 220),
    })),
  };
}

export function buildStudyPlanMessages(payload = {}) {
  const goal = cleanText(payload.goal);
  if (!goal) {
    const error = new Error('请先描述想学习的内容');
    error.status = 400;
    throw error;
  }
  const catalog = compactCatalog(payload);
  return [
    {
      role: 'system',
      content: `你是课程规划师。根据用户目标生成一轮可完成的学习计划。
要求：
- 输入框目标是最高优先级，不能把无关的已有知识硬塞进计划。
- 每轮最多 3 章，每章 2-4 个知识点。
- 若目录中有真正相关的内容，使用其原始 id 并标记 source="existing"。
- 不能仅因内容属于同一大类就复用；必须与用户目标直接相关，不相关时宁可生成新内容。
- 缺失内容必须生成，标记 source="generated"，提供准确的 baseExplanation。
- 如果用户目标是“物理化学”，只复用热力学、化学动力学、电化学、量子化学、统计热力学、相平衡等直接相关内容；不得返回有机化学、无机化学、分析化学、微生物或免疫学等泛化内容。
- 输出前自检每个章节和知识点是否直接服务于输入框目标，删除仅作为宽泛基础、但不属于本轮目标的内容。
- 只输出 JSON，不要输出 markdown 或额外说明。`,
    },
    {
      role: 'user',
      content: JSON.stringify({
        goal,
        scopeSubjectId: cleanText(payload.scopeSubjectId) || null,
        catalog,
        outputSchema: {
          subject: {
            id: 'existing subject id, or empty when generated',
            name: 'subject name',
            source: 'existing | generated',
            icon: 'one emoji',
            color: '#RRGGBB',
          },
          chapters: [{
            id: 'existing chapter id, or empty when generated',
            name: 'chapter name',
            source: 'existing | generated',
            goal: 'chapter learning goal',
            knowledgePoints: [{
              id: 'existing knowledge point id, or empty when generated',
              name: 'knowledge point name',
              source: 'existing | generated',
              goal: 'specific learning goal',
              difficulty: 'basic | standard | challenge',
              baseExplanation: 'required for generated content',
            }],
          }],
        },
      }),
    },
  ];
}

export function normalizeGeneratedStudyPlan(payload = {}, raw = {}) {
  const goal = cleanText(payload.goal);
  const catalog = catalogForScope(payload);
  const subjectById = new Map(catalog.subjects.map(subject => [String(subject.id), subject]));
  const subjectByName = new Map(catalog.subjects.map(subject => [normalizeName(subject.name), subject]));
  const chapterById = new Map(catalog.chapters.map(chapter => [String(chapter.id), chapter]));
  const kpById = new Map(catalog.knowledgePoints.map(kp => [String(kp.id), kp]));
  const rawSubject = raw.subject || {};
  const matchedSubject = subjectById.get(String(rawSubject.id || ''))
    || subjectByName.get(normalizeName(rawSubject.name));
  const subjectSource = rawSubject.source === 'existing' && matchedSubject ? 'existing' : 'generated';
  const subjectName = subjectSource === 'existing'
    ? cleanText(matchedSubject.name)
    : cleanText(rawSubject.name);
  if (!subjectName) {
    const error = new Error('AI 未能识别学习主题，请补充更具体的目标后重试');
    error.status = 502;
    throw error;
  }
  const subjectId = subjectSource === 'existing'
    ? String(matchedSubject.id)
    : stableGeneratedId('ai-subject', subjectName);

  const chapters = asArray(raw.chapters).slice(0, MAX_PLAN_CHAPTERS).map((rawChapter, chapterIndex) => {
    const matchedChapter = chapterById.get(String(rawChapter?.id || ''));
    const canReuseChapter = rawChapter?.source === 'existing'
      && matchedChapter
      && String(matchedChapter.subjectId) === subjectId;
    const chapterName = canReuseChapter ? cleanText(matchedChapter.name) : cleanText(rawChapter?.name);
    if (!chapterName) return null;
    const chapterId = canReuseChapter
      ? String(matchedChapter.id)
      : stableGeneratedId('ai-chapter', subjectName, chapterName);
    const points = asArray(rawChapter?.knowledgePoints)
      .slice(0, MAX_POINTS_PER_CHAPTER)
      .map((rawKp, kpIndex) => {
        const matchedKp = kpById.get(String(rawKp?.id || ''));
        const canReuseKp = rawKp?.source === 'existing'
          && matchedKp
          && String(matchedKp.subjectId) === subjectId
          && String(matchedKp.chapterId) === chapterId;
        const name = canReuseKp ? cleanText(matchedKp.name) : cleanText(rawKp?.name);
        if (!name) return null;
        const source = canReuseKp ? 'existing' : 'generated';
        const baseExplanation = source === 'existing'
          ? cleanText(matchedKp.explanation)
          : cleanText(rawKp?.baseExplanation);
        if (source === 'generated' && !baseExplanation) return null;
        return {
          id: source === 'existing'
            ? String(matchedKp.id)
            : stableGeneratedId('ai-kp', subjectName, chapterName, name),
          name,
          source,
          goal: cleanText(rawKp?.goal, `理解并能应用「${name}」`),
          difficulty: VALID_DIFFICULTIES.has(rawKp?.difficulty)
            ? rawKp.difficulty
            : (kpIndex === 0 ? 'basic' : 'standard'),
          baseExplanation,
        };
      })
      .filter(Boolean);
    if (points.length < MIN_POINTS_PER_CHAPTER) return null;
    return {
      id: chapterId,
      name: chapterName,
      source: canReuseChapter ? 'existing' : 'generated',
      order: canReuseChapter ? Number(matchedChapter.order || chapterIndex + 1) : chapterIndex + 1,
      goal: cleanText(rawChapter?.goal, `掌握「${chapterName}」的核心概念和应用`),
      knowledgePoints: points,
    };
  }).filter(Boolean);

  if (chapters.length === 0) {
    const error = new Error('AI 未生成可用的学习计划，请重试或把目标描述得更具体');
    error.status = 502;
    throw error;
  }

  return {
    id: `ai-plan-${crypto.randomUUID()}`,
    subjectId,
    subjectName,
    subjectSource,
    subjectIcon: cleanText(rawSubject.icon, '📘'),
    subjectColor: /^#[0-9a-f]{6}$/i.test(cleanText(rawSubject.color)) ? rawSubject.color : '#4f46e5',
    goal,
    chapters,
    createdAt: nowIso(),
  };
}

async function requestStructuredAI(userId, messages, maxTokens) {
  const response = await chatCompletion(userId, messages, {
    stream: false,
    temperature: 0.35,
    maxTokens,
  });
  return parseModelJson(await extractContent(response));
}

export async function generateStudyPlan(userId, payload = {}) {
  const raw = await requestStructuredAI(userId, buildStudyPlanMessages(payload), 3200);
  return normalizeGeneratedStudyPlan(payload, raw);
}

export function normalizeStudyExplanation(payload = {}, raw = {}) {
  const name = cleanText(payload.knowledgePoint?.name, '当前知识点');
  const overview = cleanText(raw.overview || raw.explanation);
  const memoryTip = cleanText(raw.memoryTip);
  const sectionByType = new Map(
    asArray(raw.sections)
      .map(section => [cleanText(section?.type).toLowerCase(), section])
  );
  const sections = EXPLANATION_SECTION_TYPES.map(type => {
    const section = sectionByType.get(type);
    const content = cleanText(section?.content);
    if (!content) return null;
    const fallbackTitles = {
      core: '核心概念',
      intuition: '直觉理解',
      example: '具体例子',
      pitfall: '常见误区',
    };
    return {
      type,
      title: cleanText(section?.title, fallbackTitles[type]),
      content,
    };
  }).filter(Boolean);
  if (!overview || sections.length !== EXPLANATION_SECTION_TYPES.length || !memoryTip) {
    const error = new Error('AI 返回的讲解格式无效，请重试');
    error.status = 502;
    throw error;
  }
  return { title: cleanText(raw.title, name), overview, sections, memoryTip };
}

export async function generateStudyExplanation(userId, payload = {}) {
  const kp = payload.knowledgePoint || {};
  const messages = retry => [
    {
      role: 'system',
      content: `You are a patient private tutor. Return strict JSON only and write all teaching content in Chinese.
The response schema is:
{"title":"","overview":"","sections":[
  {"type":"core","title":"核心概念","content":""},
  {"type":"intuition","title":"直觉理解","content":""},
  {"type":"example","title":"具体例子","content":""},
  {"type":"pitfall","title":"常见误区","content":""}
],"memoryTip":""}
All four section types are required exactly once. Keep each section focused and concrete.
${retry ? 'The previous response failed validation. Check the exact schema before responding.' : ''}`,
    },
    {
      role: 'user',
      content: JSON.stringify({
        learningGoal: cleanText(payload.goal),
        knowledgePoint: {
          name: cleanText(kp.name),
          baseExplanation: cleanText(kp.baseExplanation || kp.explanation),
          difficulty: cleanText(payload.difficulty),
        },
      }),
    },
  ];
  let validationError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await requestStructuredAI(userId, messages(attempt > 0), 2200);
      return normalizeStudyExplanation(payload, raw);
    } catch (error) {
      if (error?.status !== 502) throw error;
      validationError = error;
    }
  }
  const error = new Error('AI 连续两次未按格式生成完整讲解，请重试');
  error.status = 502;
  error.cause = validationError;
  throw error;
}

function sanitizeTutorQuestion(question, includeAnswer) {
  if (!question || typeof question !== 'object') return null;
  const sanitized = {
    id: cleanText(question.id),
    stem: cleanText(question.stem).slice(0, 1000),
    options: asArray(question.options).slice(0, 6).map(option => ({
      id: cleanText(option?.id),
      text: cleanText(option?.text).slice(0, 300),
    })).filter(option => option.id && option.text),
  };
  if (includeAnswer) {
    sanitized.selectedAnswers = asArray(question.selectedAnswers).map(String).slice(0, 6);
    sanitized.correctAnswers = asArray(question.correctAnswers).map(String).slice(0, 6);
    sanitized.explanation = cleanText(question.explanation).slice(0, 1800);
  }
  return sanitized;
}

export function buildStudyTutorMessages(payload = {}) {
  const context = payload.context || {};
  const mode = TUTOR_MODES.has(context.mode) ? context.mode : 'explain';
  const knowledgePointName = cleanText(context.knowledgePointName, '当前知识点');
  const includeAnswer = mode === 'question_review';
  const tutorContext = {
    mode,
    learningGoal: cleanText(context.goal).slice(0, 500),
    chapterName: cleanText(context.chapterName).slice(0, 120),
    knowledgePointName,
    sectionTitle: cleanText(context.sectionTitle).slice(0, 120),
    sectionContent: cleanText(context.sectionContent).slice(0, 1800),
    question: sanitizeTutorQuestion(context.question, includeAnswer),
  };
  const modeInstruction = mode === 'question_hint'
    ? 'The learner has not submitted an answer. Give only concepts, observations, and a solving direction. Never identify, imply, eliminate down to, or quote the correct option.'
    : mode === 'question_review'
      ? 'The learner has submitted an answer. Explain why the correct answer is correct, why the selected answer is wrong when applicable, and answer follow-up questions in depth.'
      : 'Help the learner understand the current teaching section. Use progressive explanation, analogy, or another example as requested.';
  const messages = [{
    role: 'system',
    content: `You are an interactive learning tutor. Answer in clear Chinese with short paragraphs.
Stay strictly within the supplied learning goal and knowledge point.
${modeInstruction}
Do not generate a new study plan or silently mark learning progress as complete.

## Current learning context
${JSON.stringify(tutorContext)}`,
  }];
  asArray(payload.history).slice(-10).forEach(message => {
    const role = message?.role === 'assistant' ? 'assistant' : 'user';
    const content = cleanText(message?.content).slice(0, 1600);
    if (content) messages.push({ role, content });
  });
  const query = cleanText(payload.query).slice(0, 1000);
  if (!query) {
    const error = new Error('请输入要追问的内容');
    error.status = 400;
    throw error;
  }
  messages.push({ role: 'user', content: query });
  return messages;
}

function normalizeQuestionType(value, correctAnswerCount) {
  const normalized = cleanText(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'multiple_choice' || normalized === 'multiple_select') return 'multi_choice';
  if (VALID_QUESTION_TYPES.has(normalized)) return normalized;
  return correctAnswerCount > 1 ? 'multi_choice' : 'single_choice';
}

function normalizeQuestion(rawQuestion, index, payload, prefix) {
  const optionAliases = new Map();
  const options = asArray(rawQuestion?.options).slice(0, 6)
    .map((item, optionIndex) => {
      const letter = String.fromCharCode(97 + optionIndex);
      const rawId = typeof item === 'object' && item
        ? cleanText(item.id || item.value || item.label, letter)
        : letter;
      const text = typeof item === 'string'
        ? cleanText(item)
        : cleanText(item?.text || item?.content || item?.label);
      if (!text) return null;
      const id = rawId;
      [
        id,
        rawId,
        typeof item === 'object' && item ? item.label : '',
        typeof item === 'object' && item ? item.value : '',
        letter,
        letter.toUpperCase(),
        String(optionIndex),
      ].forEach(alias => {
        const normalizedAlias = cleanText(alias).toLowerCase();
        if (normalizedAlias) optionAliases.set(normalizedAlias, id);
      });
      return { id, text };
    })
    .filter(Boolean);
  const correctAnswers = Array.from(new Set(
    asArray(rawQuestion?.correctAnswers)
      .map(answer => {
        if (typeof answer === 'number' && Number.isInteger(answer)) {
          return options[answer]?.id || '';
        }
        return optionAliases.get(cleanText(answer).toLowerCase()) || '';
      })
      .filter(Boolean)
  ));
  const type = normalizeQuestionType(rawQuestion?.type, correctAnswers.length);
  const stem = cleanText(rawQuestion?.stem);
  const explanation = cleanText(rawQuestion?.explanation);
  if (!stem || options.length < 2 || correctAnswers.length === 0 || !explanation) return null;
  return {
    id: `${prefix}-${index + 1}`,
    knowledgePointId: cleanText(payload.knowledgePoint?.id) || undefined,
    chapterId: cleanText(payload.chapter?.id) || undefined,
    subjectId: cleanText(payload.subjectId),
    type,
    stem,
    options,
    correctAnswers,
    explanation,
  };
}

export function normalizeStudyPractice(payload = {}, raw = {}) {
  const knowledgePointId = cleanText(payload.knowledgePoint?.id, 'kp');
  const questions = asArray(raw.questions).slice(0, 3)
    .map((question, index) => normalizeQuestion(question, index, payload, `ai-practice-${knowledgePointId}`))
    .filter(Boolean);
  if (questions.length !== 3) {
    const error = new Error('AI 未生成完整的三道练习题，请重试');
    error.status = 502;
    throw error;
  }
  return { questions };
}

function practiceKeywords(name) {
  const fullName = normalizeName(name);
  const segments = cleanText(name)
    .split(/[与和及、,，/]/)
    .map(normalizeName)
    .filter(segment => segment.length >= 2);
  return Array.from(new Set([fullName, ...segments].filter(keyword => keyword.length >= 2)));
}

function assertStudyPracticeRelevance(payload, result) {
  const name = cleanText(payload.knowledgePoint?.name);
  const keywords = practiceKeywords(name);
  if (keywords.length === 0) return result;
  const unrelated = result.questions.some(question => {
    const content = normalizeName(`${question.stem} ${question.explanation}`);
    return !keywords.some(keyword => content.includes(keyword));
  });
  if (unrelated) {
    const error = new Error(`AI 生成的题目偏离知识点“${name}”`);
    error.status = 502;
    throw error;
  }
  return result;
}

function buildStudyPracticeMessages(payload = {}, retry = false) {
  const kp = payload.knowledgePoint || {};
  const name = cleanText(kp.name, '当前知识点');
  const explanation = cleanText(kp.explanation || kp.baseExplanation);
  return [
    {
      role: 'system',
      content: `You are a subject-matter teacher creating Chinese practice questions only for the target concept "${name}".
Return one strict JSON object only. Do not include markdown fences, an introduction, or a closing note.
Never create questions about JSON, programming, stacks, generic epistemology, or any topic other than "${name}".
Use this exact schema:
{"questions":[
  {"type":"single_choice","stem":"题干","options":[{"id":"a","text":"选项A"},{"id":"b","text":"选项B"},{"id":"c","text":"选项C"},{"id":"d","text":"选项D"}],"correctAnswers":["a"],"explanation":"解析"}
]}
Requirements:
- The questions array must contain exactly 3 distinct questions, ordered from basic to advanced.
- Write every stem, option, and explanation in Chinese.
- Every stem or explanation must explicitly contain the target concept "${name}" or a direct keyword from its name.
- Every question needs a stem, 2-6 options, at least one correct answer, and a complete explanation.
- correctAnswers must contain option ids only, never numeric indexes or option text.
- type must be single_choice, multi_choice, or true_false.
${retry ? '- The previous response failed structure or topic validation. Check every field and topic before returning JSON again.' : ''}`,
    },
    {
      role: 'user',
      content: JSON.stringify({
        knowledgePoint: { name, explanation },
        difficulty: cleanText(payload.difficulty, 'standard'),
        requiredQuestionCount: 3,
      }),
    },
  ];
}

export async function generateStudyPractice(userId, payload = {}) {
  let validationError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await requestStructuredAI(
        userId,
        buildStudyPracticeMessages(payload, attempt > 0),
        2800,
      );
      return assertStudyPracticeRelevance(payload, normalizeStudyPractice(payload, raw));
    } catch (error) {
      if (error?.status !== 502) throw error;
      validationError = error;
    }
  }
  const error = new Error('AI 连续两次未按格式生成完整的三道练习题，请重试');
  error.status = 502;
  error.cause = validationError;
  throw error;
}

export function normalizeChapterSynthesis(payload = {}, raw = {}) {
  const chapterId = cleanText(payload.chapter?.id, 'chapter');
  const question = normalizeQuestion(asArray(raw.questions)[0], 0, payload, `ai-synthesis-${chapterId}`);
  if (!question) {
    const error = new Error('AI 未生成有效的章节综合题，请重试');
    error.status = 502;
    throw error;
  }
  return { questions: [question] };
}

export async function generateChapterSynthesis(userId, payload = {}) {
  const raw = await requestStructuredAI(userId, [
    {
      role: 'system',
      content: '你是课程复盘老师。根据本章知识点生成一道综合选择题。只输出 JSON：{"questions":[...]}，题目包含 type、stem、options、correctAnswers、explanation。',
    },
    {
      role: 'user',
      content: JSON.stringify({
        chapter: cleanText(payload.chapter?.name),
        knowledgePoints: asArray(payload.knowledgePoints).map(kp => ({
          name: cleanText(kp.name),
          explanation: cleanText(kp.explanation || kp.baseExplanation).slice(0, 240),
        })),
      }),
    },
  ], 1400);
  return normalizeChapterSynthesis(payload, raw);
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
