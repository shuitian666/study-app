// 临时文件 - 从 mock.ts 导出数据
import { MOCK_SUBJECTS, MOCK_CHAPTERS, MOCK_KNOWLEDGE_POINTS, MOCK_QUESTIONS } from './src/data/mock';
import * as fs from 'fs';
import * as path from 'path';

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('='.repeat(60));
console.log('导出知识库数据');
console.log('='.repeat(60));

console.log(`\n学科: ${MOCK_SUBJECTS.length}`);
console.log(`章节: ${MOCK_CHAPTERS.length}`);
console.log(`知识点: ${MOCK_KNOWLEDGE_POINTS.length}`);
console.log(`题目: ${MOCK_QUESTIONS.length}`);

// 按学科分组
const subjectsData: Record<string, any> = {};
for (const subject of MOCK_SUBJECTS) {
  const subjectId = subject.id;
  const subjectChapters = MOCK_CHAPTERS.filter(c => c.subjectId === subjectId);
  const subjectKnowledgePoints = MOCK_KNOWLEDGE_POINTS.filter(kp => (kp as any).subjectId === subjectId);
  const subjectQuestions = MOCK_QUESTIONS.filter(q => q.subjectId === subjectId);

  subjectsData[subjectId] = {
    subject,
    chapters: subjectChapters,
    knowledgePoints: subjectKnowledgePoints,
    questions: subjectQuestions,
  };

  // 创建学科目录
  const subjectDir = path.join(outputDir, subjectId);
  if (!fs.existsSync(subjectDir)) {
    fs.mkdirSync(subjectDir, { recursive: true });
  }

  // 生成 index.json
  const outputData = {
    version: '1.0.0',
    subjectId,
    chapters: subjectChapters,
    knowledgePoints: subjectKnowledgePoints,
    questions: subjectQuestions,
  };

  fs.writeFileSync(
    path.join(subjectDir, 'index.json'),
    JSON.stringify(outputData, null, 2),
    'utf-8'
  );

  console.log(`\n${subject.name}:`);
  console.log(`  章节: ${subjectChapters.length}`);
  console.log(`  知识点: ${subjectKnowledgePoints.length}`);
  console.log(`  题目: ${subjectQuestions.length}`);
  console.log(`  → output/${subjectId}/index.json`);
}

// 生成 metadata.json
const metadata = {
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  subjects: MOCK_SUBJECTS.map(s => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    color: s.color,
    description: `${subjectsData[s.id].knowledgePoints.length}个知识点 + ${subjectsData[s.id].questions.length}道题目`,
    kpCount: subjectsData[s.id].knowledgePoints.length,
    qCount: subjectsData[s.id].questions.length,
    chapters: subjectsData[s.id].chapters,
  })),
};

fs.writeFileSync(
  path.join(outputDir, 'metadata.json'),
  JSON.stringify(metadata, null, 2),
  'utf-8'
);

console.log('\n' + '='.repeat(60));
console.log('输出: output/metadata.json');
console.log('='.repeat(60));
console.log('[OK] 完成!');
