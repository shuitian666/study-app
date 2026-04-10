import type { Subject, Chapter, KnowledgePointExtended, Question } from '@/types';

// 预置学科数据 - 包含权威知识内容
export const MOCK_SUBJECTS: Subject[] = [
  { id: 'tcm', name: '中药学', icon: '🌿', color: '#10b981', knowledgePointCount: 30 },
  { id: 'chem', name: '化学', icon: '🧪', color: '#3b82f6', knowledgePointCount: 40 },
  { id: 'prog', name: '编程', icon: '💻', color: '#8b5cf6', knowledgePointCount: 20 },
  { id: 'eng', name: '英语', icon: '📖', color: '#f59e0b', knowledgePointCount: 18 },
  { id: 'math', name: '数学', icon: '📐', color: '#ef4444', knowledgePointCount: 15 },
  { id: 'micro', name: '微生物与免疫学', icon: '🦠', color: '#059669', knowledgePointCount: 20 },
];

// 预置章节数据
export const MOCK_CHAPTERS: Chapter[] = [
  // 中药学
  { id: 'tcm-c1', subjectId: 'tcm', name: '解表药', order: 1 },
  { id: 'tcm-c2', subjectId: 'tcm', name: '清热药', order: 2 },
  { id: 'tcm-c3', subjectId: 'tcm', name: '补虚药', order: 3 },
  { id: 'tcm-c4', subjectId: 'tcm', name: '活血化瘀药', order: 4 },
  // 化学
  { id: 'chem-c1', subjectId: 'chem', name: '有机化学基础', order: 1 },
  { id: 'chem-c2', subjectId: 'chem', name: '无机化学基础', order: 2 },
  { id: 'chem-c3', subjectId: 'chem', name: '化学反应原理', order: 3 },
  { id: 'chem-c4', subjectId: 'chem', name: '波谱分析', order: 4 },
  // 编程
  { id: 'prog-c1', subjectId: 'prog', name: 'JavaScript基础', order: 1 },
  { id: 'prog-c2', subjectId: 'prog', name: 'React框架', order: 2 },
  { id: 'prog-c3', subjectId: 'prog', name: 'TypeScript进阶', order: 3 },
  // 英语
  { id: 'eng-c1', subjectId: 'eng', name: '核心词汇', order: 1 },
  { id: 'eng-c2', subjectId: 'eng', name: '语法精讲', order: 2 },
  { id: 'eng-c3', subjectId: 'eng', name: '写作句型', order: 3 },
  // 数学
  { id: 'math-c1', subjectId: 'math', name: '函数与极限', order: 1 },
  { id: 'math-c2', subjectId: 'math', name: '导数与微分', order: 2 },
  { id: 'math-c3', subjectId: 'math', name: '积分学', order: 3 },
  // 微生物与免疫学
  { id: 'micro-ch1', subjectId: 'micro', name: '微生物学基础', order: 1 },
  { id: 'micro-ch2', subjectId: 'micro', name: '细菌学', order: 2 },
  { id: 'micro-ch3', subjectId: 'micro', name: '病毒学', order: 3 },
  { id: 'micro-ch4', subjectId: 'micro', name: '免疫学基础', order: 4 },
];

const now = new Date().toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

// ==================== 预置知识点数据 ====================
export const MOCK_KNOWLEDGE_POINTS: KnowledgePointExtended[] = [
  // ==================== 中药学 - 解表药 ====================
  {
    id: 'kp-1', subjectId: 'tcm', chapterId: 'tcm-c1', name: '麻黄',
    explanation: '麻黄为麻黄科植物草麻黄、中麻黄或木贼麻黄的干燥草质茎。性温，味辛、微苦。归肺、膀胱经。功效：发汗散寒、宣肺平喘、利水消肿。用量：2-10g。发汗解表宜生用，止咳平喘多蜜炙用。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-2', subjectId: 'tcm', chapterId: 'tcm-c1', name: '桂枝',
    explanation: '桂枝为樟科植物肉桂的干燥嫩枝。性温，味辛、甘。归心、肺、膀胱经。功效：发汗解肌、温通经脉、助阳化气、平冲降逆。主治风寒感冒、寒凝血滞诸痛证、痰饮蓄水、心悸。',
    proficiency: 'rusty', lastReviewedAt: twoDaysAgo, nextReviewAt: now, reviewCount: 2, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-3', subjectId: 'tcm', chapterId: 'tcm-c1', name: '紫苏叶',
    explanation: '紫苏叶为唇形科植物紫苏的干燥叶（或带嫩枝）。性温，味辛。归肺、脾经。功效：解表散寒、行气和胃、解鱼蟹毒。用于风寒感冒、咳嗽痰多、妊娠呕吐、鱼蟹中毒。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-4', subjectId: 'tcm', chapterId: 'tcm-c1', name: '生姜',
    explanation: '生姜为姜科植物姜的新鲜根茎。性微温，味辛。归肺、脾、胃经。功效：解表散寒、温中止呕、温肺止咳、解鱼蟹毒。被称为"呕家圣药"。用法：煎服3-10g，或捣汁服。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-5', subjectId: 'tcm', chapterId: 'tcm-c1', name: '荆芥',
    explanation: '荆芥为唇形科植物荆芥的干燥地上部分。性微温，味辛。归肺、肝经。功效：解表散寒、透疹消疮、炒炭止血。荆芥穗发汗力更强。用于风寒感冒、头痛、麻疹不透、疮疡初起。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-6', subjectId: 'tcm', chapterId: 'tcm-c1', name: '防风',
    explanation: '防风为伞形科植物防风的干燥根。性微温，味辛、甘。归膀胱、肝、脾经。功效：祛风解表、胜湿止痛、止痉。用于风寒感冒、风湿痹痛、腹痛泄泻、破伤风。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-7', subjectId: 'tcm', chapterId: 'tcm-c1', name: '羌活',
    explanation: '羌活为伞形科植物羌活或宽叶羌活的干燥根茎及根。性温，味辛、苦。归膀胱、肾经。功效：解表散寒、祛风胜湿、止痛。主治风寒感冒、风湿痹痛，尤以上半身疼痛为宜。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-8', subjectId: 'tcm', chapterId: 'tcm-c1', name: '薄荷',
    explanation: '薄荷为唇形科植物薄荷的干燥地上部分。性凉，味辛。归肺、肝经。功效：疏散风热、清利头目、利咽透疹、疏肝行气。用量：3-6g，不宜久煎。用于风热感冒、头痛目赤、咽喉肿痛。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 中药学 - 清热药 ====================
  {
    id: 'kp-9', subjectId: 'tcm', chapterId: 'tcm-c2', name: '黄连',
    explanation: '黄连为毛茛科植物黄连、三角叶黄连或云连的干燥根茎。性寒，味苦。归心、脾、胃、肝、胆、大肠经。功效：清热燥湿、泻火解毒。是治疗湿热泻痢的要药。',
    proficiency: 'normal', lastReviewedAt: yesterday, nextReviewAt: new Date(Date.now() + 6 * 86400000).toISOString(), reviewCount: 5, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-10', subjectId: 'tcm', chapterId: 'tcm-c2', name: '黄芩',
    explanation: '黄芩为唇形科植物黄芩的干燥根。性寒，味苦。归肺、胆、脾、大肠、小肠经。功效：清热燥湿、泻火解毒、止血、安胎。常用于肺热咳嗽、湿热黄疸、胎热不安。',
    proficiency: 'master', lastReviewedAt: yesterday, nextReviewAt: new Date(Date.now() + 20 * 86400000).toISOString(), reviewCount: 10, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-11', subjectId: 'tcm', chapterId: 'tcm-c2', name: '黄柏',
    explanation: '黄柏为芸香科植物黄皮树或黄檗的干燥树皮。性寒，味苦。归肾、膀胱经。功效：清热燥湿、泻火解毒、退虚热。主要用于湿热泻痢、黄疸、带下、热淋、脚气。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-12', subjectId: 'tcm', chapterId: 'tcm-c2', name: '金银花',
    explanation: '金银花为忍冬科植物忍冬的干燥花蕾或带初开的花。性寒，味甘。归肺、心、胃经。功效：清热解毒、疏散风热。用于痈肿疔疮、风热感冒、温病初起、喉痹。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-13', subjectId: 'tcm', chapterId: 'tcm-c2', name: '连翘',
    explanation: '连翘为木犀科植物连翘的干燥果实。性微寒，味苦。归肺、心、小肠经。功效：清热解毒、消肿散结、疏散风热。有"疮家圣药"之称。用于风热感冒、温病初起。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-14', subjectId: 'tcm', chapterId: 'tcm-c2', name: '栀子',
    explanation: '栀子为茜草科植物栀子的干燥成熟果实。性寒，味苦。归心、肺、三焦经。功效：泻火除烦、清热利湿、凉血解毒。外用可消肿止痛。用于热病心烦、湿热黄疸、血热吐衄。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-15', subjectId: 'tcm', chapterId: 'tcm-c2', name: '知母',
    explanation: '知母为百合科植物知母的干燥根茎。性寒，味苦、甘。归肺、胃、肾经。功效：清热泻火、滋阴润燥。用于热病烦渴、肺热燥咳、骨蒸潮热、内热消渴。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 中药学 - 补虚药 ====================
  {
    id: 'kp-16', subjectId: 'tcm', chapterId: 'tcm-c3', name: '人参',
    explanation: '人参为五加科植物人参的干燥根和根茎。性微温，味甘、微苦。归脾、肺、心、肾经。功效：大补元气、复脉固脱、补脾益肺、生津养血、安神益智。被誉为"百草之王"。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-17', subjectId: 'tcm', chapterId: 'tcm-c3', name: '黄芪',
    explanation: '黄芪为豆科植物蒙古黄芪或膜荚黄芪的干燥根。性微温，味甘。归脾、肺经。功效：补气升阳、固表止汗、利水消肿、生津养血、行滞通痹。用于气虚乏力、脾虚泄泻。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-18', subjectId: 'tcm', chapterId: 'tcm-c3', name: '当归',
    explanation: '当归为伞形科植物当归的干燥根。性温，味甘、辛。归肝、心、脾经。功效：补血活血、调经止痛、润肠通便。为补血要药、妇科要药。用于血虚萎黄、月经不调。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-19', subjectId: 'tcm', chapterId: 'tcm-c3', name: '熟地黄',
    explanation: '熟地黄为生地黄的炮制加工品。性微温，味甘。归肝、肾经。功效：补血滋阴、益精填髓。为补血要药，用于血虚萎黄、心悸怔忡、月经不调。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-20', subjectId: 'tcm', chapterId: 'tcm-c3', name: '阿胶',
    explanation: '阿胶为马科动物驴的干燥皮或鲜皮经煎煮、浓缩制成的固体胶。性平，味甘。归肝、肺、肾经。功效：补血止血、滋阴润燥。为补血要药，用于血虚萎黄、眩晕心悸。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 中药学 - 活血化瘀药 ====================
  {
    id: 'kp-21', subjectId: 'tcm', chapterId: 'tcm-c4', name: '川芎',
    explanation: '川芎为伞形科植物川芎的干燥根茎。性温，味辛。归肝、胆、心包经。功效：活血行气、祛风止痛。为"血中气药"，能下调经水、中开郁结。用于月经不调、胸痹心痛。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-22', subjectId: 'tcm', chapterId: 'tcm-c4', name: '丹参',
    explanation: '丹参为唇形科植物丹参的干燥根和根茎。性微寒，味苦。归心、肝经。功效：活血祛瘀、通经止痛、清心除烦、凉血消痈。有"一味丹参散，功同四物汤"之说。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-23', subjectId: 'tcm', chapterId: 'tcm-c4', name: '红花',
    explanation: '红花为菊科植物红花的干燥花。性温，味辛。归心、肝经。功效：活血通经、散瘀止痛。为治血瘀证常用药，尤善通经止痛。用于经闭、痛经、恶露不行。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-24', subjectId: 'tcm', chapterId: 'tcm-c4', name: '桃仁',
    explanation: '桃仁为蔷薇科植物桃或山桃的干燥成熟种子。性平，味苦、甘。归心、肝、大肠经。功效：活血祛瘀、润肠通便、止咳平喘。用于经闭痛经、癥瘕结块、肺痈肠痈。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-25', subjectId: 'tcm', chapterId: 'tcm-c4', name: '益母草',
    explanation: '益母草为唇形科植物益母草的新鲜或干燥地上部分。性微寒，味苦、辛。归肝、心包、膀胱经。功效：活血调经、利尿消肿、清热解毒。为妇科经产要药。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 化学 - 有机化学基础 ====================
  {
    id: 'kp-26', subjectId: 'chem', chapterId: 'chem-c1', name: '烷烃命名规则',
    explanation: '烷烃命名采用IUPAC系统命名法：1.选择最长碳链作为主链；2.从距支链最近的一端开始编号；3.按"次序规则"排列取代基；4.标明支链位置和数目。',
    proficiency: 'rusty', lastReviewedAt: twoDaysAgo, nextReviewAt: now, reviewCount: 1, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-27', subjectId: 'chem', chapterId: 'chem-c1', name: '苯环结构',
    explanation: '苯的分子式为C₆H₆，是平面正六边形结构。苯环中6个碳原子以sp²杂化形成σ键，剩余p轨道形成闭合的离域π键（大π键）。碳碳键长完全相等，为139pm。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-28', subjectId: 'chem', chapterId: 'chem-c1', name: '同分异构体',
    explanation: '同分异构体是指分子式相同但结构不同的化合物。包括：1.构造异构（碳链异构、位置异构、官能团异构）；2.立体异构（顺反异构、对映异构）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-29', subjectId: 'chem', chapterId: 'chem-c1', name: '亲电取代反应',
    explanation: '芳香烃的主要反应是亲电取代反应（electrophilic aromatic substitution）。机理：亲电试剂E⁺进攻苯环→形成σ-配合物→失去H⁺恢复芳香性。典型反应：卤代、硝化、磺化、傅克反应。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-30', subjectId: 'chem', chapterId: 'chem-c1', name: '醇的氧化',
    explanation: '醇的氧化：1.伯醇氧化得醛，继续氧化得羧酸；2.仲醇氧化得酮；3.叔醇不易氧化。常用氧化剂：高锰酸钾(KMnO₄)、重铬酸钾(K₂Cr₂O₇)、琼斯试剂、PCC等。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 化学 - 无机化学基础 ====================
  {
    id: 'kp-31', subjectId: 'chem', chapterId: 'chem-c2', name: '元素周期律',
    explanation: '元素周期律：元素的性质随原子序数递增呈周期性变化。包括：原子半径周期性变化、电离能变化趋势、电子亲和能变化趋势、电负性变化趋势。同一周期从左到右，原子半径减小，电负性增大。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-32', subjectId: 'chem', chapterId: 'chem-c2', name: '杂化轨道理论',
    explanation: '杂化轨道理论：原子轨道重新组合形成新的杂化轨道。sp³杂化：4个等价轨道，109.5°，如CH₄；sp²杂化：3个等价轨道，120°，如C₂H₄；sp杂化：2个等价轨道，180°，如C₂H₂。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-33', subjectId: 'chem', chapterId: 'chem-c2', name: '分子间作用力',
    explanation: '分子间作用力包括：1.色散力（所有分子间）；2.诱导力（极性分子与非极性分子间）；3.取向力（极性分子间）；4.氢键（含有N、O、F原子的分子间）。氢键强于一般分子间作用力。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-34', subjectId: 'chem', chapterId: 'chem-c2', name: '氧化还原反应',
    explanation: '氧化还原反应：反应中有电子转移。氧化剂得到电子，化合价降低；还原剂失去电子，化合价升高。常见的氧化剂：KMnO₄、K₂Cr₂O₇、O₂、Cl₂。常见还原剂：Na、Mg、Al、H₂、C。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-35', subjectId: 'chem', chapterId: 'chem-c2', name: '离子键与共价键',
    explanation: '离子键：正负离子间的静电作用，形成离子化合物，如NaCl。共价键：原子间通过共用电子对形成，可分为极性共价键和非极性共价键。金属键：金属离子与自由电子间的相互作用。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 化学 - 化学反应原理 ====================
  {
    id: 'kp-36', subjectId: 'chem', chapterId: 'chem-c3', name: '勒夏特列原理',
    explanation: '勒夏特列原理（平衡移动原理）：如果对一个处于平衡状态的外界条件（如浓度、压力、温度）发生变化，平衡将向减弱这种变化的方向移动。但不能完全抵消这种变化。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-37', subjectId: 'chem', chapterId: 'chem-c3', name: '化学平衡常数',
    explanation: '化学平衡常数K：对于可逆反应aA + bB ⇌ cC + dD，K = [C]^c[D]^d/[A]^a[B]^b。K越大，反应越完全。K只与温度有关，与浓度、压强无关。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-38', subjectId: 'chem', chapterId: 'chem-c3', name: '反应速率与活化能',
    explanation: '反应速率：单位时间内反应物浓度的减少或生成物浓度的增加。影响反应速率的因素：浓度、温度、催化剂、接触面积。活化能：分子从初态到过渡态所需能量。催化剂降低活化能。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-39', subjectId: 'chem', chapterId: 'chem-c3', name: '水的离子积',
    explanation: '水的离子积Kw = [H⁺][OH⁻] = 1.0×10⁻¹⁴（25℃）。pH = -lg[H⁺]。酸性：[H⁺] > 10⁻⁷，pH < 7；中性：[H⁺] = 10⁻⁷，pH = 7；碱性：[H⁺] < 10⁻⁷，pH > 7。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-40', subjectId: 'chem', chapterId: 'chem-c3', name: '盐类水解',
    explanation: '盐类水解：盐的离子与水电离出的H⁺或OH⁻结合生成弱电解质的反应。强酸强碱盐不水解；强酸弱碱盐呈酸性；弱酸强碱盐呈碱性；弱酸弱碱盐取决于相对强弱。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 编程 - JavaScript基础 ====================
  {
    id: 'kp-41', subjectId: 'prog', chapterId: 'prog-c1', name: '闭包',
    explanation: '闭包是指有权访问另一个函数作用域中变量的函数。创建闭包的常见方式是在一个函数内部创建另一个函数，内部函数可以访问外部函数的变量。闭包可用于数据私有化、函数工厂等场景。',
    proficiency: 'normal', lastReviewedAt: yesterday, nextReviewAt: new Date(Date.now() + 5 * 86400000).toISOString(), reviewCount: 3, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-42', subjectId: 'prog', chapterId: 'prog-c1', name: 'Promise与async/await',
    explanation: 'Promise是ES6引入的异步编程解决方案，代表一个异步操作的最终完成或失败。状态：pending（进行中）、fulfilled（已成功）、rejected（已失败）。async/await是Promise的语法糖，使异步代码更像同步代码。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-43', subjectId: 'prog', chapterId: 'prog-c1', name: '原型与原型链',
    explanation: 'JavaScript中每个对象都有一个原型（prototype），对象通过原型链实现继承。构造函数.prototype指向原型对象，原型对象.constructor指回构造函数。当访问属性时，会沿原型链向上查找。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-44', subjectId: 'prog', chapterId: 'prog-c1', name: '事件循环机制',
    explanation: 'JavaScript是单线程语言，通过事件循环处理异步任务。任务队列分为宏任务（setTimeout、setInterval、I/O）和微任务（Promise.then、MutationObserver）。执行顺序：同步任务→微任务→宏任务。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-45', subjectId: 'prog', chapterId: 'prog-c1', name: 'let、const、var区别',
    explanation: 'var：函数作用域，存在变量提升，可重复声明。let：块级作用域，不存在变量提升（暂时性死区），不可重复声明。const：块级作用域，必须初始化，不可重新赋值（但对象属性可修改）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 编程 - React框架 ====================
  {
    id: 'kp-46', subjectId: 'prog', chapterId: 'prog-c2', name: 'React Hooks',
    explanation: 'Hooks是React 16.8引入的特性，让你在函数组件中使用state和其他React特性。常用Hooks：useState（状态管理）、useEffect（副作用）、useContext（上下文）、useReducer（复杂状态）、useMemo/useCallback（性能优化）。',
    proficiency: 'master', lastReviewedAt: yesterday, nextReviewAt: new Date(Date.now() + 15 * 86400000).toISOString(), reviewCount: 8, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-47', subjectId: 'prog', chapterId: 'prog-c2', name: 'Virtual DOM',
    explanation: 'Virtual DOM是真实DOM的JavaScript对象表示。当状态变化时，React先更新Virtual DOM，然后通过Diff算法比较新旧Virtual DOM，最后只更新真实DOM中变化的部分，提高渲染性能。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-48', subjectId: 'prog', chapterId: 'prog-c2', name: '组件生命周期',
    explanation: 'React类组件生命周期：挂载阶段（constructor→render→componentDidMount）、更新阶段（setState→render→componentDidUpdate）、卸载阶段（componentWillUnmount）。函数组件使用useEffect模拟生命周期。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-49', subjectId: 'prog', chapterId: 'prog-c2', name: 'Context API',
    explanation: 'Context API是React提供的数据传递方案，用于在组件树间传递数据，避免prop drilling。创建：React.createContext；提供：Provider组件；消费：Class.contextType或useContext Hook。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-50', subjectId: 'prog', chapterId: 'prog-c2', name: 'useEffect依赖项',
    explanation: 'useEffect的依赖数组控制何时执行副作用。空数组[]只在首次渲染时执行；不传依赖则在每次渲染后执行；指定依赖只在值变化时执行。常见问题：依赖遗漏导致闭包陷阱；过多依赖导致无限循环。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 编程 - TypeScript进阶 ====================
  {
    id: 'kp-51', subjectId: 'prog', chapterId: 'prog-c3', name: '泛型约束',
    explanation: '泛型约束使用extends关键字限制类型参数的范围。语法：<T extends SomeType>。常用场景：限制为对象类型、要求具有特定属性、联合类型约束等。如：<T extends { id: string }>确保T有id属性。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-52', subjectId: 'prog', chapterId: 'prog-c3', name: '条件类型',
    explanation: '条件类型语法：T extends U ? X : Y。根据T是否为U的子类型来决定返回X还是Y。常用内置条件类型：Exclude<T, U>（排除）、Extract<T, U>（提取）、NonNullable<T>（非空）、ReturnType<T>（返回值类型）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-53', subjectId: 'prog', chapterId: 'prog-c3', name: '映射类型',
    explanation: '映射类型通过索引签名语法从现有类型创建新类型。语法：{ [K in keyof T]: ... }。常用场景：使所有属性可选（Partial）、使所有属性必填（Required）、使所有属性只读（Readonly）、提取值类型（Pick）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-54', subjectId: 'prog', chapterId: 'prog-c3', name: '装饰器',
    explanation: '装饰器是ES2017提案和TypeScript实验性功能，用于修改类、方法、属性或参数的行为。语法：在声明前加@。需在tsconfig中启用experimentalDecorators。常见应用：依赖注入、日志记录、权限验证。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-55', subjectId: 'prog', chapterId: 'prog-c3', name: '类型守卫',
    explanation: '类型守卫是运行时检查并在代码块内收窄类型的技术。常见类型守卫：typeof（基本类型）、instanceof（类实例）、in（属性存在）、自定义函数（返回类型谓词）。语法：function isX(x: unknown): x is X { ... }',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 英语 - 核心词汇 ====================
  {
    id: 'kp-56', subjectId: 'eng', chapterId: 'eng-c1', name: 'Ephemeral',
    explanation: 'Ephemeral (adj.) - lasting for a very short time. 短暂的，瞬息的。例句：Fame is ephemeral in the entertainment industry. 在娱乐圈，名声是短暂的。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-57', subjectId: 'eng', chapterId: 'eng-c1', name: 'Ubiquitous',
    explanation: 'Ubiquitous (adj.) - present, appearing, or found everywhere. 无处不在的，普遍存在的。例句：Smartphones have become ubiquitous in modern society. 智能手机在现代社会已无处不在。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-58', subjectId: 'eng', chapterId: 'eng-c1', name: 'Pragmatic',
    explanation: 'Pragmatic (adj.) - dealing with things sensibly and realistically. 务实的，实用主义的。例句：A pragmatic approach to problem-solving often yields better results. 务实的解决问题的方法通常会得到更好的结果。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-59', subjectId: 'eng', chapterId: 'eng-c1', name: 'Ameliorate',
    explanation: 'Ameliorate (v.) - to make something bad or unsatisfactory better. 改善，改进。例句：The new policies aim to ameliorate the living conditions in rural areas. 新政策旨在改善农村地区的生活条件。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-60', subjectId: 'eng', chapterId: 'eng-c1', name: 'Circumvent',
    explanation: 'Circumvent (v.) - to find a way around an obstacle or restriction. 绕过，规避。例句：Some companies try to circumvent regulations to maximize profits. 一些公司试图规避法规以最大化利润。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-61', subjectId: 'eng', chapterId: 'eng-c1', name: 'Mitigate',
    explanation: 'Mitigate (v.) - to make less severe, serious, or painful. 减轻，缓和。例句：Planting trees can help mitigate the effects of climate change. 植树可以帮助减轻气候变化的影响。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 英语 - 语法精讲 ====================
  {
    id: 'kp-62', subjectId: 'eng', chapterId: 'eng-c2', name: '虚拟语气',
    explanation: '虚拟语气表示非真实条件或愿望。与现在事实相反：If + 主语 + were/did, 主语 + would/could/might + do。与过去事实相反：If + 主语 + had done, 主语 + would/could/might + have done。与将来可能性相反：If + 主语 + were to do/should do。',
    proficiency: 'rusty', lastReviewedAt: twoDaysAgo, nextReviewAt: now, reviewCount: 2, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-63', subjectId: 'eng', chapterId: 'eng-c2', name: '倒装句',
    explanation: '倒装句分为全部倒装和部分倒装。全部倒装：将句子全部谓语动词移到主语前（如Here comes the bus）。部分倒装：只将助动词移到主语前（Never have I seen such a thing）。常见否定词放在句首需倒装：never, rarely, seldom, hardly, no sooner。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-64', subjectId: 'eng', chapterId: 'eng-c2', name: '独立主格',
    explanation: '独立主格结构由"名词/代词 + 分词/不定式/形容词/介词短语"构成，修饰整个句子，表示时间、原因、条件、伴随等。独立主格与分词逻辑主语不一致时使用。如：Weather permitting, we will go camping. 天气允许的话，我们去露营。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-65', subjectId: 'eng', chapterId: 'eng-c2', name: '定语从句',
    explanation: '定语从句修饰名词或代词，分为限定性和非限定性。限定性：先行词必不可少，缺则句意不完整（无逗号）。非限定性：对先行词补充说明，缺则句意仍完整（有逗号）。关系词：who/whom（人）、which（物）、that（可指人或物）、whose（所有格）、where/when/why（状语）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-66', subjectId: 'eng', chapterId: 'eng-c2', name: '名词性从句',
    explanation: '名词性从句包括主语从句、宾语从句、表语从句、同位语从句。连接词：that（无意义）、whether/if（是否）、what/whatever（什么/无论什么）、who/whoever（谁/无论谁）、which/whichever（哪个/无论哪个）、when/where/how/why（状语含义）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 英语 - 写作句型 ====================
  {
    id: 'kp-67', subjectId: 'eng', chapterId: 'eng-c3', name: '引言段落句型',
    explanation: '常用引言句型：1.It is universally acknowledged that...（众所周知）；2.Recently, the issue of...has been brought into focus；3.With the rapid development of...（随着...的快速发展）；4.People\'s attitudes toward...vary widely（对...人们态度各异）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-68', subjectId: 'eng', chapterId: 'eng-c3', name: '对比论证句型',
    explanation: '常用对比句型：1.Compared with A, B has/cannot...；2.While/A whereas A..., B...；3.On the one hand..., on the other hand...；4.Although/Though A..., B...；5.Despite/In spite of..., B...。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-69', subjectId: 'eng', chapterId: 'eng-c3', name: '因果论证句型',
    explanation: '常用因果句型：1.There are several reasons for this phenomenon. First...Second...Finally...；2....is mainly due to the following factors；3.Consequently/As a result/Therefore/Thus...；4.The primary/leading cause is...；5.This is why...',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-70', subjectId: 'eng', chapterId: 'eng-c3', name: '结尾总结句型',
    explanation: '常用结尾句型：1.In conclusion/In summary/To sum up...；2.From what has been discussed above, we can safely conclude that...；3.Taking into account all these factors, we may reasonably conclude that...；4.In a word/All in all...；5.It is hoped that...',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 数学 - 函数与极限 ====================
  {
    id: 'kp-71', subjectId: 'math', chapterId: 'math-c1', name: '数列极限定义',
    explanation: '数列极限的ε-N定义：若对任意ε>0，存在正整数N，当n>N时，恒有|xₙ-a|<ε，则称数列{xₙ}收敛于a，记作lim(xₙ→∞)=a。几何意义：当n大于N后，所有项都落在(a-ε, a+ε)邻域内。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-72', subjectId: 'math', chapterId: 'math-c1', name: '函数极限性质',
    explanation: '函数极限性质：1.唯一性（若极限存在，则唯一）；2.局部有界性（存在邻域内有界）；3.局部保号性（极限正则邻域内正）；4.夹逼定理（若f≤g≤h且f,h极限相同，则g极限相同）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-73', subjectId: 'math', chapterId: 'math-c1', name: '两个重要极限',
    explanation: '两个重要极限：1.lim(sinx/x)=1（x→0）；2.lim(1+1/x)ˣ=e（x→∞）。这两个极限在求极限和证明中非常有用，经常结合夹逼准则或换元法使用。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-74', subjectId: 'math', chapterId: 'math-c1', name: '无穷小比较',
    explanation: '当x→0时，若lim[f(x)/g(x)]=0，称f是g的高阶无穷小；若=1，称等价无穷小；若=常数c≠0，称同阶无穷小。特别地，若lim[f(x)/xⁿ]=常数≠0，称f是x的n阶无穷小。常用等价：sinx~x, tanx~x, ln(1+x)~x, eˣ-1~x。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-75', subjectId: 'math', chapterId: 'math-c1', name: '函数的连续性',
    explanation: '函数在点x₀连续：lim(x→x₀)f(x)=f(x₀)。间断点类型：1.可去间断点（极限存在但不等于函数值）；2.跳跃间断点（左右极限存在但不相等）；3.无穷间断点（极限为无穷）；4.振荡间断点（极限振荡不存在）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 数学 - 导数与微分 ====================
  {
    id: 'kp-76', subjectId: 'math', chapterId: 'math-c2', name: '导数定义',
    explanation: '导数定义：f\'(x₀)=lim(Δx→0)[f(x₀+Δx)-f(x₀)]/Δx。几何意义：曲线上点(x₀,f(x₀))处切线斜率。导数存在的必要充分条件：左导数和右导数都存在且相等。可导必连续，连续不一定可导。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-77', subjectId: 'math', chapterId: 'math-c2', name: '求导法则',
    explanation: '基本求导法则：(u±v)\'=u\'±v\'；(uv)\'=u\'v+uv\'；(u/v)\'=(u\'v-uv\')/v²；复合函数y=f(u), u=g(x)，则y\'=f\'(u)·g\'(x)。记住基本公式：sin\'x=cosx, cos\'x=-sinx, (xⁿ)\'=nxⁿ⁻¹等。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-78', subjectId: 'math', chapterId: 'math-c2', name: '微分中值定理',
    explanation: '拉格朗日中值定理：若f在[a,b]连续、(a,b)可导，则存在ξ∈(a,b)使f\'(ξ)=[f(b)-f(a)]/(b-a)。几何意义：曲线上存在一点，其切线平行于割线。推论：f\'(x)≡0则f为常数；f\'(x)=g\'(x)则f(x)=g(x)+C。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-79', subjectId: 'math', chapterId: 'math-c2', name: '洛必达法则',
    explanation: '洛必达法则：若lim f(x)=lim g(x)=0或∞，且f\'(x)/g\'(x)极限存在或为∞，则lim f(x)/g(x)=lim f\'(x)/g\'(x)。适用于0/0或∞/∞型。其他类型需先换算成这两种类型。可多次使用。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-80', subjectId: 'math', chapterId: 'math-c2', name: '函数单调性与极值',
    explanation: '单调性判别：f\'(x)>0则递增，f\'(x)<0则递减。极值判别：费马引理（极值点处若可导则f\'=0）；一阶导数符号变化（左正右负为极大，左负右正为极小）；二阶导数f\'\'(x₀)>0为极小，<0为极大。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 数学 - 积分学 ====================
  {
    id: 'kp-81', subjectId: 'math', chapterId: 'math-c3', name: '不定积分概念',
    explanation: '不定积分：若F\'(x)=f(x)，则称F(x)是f(x)的原函数，f(x)的全体原函数称为不定积分，记作∫f(x)dx=F(x)+C。性质：∫kf(x)dx=k∫f(x)dx；∫[f(x)±g(x)]dx=∫f(x)dx±∫g(x)dx。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-82', subjectId: 'math', chapterId: 'math-c3', name: '换元积分法',
    explanation: '第一换元法（凑微分）：∫f(g(x))g\'(x)dx=∫f(u)du，令u=g(x)。第二换元法：令x=φ(t)，则dx=φ\'(t)dt，需将结果换回x。常见换元：√(a²-x²)令x=asint；√(a²+x²)令x=atan t；√(x²-a²)令x=a/sect。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-83', subjectId: 'math', chapterId: 'math-c3', name: '分部积分法',
    explanation: '分部积分公式：∫udv=uv-∫vdu。选择u的原则（LIATE法则）：L（对数）、I（反三角）、A（代数）、T（三角）、E（指数）。越靠前的越优先选作u。常见应用：∫xⁿeˣdx、∫xⁿlnx dx、∫eˣsinx dx等。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-84', subjectId: 'math', chapterId: 'math-c3', name: '定积分计算',
    explanation: '牛顿-莱布尼茨公式：∫ₐᵇf(x)dx=F(b)-F(a)，其中F是f的任一原函数。定积分换元需注意：换元必换限；若新下限>上限则加负号。常用公式：∫₀ᵃ√(a²-x²)dx=πa²/4（求圆面积）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-85', subjectId: 'math', chapterId: 'math-c3', name: '定积分应用',
    explanation: '定积分几何应用：平面图形面积（X型：∫ₐᵇ|f₁(x)-f₂(x)|dx；Y型：∫ₐᵇ|φ₁(y)-φ₂(y)|dy）；旋转体体积（V=π∫f²(x)dx）。物理应用：求路程S=∫v(t)dt；求功W=∫F(x)dx；求压力等。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 化学 - 波谱分析 ====================
  {
    id: 'kp-86', subjectId: 'chem', chapterId: 'chem-c4', name: '红外光谱基本原理',
    explanation: '红外光谱（IR）原理：当一定频率的红外光照射分子时，分子中某个基团的振动频率与外界红外辐射频率一致时，分子吸收红外光，产生振动能级跃迁。红外光谱图：纵坐标为吸收强度，横坐标为波长λ(μm)或波数(1/λ，单位cm⁻¹)。产生红外吸收的条件：①辐射具有能满足分子振动跃迁所需能量；②振动伴随偶极矩变化（同核双原子分子如N₂、Cl₂无红外活性）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-87', subjectId: 'chem', chapterId: 'chem-c4', name: '红外光谱重要区段',
    explanation: '红外光谱4000~400 cm⁻¹区域划分为：1) 氢键区(4000~2500 cm⁻¹)：O-H、N-H、C-H伸缩振动；2) 叁键区(2500~2000 cm⁻¹)：C≡C、C≡N等；3) 双键区(2000~1500 cm⁻¹)：C=C、C=O、苯环骨架；4) 单键区(1500~400 cm⁻¹)：指纹区。官能团区(4000~1300 cm⁻¹)：基团鉴定最有价值；指纹区(1300~650 cm⁻¹)：分子结构稍有不同就有差异，用于已知物鉴别。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-88', subjectId: 'chem', chapterId: 'chem-c4', name: '常见官能团红外特征峰',
    explanation: '常见官能团特征吸收：1) O-H/N-H：3750~3000 cm⁻¹，游离OH尖锐，缔合OH宽峰；2) C-H：饱和2960~2850 cm⁻¹，不饱和3100~3010 cm⁻¹，炔烃3300 cm⁻¹；3) C=O：1900~1650 cm⁻¹，酮约1715 cm⁻¹，醛约1725 cm⁻¹，羧酸约1710 cm⁻¹，酰胺约1650 cm⁻¹；4) C=C：烯烃1680~1620 cm⁻¹，苯环1650~1430 cm⁻¹(2~4个峰)；5) 苯环取代：单取代770~730+710~690 cm⁻¹，邻二取代770~735 cm⁻¹，对二取代830~810 cm⁻¹。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-89', subjectId: 'chem', chapterId: 'chem-c4', name: '核磁共振氢谱基本原理',
    explanation: '核磁共振氢谱(¹H NMR)原理：具有磁矩的原子核(如¹H)在静磁场中，受特定频率射频照射，发生核自旋能级跃迁。氢谱三大信息：化学位移、耦合常数、积分曲线。化学位移(δ)：同种核因化学环境不同而出峰位置不同，以四甲基硅烷(TMS)为零点，单位ppm。化学位移大小反映氢核周围电子云密度：电子云密度越大，屏蔽效应越强，δ值越小，峰越靠右(高场)；去屏蔽使δ值增大，峰靠左(低场)。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-90', subjectId: 'chem', chapterId: 'chem-c4', name: '常见氢核化学位移范围',
    explanation: '常见氢核化学位移(δ，ppm)：1) 烷基氢：0.5~1.5，甲基0.9，亚甲基1.2，次甲基1.5；2) 与杂原子相连：O-CH₃(3.3~4.0)、N-CH₃(2.1~3.0)、X-CH₃(2.5~4.0)；3) 双键/苯环：烯氢5.0~6.5，苯环氢7.0~8.5；4) 醛基氢：9.0~10.0；5) 羧酸氢：10.0~12.0(宽峰)；6) 炔氢：2.0~3.0。影响化学位移因素：电负性(吸电子基团使δ增大)、各向异性效应(苯环、双键、三键的空间屏蔽效应)、氢键(使δ增大)。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-91', subjectId: 'chem', chapterId: 'chem-c4', name: '自旋耦合与n+1规律',
    explanation: '自旋耦合：相邻不等价氢核之间的核磁矩相互作用，导致峰裂分。耦合常数J：裂分峰间距×仪器频率(Hz)，反映核间距，与外磁场无关。n+1规律：一个氢核被相邻n个等价氢核耦合，裂分成n+1重峰。裂分强度比：二重峰1:1，三重峰1:2:1，四重峰1:3:3:1，符合二项式系数。等价氢核之间不裂分。化学等价：化学位移相同；磁等价：化学位移相同且对组外任一核耦合常数相同。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-92', subjectId: 'chem', chapterId: 'chem-c4', name: '核磁共振谱图解析步骤',
    explanation: '¹H NMR谱图解析步骤：1) 由分子式计算不饱和度：Ω = (2C+2+N-H-X)/2，Ω=0无双键/环，Ω=1有双键/饱和环，Ω≥4可能含苯环；2) 由积分曲线或峰面积比，确定各组氢核数目比；3) 由化学位移判断氢核类型(烷基、烯基、芳基、醛基等)；4) 由裂分模式和耦合常数推断相邻氢核数目及连接方式；5) 结合IR、MS等数据，推导出可能结构并验证。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-93', subjectId: 'chem', chapterId: 'chem-c4', name: '红外光谱解析要点',
    explanation: 'IR谱图解析要点：1) 先观察官能团区(4000~1300 cm⁻¹)，判断可能存在的官能团；2) 再看指纹区(1300~650 cm⁻¹)，验证官能团存在并获取更多结构细节；3) 常见强峰优先：C=O(1700左右)、O-H(3200~3600)、C-O(1000~1300)、苯环(1450~1600，2~4个峰)；4) 注意吸收峰的形状(宽峰可能为氢键)和强度；5) 与标准谱图对比或结合NMR、MS数据综合分析。例如：3400 cm⁻¹宽峰+1710 cm⁻¹+1280 cm⁻¹提示羧酸；3300 cm⁻¹(双峰)+1650 cm⁻¹提示酰胺；1715 cm⁻¹但无OH提示酮。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-94', subjectId: 'chem', chapterId: 'chem-c4', name: '典型化合物波谱特征-乙醇',
    explanation: '乙醇(CH₃CH₂OH)的波谱特征：IR：3300~3400 cm⁻¹(宽，O-H伸缩)，2960~2870 cm⁻¹(C-H伸缩)，1450~1370 cm⁻¹(C-H弯曲)，1050 cm⁻¹(C-O伸缩)。¹H NMR：δ 0.9(三重峰，3H，CH₃，被CH₂裂分)，δ 3.5(四重峰，2H，CH₂，被CH₃裂分，且受O吸电子去屏蔽)，δ 2.0~5.0(单峰，1H，OH，活泼氢常为单峰，可被D₂O交换消失)。积分比3:2:1。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-95', subjectId: 'chem', chapterId: 'chem-c4', name: '典型化合物波谱特征-乙酸乙酯',
    explanation: '乙酸乙酯(CH₃COOCH₂CH₃)的波谱特征：IR：1740 cm⁻¹(强，C=O伸缩，酯羰基比酮高约25 cm⁻¹)，1240和1045 cm⁻¹(C-O-C伸缩，酯的特征双峰)，2980~2850 cm⁻¹(C-H伸缩)，1370 cm⁻¹(CH₃弯曲)。¹H NMR：δ 2.0(单峰，3H，CH₃CO-，与羰基相连，去屏蔽)，δ 4.1(四重峰，2H，-OCH₂-，受O吸电子去屏蔽明显，被CH₃裂分)，δ 1.2(三重峰，3H，-CH₃，被CH₂裂分)。积分比3:2:3。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  // ==================== 微生物与免疫学 ====================
  {
    id: 'kp-micro-0001', subjectId: 'micro', chapterId: 'micro-ch1', name: '微生物的概念与分类',
    explanation: '微生物是存在于自然界的一大群体形微小、结构简单、肉眼直接看不见，必须借助光学显微镜或电子显微镜放大数百倍、数千倍甚至数万倍才能观察到的微小生物。分类：①非细胞型微生物（病毒）；②原核细胞型微生物（细菌、支原体、衣原体、立克次体、螺旋体、放线菌）；③真核细胞型微生物（真菌）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0002', subjectId: 'micro', chapterId: 'micro-ch1', name: '革兰氏染色法原理',
    explanation: '革兰氏染色法是细菌学中最常用的鉴别染色法。步骤：①结晶紫初染；②碘液媒染；③95%乙醇脱色；④沙黄复染。原理：革兰氏阳性菌细胞壁肽聚糖层厚、交联度高，乙醇脱色时肽聚糖层孔径缩小，结晶紫-碘复合物保留在细胞内呈紫色；革兰氏阴性菌细胞壁肽聚糖层薄、交联度低，且含大量脂质，乙醇脱色时脂质溶解，结晶紫-碘复合物被洗出，复染后呈红色。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0003', subjectId: 'micro', chapterId: 'micro-ch2', name: '细菌的基本结构',
    explanation: '细菌的基本结构包括：①细胞壁：维持细菌形态，保护细菌；②细胞膜：物质转运、呼吸和合成功能；③细胞质：含核糖体、质粒等；④核质：细菌的遗传物质。特殊结构包括：荚膜（抗吞噬）、鞭毛（运动）、菌毛（黏附）、芽胞（抵抗力强，灭菌指标）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0004', subjectId: 'micro', chapterId: 'micro-ch2', name: '细菌的生长繁殖',
    explanation: '细菌以二分裂方式进行无性繁殖。生长曲线分为四期：①迟缓期：适应环境，代谢活跃，不分裂；②对数期：生长迅速，形态典型，对外界敏感，用于鉴定；③稳定期：繁殖与死亡平衡，产生代谢产物（抗生素、毒素）；④衰亡期：死亡数超过繁殖数，形态退变。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0005', subjectId: 'micro', chapterId: 'micro-ch2', name: '细菌的代谢产物',
    explanation: '细菌的合成代谢产物包括：①热原质：引起发热反应；②毒素与侵袭性酶：致病物质；③色素：有助于鉴别；④抗生素：抑制或杀灭其他微生物；⑤维生素：供自身及宿主利用；⑥细菌素：仅对近缘菌有作用。分解代谢产物可用于细菌鉴定（糖发酵试验等）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0006', subjectId: 'micro', chapterId: 'micro-ch2', name: '消毒与灭菌',
    explanation: '消毒：杀灭物体上病原微生物，不一定杀芽胞；灭菌：杀灭所有微生物（包括芽胞）；防腐：抑制微生物生长繁殖；无菌：无活微生物。常用方法：①物理法：热力（高压蒸汽灭菌法最常用，121℃15-20分钟）、紫外线、电离辐射；②化学法：消毒剂（75%乙醇、碘伏等）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0007', subjectId: 'micro', chapterId: 'micro-ch2', name: '正常菌群与条件致病菌',
    explanation: '正常菌群：寄居在正常人皮肤、黏膜，对人体无害的微生物。生理作用：①生物拮抗；②营养作用；③免疫作用；④抗衰老作用。条件致病菌：正常菌群在特定条件下可致病，条件包括：①寄居部位改变；②宿主免疫功能低下；③菌群失调。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0008', subjectId: 'micro', chapterId: 'micro-ch2', name: '细菌的致病性',
    explanation: '细菌致病性取决于毒力、侵入数量和侵入途径。毒力包括侵袭力和毒素。侵袭力：黏附素、荚膜、侵袭性酶等。毒素：①外毒素：革兰氏阳性菌产生，蛋白质，毒性强，选择性作用，免疫原性强，可脱毒制成类毒素；②内毒素：革兰氏阴性菌细胞壁脂多糖，毒性较弱，引起发热、休克等，免疫原性弱，不能制成类毒素。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0009', subjectId: 'micro', chapterId: 'micro-ch3', name: '病毒的基本特征',
    explanation: '病毒是体积最微小、结构最简单的非细胞型微生物。特点：①体积微小，需电镜观察；②结构简单，仅含一种核酸（DNA或RNA）；③严格活细胞内寄生；④以复制方式增殖；⑤对抗生素不敏感，对干扰素敏感。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0010', subjectId: 'micro', chapterId: 'micro-ch3', name: '病毒的结构',
    explanation: '病毒的基本结构：①核心：含DNA或RNA；②衣壳：蛋白质，保护核酸，介导吸附。部分病毒有包膜：脂质双层，来自宿主细胞膜，包膜上有刺突（病毒抗原，可用于鉴定）。衣壳的对称类型：①螺旋对称；②20面体立体对称；③复合对称。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0011', subjectId: 'micro', chapterId: 'micro-ch3', name: '病毒的复制周期',
    explanation: '病毒复制周期包括：①吸附：病毒与宿主细胞表面受体结合；②穿入：通过融合、胞饮或直接穿入；③脱壳：释放核酸；④生物合成：合成病毒核酸和蛋白质；⑤装配与释放：组装成子代病毒，通过出芽或细胞裂解释放。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0012', subjectId: 'micro', chapterId: 'micro-ch3', name: '病毒的感染类型',
    explanation: '病毒感染类型：①隐性感染：无症状，可获得免疫力；②显性感染：有症状，分为急性感染和持续性感染；③持续性感染又分为：慢性感染（病程长，病毒持续存在）、潜伏感染（病毒潜伏，间歇发作）、慢发病毒感染（潜伏期长，发病后进行性加重）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0013', subjectId: 'micro', chapterId: 'micro-ch3', name: '干扰素',
    explanation: '干扰素是病毒或干扰素诱生剂诱导细胞产生的糖蛋白。特点：①广谱抗病毒；②有种属特异性；③间接抗病毒（诱导细胞产生抗病毒蛋白）；④还有免疫调节和抗肿瘤作用。抗病毒机制：诱导细胞合成抗病毒蛋白，降解病毒mRNA，抑制病毒蛋白合成。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0014', subjectId: 'micro', chapterId: 'micro-ch4', name: '免疫系统的组成',
    explanation: '免疫系统由免疫器官、免疫细胞和免疫分子组成。免疫器官：①中枢免疫器官（骨髓、胸腺）：免疫细胞发生、分化、成熟的场所；②外周免疫器官（淋巴结、脾脏、黏膜相关淋巴组织）：免疫细胞定居、免疫应答发生的场所。免疫细胞：T细胞、B细胞、NK细胞、巨噬细胞、树突状细胞等。免疫分子：抗体、补体、细胞因子等。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0015', subjectId: 'micro', chapterId: 'micro-ch4', name: '抗原的基本概念',
    explanation: '抗原（Ag）是能刺激机体免疫系统产生免疫应答，并能与免疫应答产物（抗体或致敏淋巴细胞）特异性结合的物质。抗原的两个基本特性：①免疫原性：能刺激机体产生免疫应答；②抗原性（免疫反应性）：能与免疫应答产物特异性结合。同时具有这两种特性的物质称为完全抗原；只有抗原性而无免疫原性的物质称为半抗原。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0016', subjectId: 'micro', chapterId: 'micro-ch4', name: '抗原表位',
    explanation: '抗原表位（抗原决定簇）是抗原分子中与抗体或淋巴细胞抗原受体特异性结合的特殊化学基团，是抗原特异性的物质基础。分类：①顺序表位（线性表位）：由连续的氨基酸组成，主要被T细胞识别；②构象表位：由空间构象形成的不连续氨基酸组成，主要被B细胞识别。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0017', subjectId: 'micro', chapterId: 'micro-ch4', name: '抗体的基本结构',
    explanation: '抗体（Ig）是由两条相同的重链（H链）和两条相同的轻链（L链）通过二硫键连接而成的Y形分子。可变区（V区）：位于N端，是抗原结合部位，包括高变区（互补决定区CDR）和骨架区。恒定区（C区）：位于C端，具有同种型抗原特异性。木瓜蛋白酶水解产生两个Fab段（抗原结合片段）和一个Fc段（可结晶片段）；胃蛋白酶水解产生一个F(ab\')2段和pFc\'段。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0018', subjectId: 'micro', chapterId: 'micro-ch4', name: '五类免疫球蛋白的特性',
    explanation: '免疫球蛋白分为五类：①IgG：血清中含量最高，唯一能通过胎盘的抗体，抗感染的主要抗体；②IgM：五聚体，分子量最大，产生最早，是初次应答的主要抗体，用于早期感染诊断；③IgA：分泌型IgA（sIgA）存在于外分泌液中，是黏膜局部免疫的主要抗体；④IgD：B细胞表面标志；⑤IgE：介导Ⅰ型超敏反应，抗寄生虫。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0019', subjectId: 'micro', chapterId: 'micro-ch4', name: '免疫应答的基本过程',
    explanation: '免疫应答分为三个阶段：①识别阶段：抗原提呈细胞摄取、加工、提呈抗原，T、B细胞识别抗原；②活化、增殖、分化阶段：T、B细胞活化、增殖、分化为效应细胞；③效应阶段：效应细胞和效应分子发挥免疫效应。B细胞介导体液免疫，产生抗体；T细胞介导细胞免疫，产生效应T细胞（CTL、Th细胞）。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
  {
    id: 'kp-micro-0020', subjectId: 'micro', chapterId: 'micro-ch4', name: '超敏反应的类型',
    explanation: '超敏反应（变态反应）分为四型：①Ⅰ型（速发型）：由IgE介导，发生快，消退也快，如过敏性休克、荨麻疹；②Ⅱ型（细胞毒型）：由IgG、IgM介导，如输血反应、新生儿溶血症；③Ⅲ型（免疫复合物型）：由免疫复合物沉积引起，如肾小球肾炎、血清病；④Ⅳ型（迟发型）：由T细胞介导，发生较慢，如接触性皮炎、结核菌素试验。',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  },
];

// ==================== 预置题目数据 ====================
export const MOCK_QUESTIONS: Question[] = [
  // ==================== 中药学 - 解表药 ====================
  {
    id: 'q-1', knowledgePointId: 'kp-1', subjectId: 'tcm', type: 'single_choice',
    stem: '麻黄的性味归经正确的是？',
    options: [
      { id: 'a', text: '性温，味辛、微苦，归肺、膀胱经' },
      { id: 'b', text: '性寒，味苦，归肺、胃经' },
      { id: 'c', text: '性微温，味辛、甘，归肺、肾经' },
      { id: 'd', text: '性凉，味辛，归肺、心经' },
    ],
    correctAnswers: ['a'],
    explanation: '麻黄性温，味辛、微苦，归肺、膀胱经。功效为发汗散寒、宣肺平喘、利水消肿。',
  },
  {
    id: 'q-2', knowledgePointId: 'kp-1', subjectId: 'tcm', type: 'single_choice',
    stem: '麻黄发汗解表宜用？',
    options: [
      { id: 'a', text: '蜜炙' },
      { id: 'b', text: '生用' },
      { id: 'c', text: '酒炙' },
      { id: 'd', text: '醋炙' },
    ],
    correctAnswers: ['b'],
    explanation: '麻黄发汗解表宜生用，止咳平喘多蜜炙用。',
  },
  {
    id: 'q-3', knowledgePointId: 'kp-2', subjectId: 'tcm', type: 'single_choice',
    stem: '桂枝的功效不包括以下哪项？',
    options: [
      { id: 'a', text: '发汗解肌' },
      { id: 'b', text: '温通经脉' },
      { id: 'c', text: '清热泻火' },
      { id: 'd', text: '助阳化气' },
    ],
    correctAnswers: ['c'],
    explanation: '清热泻火不是桂枝的功效。桂枝功效：发汗解肌、温通经脉、助阳化气、平冲降逆。',
  },
  {
    id: 'q-4', knowledgePointId: 'kp-3', subjectId: 'tcm', type: 'single_choice',
    stem: '紫苏叶归哪两经？',
    options: [
      { id: 'a', text: '肺、脾经' },
      { id: 'b', text: '肺、心经' },
      { id: 'c', text: '脾、胃经' },
      { id: 'd', text: '肺、肝经' },
    ],
    correctAnswers: ['a'],
    explanation: '紫苏叶归肺、脾经。功效：解表散寒、行气和胃、解鱼蟹毒。',
  },
  {
    id: 'q-5', knowledgePointId: 'kp-4', subjectId: 'tcm', type: 'single_choice',
    stem: '生姜被称为什么？',
    options: [
      { id: 'a', text: '呕家圣药' },
      { id: 'b', text: '疮家圣药' },
      { id: 'c', text: '补血要药' },
      { id: 'd', text: '补气要药' },
    ],
    correctAnswers: ['a'],
    explanation: '生姜被称为"呕家圣药"，功效解表散寒、温中止呕、温肺止咳、解鱼蟹毒。',
  },
  {
    id: 'q-6', knowledgePointId: 'kp-8', subjectId: 'tcm', type: 'single_choice',
    stem: '薄荷入煎剂需要后下，且不宜久煎，用量一般为？',
    options: [
      { id: 'a', text: '3-6g' },
      { id: 'b', text: '10-15g' },
      { id: 'c', text: '1-3g' },
      { id: 'd', text: '6-10g' },
    ],
    correctAnswers: ['a'],
    explanation: '薄荷用量为3-6g，不宜久煎，后下以保留挥发性成分。',
  },
  // ==================== 中药学 - 清热药 ====================
  {
    id: 'q-7', knowledgePointId: 'kp-9', subjectId: 'tcm', type: 'single_choice',
    stem: '黄连的归经不包括？',
    options: [
      { id: 'a', text: '心' },
      { id: 'b', text: '肺' },
      { id: 'c', text: '脾' },
      { id: 'd', text: '胃' },
    ],
    correctAnswers: ['b'],
    explanation: '黄连归心、脾、胃、肝、胆、大肠经，不归肺经。',
  },
  {
    id: 'q-8', knowledgePointId: 'kp-10', subjectId: 'tcm', type: 'single_choice',
    stem: '黄芩除清热燥湿、泻火解毒外，还有什么特殊功效？',
    options: [
      { id: 'a', text: '止血、安胎' },
      { id: 'b', text: '发汗解表' },
      { id: 'c', text: '温阳补肾' },
      { id: 'd', text: '化痰止咳' },
    ],
    correctAnswers: ['a'],
    explanation: '黄芩具有清热燥湿、泻火解毒、止血、安胎的功效，常用于胎热不安。',
  },
  {
    id: 'q-9', knowledgePointId: 'kp-12', subjectId: 'tcm', type: 'single_choice',
    stem: '金银花常用于治疗哪种病证？',
    options: [
      { id: 'a', text: '痈肿疔疮、风热感冒' },
      { id: 'b', text: '风湿痹痛' },
      { id: 'c', text: '血虚萎黄' },
      { id: 'd', text: '肾虚遗精' },
    ],
    correctAnswers: ['a'],
    explanation: '金银花功效清热解毒、疏散风热，常用于痈肿疔疮、风热感冒、温病初起。',
  },
  {
    id: 'q-10', knowledgePointId: 'kp-14', subjectId: 'tcm', type: 'single_choice',
    stem: '栀子归哪三焦经？',
    options: [
      { id: 'a', text: '心、肺、三焦经' },
      { id: 'b', text: '肝、胆、三焦经' },
      { id: 'c', text: '心、胃、三焦经' },
      { id: 'd', text: '肺、肾、三焦经' },
    ],
    correctAnswers: ['a'],
    explanation: '栀子归心、肺、三焦经。功效：泻火除烦、清热利湿、凉血解毒。',
  },
  // ==================== 中药学 - 补虚药 ====================
  {
    id: 'q-11', knowledgePointId: 'kp-16', subjectId: 'tcm', type: 'multi_choice',
    stem: '人参的功效包括？',
    options: [
      { id: 'a', text: '大补元气' },
      { id: 'b', text: '复脉固脱' },
      { id: 'c', text: '补脾益肺' },
      { id: 'd', text: '清热泻火' },
    ],
    correctAnswers: ['a', 'b', 'c'],
    explanation: '人参功效：大补元气、复脉固脱、补脾益肺、生津养血、安神益智。不包括清热泻火。',
  },
  {
    id: 'q-12', knowledgePointId: 'kp-18', subjectId: 'tcm', type: 'single_choice',
    stem: '当归被称为什么？',
    options: [
      { id: 'a', text: '补血要药、妇科要药' },
      { id: 'b', text: '补气要药' },
      { id: 'c', text: '清热要药' },
      { id: 'd', text: '化瘀要药' },
    ],
    correctAnswers: ['a'],
    explanation: '当归为补血要药、妇科要药。功效：补血活血、调经止痛、润肠通便。',
  },
  // ==================== 中药学 - 活血化瘀药 ====================
  {
    id: 'q-13', knowledgePointId: 'kp-22', subjectId: 'tcm', type: 'multi_choice',
    stem: '丹参的功效包括？',
    options: [
      { id: 'a', text: '活血祛瘀' },
      { id: 'b', text: '通经止痛' },
      { id: 'c', text: '清心除烦' },
      { id: 'd', text: '温阳散寒' },
    ],
    correctAnswers: ['a', 'b', 'c'],
    explanation: '丹参功效：活血祛瘀、通经止痛、清心除烦、凉血消痈。有"一味丹参散，功同四物汤"之说。',
  },
  // ==================== 化学 - 有机化学 ====================
  {
    id: 'q-14', knowledgePointId: 'kp-26', subjectId: 'chem', type: 'single_choice',
    stem: '烷烃系统命名法中，主链的选取原则是？',
    options: [
      { id: 'a', text: '选最长碳链' },
      { id: 'b', text: '选取代基最多的链' },
      { id: 'c', text: '选最短碳链' },
      { id: 'd', text: '随意选取' },
    ],
    correctAnswers: ['a'],
    explanation: '烷烃命名时选择最长碳链作为主链，然后从距取代基最近的一端开始编号。',
  },
  {
    id: 'q-15', knowledgePointId: 'kp-27', subjectId: 'chem', type: 'single_choice',
    stem: '苯分子中碳原子的杂化方式是？',
    options: [
      { id: 'a', text: 'sp杂化' },
      { id: 'b', text: 'sp²杂化' },
      { id: 'c', text: 'sp³杂化' },
      { id: 'd', text: '不杂化' },
    ],
    correctAnswers: ['b'],
    explanation: '苯环中6个碳原子以sp²杂化，形成正六边形平面结构，碳碳键角为120°。',
  },
  {
    id: 'q-16', knowledgePointId: 'kp-29', subjectId: 'chem', type: 'single_choice',
    stem: '芳香烃的主要反应类型是？',
    options: [
      { id: 'a', text: '亲电取代反应' },
      { id: 'b', text: '亲核取代反应' },
      { id: 'c', text: '加成反应' },
      { id: 'd', text: '消除反应' },
    ],
    correctAnswers: ['a'],
    explanation: '芳香烃的主要反应是亲电取代反应（EAS），包括卤代、硝化、磺化、傅克反应等。',
  },
  // ==================== 化学 - 无机化学 ====================
  {
    id: 'q-17', knowledgePointId: 'kp-32', subjectId: 'chem', type: 'single_choice',
    stem: '乙炔分子中碳原子的杂化方式及键角分别是？',
    options: [
      { id: 'a', text: 'sp杂化，180°' },
      { id: 'b', text: 'sp²杂化，120°' },
      { id: 'c', text: 'sp³杂化，109.5°' },
      { id: 'd', text: 'sp杂化，109.5°' },
    ],
    correctAnswers: ['a'],
    explanation: '乙炔中碳原子为sp杂化，两个sp杂化轨道形成σ键，键角为180°，分子呈直线形。',
  },
  {
    id: 'q-18', knowledgePointId: 'kp-33', subjectId: 'chem', type: 'single_choice',
    stem: '下列物质间存在氢键的是？',
    options: [
      { id: 'a', text: 'NH₃' },
      { id: 'b', text: 'CH₄' },
      { id: 'c', text: 'CO₂' },
      { id: 'd', text: 'H₂S' },
    ],
    correctAnswers: ['a'],
    explanation: '氢键需要H与N、O、F原子相连。NH₃含有N-H键，可以形成氢键。CH₄和CO₂不能形成氢键，H₂S的S原子电负性不够强。',
  },
  // ==================== 化学 - 化学反应原理 ====================
  {
    id: 'q-19', knowledgePointId: 'kp-36', subjectId: 'chem', type: 'single_choice',
    stem: '勒夏特列原理描述的是？',
    options: [
      { id: 'a', text: '平衡向减弱改变的方向移动' },
      { id: 'b', text: '反应速率随温度升高而加快' },
      { id: 'c', text: '催化剂能改变化学平衡' },
      { id: 'd', text: '反应物浓度增加反应速率一定加快' },
    ],
    correctAnswers: ['a'],
    explanation: '勒夏特列原理：若改变影响平衡的条件，平衡将向减弱这种改变的方向移动。催化剂不影响化学平衡。',
  },
  {
    id: 'q-20', knowledgePointId: 'kp-39', subjectId: 'chem', type: 'single_choice',
    stem: '25℃时，水的离子积Kw为？',
    options: [
      { id: 'a', text: '1.0×10⁻¹⁴' },
      { id: 'b', text: '1.0×10⁻⁷' },
      { id: 'c', text: '1.0×10⁻⁵' },
      { id: 'd', text: '1.0×10⁻¹²' },
    ],
    correctAnswers: ['a'],
    explanation: '水的离子积Kw = [H⁺][OH⁻] = 1.0×10⁻¹⁴（25℃）。这是水的电离平衡常数。',
  },
  // ==================== 编程 - JavaScript ====================
  {
    id: 'q-21', knowledgePointId: 'kp-41', subjectId: 'prog', type: 'single_choice',
    stem: '关于JavaScript闭包，以下说法正确的是？',
    options: [
      { id: 'a', text: '闭包可以访问外部函数的变量' },
      { id: 'b', text: '闭包只能在全局作用域创建' },
      { id: 'c', text: '闭包不会保持对外部变量的引用' },
      { id: 'd', text: '闭包只能在ES6中使用' },
    ],
    correctAnswers: ['a'],
    explanation: '闭包是指有权访问另一个函数作用域中变量的函数，这是闭包的核心特性。',
  },
  {
    id: 'q-22', knowledgePointId: 'kp-42', subjectId: 'prog', type: 'single_choice',
    stem: 'Promise有几种状态？',
    options: [
      { id: 'a', text: '3种' },
      { id: 'b', text: '2种' },
      { id: 'c', text: '4种' },
      { id: 'd', text: '1种' },
    ],
    correctAnswers: ['a'],
    explanation: 'Promise有3种状态：pending（进行中）、fulfilled（已成功）、rejected（已失败）。状态一旦改变就不可逆。',
  },
  {
    id: 'q-23', knowledgePointId: 'kp-43', subjectId: 'prog', type: 'multi_choice',
    stem: 'JavaScript原型链的特点包括？',
    options: [
      { id: 'a', text: '对象通过原型链实现继承' },
      { id: 'b', text: '每个对象都有prototype属性' },
      { id: 'c', text: '访问属性时会沿原型链向上查找' },
      { id: 'd', text: '原型链长度无限' },
    ],
    correctAnswers: ['a', 'c'],
    explanation: '对象通过原型链实现继承，访问属性时沿原型链向上查找。但prototype是构造函数的属性，不是普通对象的。原型链终端是Object.prototype。',
  },
  {
    id: 'q-24', knowledgePointId: 'kp-45', subjectId: 'prog', type: 'single_choice',
    stem: 'const定义的变量特点是？',
    options: [
      { id: 'a', text: '块级作用域，必须初始化，不可重新赋值' },
      { id: 'b', text: '函数作用域，可不初始化' },
      { id: 'c', text: '全局作用域，存在变量提升' },
      { id: 'd', text: '块级作用域，可重复声明' },
    ],
    correctAnswers: ['a'],
    explanation: 'const具有块级作用域、必须初始化、不可重新赋值（但对象属性可修改）的特点。',
  },
  // ==================== 编程 - React ====================
  {
    id: 'q-25', knowledgePointId: 'kp-46', subjectId: 'prog', type: 'single_choice',
    stem: '以下哪个不是React内置Hook？',
    options: [
      { id: 'a', text: 'useState' },
      { id: 'b', text: 'useEffect' },
      { id: 'c', text: 'useRequest' },
      { id: 'd', text: 'useContext' },
    ],
    correctAnswers: ['c'],
    explanation: 'useRequest不是React内置Hook，它是ahooks等第三方库提供的。useState、useEffect、useContext都是React内置Hook。',
  },
  {
    id: 'q-26', knowledgePointId: 'kp-47', subjectId: 'prog', type: 'single_choice',
    stem: 'Virtual DOM的主要作用是？',
    options: [
      { id: 'a', text: '减少直接操作真实DOM，提高渲染性能' },
      { id: 'b', text: '替代HTML成为新的页面描述语言' },
      { id: 'c', text: '实现服务器端渲染' },
      { id: 'd', text: '替代JavaScript成为新的编程语言' },
    ],
    correctAnswers: ['a'],
    explanation: 'Virtual DOM通过Diff算法比较新旧状态，只更新变化的部分，减少直接DOM操作，提高性能。',
  },
  {
    id: 'q-27', knowledgePointId: 'kp-50', subjectId: 'prog', type: 'single_choice',
    stem: 'useEffect的依赖数组为空数组[]表示？',
    options: [
      { id: 'a', text: '只在首次渲染时执行' },
      { id: 'b', text: '每次渲染后都执行' },
      { id: 'c', text: '从不执行' },
      { id: 'd', text: '组件卸载时执行' },
    ],
    correctAnswers: ['a'],
    explanation: 'useEffect依赖数组为空表示只在组件首次渲染时执行一次，类似componentDidMount。',
  },
  // ==================== 编程 - TypeScript ====================
  {
    id: 'q-28', knowledgePointId: 'kp-51', subjectId: 'prog', type: 'single_choice',
    stem: 'TypeScript泛型约束使用什么关键字？',
    options: [
      { id: 'a', text: 'extends' },
      { id: 'b', text: 'implements' },
      { id: 'c', text: 'super' },
      { id: 'd', text: 'typeof' },
    ],
    correctAnswers: ['a'],
    explanation: 'TypeScript泛型约束使用extends关键字，如<T extends SomeType>。',
  },
  {
    id: 'q-29', knowledgePointId: 'kp-52', subjectId: 'prog', type: 'single_choice',
    stem: 'Exclude<T, U>的作用是？',
    options: [
      { id: 'a', text: '从T中排除可赋值给U的类型' },
      { id: 'b', text: '从T中提取可赋值给U的类型' },
      { id: 'c', text: '获取T的非空类型' },
      { id: 'd', text: '获取T的返回值类型' },
    ],
    correctAnswers: ['a'],
    explanation: 'Exclude<T, U>是TypeScript内置条件类型，从T中排除可以赋值给U的类型。',
  },
  // ==================== 英语 - 词汇 ====================
  {
    id: 'q-30', knowledgePointId: 'kp-56', subjectId: 'eng', type: 'single_choice',
    stem: 'What does "ephemeral" mean?',
    options: [
      { id: 'a', text: 'Lasting for a very short time' },
      { id: 'b', text: 'Lasting forever' },
      { id: 'c', text: 'Very important' },
      { id: 'd', text: 'Extremely large' },
    ],
    correctAnswers: ['a'],
    explanation: 'Ephemeral means lasting for a very short time (短暂的，瞬息的)。',
  },
  {
    id: 'q-31', knowledgePointId: 'kp-57', subjectId: 'eng', type: 'single_choice',
    stem: '"Ubiquitous"的意思是？',
    options: [
      { id: 'a', text: '无处不在的' },
      { id: 'b', text: '独特的' },
      { id: 'c', text: '稀有的' },
      { id: 'd', text: '稳定的' },
    ],
    correctAnswers: ['a'],
    explanation: 'Ubiquitous (adj.) = present everywhere，无处不在的，普遍存在的。',
  },
  {
    id: 'q-32', knowledgePointId: 'kp-61', subjectId: 'eng', type: 'single_choice',
    stem: '"Mitigate"的意思是？',
    options: [
      { id: 'a', text: '减轻，缓和' },
      { id: 'b', text: '加剧，加强' },
      { id: 'c', text: '忽视，忽略' },
      { id: 'd', text: '完成，实现' },
    ],
    correctAnswers: ['a'],
    explanation: 'Mitigate (v.) = to make less severe，减轻，缓和。常见搭配：mitigate the effects/impact。',
  },
  // ==================== 英语 - 语法 ====================
  {
    id: 'q-33', knowledgePointId: 'kp-62', subjectId: 'eng', type: 'single_choice',
    stem: '在虚拟语气中，"If I ___ you"应填？',
    options: [
      { id: 'a', text: 'were' },
      { id: 'b', text: 'was' },
      { id: 'c', text: 'am' },
      { id: 'd', text: 'be' },
    ],
    correctAnswers: ['a'],
    explanation: '虚拟语气中be动词用were，不论主语人称。If I were you是标准用法。',
  },
  {
    id: 'q-34', knowledgePointId: 'kp-62', subjectId: 'eng', type: 'single_choice',
    stem: '"I wish I ___ harder." 句子完整形式是？',
    options: [
      { id: 'a', text: 'had studied' },
      { id: 'b', text: 'study' },
      { id: 'c', text: 'studied' },
      { id: 'd', text: 'would study' },
    ],
    correctAnswers: ['a'],
    explanation: 'wish表示与过去事实相反的愿望，从句用过去完成时had done。',
  },
  {
    id: 'q-35', knowledgePointId: 'kp-63', subjectId: 'eng', type: 'single_choice',
    stem: '以下哪个词放在句首不需要倒装？',
    options: [
      { id: 'a', text: 'Therefore' },
      { id: 'b', text: 'Never' },
      { id: 'c', text: 'Seldom' },
      { id: 'd', text: 'Rarely' },
    ],
    correctAnswers: ['a'],
    explanation: 'Therefore是副词连接词，不引起倒装。Never、Seldom、Rarely等否定副词放在句首要部分倒装。',
  },
  {
    id: 'q-36', knowledgePointId: 'kp-64', subjectId: 'eng', type: 'multi_choice',
    stem: '独立主格结构包括哪些成分？',
    options: [
      { id: 'a', text: '名词/代词' },
      { id: 'b', text: '分词' },
      { id: 'c', text: '介词短语' },
      { id: 'd', text: '动词不定式' },
    ],
    correctAnswers: ['a', 'b', 'c', 'd'],
    explanation: '独立主格由名词/代词加分词/不定式/形容词/介词短语构成，表示时间、原因、条件、伴随等。',
  },
  // ==================== 数学 ====================
  {
    id: 'q-37', knowledgePointId: 'kp-71', subjectId: 'math', type: 'single_choice',
    stem: '数列极限ε-N定义中，当n>N时，恒有|xₙ-a|<ε，其中ε是？',
    options: [
      { id: 'a', text: '任意大于0的数' },
      { id: 'b', text: '任意整数' },
      { id: 'c', text: '正整数' },
      { id: 'd', text: '任意负数' },
    ],
    correctAnswers: ['a'],
    explanation: 'ε-N定义中，ε是任意正数（ε>0），表示数列项与极限值的接近程度可以任意小。',
  },
  {
    id: 'q-38', knowledgePointId: 'kp-73', subjectId: 'math', type: 'single_choice',
    stem: '两个重要极限之一是lim(x→0)sinx/x等于？',
    options: [
      { id: 'a', text: '1' },
      { id: 'b', text: '0' },
      { id: 'c', text: 'e' },
      { id: 'd', text: '∞' },
    ],
    correctAnswers: ['a'],
    explanation: '重要极限：lim(x→0)sinx/x=1。这个极限在三角函数极限计算中非常有用。',
  },
  {
    id: 'q-39', knowledgePointId: 'kp-74', subjectId: 'math', type: 'multi_choice',
    stem: '当x→0时，下列等价无穷小正确的是？',
    options: [
      { id: 'a', text: 'sinx~x' },
      { id: 'b', text: 'tanx~x' },
      { id: 'c', text: 'ln(1+x)~x' },
      { id: 'd', text: 'eˣ~x' },
    ],
    correctAnswers: ['a', 'b', 'c'],
    explanation: '当x→0时，sinx~x、tanx~x、ln(1+x)~x都正确。但eˣ-1~x，不是eˣ~x。',
  },
  {
    id: 'q-40', knowledgePointId: 'kp-76', subjectId: 'math', type: 'single_choice',
    stem: '函数在某点可导，则？',
    options: [
      { id: 'a', text: '该函数在该点必连续' },
      { id: 'b', text: '该函数在该点必不连续' },
      { id: 'c', text: '该函数在该点极限必为0' },
      { id: 'd', text: '该函数在该点导数必为0' },
    ],
    correctAnswers: ['a'],
    explanation: '可导必连续，但连续不一定可导。可导是更强的条件，它要求函数在该点的左、右导数都存在且相等。',
  },
  {
    id: 'q-41', knowledgePointId: 'kp-78', subjectId: 'math', type: 'single_choice',
    stem: '拉格朗日中值定理的条件是？',
    options: [
      { id: 'a', text: 'f在[a,b]连续，在(a,b)可导' },
      { id: 'b', text: 'f在[a,b]可导' },
      { id: 'c', text: 'f在[a,b]连续' },
      { id: 'd', text: 'f在(a,b)连续' },
    ],
    correctAnswers: ['a'],
    explanation: '拉格朗日中值定理要求函数在闭区间[a,b]上连续，在开区间(a,b)内可导。两个条件缺一不可。',
  },
  {
    id: 'q-42', knowledgePointId: 'kp-79', subjectId: 'math', type: 'single_choice',
    stem: '洛必达法则适用于哪种不定式？',
    options: [
      { id: 'a', text: '0/0型或∞/∞型' },
      { id: 'b', text: '0·∞型' },
      { id: 'c', text: '∞⁰型' },
      { id: 'd', text: '1^∞型' },
    ],
    correctAnswers: ['a'],
    explanation: '洛必达法则直接适用于0/0型和∞/∞型。其他类型需先通过取对数、取倒数等方式转换为这两种类型。',
  },
  {
    id: 'q-43', knowledgePointId: 'kp-81', subjectId: 'math', type: 'single_choice',
    stem: '若F\'(x)=f(x)，则∫f(x)dx等于？',
    options: [
      { id: 'a', text: 'F(x)+C' },
      { id: 'b', text: 'F(x)' },
      { id: 'c', text: 'F\'(x)' },
      { id: 'd', text: 'f\'(x)+C' },
    ],
    correctAnswers: ['a'],
    explanation: '不定积分是被积函数的全体原函数，记作∫f(x)dx=F(x)+C，其中C为任意常数。',
  },
  {
    id: 'q-44', knowledgePointId: 'kp-83', subjectId: 'math', type: 'single_choice',
    stem: '分部积分公式是？',
    options: [
      { id: 'a', text: '∫udv=uv-∫vdu' },
      { id: 'b', text: '∫udv=uv+∫vdu' },
      { id: 'c', text: '∫udv=u/v-∫vdu' },
      { id: 'd', text: '∫udv=uv/2-∫vdu' },
    ],
    correctAnswers: ['a'],
    explanation: '分部积分公式：∫udv=uv-∫vdu。选择u的原则（LIATE法则）：L>I>A>T>E。',
  },
  // ==================== 化学 - 波谱分析 ====================
  {
    id: 'q-45', knowledgePointId: 'kp-86', subjectId: 'chem', type: 'single_choice',
    stem: '下列哪种气体不能吸收红外光？',
    options: [
      { id: 'a', text: 'N₂' },
      { id: 'b', text: 'H₂O' },
      { id: 'c', text: 'CO₂' },
      { id: 'd', text: 'HCl' },
    ],
    correctAnswers: ['a'],
    explanation: '同核双原子分子如N₂、Cl₂、H₂等无红外活性，因为振动时偶极矩不变化。H₂O、CO₂、HCl都有红外活性。',
  },
  {
    id: 'q-46', knowledgePointId: 'kp-87', subjectId: 'chem', type: 'single_choice',
    stem: '红外光谱中，官能团区指的是哪个区域？',
    options: [
      { id: 'a', text: '4000~1300 cm⁻¹' },
      { id: 'b', text: '1300~650 cm⁻¹' },
      { id: 'c', text: '2500~2000 cm⁻¹' },
      { id: 'd', text: '2000~1500 cm⁻¹' },
    ],
    correctAnswers: ['a'],
    explanation: '4000~1300 cm⁻¹为官能团区，基团的特征吸收峰多位于此区域，用于基团鉴定；1300~650 cm⁻¹为指纹区。',
  },
  {
    id: 'q-47', knowledgePointId: 'kp-88', subjectId: 'chem', type: 'single_choice',
    stem: '酮羰基的伸缩振动通常出现在哪个波数附近？',
    options: [
      { id: 'a', text: '1715 cm⁻¹' },
      { id: 'b', text: '1650 cm⁻¹' },
      { id: 'c', text: '2960 cm⁻¹' },
      { id: 'd', text: '1050 cm⁻¹' },
    ],
    correctAnswers: ['a'],
    explanation: '酮羰基C=O伸缩振动通常出现在约1715 cm⁻¹附近，是红外光谱中最特征的强峰之一。',
  },
  {
    id: 'q-48', knowledgePointId: 'kp-89', subjectId: 'chem', type: 'single_choice',
    stem: '核磁共振氢谱的基准物质是？',
    options: [
      { id: 'a', text: '四甲基硅烷(TMS)' },
      { id: 'b', text: '丙酮' },
      { id: 'c', text: '乙醇' },
      { id: 'd', text: '苯' },
    ],
    correctAnswers: ['a'],
    explanation: '四甲基硅烷(TMS, (CH₃)₄Si)是核磁共振氢谱的常用基准物质，其化学位移定义为0 ppm。',
  },
  {
    id: 'q-49', knowledgePointId: 'kp-90', subjectId: 'chem', type: 'single_choice',
    stem: '苯环上的氢核化学位移通常在哪个范围？',
    options: [
      { id: 'a', text: '7.0~8.5 ppm' },
      { id: 'b', text: '5.0~6.5 ppm' },
      { id: 'c', text: '2.0~3.0 ppm' },
      { id: 'd', text: '0.5~1.5 ppm' },
    ],
    correctAnswers: ['a'],
    explanation: '苯环氢受环电流去屏蔽效应，化学位移通常在7.0~8.5 ppm范围，烯氢5.0~6.5 ppm，烷基氢0.5~1.5 ppm。',
  },
  {
    id: 'q-50', knowledgePointId: 'kp-91', subjectId: 'chem', type: 'single_choice',
    stem: '某氢核被相邻2个等价氢核耦合，裂分为几重峰？',
    options: [
      { id: 'a', text: '3重峰' },
      { id: 'b', text: '2重峰' },
      { id: 'c', text: '4重峰' },
      { id: 'd', text: '单峰' },
    ],
    correctAnswers: ['a'],
    explanation: '根据n+1规律，被n个等价氢核耦合，裂分成n+1重峰。n=2时，裂分为3重峰，强度比1:2:1。',
  },
  {
    id: 'q-51', knowledgePointId: 'kp-92', subjectId: 'chem', type: 'single_choice',
    stem: '分子式C₇H₈的不饱和度是？',
    options: [
      { id: 'a', text: '4' },
      { id: 'b', text: '3' },
      { id: 'c', text: '2' },
      { id: 'd', text: '1' },
    ],
    correctAnswers: ['a'],
    explanation: '不饱和度计算公式：Ω=(2C+2-H)/2=(2×7+2-8)/2=(14+2-8)/2=8/2=4。提示含苯环。',
  },
  {
    id: 'q-52', knowledgePointId: 'kp-93', subjectId: 'chem', type: 'multi_choice',
    stem: '红外光谱中，羧酸的特征峰包括？',
    options: [
      { id: 'a', text: '3200~3600 cm⁻¹宽峰(O-H)' },
      { id: 'b', text: '1710 cm⁻¹强峰(C=O)' },
      { id: 'c', text: '1280 cm⁻¹附近(C-O)' },
      { id: 'd', text: '3300 cm⁻¹双峰(N-H)' },
    ],
    correctAnswers: ['a', 'b', 'c'],
    explanation: '羧酸的特征：O-H宽峰(3200~3600)、C=O(1710)、C-O(1280)。3300双峰是酰胺的特征。',
  },
  {
    id: 'q-53', knowledgePointId: 'kp-94', subjectId: 'chem', type: 'single_choice',
    stem: '乙醇CH₃CH₂OH的甲基氢在¹H NMR中表现为？',
    options: [
      { id: 'a', text: '三重峰' },
      { id: 'b', text: '四重峰' },
      { id: 'c', text: '单峰' },
      { id: 'd', text: '二重峰' },
    ],
    correctAnswers: ['a'],
    explanation: '乙醇的甲基(CH₃)被相邻的CH₂裂分，n=2，按n+1规律裂分为三重峰。',
  },
  {
    id: 'q-54', knowledgePointId: 'kp-95', subjectId: 'chem', type: 'single_choice',
    stem: '乙酸乙酯CH₃COOCH₂CH₃中，与氧直接相连的CH₂氢化学位移约为？',
    options: [
      { id: 'a', text: '4.1 ppm' },
      { id: 'b', text: '2.0 ppm' },
      { id: 'c', text: '1.2 ppm' },
      { id: 'd', text: '0.9 ppm' },
    ],
    correctAnswers: ['a'],
    explanation: '与氧直接相连的CH₂受氧的吸电子去屏蔽效应，化学位移明显增大，约为4.1 ppm。',
  },
  // ==================== 化学 - 波谱分析 - 带谱图题目 ====================
  {
    id: 'q-55', knowledgePointId: 'kp-88', subjectId: 'chem', type: 'single_choice',
    stem: '根据红外光谱图判断，该化合物最可能是？',
    options: [
      { id: 'a', text: '环己酮' },
      { id: 'b', text: '苯甲醇' },
      { id: 'c', text: '乙酸乙酯' },
      { id: 'd', text: '乙胺' },
    ],
    correctAnswers: ['a'],
    explanation: '1715 cm⁻¹的强峰是酮羰基的特征吸收，环己酮是环状酮，符合此谱图特征。',
    imageUrl: '/assets/spectra/ir-cyclohexanone.svg',
  },
  {
    id: 'q-56', knowledgePointId: 'kp-90', subjectId: 'chem', type: 'single_choice',
    stem: '根据¹H NMR谱图判断，该化合物最可能是？(δ 7.2, 5H, 单峰；δ 2.3, 3H, 单峰)',
    options: [
      { id: 'a', text: '甲苯' },
      { id: 'b', text: '乙苯' },
      { id: 'c', text: '二甲苯' },
      { id: 'd', text: '苯乙烯' },
    ],
    correctAnswers: ['a'],
    explanation: 'δ 7.2(5H)为苯环单取代，δ 2.3(3H)为甲基，符合甲苯的结构。',
    imageUrl: '/assets/spectra/nmr-toluene.svg',
  },
  {
    id: 'q-57', knowledgePointId: 'kp-95', subjectId: 'chem', type: 'single_choice',
    stem: '根据¹H NMR谱图(δ 4.1, 2H, 四重峰；δ 2.0, 3H, 单峰；δ 1.2, 3H, 三重峰)，该化合物是？',
    options: [
      { id: 'a', text: '乙酸乙酯' },
      { id: 'b', text: '丙酸甲酯' },
      { id: 'c', text: '丁酸乙酯' },
      { id: 'd', text: '乙酸甲酯' },
    ],
    correctAnswers: ['a'],
    explanation: 'δ 4.1四重峰和δ 1.2三重峰是O-CH₂CH₃的特征，δ 2.0单峰是CH₃CO-的特征，符合乙酸乙酯结构。',
    imageUrl: '/assets/spectra/nmr-ethyl-acetate.png',
  },
  {
    id: 'q-58', knowledgePointId: 'kp-93', subjectId: 'chem', type: 'single_choice',
    stem: '红外谱图显示3300~3400 cm⁻¹宽峰、1050 cm⁻¹强峰，无1700附近的峰，该化合物最可能是？',
    options: [
      { id: 'a', text: '乙醇' },
      { id: 'b', text: '丙酮' },
      { id: 'c', text: '乙酸' },
      { id: 'd', text: '乙酰胺' },
    ],
    correctAnswers: ['a'],
    explanation: '3300~3400宽峰为O-H伸缩，1050为C-O伸缩，无C=O峰，符合醇的特征。',
    imageUrl: '/assets/spectra/ir-ethanol.png',
  },
  {
    id: 'q-59', knowledgePointId: 'kp-88', subjectId: 'chem', type: 'multi_choice',
    stem: '红外谱图在1735 cm⁻¹有强吸收，可能含有哪些官能团？',
    options: [
      { id: 'a', text: '酯羰基' },
      { id: 'b', text: '酮羰基' },
      { id: 'c', text: '酰胺羰基' },
      { id: 'd', text: '醛羰基' },
    ],
    correctAnswers: ['a', 'd'],
    explanation: '酯羰基约1735~1750 cm⁻¹，醛羰基约1725~1740 cm⁻¹，酮约1715，酰胺约1650。',
    imageUrl: '/assets/spectra/ir-ester.png',
  },
  {
    id: 'q-60', knowledgePointId: 'kp-92', subjectId: 'chem', type: 'single_choice',
    stem: '化合物分子式C₄H₈O，¹H NMR: δ 2.4(1H, septet), δ 2.1(3H, s), δ 1.0(6H, d)，该化合物是？',
    options: [
      { id: 'a', text: '3-甲基-2-丁酮' },
      { id: 'b', text: '2-戊酮' },
      { id: 'c', text: '3-戊酮' },
      { id: 'd', text: '异丁醛' },
    ],
    correctAnswers: ['a'],
    explanation: 'δ 2.4 septet(1H)+δ 1.0 doublet(6H)是异丙基的特征，δ 2.1(3H)是乙酰基，符合3-甲基-2-丁酮。',
    imageUrl: '/assets/spectra/nmr-methyl-butanone.png',
  },
  // ==================== 微生物与免疫学 ====================
  {
    id: 'q-micro-0001-01', knowledgePointId: 'kp-micro-0001', subjectId: 'micro', type: 'single_choice',
    stem: '下列不属于原核细胞型微生物的是？',
    options: [
            { id: 'a', text: '细菌' },
            { id: 'b', text: '病毒' },
            { id: 'c', text: '支原体' },
            { id: 'd', text: '衣原体' }
    ],
    correctAnswers: ['b'],
    explanation: '病毒属于非细胞型微生物，无细胞结构，仅由核酸和蛋白质外壳组成，必须在活细胞内寄生。',
  },
  {
    id: 'q-micro-0002-01', knowledgePointId: 'kp-micro-0002', subjectId: 'micro', type: 'single_choice',
    stem: '革兰氏阳性菌呈紫色的原因是？',
    options: [
            { id: 'a', text: '细胞壁含大量脂质' },
            { id: 'b', text: '肽聚糖层厚且交联度高' },
            { id: 'c', text: '无细胞壁' },
            { id: 'd', text: '细胞膜含特殊蛋白质' }
    ],
    correctAnswers: ['b'],
    explanation: '革兰氏阳性菌细胞壁肽聚糖层厚、交联度高，乙醇脱色时肽聚糖层孔径缩小，结晶紫-碘复合物保留在细胞内呈紫色。',
  },
  {
    id: 'q-micro-0003-01', knowledgePointId: 'kp-micro-0003', subjectId: 'micro', type: 'single_choice',
    stem: '下列哪项不是细菌的基本结构？',
    options: [
            { id: 'a', text: '细胞壁' },
            { id: 'b', text: '细胞膜' },
            { id: 'c', text: '荚膜' },
            { id: 'd', text: '细胞质' }
    ],
    correctAnswers: ['c'],
    explanation: '荚膜是细菌的特殊结构，不是基本结构。基本结构包括细胞壁、细胞膜、细胞质、核质。',
  },
  {
    id: 'q-micro-0004-01', knowledgePointId: 'kp-micro-0004', subjectId: 'micro', type: 'single_choice',
    stem: '细菌形态典型、对外界环境敏感的时期是？',
    options: [
            { id: 'a', text: '迟缓期' },
            { id: 'b', text: '对数期' },
            { id: 'c', text: '稳定期' },
            { id: 'd', text: '衰亡期' }
    ],
    correctAnswers: ['b'],
    explanation: '对数期细菌生长迅速，形态典型，对外界环境敏感，常用于细菌鉴定和药物敏感性试验。',
  },
  {
    id: 'q-micro-0005-01', knowledgePointId: 'kp-micro-0005', subjectId: 'micro', type: 'single_choice',
    stem: '下列哪项不是细菌的合成代谢产物？',
    options: [
            { id: 'a', text: '热原质' },
            { id: 'b', text: '毒素' },
            { id: 'c', text: '抗生素' },
            { id: 'd', text: '二氧化碳' }
    ],
    correctAnswers: ['d'],
    explanation: '二氧化碳是细菌的分解代谢产物，不是合成代谢产物。合成代谢产物包括热原质、毒素、抗生素、维生素等。',
  },
  {
    id: 'q-micro-0006-01', knowledgePointId: 'kp-micro-0006', subjectId: 'micro', type: 'single_choice',
    stem: '杀灭芽胞最可靠的方法是？',
    options: [
            { id: 'a', text: '煮沸法' },
            { id: 'b', text: '高压蒸汽灭菌法' },
            { id: 'c', text: '紫外线照射' },
            { id: 'd', text: '75%乙醇浸泡' }
    ],
    correctAnswers: ['b'],
    explanation: '高压蒸汽灭菌法（121℃，15-20分钟）可杀灭包括芽胞在内的所有微生物，是最可靠的灭菌方法。',
  },
  {
    id: 'q-micro-0007-01', knowledgePointId: 'kp-micro-0007', subjectId: 'micro', type: 'single_choice',
    stem: '正常菌群的生理作用不包括？',
    options: [
            { id: 'a', text: '生物拮抗' },
            { id: 'b', text: '营养作用' },
            { id: 'c', text: '免疫作用' },
            { id: 'd', text: '致病作用' }
    ],
    correctAnswers: ['d'],
    explanation: '正常菌群的生理作用包括生物拮抗、营养作用、免疫作用、抗衰老作用等，致病作用不是正常菌群的生理作用。',
  },
  {
    id: 'q-micro-0008-01', knowledgePointId: 'kp-micro-0008', subjectId: 'micro', type: 'single_choice',
    stem: '关于外毒素的描述正确的是？',
    options: [
            { id: 'a', text: '革兰氏阴性菌产生' },
            { id: 'b', text: '脂多糖成分' },
            { id: 'c', text: '可脱毒制成类毒素' },
            { id: 'd', text: '毒性较弱' }
    ],
    correctAnswers: ['c'],
    explanation: '外毒素由革兰氏阳性菌产生，是蛋白质，毒性强，免疫原性强，可脱毒制成类毒素用于预防接种。',
  },
  {
    id: 'q-micro-0009-01', knowledgePointId: 'kp-micro-0009', subjectId: 'micro', type: 'single_choice',
    stem: '病毒的特征不包括？',
    options: [
            { id: 'a', text: '体积微小' },
            { id: 'b', text: '仅含一种核酸' },
            { id: 'c', text: '二分裂繁殖' },
            { id: 'd', text: '对抗生素不敏感' }
    ],
    correctAnswers: ['c'],
    explanation: '病毒以复制方式增殖，不是二分裂繁殖。二分裂是细菌的繁殖方式。',
  },
  {
    id: 'q-micro-0010-01', knowledgePointId: 'kp-micro-0010', subjectId: 'micro', type: 'single_choice',
    stem: '病毒包膜的来源是？',
    options: [
            { id: 'a', text: '病毒自身合成' },
            { id: 'b', text: '宿主细胞膜或核膜' },
            { id: 'c', text: '培养基成分' },
            { id: 'd', text: '衣壳蛋白变性' }
    ],
    correctAnswers: ['b'],
    explanation: '病毒包膜来自宿主细胞膜或核膜，是病毒在出芽释放时获得的，含有病毒编码的刺突蛋白。',
  },
  {
    id: 'q-micro-0011-01', knowledgePointId: 'kp-micro-0011', subjectId: 'micro', type: 'single_choice',
    stem: '病毒复制周期的正确顺序是？',
    options: [
            { id: 'a', text: '吸附→穿入→脱壳→生物合成→装配释放' },
            { id: 'b', text: '穿入→吸附→脱壳→生物合成→装配释放' },
            { id: 'c', text: '吸附→脱壳→穿入→生物合成→装配释放' },
            { id: 'd', text: '生物合成→吸附→穿入→脱壳→装配释放' }
    ],
    correctAnswers: ['a'],
    explanation: '病毒复制周期的正确顺序是：吸附→穿入→脱壳→生物合成→装配释放。',
  },
  {
    id: 'q-micro-0012-01', knowledgePointId: 'kp-micro-0012', subjectId: 'micro', type: 'single_choice',
    stem: '单纯疱疹病毒的感染类型属于？',
    options: [
            { id: 'a', text: '急性感染' },
            { id: 'b', text: '慢性感染' },
            { id: 'c', text: '潜伏感染' },
            { id: 'd', text: '慢发病毒感染' }
    ],
    correctAnswers: ['c'],
    explanation: '单纯疱疹病毒属于潜伏感染，病毒潜伏在神经节中，当机体免疫力下降时可复发引起口唇疱疹等。',
  },
  {
    id: 'q-micro-0013-01', knowledgePointId: 'kp-micro-0013', subjectId: 'micro', type: 'single_choice',
    stem: '干扰素的抗病毒机制是？',
    options: [
            { id: 'a', text: '直接灭活病毒' },
            { id: 'b', text: '诱导细胞产生抗病毒蛋白' },
            { id: 'c', text: '阻止病毒吸附' },
            { id: 'd', text: '破坏病毒包膜' }
    ],
    correctAnswers: ['b'],
    explanation: '干扰素不能直接灭活病毒，而是诱导细胞产生抗病毒蛋白，降解病毒mRNA，抑制病毒蛋白合成。',
  },
  {
    id: 'q-micro-0014-01', knowledgePointId: 'kp-micro-0014', subjectId: 'micro', type: 'single_choice',
    stem: '下列属于中枢免疫器官的是？',
    options: [
            { id: 'a', text: '淋巴结' },
            { id: 'b', text: '脾脏' },
            { id: 'c', text: '骨髓' },
            { id: 'd', text: '扁桃体' }
    ],
    correctAnswers: ['c'],
    explanation: '中枢免疫器官包括骨髓和胸腺，是免疫细胞发生、分化、成熟的场所。',
  },
  {
    id: 'q-micro-0015-01', knowledgePointId: 'kp-micro-0015', subjectId: 'micro', type: 'single_choice',
    stem: '抗原的两个基本特性是？',
    options: [
            { id: 'a', text: '免疫原性和抗原性' },
            { id: 'b', text: '异物性和特异性' },
            { id: 'c', text: '分子量大和结构复杂' },
            { id: 'd', text: '可降解性和构象' }
    ],
    correctAnswers: ['a'],
    explanation: '抗原的两个基本特性是免疫原性（能刺激免疫应答）和抗原性（能与应答产物结合）。',
  },
  {
    id: 'q-micro-0016-01', knowledgePointId: 'kp-micro-0016', subjectId: 'micro', type: 'single_choice',
    stem: '决定抗原特异性的核心结构是？',
    options: [
            { id: 'a', text: '抗原分子量' },
            { id: 'b', text: '抗原表位' },
            { id: 'c', text: '抗原的物理性状' },
            { id: 'd', text: '抗原分子结构复杂度' }
    ],
    correctAnswers: ['b'],
    explanation: '抗原表位是抗原分子中与抗体或淋巴细胞抗原受体特异性结合的特殊化学基团，直接决定抗原特异性。',
  },
  {
    id: 'q-micro-0017-01', knowledgePointId: 'kp-micro-0017', subjectId: 'micro', type: 'single_choice',
    stem: '抗体的抗原结合部位位于？',
    options: [
            { id: 'a', text: 'Fc段' },
            { id: 'b', text: 'Fab段的可变区' },
            { id: 'c', text: '恒定区' },
            { id: 'd', text: '轻链的恒定区' }
    ],
    correctAnswers: ['b'],
    explanation: '抗体的抗原结合部位位于Fab段的可变区，特别是其中的高变区（互补决定区CDR）。',
  },
  {
    id: 'q-micro-0018-01', knowledgePointId: 'kp-micro-0018', subjectId: 'micro', type: 'single_choice',
    stem: '唯一能通过胎盘的抗体是？',
    options: [
            { id: 'a', text: 'IgM' },
            { id: 'b', text: 'IgG' },
            { id: 'c', text: 'IgA' },
            { id: 'd', text: 'IgE' }
    ],
    correctAnswers: ['b'],
    explanation: 'IgG是唯一能通过胎盘的抗体，在新生儿抗感染中起重要作用。',
  },
  {
    id: 'q-micro-0019-01', knowledgePointId: 'kp-micro-0019', subjectId: 'micro', type: 'single_choice',
    stem: '免疫应答的三个阶段顺序是？',
    options: [
            { id: 'a', text: '识别→活化增殖分化→效应' },
            { id: 'b', text: '活化增殖分化→识别→效应' },
            { id: 'c', text: '效应→识别→活化增殖分化' },
            { id: 'd', text: '识别→效应→活化增殖分化' }
    ],
    correctAnswers: ['a'],
    explanation: '免疫应答的三个阶段顺序是：识别阶段→活化、增殖、分化阶段→效应阶段。',
  },
  {
    id: 'q-micro-0020-01', knowledgePointId: 'kp-micro-0020', subjectId: 'micro', type: 'single_choice',
    stem: '接触性皮炎属于哪型超敏反应？',
    options: [
            { id: 'a', text: 'Ⅰ型' },
            { id: 'b', text: 'Ⅱ型' },
            { id: 'c', text: 'Ⅲ型' },
            { id: 'd', text: 'Ⅳ型' }
    ],
    correctAnswers: ['d'],
    explanation: '接触性皮炎属于Ⅳ型（迟发型）超敏反应，由T细胞介导，通常在接触抗原24-48小时后发生。',
  },
];
