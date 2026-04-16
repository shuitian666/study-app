/**
 * 从完整mock.ts生成各学科JSON文件
 * 用于上传到OSS云端
 */

const fs = require('fs');
const path = require('path');

// 添加tsx/ts支持
require('@esbuild-kit/cjs-loader');

console.log('='.repeat(60));
console.log('生成知识库JSON文件');
console.log('='.repeat(60));

// 读取完整的mock.ts（从test001目录）
const mockPath = path.join(__dirname, '..', 'test001', 'TRAE_project', 'src', 'data', 'mock.ts');
if (!fs.existsSync(mockPath)) {
  console.log('[ERROR] 找不到完整mock.ts:', mockPath);
  process.exit(1);
}

console.log('\n[1/4] 读取mock.ts...');

// 简单的TypeScript到JavaScript转换
let content = fs.readFileSync(mockPath, 'utf-8');

// 先提取各个数组
function extractArray(content, startMarker, endMarker) {
  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) return null;

  // 找到开始的 [
  let arrayStart = content.indexOf('[', startIdx);
  if (arrayStart === -1) return null;

  // 找到匹配的 ]
  let bracketCount = 0;
  let arrayEnd = -1;
  for (let i = arrayStart; i < content.length; i++) {
    if (content[i] === '[') bracketCount++;
    if (content[i] === ']') {
      bracketCount--;
      if (bracketCount === 0) {
        arrayEnd = i;
        break;
      }
    }
  }

  if (arrayEnd === -1) return null;
  return content.slice(arrayStart, arrayEnd + 1);
}

console.log('[2/4] 提取数据数组...');

const subjectsText = extractArray(content, 'export const MOCK_SUBJECTS:', 'export const MOCK_CHAPTERS:');
const chaptersText = extractArray(content, 'export const MOCK_CHAPTERS:', '// ==================== 预置知识点数据 ====================');
const kpText = extractArray(content, 'export const MOCK_KNOWLEDGE_POINTS:', '// ==================== 预置题目数据 ====================');
const qText = extractArray(content, 'export const MOCK_QUESTIONS:', null);

// 转换为可执行的JS
function tsToJs(tsCode) {
  if (!tsCode) return '[]';

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

  result = result.replace(/\bnow\b/g, `"${now}"`);
  result = result.replace(/\byesterday\b/g, `"${yesterday}"`);
  result = result.replace(/\btwoDaysAgo\b/g, `"${yesterday}"`);
  result = result.replace(/\bweekAgo\b/g, `"${weekAgo}"`);
  result = result.replace(/new Date\([^)]*\)/g, `"${now}"`);

  result = result.replace(/,\s*(\w+):/g, ',"$1":');
  result = result.replace(/(\w+):/g, '"$1":');

  result = result.replace(/\/\/.*$/gm, '');
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');

  return result;
}

console.log('[3/4] 解析数据...');

const subjects = eval(tsToJs(subjectsText));
const chapters = eval(tsToJs(chaptersText));
const knowledgePoints = eval(tsToJs(kpText));
const questions = eval(tsToJs(qText));

console.log(`  解析成功:`);
console.log(`    学科: ${subjects.length}`);
console.log(`    章节: ${chapters.length}`);
console.log(`    知识点: ${knowledgePoints.length}`);
console.log(`    题目: ${questions.length}`);

// 按学科分组
const subjectsData = {};
for (const subject of subjects) {
  const subjectId = subject.id;
  subjectsData[subjectId] = {
    subject,
    chapters: chapters.filter(c => c.subjectId === subjectId),
    knowledgePoints: knowledgePoints.filter(kp => kp.subjectId === subjectId),
    questions: questions.filter(q => q.subjectId === subjectId),
  };

  console.log(`\n  ${subject.name}: `
    + `${subjectsData[subjectId].chapters.length} 章节, `
    + `${subjectsData[subjectId].knowledgePoints.length} 知识点, `
    + `${subjectsData[subjectId].questions.length} 题目`);
}

// 确保输出目录存在
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('\n[4/4] 生成 JSON 文件');

// 生成各学科JSON
for (const subjectId in subjectsData) {
  const data = subjectsData[subjectId];
  const subjectDir = path.join(outputDir, subjectId);
  if (!fs.existsSync(subjectDir)) {
    fs.mkdirSync(subjectDir, { recursive: true });
  }

  const outputData = {
    version: '1.0.0',
    subjectId,
    chapters: data.chapters,
    knowledgePoints: data.knowledgePoints,
    questions: data.questions,
  };

  const outputFile = path.join(subjectDir, 'index.json');
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`  [OK] ${outputFile}`);
}

// 生成 metadata.json
const metadataSubjects = [];
for (const subjectId in subjectsData) {
  const data = subjectsData[subjectId];
  const subject = data.subject;
  metadataSubjects.push({
    id: subjectId,
    name: subject.name,
    icon: subject.icon,
    color: subject.color,
    description: `${data.knowledgePoints.length}个知识点 + ${data.questions.length}道题目`,
    kpCount: data.knowledgePoints.length,
    qCount: data.questions.length,
    chapters: data.chapters,
  });
}

const metadata = {
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  subjects: metadataSubjects,
};

const metadataFile = path.join(outputDir, 'metadata.json');
fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
console.log(`\n  [OK] ${metadataFile}`);

console.log('\n' + '='.repeat(60));
console.log('[OK] 全部完成!');
console.log(`输出目录: ${outputDir}`);
console.log('='.repeat(60));
