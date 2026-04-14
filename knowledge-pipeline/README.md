# 知识处理流水线

将原始教材/资料提取为 APP 可用的知识库数据。

## 目录结构

```
knowledge-pipeline/
├── source/              # 原始资料（按学科分子目录）
│   ├── tcm/              # 中药学原始 PDF/TXT
│   ├── instrumental/     # 仪器分析原始资料
│   └── 微生物与免疫学.txt
├── output/               # 生成结果
│   ├── pending/          # 待审核（运行 extract 后自动创建）
│   ├── approved/         # 审核通过（finalize 后自动创建）
│   ├── rejected/         # 审核拒绝
│   └── {学科名}/         # 最终数据（finalize 后生成）
│       ├── index.json    # 知识点
│       └── questions.json # 题目
├── extractors/           # 文件提取器（PDF/EPUB/TXT/图片）
├── processors/           # 知识处理 + 题目生成 + 审核
├── storage/              # 本地存储 + OSS 上传
├── config.py             # 配置
└── main.py              # 主入口
```

## 工作流

### Step 1: 放入原始资料

将 PDF/TXT/EPUB 放入 `source/{学科}/`，例如：
```
source/tcm/中药学教材.pdf
source/instrumental/紫外光谱分析.pdf
```

### Step 2: 运行提取 + 审核模式

```bash
cd knowledge-pipeline
python main.py run -i ../source/tcm/中药学教材.pdf -s 中药学 --subject-id tcm
```

提取后会自动保存到 `output/pending/`，等待人工审核。

### Step 3: 人工审核

审核文件在 `output/pending/` 下，格式为 JSON。

每个知识点有审核状态：
- `pending` - 待定
- `approved` - 通过
- `rejected` - 拒绝

**方式一：命令行审核**
```bash
# 批准单个
python -c "from processors.review import KnowledgeReviewer; r=KnowledgeReviewer('output'); r.approve_item('pending/文件名.json', '知识点ID')"

# 批准全部
python -c "from processors.review import KnowledgeReviewer; r=KnowledgeReviewer('output'); r.approve_all('pending/文件名.json')"

# 拒绝全部
python -c "from processors.review import KnowledgeReviewer; r=KnowledgeReviewer('output'); r.reject_all('pending/文件名.json')"
```

**方式二：直接编辑 JSON**

修改 `itemReviews` 字段中对应知识点的状态为 `approved` 或 `rejected`。

### Step 4: 完成审核 + 上传 OSS

```bash
python main.py finalize -f output/pending/中药学_20260414_153022.json --upload
```

执行后：
1. 通过审核的知识点保存到 `output/中药学/index.json`
2. 通过审核的题目保存到 `output/中药学/questions.json`
3. 文件移动到 `output/approved/`
4. 上传到 OSS `knowledge/tcm/index.json`

### 其他命令

```bash
# 批量处理目录
python main.py batch -d ../source/tcm/

# 上传所有本地数据到 OSS
python main.py upload

# 查看本地统计
python main.py stats
```

## 题目要求

**每道题目必须包含解析，无解析的题目不会被保存。**

题目生成器会自动为每道题生成解析，格式为：
```
{explanation}: {知识点名}：{知识点内容摘要}...
```

如果解析长度不足，题目会被过滤掉。

## OSS 配置

在 `knowledge-pipeline/` 下创建 `.env` 文件：

```
OSS_ENABLED=true
OSS_ACCESS_KEY_ID=你的KeyId
OSS_ACCESS_KEY_SECRET=你的KeySecret
OSS_BUCKET=zhixuestudy
OSS_REGION=oss-cn-beijing
```

## 已上传 OSS 的学科

| 学科 | OSS 路径 |
|------|---------|
| 微生物与免疫学 | knowledge/micro/index.json |
| 免疫学 | knowledge/immuno/index.json |
| 仪器分析（紫外光谱） | knowledge/instrumental_analysis/* |

本地 `output/` 目录中暂无对应文件，如需重新上传需先跑完整流程生成数据。
