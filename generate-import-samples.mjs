import fs from 'node:fs';
import path from 'node:path';

const samples = [
  {
    id: 'S01',
    category: '标准 Q/A',
    fileName: 'standard-qa.txt',
    expectedMode: 'qa',
    expectedCards: 2,
    expectedQuestions: 0,
    notes: '无 warning，置信度高。',
    content: `Q: 什么是牛顿第一定律？
A: 物体在不受外力时保持静止或匀速直线运动状态。

Q: 什么是细胞膜的主要功能？
A: 将细胞内外环境分隔开，并控制物质进出。
`,
  },
  {
    id: 'S02',
    category: '标准知识点',
    fileName: 'standard-knowledge.txt',
    expectedMode: 'knowledge',
    expectedCards: 2,
    expectedQuestions: 0,
    notes: '无 warning，置信度高。',
    content: `# 牛顿第一定律
物体在不受外力时保持静止或匀速直线运动状态。

# 光合作用
绿色植物利用光能，将二氧化碳和水合成为有机物，并释放氧气。
`,
  },
  {
    id: 'S03',
    category: '知识点+题目+解析混合',
    fileName: 'knowledge-question-mixed.txt',
    expectedMode: 'knowledge',
    expectedCards: 2,
    expectedQuestions: 2,
    notes: '无跳过，能看到题目预览。',
    content: `【知识点】牛顿第一定律
内容：物体在不受外力时保持静止或匀速直线运动状态。
【题目】题干：以下哪项最符合牛顿第一定律？
A. 受力越大，速度一定越大
B. 不受外力时物体保持原有运动状态
C. 所有物体都会自动停止
答案：B
【解析】牛顿第一定律强调的是“保持原有状态”。

【知识点】氧化还原反应
内容：反应过程中发生电子转移或元素化合价变化。
【题目】题干：以下哪项属于氧化还原反应的核心特征？
A. 颜色变化
B. 状态变化
C. 电子转移
答案：C
【解析】判断氧化还原反应的核心标准是是否存在电子转移。
`,
  },
  {
    id: 'S04',
    category: '普通段落笔记',
    fileName: 'paragraph-notes.txt',
    expectedMode: 'paragraph',
    expectedCards: 3,
    expectedQuestions: 0,
    notes: '自动按段落兜底。',
    content: `酸碱中和反应通常会生成盐和水，是初中化学中的高频基础知识。

电解质在水溶液或熔融状态下能够导电，非电解质则不能。

化学平衡是动态平衡，正逆反应仍在同时进行，只是速率相等。
`,
  },
  {
    id: 'S05',
    category: '半残缺 Q/A',
    fileName: 'incomplete-qa.txt',
    expectedMode: 'qa',
    expectedCards: 2,
    expectedQuestions: 0,
    notes: '提示检测到 Q: 缺少对应 A:。',
    content: `Q: 什么是阿伏伽德罗常数？
A: 每摩尔物质所含的微粒数，约为 6.02×10^23。

Q: 什么是理想气体状态方程？
`,
  },
  {
    id: 'S06',
    category: '半残缺题目解析',
    fileName: 'incomplete-question-explanation.txt',
    expectedMode: 'knowledge',
    expectedCards: 1,
    expectedQuestions: 1,
    notes: '提示检测到【题目】缺少【解析】。',
    content: `【知识点】热力学第一定律
内容：能量既不会凭空产生，也不会凭空消失，只会从一种形式转化为另一种形式。
【题目】题干：热力学第一定律强调的核心是？
A. 熵增
B. 能量守恒
C. 反应速率
答案：B
`,
  },
  {
    id: 'S07',
    category: '脏文本（空行/分隔线/编号）',
    fileName: 'noisy-structured-text.txt',
    expectedMode: 'knowledge',
    expectedCards: 2,
    expectedQuestions: 0,
    notes: '仍能稳定识别为知识点模式。',
    content: `01.

# 溶液浓度

---

表示一定量溶液中所含溶质的多少。



02.

# 化学反应速率

=====

单位时间内反应物浓度的减少量或生成物浓度的增加量。
`,
  },
  {
    id: 'S08',
    category: '完全无法识别的普通文本',
    fileName: 'unstructured-text.txt',
    expectedMode: 'paragraph',
    expectedCards: 1,
    expectedQuestions: 0,
    notes: '提示建议优先使用模板。',
    content: `今天把物理和化学的笔记混在一起简单记了一下，后面有空再慢慢整理成更清晰的结构。
`,
  },
  {
    id: 'S09',
    category: '结构化 JSON',
    fileName: 'structured-json.json',
    expectedMode: 'json',
    expectedCards: 2,
    expectedQuestions: 1,
    notes: '保持现有 JSON 导入能力。',
    content: `{
  "knowledgePoints": [
    {
      "id": "json-kp-1",
      "name": "原电池",
      "explanation": "将化学能转化为电能的装置。"
    },
    {
      "id": "json-kp-2",
      "name": "盖斯定律",
      "explanation": "化学反应的焓变只与始态和终态有关。"
    }
  ],
  "questions": [
    {
      "id": "json-q-1",
      "knowledgePointId": "json-kp-1",
      "type": "single_choice",
      "stem": "原电池工作时，能量转化方向是？",
      "options": [
        { "id": "A", "text": "电能转化为化学能" },
        { "id": "B", "text": "化学能转化为电能" }
      ],
      "correctAnswers": ["B"],
      "explanation": "原电池依靠自发氧化还原反应对外供电。"
    }
  ]
}
`,
  },
];

const rootDir = process.cwd();
const outputDir = path.join(rootDir, 'output', 'import-samples');
fs.mkdirSync(outputDir, { recursive: true });

for (const sample of samples) {
  fs.writeFileSync(path.join(outputDir, sample.fileName), sample.content, 'utf8');
}

const manifest = {
  generatedAt: new Date().toISOString(),
  sampleCount: samples.length,
  samples: samples.map(sample => ({
    id: sample.id,
    category: sample.category,
    fileName: sample.fileName,
    expectedMode: sample.expectedMode,
    expectedCards: sample.expectedCards,
    expectedQuestions: sample.expectedQuestions,
    notes: sample.notes,
  })),
};

fs.writeFileSync(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Generated ${samples.length} import regression samples to: ${outputDir}`);
for (const sample of samples) {
  console.log(
    `- ${sample.id} ${sample.fileName} -> mode=${sample.expectedMode}, cards=${sample.expectedCards}, questions=${sample.expectedQuestions}`,
  );
}
