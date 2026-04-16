/**
 * 从 mock.ts 中提取知识库数据
 * 使用 Node.js 直接运行，避免 Python 解析复杂的 TypeScript
 */

const fs = require('fs');
const path = require('path');

// 读取 mock.ts
const mockPath = path.join(__dirname, 'src', 'data', 'mock.ts');
let content = fs.readFileSync(mockPath, 'utf-8');

// 简化处理：提取 JSON 部分
// 先提取 MOCK_SUBJECTS
const subjectsMatch = content.match(/export const MOCK_SUBJECTS: Subject\[\] = (\[[\s\S]*?\]);/);
const chaptersMatch = content.match(/export const MOCK_CHAPTERS: Chapter\[\] = (\[[\s\S]*?\]);/);
const kpMatch = content.match(/export const MOCK_KNOWLEDGE_POINTS: KnowledgePointExtended\[\] = (\[[\s\S]*?\]);/);
const qMatch = content.match(/export const MOCK_QUESTIONS: Question\[\] = (\[[\s\S]*?\]);/);

// 转换为可执行的 JS
function tsToJs(tsCode) {
  if (!tsCode) return '[]';
  // 先定义一些 mock.ts 中使用的变量
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  let result = tsCode
    .replace(/:\s*Subject/g, '')
    .replace(/:\s*Chapter/g, '')
    .replace(/:\s*KnowledgePointExtended/g, '')
    .replace(/:\s*KnowledgePoint/g, '')
    .replace(/:\s*Question/g, '')
    .replace(/:\s*QuestionOption/g, '')
    .replace(/:\s*QuestionType/g, '')
    .replace(/:\s*ProficiencyLevel/g, '')
    .replace(/:\s*KnowledgeSource/g, '')
    .replace(/:\s*string/g, '')
    .replace(/:\s*number/g, '')
    .replace(/:\s*boolean/g, '')
    .replace(/:\s*any/g, '')
    .replace(/\?:/g, ':');

  // 替换变量为实际值
  result = result.replace(/\bnow\b/g, `"${now}"`);
  result = result.replace(/\byesterday\b/g, `"${yesterday}"`);
  result = result.replace(/\bweekAgo\b/g, `"${weekAgo}"`);
  result = result.replace(/\btwoDaysAgo\b/g, `"${yesterday}"`);
  result = result.replace(/\bnew Date\([^)]*\)/g, `"${now}"`);

  // 处理 JSON 格式
  result = result.replace(/,\s*(\w+):/g, ',"$1":');
  result = result.replace(/(\w+):/g, '"$1":');

  return result;
}

const subjects = eval(tsToJs(subjectsMatch ? subjectsMatch[1] : '[]'));
const chapters = eval(tsToJs(chaptersMatch ? chaptersMatch[1] : '[]'));
const knowledgePoints = eval(tsToJs(kpMatch ? kpMatch[1] : '[]'));
const questions = eval(tsToJs(qMatch ? qMatch[1] : '[]'));

console.log('='.repeat(60));
console.log('解析结果');
console.log('='.repeat(60));
console.log(`学科: ${subjects.length}`);
console.log(`章节: ${chapters.length}`);
console.log(`知识点: ${knowledgePoints.length}`);
console.log(`题目: ${questions.length}`);

// 按学科分组
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const subjectsData = {};
for (const subject of subjects) {
  const subjectId = subject.id;
  subjectsData[subjectId] = {
    subject,
    chapters: chapters.filter(c => c.subjectId === subjectId),
    knowledgePoints: knowledgePoints.filter(kp => kp.subjectId === subjectId),
    questions: questions.filter(q => q.subjectId === subjectId),
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
    chapters: subjectsData[subjectId].chapters,
    knowledgePoints: subjectsData[subjectId].knowledgePoints,
    questions: subjectsData[subjectId].questions,
  };

  fs.writeFileSync(
    path.join(subjectDir, 'index.json'),
    JSON.stringify(outputData, null, 2),
    'utf-8'
  );

  console.log(`\n${subject.name}:`);
  console.log(`  章节: ${subjectsData[subjectId].chapters.length}`);
  console.log(`  知识点: ${subjectsData[subjectId].knowledgePoints.length}`);
  console.log(`  题目: ${subjectsData[subjectId].questions.length}`);
  console.log(`  → output/${subjectId}/index.json`);
}

// 生成 metadata.json
const metadata = {
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  subjects: subjects.map(s => ({
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
