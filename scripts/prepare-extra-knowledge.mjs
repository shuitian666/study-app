import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = 'E:/ClaudeCode-MiniMax/output';
const publicKnowledgeDir = path.join(projectRoot, 'public', 'knowledge');
const instrumentalSupplementPath = path.join(projectRoot, 'scripts', 'instrumental-analysis-supplement.json');

const now = new Date().toISOString();

const subjects = [
  {
    id: 'instrumental_analysis',
    name: '仪器分析',
    description: '紫外、红外、核磁、质谱、色谱等仪器分析知识库',
    icon: '🔬',
    color: '#3b82f6',
    sourceFile: path.join(sourceRoot, 'instrumental_analysis_index.json'),
  },
  {
    id: 'english_vocabulary',
    name: '英语词汇（考研/六级）',
    description: '考研与六级词汇、近义词辨析、固定搭配和语法题库',
    icon: '📘',
    color: '#ef4444',
    sourceFile: path.join(sourceRoot, 'english_vocabulary_index.json'),
    skipQuestions: true,
  },
];

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeKnowledgePoint(kp, subjectId) {
  return {
    proficiency: 'none',
    lastReviewedAt: null,
    nextReviewAt: null,
    reviewCount: 0,
    createdAt: now,
    source: 'import',
    ...kp,
    subjectId,
    name: String(kp.name || '').trim(),
    explanation: String(kp.explanation || '').trim(),
  };
}

function normalizeQuestion(question, subjectId) {
  return {
    ...question,
    subjectId,
    type: question.type || 'single_choice',
    options: Array.isArray(question.options) ? question.options : [],
    correctAnswers: Array.isArray(question.correctAnswers) ? question.correctAnswers : [],
    explanation: question.explanation || '',
  };
}

function normalizeSubjectData(data, subjectId) {
  const knowledgePoints = data.knowledgePoints.map(kp => normalizeKnowledgePoint(kp, subjectId));
  const kpIds = new Set(knowledgePoints.map(kp => kp.id));
  const kpById = new Map(knowledgePoints.map(kp => [kp.id, kp]));
  const skippedQuestions = [];

  const questions = data.questions.flatMap(rawQuestion => {
    const question = normalizeQuestion(rawQuestion, subjectId);
    if (question.knowledgePointId && kpIds.has(question.knowledgePointId)) {
      return [{
        ...question,
        chapterId: kpById.get(question.knowledgePointId).chapterId,
      }];
    }

    skippedQuestions.push(question.id || '(missing id)');
    return [];
  });

  return { knowledgePoints, questions, skippedQuestions };
}

function applySupplement(payload, subjectId) {
  if (subjectId !== 'instrumental_analysis' || !fs.existsSync(instrumentalSupplementPath)) {
    return payload;
  }

  const supplement = readJSON(instrumentalSupplementPath);
  const removeQuestionIds = new Set(supplement.removeQuestionIds || []);
  const chapterIds = new Set(payload.chapters.map(chapter => chapter.id));
  const kpIds = new Set(payload.knowledgePoints.map(kp => kp.id));
  const questionIds = new Set(payload.questions.map(question => question.id));

  const chapters = [...payload.chapters];
  for (const chapter of supplement.chapters || []) {
    if (!chapterIds.has(chapter.id)) {
      chapters.push({
        subjectId,
        ...chapter,
      });
      chapterIds.add(chapter.id);
    }
  }

  const knowledgePoints = [...payload.knowledgePoints];
  for (const kp of supplement.knowledgePoints || []) {
    if (!kpIds.has(kp.id)) {
      knowledgePoints.push(normalizeKnowledgePoint(kp, subjectId));
      kpIds.add(kp.id);
    }
  }

  const questions = payload.questions.filter(question => !removeQuestionIds.has(question.id));
  for (const question of supplement.questions || []) {
    if (!questionIds.has(question.id)) {
      questions.push(normalizeQuestion(question, subjectId));
      questionIds.add(question.id);
    }
  }

  const usedChapterIds = new Set([
    ...knowledgePoints.map(kp => kp.chapterId),
    ...questions.map(question => question.chapterId),
  ]);

  return {
    ...payload,
    chapters: chapters
      .filter(chapter => usedChapterIds.has(chapter.id))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((chapter, index) => ({
        ...chapter,
        subjectId,
        order: index + 1,
      })),
    knowledgePoints,
    questions,
    total: knowledgePoints.length,
  };
}

function validateSubject(data) {
  const errors = [];
  const chapterIds = new Set(data.chapters.map(chapter => chapter.id));
  const kpIds = new Set(data.knowledgePoints.map(kp => kp.id));

  for (const kp of data.knowledgePoints) {
    if (!kp.id || !kp.name || !kp.explanation) errors.push(`bad knowledge point ${kp.id || '(missing id)'}`);
    if (!chapterIds.has(kp.chapterId)) errors.push(`knowledge point ${kp.id} references missing chapter ${kp.chapterId}`);
  }

  for (const question of data.questions) {
    if (!question.id || !question.stem) errors.push(`bad question ${question.id || '(missing id)'}`);
    if (question.knowledgePointId && !kpIds.has(question.knowledgePointId)) {
      errors.push(`question ${question.id} references missing knowledge point ${question.knowledgePointId}`);
    }
    if (question.chapterId && !chapterIds.has(question.chapterId)) {
      errors.push(`question ${question.id} references missing chapter ${question.chapterId}`);
    }
    const optionIds = new Set(question.options.map(option => option.id));
    for (const answer of question.correctAnswers) {
      if (!optionIds.has(answer)) errors.push(`question ${question.id} has invalid answer ${answer}`);
    }
  }

  return errors;
}

const metadataPath = path.join(publicKnowledgeDir, 'metadata.json');
const metadata = fs.existsSync(metadataPath)
  ? readJSON(metadataPath)
  : { version: '1.0', lastUpdated: now, subjects: [] };

for (const subject of subjects) {
  const sourceData = readJSON(subject.sourceFile);
  const { knowledgePoints, questions: normalizedQuestions, skippedQuestions } = normalizeSubjectData(sourceData, subject.id);
  const questions = subject.skipQuestions ? [] : normalizedQuestions;
  const payload = applySupplement({
    version: sourceData.version || '1.0',
    exportTime: now,
    subjectId: subject.id,
    subjectName: subject.name,
    total: knowledgePoints.length,
    chapters: sourceData.chapters.map((chapter, index) => ({
      subjectId: subject.id,
      order: index + 1,
      ...chapter,
      subjectId: subject.id,
      order: chapter.order ?? index + 1,
    })),
    knowledgePoints,
    questions,
  }, subject.id);

  const errors = validateSubject(payload);
  if (errors.length > 0) {
    throw new Error(`${subject.id} validation failed:\n${errors.slice(0, 20).join('\n')}`);
  }

  writeJSON(path.join(publicKnowledgeDir, subject.id, 'index.json'), payload);

  const entry = {
    id: subject.id,
    name: subject.name,
    description: subject.skipQuestions ? '考研与六级词汇、近义词辨析、固定搭配和语法知识库' : subject.description,
    icon: subject.icon,
    color: subject.color,
    kpCount: payload.knowledgePoints.length,
    qCount: payload.questions.length,
    chapters: payload.chapters,
  };

  const existingIndex = metadata.subjects.findIndex(item => item.id === subject.id);
  if (existingIndex >= 0) {
    metadata.subjects[existingIndex] = entry;
  } else {
    metadata.subjects.push(entry);
  }

  console.log(`${subject.id}: ${payload.chapters.length} chapters, ${payload.knowledgePoints.length} KPs, ${payload.questions.length} questions`);
  if (subject.skipQuestions) {
    console.log(`${subject.id}: skipped all ${normalizedQuestions.length} source questions by configuration`);
  }
  if (skippedQuestions.length > 0) {
    console.log(`${subject.id}: skipped ${skippedQuestions.length} questions without valid knowledge point links (${skippedQuestions.join(', ')})`);
  }
}

metadata.version = metadata.version || '1.0';
metadata.lastUpdated = now;
writeJSON(metadataPath, metadata);
console.log(`Updated ${metadataPath}`);
