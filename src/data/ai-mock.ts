/**
 * ============================================================================
 * AI 模拟数据 (Mock Data)
 * ============================================================================
 *
 * 【用途】为 aiService.ts 的 mock 实现提供数据源
 * 【后续】接入真实 LLM 后，此文件仍可保留作为离线兜底/测试用途
 *
 * 【数据结构】
 * 1. AI_ANSWER_TEMPLATES → 回答模板（按学科+关键词匹配）
 * 2. AI_GENERIC_ANSWER   → 无法匹配时的通用回答
 * 3. AI_QUIZ_POOL        → 预置 AI 题库（10 道，覆盖 4 个学科）
 * 4. ENCOURAGEMENT_RULES → 鼓励语规则模板（6 个场景，支持占位符）
 *
 * 【扩展方式】
 * - 新增学科：在 AI_ANSWER_TEMPLATES 添加新的 keywords+template
 * - 新增题目：在 AI_QUIZ_POOL 添加，knowledgePointId 需与 mock.ts 中的 ID 对应
 * - 新增鼓励场景：在 ENCOURAGEMENT_RULES 添加并在 aiService.ts 中添加判断逻辑
 * ============================================================================
 */

import type { Question } from '@/types';

// ===== AI Answer Templates =====

export interface AnswerTemplate {
  keywords: string[];
  subjectId?: string;
  template: string;
}

export const AI_ANSWER_TEMPLATES: AnswerTemplate[] = [
  // TCM
  { keywords: ['麻黄'], subjectId: 'tcm', template: '关于麻黄，我来为你详细讲解：\n\n麻黄为麻黄科植物草麻黄、中麻黄或木贼麻黄的干燥草质茎。\n\n**性味归经**：性温，味辛、微苦。归肺、膀胱经。\n\n**功效**：发汗散寒、宣肺平喘、利水消肿。\n\n**临床应用**：常用于风寒感冒、胸闷喘咳、风水浮肿等症。麻黄汤是经典方剂之一。\n\n**注意事项**：体虚自汗、阴虚盗汗者慎用。' },
  { keywords: ['桂枝'], subjectId: 'tcm', template: '关于桂枝，这是一味重要的解表药：\n\n桂枝为樟科植物肉桂的干燥嫩枝。\n\n**性味归经**：性温，味辛、甘。归心、肺、膀胱经。\n\n**功效**：发汗解肌、温通经脉、助阳化气、平冲降逆。\n\n**经典方剂**：桂枝汤（桂枝+芍药+甘草+生姜+大枣）是调和营卫的代表方。\n\n**与麻黄的区别**：麻黄发汗力强，适用于表实证；桂枝发汗力较缓，适用于表虚证。' },
  { keywords: ['黄连', '清热'], subjectId: 'tcm', template: '黄连是清热燥湿的代表药物：\n\n**来源**：毛茛科植物黄连、三角叶黄连或云连的干燥根茎。\n\n**性味归经**：性寒，味苦。归心、脾、胃、肝、胆、大肠经。\n\n**功效**：清热燥湿、泻火解毒。\n\n**特点**：黄连最善清中焦湿热，又善泻心火。含小檗碱（黄连素），有广谱抗菌作用。' },
  { keywords: ['黄芩'], subjectId: 'tcm', template: '黄芩也是重要的清热药：\n\n**来源**：唇形科植物黄芩的干燥根。\n\n**性味归经**：性寒，味苦。归肺、胆、脾、大肠、小肠经。\n\n**功效**：清热燥湿、泻火解毒、止血、安胎。\n\n**与黄连区别**：黄芩偏清上焦肺热，黄连偏清中焦胃热，黄柏偏清下焦湿热。这是"三黄"的经典区分。' },
  // Chemistry
  { keywords: ['烷烃', '命名'], subjectId: 'chem', template: '烷烃的系统命名法是有机化学的基础：\n\n**命名步骤**：\n1. **选主链**：选最长的碳链作为主链\n2. **编号**：从距取代基最近的一端开始编号\n3. **写名称**：取代基位号-取代基名称-母体名称\n\n**示例**：2-甲基丁烷（CH3CH(CH3)CH2CH3）\n\n**注意**：多个取代基按"次序规则"排列，相同取代基合并用二、三等表示。' },
  { keywords: ['苯', '苯环'], subjectId: 'chem', template: '苯环结构是有机化学的核心概念：\n\n**分子式**：C6H6\n\n**结构特点**：\n- 平面正六边形结构\n- 6个碳原子均采用sp2杂化\n- 每个碳原子剩余的p轨道垂直于环平面，形成离域pi键\n\n**凯库勒结构**：交替单双键表示，但实际上所有C-C键等长（0.140nm），介于单键和双键之间。\n\n**化学性质**：易取代、难加成、难氧化——这是芳香性的体现。' },
  // Programming
  { keywords: ['闭包', 'closure'], subjectId: 'prog', template: '闭包是JavaScript中的核心概念：\n\n**定义**：闭包是指有权访问另一个函数作用域中变量的函数。\n\n**形成条件**：\n1. 函数嵌套\n2. 内部函数引用外部函数的变量\n3. 内部函数被返回或传递到外部\n\n**经典示例**：\n```\nfunction counter() {\n  let count = 0;\n  return () => ++count;\n}\nconst inc = counter();\ninc(); // 1\ninc(); // 2\n```\n\n**用途**：数据封装、模块模式、函数柯里化等。\n**注意**：闭包会持有外部变量的引用，可能导致内存泄漏。' },
  { keywords: ['React', 'react', '组件'], subjectId: 'prog', template: 'React是目前最流行的前端框架之一：\n\n**核心概念**：\n- **组件化**：UI拆分为可复用的独立组件\n- **虚拟DOM**：通过diff算法高效更新真实DOM\n- **单向数据流**：props从父组件流向子组件\n\n**Hooks**（函数组件的核心）：\n- `useState`：管理组件状态\n- `useEffect`：处理副作用\n- `useContext`：跨组件共享数据\n- `useReducer`：复杂状态管理\n\n**最佳实践**：保持组件职责单一，合理拆分，避免不必要的重渲染。' },
  // English
  { keywords: ['时态', 'tense'], subjectId: 'eng', template: '英语时态是语法的核心：\n\n**三大基本时态**：\n- **一般现在时**：表习惯/事实，I study every day.\n- **一般过去时**：表过去动作，I studied yesterday.\n- **一般将来时**：表将来计划，I will study tomorrow.\n\n**进行时**：强调动作正在进行\n- 现在进行：I am studying.\n- 过去进行：I was studying.\n\n**完成时**：强调动作的完成/影响\n- 现在完成：I have studied this topic.\n- 过去完成：I had studied before the test.\n\n**记忆技巧**：时态 = 时间 + 状态，先确定时间点，再判断动作状态。' },
];

// Generic fallback template
export const AI_GENERIC_ANSWER = '这是一个很好的问题！让我来帮你分析：\n\n根据你提到的内容，这涉及到学习中的重要知识点。建议你：\n\n1. **回顾基础概念**：先确保理解相关的基础知识\n2. **对比记忆**：将类似的知识点放在一起对比，找出异同\n3. **实践巩固**：通过做题来检验自己的理解程度\n\n知识的掌握需要反复练习，我给你出一道题来巩固一下吧！';

// ===== AI Quiz Pool =====

export const AI_QUIZ_POOL: Question[] = [
  // TCM questions
  {
    id: 'ai-pool-1', knowledgePointId: 'kp-1', subjectId: 'tcm', type: 'single_choice',
    stem: '麻黄的主要功效不包括以下哪项？',
    options: [
      { id: 'a', text: '发汗散寒' }, { id: 'b', text: '宣肺平喘' },
      { id: 'c', text: '利水消肿' }, { id: 'd', text: '活血化瘀' },
    ],
    correctAnswers: ['d'],
    explanation: '麻黄的功效为发汗散寒、宣肺平喘、利水消肿，不具有活血化瘀的功效。活血化瘀是川芎、丹参等药物的功效。',
  },
  {
    id: 'ai-pool-2', knowledgePointId: 'kp-2', subjectId: 'tcm', type: 'single_choice',
    stem: '桂枝与麻黄在解表方面的主要区别是什么？',
    options: [
      { id: 'a', text: '桂枝性寒，麻黄性温' }, { id: 'b', text: '桂枝适用于表虚证，麻黄适用于表实证' },
      { id: 'c', text: '桂枝不能发汗' }, { id: 'd', text: '两者没有区别' },
    ],
    correctAnswers: ['b'],
    explanation: '桂枝发汗力较缓和，适用于风寒表虚证（有汗）；麻黄发汗力较强，适用于风寒表实证（无汗）。两者都性温。',
  },
  {
    id: 'ai-pool-3', knowledgePointId: 'kp-3', subjectId: 'tcm', type: 'single_choice',
    stem: '"三黄"中，善清中焦胃热的是哪一味药？',
    options: [
      { id: 'a', text: '黄芩' }, { id: 'b', text: '黄连' },
      { id: 'c', text: '黄柏' }, { id: 'd', text: '黄芪' },
    ],
    correctAnswers: ['b'],
    explanation: '三黄各有侧重：黄芩清上焦肺热，黄连清中焦胃热，黄柏清下焦湿热。黄芪不属于三黄，是补气药。',
  },
  {
    id: 'ai-pool-4', knowledgePointId: 'kp-4', subjectId: 'tcm', type: 'true_false',
    stem: '黄芩除了清热燥湿外，还具有安胎的功效。',
    options: [
      { id: 'a', text: '正确' }, { id: 'b', text: '错误' },
    ],
    correctAnswers: ['a'],
    explanation: '黄芩确实具有安胎功效。其性寒能清热，又入脾经能健脾，脾健则胎安。常与白术配伍用于胎动不安。',
  },
  // Chemistry questions
  {
    id: 'ai-pool-5', knowledgePointId: 'kp-5', subjectId: 'chem', type: 'single_choice',
    stem: '对2-甲基丁烷进行系统命名时，主链碳原子数为？',
    options: [
      { id: 'a', text: '3' }, { id: 'b', text: '4' },
      { id: 'c', text: '5' }, { id: 'd', text: '2' },
    ],
    correctAnswers: ['b'],
    explanation: '2-甲基丁烷的主链为丁烷（4个碳），在2号位有一个甲基取代基。选主链时要选最长的碳链。',
  },
  {
    id: 'ai-pool-6', knowledgePointId: 'kp-6', subjectId: 'chem', type: 'single_choice',
    stem: '苯环中碳碳键的键长约为多少nm？',
    options: [
      { id: 'a', text: '0.154（单键）' }, { id: 'b', text: '0.134（双键）' },
      { id: 'c', text: '0.140（介于两者之间）' }, { id: 'd', text: '0.120（三键）' },
    ],
    correctAnswers: ['c'],
    explanation: '苯环中的碳碳键不是单纯的单键或双键，而是由离域pi键形成的等价键，键长约0.140nm，介于单键（0.154nm）和双键（0.134nm）之间。',
  },
  // Programming questions
  {
    id: 'ai-pool-7', knowledgePointId: 'kp-7', subjectId: 'prog', type: 'single_choice',
    stem: '以下关于JavaScript闭包的说法，哪个是错误的？',
    options: [
      { id: 'a', text: '闭包可以访问外部函数的变量' },
      { id: 'b', text: '闭包在外部函数执行完后仍然可以访问其变量' },
      { id: 'c', text: '闭包会自动释放外部变量的引用' },
      { id: 'd', text: '闭包常用于数据封装和模块模式' },
    ],
    correctAnswers: ['c'],
    explanation: '闭包会持有外部变量的引用，不会自动释放。这就是为什么闭包可能导致内存泄漏——被引用的变量无法被垃圾回收。',
  },
  {
    id: 'ai-pool-8', knowledgePointId: 'kp-8', subjectId: 'prog', type: 'single_choice',
    stem: 'React中，useEffect的清理函数在什么时候执行？',
    options: [
      { id: 'a', text: '组件挂载时' },
      { id: 'b', text: '组件卸载时或依赖项变化前' },
      { id: 'c', text: '仅在组件卸载时' },
      { id: 'd', text: '每次渲染后' },
    ],
    correctAnswers: ['b'],
    explanation: 'useEffect的清理函数在组件卸载时执行，也在依赖项变化导致effect重新执行之前执行。这确保了旧的副作用被正确清理。',
  },
  // English questions
  {
    id: 'ai-pool-9', knowledgePointId: 'kp-9', subjectId: 'eng', type: 'single_choice',
    stem: '选择正确的时态填空：She ___ (study) English for three years by next month.',
    options: [
      { id: 'a', text: 'will study' }, { id: 'b', text: 'will have studied' },
      { id: 'c', text: 'has studied' }, { id: 'd', text: 'studied' },
    ],
    correctAnswers: ['b'],
    explanation: '"by next month"表示到将来某个时间点为止，应使用将来完成时 will have + 过去分词。表示到下个月时，她将已经学了三年英语。',
  },
  {
    id: 'ai-pool-10', knowledgePointId: 'kp-10', subjectId: 'eng', type: 'single_choice',
    stem: '以下哪个句子使用了正确的现在完成时？',
    options: [
      { id: 'a', text: 'I have went to school.' },
      { id: 'b', text: 'I have gone to school.' },
      { id: 'c', text: 'I have go to school.' },
      { id: 'd', text: 'I have going to school.' },
    ],
    correctAnswers: ['b'],
    explanation: '现在完成时结构为 have/has + 过去分词。go的过去分词是gone，所以正确答案是"I have gone to school."',
  },
];

// ===== Smart Encouragement Templates =====

export interface EncouragementRule {
  id: string;
  condition: 'milestone_days' | 'weak_subjects' | 'high_mastery' | 'many_wrong' | 'many_new' | 'random';
  templates: string[];
}

export const ENCOURAGEMENT_RULES: EncouragementRule[] = [
  {
    id: 'milestone',
    condition: 'milestone_days',
    templates: [
      '你已经连续学习{days}天了！坚持就是力量，继续保持这份热情吧！',
      '学习{days}天达成！这份毅力值得点赞，知识的积累终将厚积薄发。',
      '{days}天的坚持，每一天都在为未来打基础。你做得太好了！',
    ],
  },
  {
    id: 'weak',
    condition: 'weak_subjects',
    templates: [
      '{subject}还需要多练习哦，今天花点时间重点突破一下吧！',
      '数据显示{subject}是你的薄弱环节，定向攻克一定能快速提升！',
      '别担心{subject}，每个学霸都有过薄弱学科，多练几次就好了。',
    ],
  },
  {
    id: 'high_mastery',
    condition: 'high_mastery',
    templates: [
      '你已经掌握了{count}个知识点，学习效率很高，继续保持！',
      '{count}个知识点已达到熟练水平，你的努力正在变成实力！',
      '已有{count}个知识点被你拿下，你就是学习小天才！',
    ],
  },
  {
    id: 'many_wrong',
    condition: 'many_wrong',
    templates: [
      '错题本里有{count}道题在等你消灭，今天挑战一下吧！',
      '别忘了错题本里的{count}道题，攻克它们能大幅提升成绩。',
      '每一道错题都是进步的阶梯，{count}道错题正等着你来征服！',
    ],
  },
  {
    id: 'many_new',
    condition: 'many_new',
    templates: [
      '今天有{count}个新知识点待学习，一步一步来，你一定行！',
      '{count}个新知识等待探索，新的知识就像新的宝藏！',
      '今天的{count}个新知识点，每学一个都是新的收获。加油！',
    ],
  },
  {
    id: 'random',
    condition: 'random',
    templates: [
      '每天进步一点点，终将成就大不同。加油！',
      '学习是最好的投资，你的每一分努力都不会白费。',
      '坚持学习的你，已经比大多数人优秀了！',
      '知识是照亮前路的灯塔，今天也要元气满满地学习哦！',
      '学而不思则罔，思而不学则殆。边学边想，效果加倍！',
    ],
  },
];
