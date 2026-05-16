import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const publicKnowledgeDir = path.join(projectRoot, 'public', 'knowledge');
const distKnowledgeDir = path.join(projectRoot, 'dist', 'knowledge');

const now = new Date().toISOString();

const subjects = [
  {
    id: 'micro',
    name: '微生物与免疫学',
    description: '微生物与免疫学复习知识库',
    icon: '🧫',
    color: '#059669',
    indexPath: path.join(projectRoot, 'knowledge-pipeline', 'output', '微生物与免疫学', 'index.json'),
    questionsPath: path.join(projectRoot, 'knowledge-pipeline', 'output', '微生物与免疫学', 'questions.json'),
    chapters: [
      { id: 'micro-ch1', subjectId: 'micro', name: '微生物学基础', order: 1 },
      { id: 'micro-ch2', subjectId: 'micro', name: '细菌学', order: 2 },
      { id: 'micro-ch3', subjectId: 'micro', name: '病毒学', order: 3 },
      { id: 'micro-ch4', subjectId: 'micro', name: '免疫学基础', order: 4 },
    ],
  },
  {
    id: 'immuno',
    name: '免疫学题目',
    description: '免疫学选择题与解析',
    icon: '🔬',
    color: '#8b5cf6',
    indexPath: path.join(projectRoot, 'output', '免疫学题目', 'oss_ready.json'),
    chapters: [
      { id: 'immunology-ch1', subjectId: 'immuno', name: '免疫学题目', order: 1 },
    ],
  },
  {
    id: 'analytical',
    name: '分析化学',
    description: '分析化学知识库',
    icon: '⚗️',
    color: '#2563eb',
    indexPath: path.join(projectRoot, 'knowledge-pipeline', 'output', 'analytical', 'index.json'),
    questionsPath: path.join(projectRoot, 'knowledge-pipeline', 'output', 'analytical', 'questions.json'),
  },
];

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeChapters(chapters, subjectId) {
  if (!Array.isArray(chapters)) return [];
  return chapters.map((chapter, index) => ({
    subjectId,
    order: index + 1,
    ...chapter,
    subjectId: chapter.subjectId || subjectId,
    order: chapter.order ?? index + 1,
  }));
}

function normalizeKnowledgePoints(knowledgePoints, subjectId) {
  if (!Array.isArray(knowledgePoints)) return [];
  return knowledgePoints.map((kp) => ({
    proficiency: 'none',
    lastReviewedAt: null,
    nextReviewAt: null,
    reviewCount: 0,
    createdAt: now,
    source: 'import',
    ...kp,
    subjectId: kp.subjectId || subjectId,
    proficiency: kp.proficiency || 'none',
    lastReviewedAt: kp.lastReviewedAt ?? null,
    nextReviewAt: kp.nextReviewAt ?? null,
    reviewCount: kp.reviewCount ?? 0,
    createdAt: kp.createdAt || now,
    source: kp.source || 'import',
  }));
}

function normalizeQuestions(questions, subjectId) {
  if (!Array.isArray(questions)) return [];
  return questions.map((question) => ({
    ...question,
    subjectId: question.subjectId || subjectId,
    type: question.type || 'single_choice',
    options: Array.isArray(question.options) ? question.options : [],
    correctAnswers: Array.isArray(question.correctAnswers) ? question.correctAnswers : [],
    explanation: question.explanation || '',
  }));
}

function buildSubjectPayload(subject) {
  if (!fs.existsSync(subject.indexPath)) {
    throw new Error(`Missing source file for ${subject.id}: ${subject.indexPath}`);
  }

  const indexData = readJSON(subject.indexPath);
  const questionData = subject.questionsPath && fs.existsSync(subject.questionsPath)
    ? readJSON(subject.questionsPath)
    : {};

  const chapters = normalizeChapters(
    subject.chapters || indexData.chapters || [],
    subject.id,
  );
  const knowledgePoints = normalizeKnowledgePoints(indexData.knowledgePoints, subject.id);
  const questions = normalizeQuestions(
    indexData.questions || questionData.questions || [],
    subject.id,
  );

  return {
    version: indexData.version || '1.0',
    exportTime: now,
    subjectId: subject.id,
    subjectName: subject.name,
    total: knowledgePoints.length,
    chapters,
    knowledgePoints,
    questions,
  };
}

function syncDir(sourceDir, targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

ensureDir(publicKnowledgeDir);
fs.rmSync(publicKnowledgeDir, { recursive: true, force: true });
ensureDir(publicKnowledgeDir);

const metadataSubjects = subjects.map((subject) => {
  const payload = buildSubjectPayload(subject);
  writeJSON(path.join(publicKnowledgeDir, subject.id, 'index.json'), payload);

  return {
    id: subject.id,
    name: subject.name,
    description: subject.description,
    icon: subject.icon,
    color: subject.color,
    kpCount: payload.knowledgePoints.length,
    qCount: payload.questions.length,
    chapters: payload.chapters,
  };
});

writeJSON(path.join(publicKnowledgeDir, 'metadata.json'), {
  version: '1.0',
  lastUpdated: now,
  subjects: metadataSubjects,
});

if (fs.existsSync(path.join(projectRoot, 'dist'))) {
  syncDir(publicKnowledgeDir, distKnowledgeDir);
}

console.log(`Prepared ${metadataSubjects.length} knowledge bases in ${publicKnowledgeDir}`);
for (const subject of metadataSubjects) {
  console.log(`- ${subject.id}: ${subject.kpCount} knowledge points, ${subject.qCount} questions`);
}
