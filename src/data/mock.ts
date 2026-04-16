import type { Subject, Chapter, KnowledgePointExtended, Question } from '@/types';

// 预置学科数据 - 演示版本（用于新用户养成学习习惯）
export const MOCK_SUBJECTS: Subject[] = [
  { id: 'tcm', name: '中药学', icon: '🌿', color: '#10b981', knowledgePointCount: 3 },
  { id: 'chem', name: '化学', icon: '🧪', color: '#3b82f6', knowledgePointCount: 2 },
  { id: 'prog', name: '编程', icon: '💻', color: '#8b5cf6', knowledgePointCount: 2 },
  { id: 'eng', name: '英语', icon: '📖', color: '#f59e0b', knowledgePointCount: 2 },
  { id: 'math', name: '数学', icon: '📐', color: '#ef4444', knowledgePointCount: 2 },
];

// 预置章节数据
export const MOCK_CHAPTERS: Chapter[] = [
  // 中药学
  { id: 'tcm-c1', subjectId: 'tcm', name: '解表药', order: 1 },
  { id: 'tcm-c2', subjectId: 'tcm', name: '清热药', order: 2 },
  { id: 'tcm-c3', subjectId: 'tcm', name: '补虚药', order: 3 },
  // 化学
  { id: 'chem-c1', subjectId: 'chem', name: '有机化学基础', order: 1 },
  { id: 'chem-c2', subjectId: 'chem', name: '无机化学基础', order: 2 },
  // 编程
  { id: 'prog-c1', subjectId: 'prog', name: 'JavaScript基础', order: 1 },
  { id: 'prog-c2', subjectId: 'prog', name: 'React框架', order: 2 },
  // 英语
  { id: 'eng-c1', subjectId: 'eng', name: '核心词汇', order: 1 },
  { id: 'eng-c2', subjectId: 'eng', name: '语法精讲', order: 2 },
  // 数学
  { id: 'math-c1', subjectId: 'math', name: '函数与极限', order: 1 },
  { id: 'math-c2', subjectId: 'math', name: '导数与微分', order: 2 },
];

const now = new Date().toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

// ==================== 预置知识点数据（演示版本） ====================
// 精选内容，帮助新用户养成学习习惯
export const MOCK_KNOWLEDGE_POINTS: KnowledgePointExtended[] = [
  // 中药学 - 3个经典药
  {
    id: 'kp-1', subjectId: 'tcm', chapterId: 'tcm-c1', name: '麻黄',
    explanation: '麻黄为麻黄科植物草麻黄、中麻黄或木贼麻黄的干燥草质茎。性温，味辛、微苦。归肺、膀胱经。功效：发汗散寒、宣肺平喘、利水消肿。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-2', subjectId: 'tcm', chapterId: 'tcm-c1', name: '桂枝',
    explanation: '桂枝为樟科植物肉桂的干燥嫩枝。性温，味辛、甘。归心、肺、膀胱经。功效：发汗解肌、温通经脉、助阳化气。',
    proficiency: 'rusty', lastReviewedAt: yesterday, nextReviewAt: now, reviewCount: 2, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-3', subjectId: 'tcm', chapterId: 'tcm-c2', name: '黄连',
    explanation: '黄连为毛茛科植物黄连、三角叶黄连或云连的干燥根茎。性寒，味苦。归心、脾、胃、肝、胆、大肠经。功效：清热燥湿、泻火解毒。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // 化学 - 2个基础概念
  {
    id: 'kp-chem-1', subjectId: 'chem', chapterId: 'chem-c1', name: '甲烷',
    explanation: '甲烷是最简单的有机化合物，分子式为CH₄。它是天然气、沼气的主要成分。甲烷是正四面体结构，碳原子位于中心，四个氢原子位于顶点。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-chem-2', subjectId: 'chem', chapterId: 'chem-c2', name: '元素周期律',
    explanation: '元素周期律是指元素的性质随着原子序数的递增而呈周期性变化的规律。包括原子半径、化合价、金属性和非金属性等的周期性变化。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // 编程 - 2个核心概念
  {
    id: 'kp-prog-1', subjectId: 'prog', chapterId: 'prog-c1', name: '变量',
    explanation: '在JavaScript中，变量是存储数据的容器。使用let、const或var声明。let和const是ES6引入的，具有块级作用域。const用于声明常量。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-prog-2', subjectId: 'prog', chapterId: 'prog-c2', name: 'React Hooks',
    explanation: 'React Hooks是React 16.8引入的新特性，允许在函数组件中使用状态和其他React特性。常用的有useState、useEffect、useContext等。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // 英语 - 2个实用内容
  {
    id: 'kp-eng-1', subjectId: 'eng', chapterId: 'eng-c1', name: 'abandon',
    explanation: 'abandon v. 放弃；抛弃；遗弃。搭配：abandon oneself to 沉溺于；abandon doing sth. 放弃做某事。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-eng-2', subjectId: 'eng', chapterId: 'eng-c2', name: '虚拟语气',
    explanation: '虚拟语气用来表达假设、愿望、怀疑或推测等非真实的情况。常见形式：If I were you, I would...（如果我是你，我会...）',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // 数学 - 2个基础概念
  {
    id: 'kp-math-1', subjectId: 'math', chapterId: 'math-c1', name: '函数',
    explanation: '函数是数学中的基本概念。设A、B是非空实数集，如果对于A中的任意一个数x，按照某种确定的对应关系f，在B中都有唯一确定的数y和它对应，就称f：A→B是一个函数。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-math-2', subjectId: 'math', chapterId: 'math-c2', name: '导数',
    explanation: '导数是函数在某一点的瞬时变化率。几何上，它表示函数曲线在该点的切线斜率。导数广泛应用于求极值、判断函数单调性等。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
];

// ==================== 预置题目数据（演示版本） ====================
// 每个知识点配1道题目，帮助用户巩固
export const MOCK_QUESTIONS: Question[] = [
  // 中药学
  {
    id: 'q-1', subjectId: 'tcm', chapterId: 'tcm-c1', knowledgePointId: 'kp-1',
    type: 'single_choice',
    stem: '麻黄的功效不包括下列哪项？',
    options: [
      { id: 'opt-1', text: '发汗散寒' },
      { id: 'opt-2', text: '宣肺平喘' },
      { id: 'opt-3', text: '利水消肿' },
      { id: 'opt-4', text: '清热解毒' },
    ],
    correctAnswers: ['opt-4'],
    explanation: '麻黄性温，味辛、微苦，功效为发汗散寒、宣肺平喘、利水消肿。清热解毒不是麻黄的功效。',
  },
  {
    id: 'q-2', subjectId: 'tcm', chapterId: 'tcm-c1', knowledgePointId: 'kp-2',
    type: 'single_choice',
    stem: '桂枝的性味是？',
    options: [
      { id: 'opt-1', text: '性寒，味苦' },
      { id: 'opt-2', text: '性温，味辛、甘' },
      { id: 'opt-3', text: '性微寒，味辛' },
      { id: 'opt-4', text: '性平，味甘' },
    ],
    correctAnswers: ['opt-2'],
    explanation: '桂枝性温，味辛、甘。归心、肺、膀胱经。',
  },
  {
    id: 'q-3', subjectId: 'tcm', chapterId: 'tcm-c2', knowledgePointId: 'kp-3',
    type: 'single_choice',
    stem: '黄连善于治疗？',
    options: [
      { id: 'opt-1', text: '风寒感冒' },
      { id: 'opt-2', text: '湿热泻痢' },
      { id: 'opt-3', text: '肺寒咳嗽' },
      { id: 'opt-4', text: '脾胃虚寒' },
    ],
    correctAnswers: ['opt-2'],
    explanation: '黄连性寒，味苦，功效清热燥湿、泻火解毒，是治疗湿热泻痢的要药。',
  },
  // 化学
  {
    id: 'q-chem-1', subjectId: 'chem', chapterId: 'chem-c1', knowledgePointId: 'kp-chem-1',
    type: 'single_choice',
    stem: '甲烷的分子式是？',
    options: [
      { id: 'opt-chem-1', text: 'C₂H₆' },
      { id: 'opt-chem-2', text: 'CH₄' },
      { id: 'opt-chem-3', text: 'C₂H₄' },
      { id: 'opt-chem-4', text: 'C₆H₆' },
    ],
    correctAnswers: ['opt-chem-2'],
    explanation: '甲烷的分子式是CH₄，是最简单的有机化合物。',
  },
  // 编程
  {
    id: 'q-prog-1', subjectId: 'prog', chapterId: 'prog-c1', knowledgePointId: 'kp-prog-1',
    type: 'single_choice',
    stem: '以下哪个关键字用于声明常量？',
    options: [
      { id: 'opt-prog-1', text: 'let' },
      { id: 'opt-prog-2', text: 'const' },
      { id: 'opt-prog-3', text: 'var' },
      { id: 'opt-prog-4', text: 'function' },
    ],
    correctAnswers: ['opt-prog-2'],
    explanation: 'const用于声明常量，值不能重新赋值。let和var用于声明变量。',
  },
  // 英语
  {
    id: 'q-eng-1', subjectId: 'eng', chapterId: 'eng-c1', knowledgePointId: 'kp-eng-1',
    type: 'single_choice',
    stem: '"abandon" 的意思是？',
    options: [
      { id: 'opt-eng-1', text: '接受' },
      { id: 'opt-eng-2', text: '放弃' },
      { id: 'opt-eng-3', text: '继续' },
      { id: 'opt-eng-4', text: '开始' },
    ],
    correctAnswers: ['opt-eng-2'],
    explanation: 'abandon v. 放弃；抛弃；遗弃。',
  },
  // 数学
  {
    id: 'q-math-1', subjectId: 'math', chapterId: 'math-c1', knowledgePointId: 'kp-math-1',
    type: 'single_choice',
    stem: '函数中，每个x对应几个y值？',
    options: [
      { id: 'opt-math-1', text: '1个' },
      { id: 'opt-math-2', text: '2个' },
      { id: 'opt-math-3', text: '多个' },
      { id: 'opt-math-4', text: '不确定' },
    ],
    correctAnswers: ['opt-math-1'],
    explanation: '函数的定义是：对于集合A中的任意一个数x，在集合B中都有唯一确定的数y和它对应。',
  },
];
