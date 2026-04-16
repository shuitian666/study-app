import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Copy, FileJson, RefreshCw, Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/Common';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';
import type { Chapter, KnowledgePointExtended, ProficiencyLevel, Question, QuestionType, Subject } from '@/types';

type PasteMode = 'file' | 'paste';
type SourceHint = 'json' | 'text' | 'auto';
type TextParseMode = 'auto' | 'knowledge' | 'qa' | 'paragraph';
type RecognizedMode = 'json' | 'knowledge' | 'qa' | 'paragraph';
type ParseConfidence = 'high' | 'medium' | 'low';

interface ImportedKnowledgeDraft {
  id?: string;
  subjectId?: string;
  chapterId?: string;
  name: string;
  explanation?: string;
  proficiency?: ProficiencyLevel;
  source?: 'ai' | 'manual' | 'import';
  raw_text?: string;
  type?: string;
}

interface ImportedQuestionDraft {
  id?: string;
  knowledgePointId?: string;
  knowledgePointName?: string;
  subjectId?: string;
  type?: QuestionType;
  stem: string;
  options: { id: string; text: string }[];
  correctAnswers: string[];
  explanation?: string;
}

interface ParsedImportData {
  knowledgePoints: ImportedKnowledgeDraft[];
  questions: ImportedQuestionDraft[];
  sourceType: 'json' | 'text';
  recognizedMode: RecognizedMode;
  fileName?: string;
  warnings: ParseWarning[];
  skippedCount: number;
  confidence: ParseConfidence;
}

interface ParseWarning {
  id: string;
  level: 'info' | 'warning';
  message: string;
  suggestion: string;
}

interface SubmittedSource {
  content: string;
  fileName?: string;
  sourceHint: SourceHint;
}

interface TemplateDefinition {
  id: string;
  title: string;
  description: string;
  example: string;
}

interface ParsedQuestionBlock {
  questionLines: string[];
  explanationLines: string[];
}

interface ParseModeResult {
  knowledgePoints: ImportedKnowledgeDraft[];
  questions: ImportedQuestionDraft[];
  warnings: ParseWarning[];
  skippedCount: number;
  confidence: ParseConfidence;
}

const DEFAULT_SUBJECT: Subject = {
  id: 'general',
  name: '默认学科',
  icon: '📚',
  color: '#6b7280',
  knowledgePointCount: 0,
};

const TEMPLATE_LIST: TemplateDefinition[] = [
  {
    id: 'qa-template',
    title: 'Q/A 模板',
    description: '适合一问一答的记忆卡片，自动识别为问答模式。',
    example: `Q: 什么是牛顿第一定律？
A: 物体在不受外力时保持静止或匀速直线运动状态。

Q: 什么是细胞膜的主要功能？
A: 将细胞内外环境分隔开，并控制物质进出。`,
  },
  {
    id: 'knowledge-template',
    title: '知识点模板',
    description: '适合按标题整理笔记，自动识别为知识点模式。',
    example: `# 牛顿第一定律
物体在不受外力时保持静止或匀速直线运动状态。

# 光合作用
绿色植物利用光能，将二氧化碳和水合成为有机物，并释放氧气。`,
  },
  {
    id: 'knowledge-question-template',
    title: '知识点+题目模板',
    description: '适合一边导知识点一边补题目，优先按模板结构解析。',
    example: `【知识点】牛顿第一定律
内容：
物体在不受外力时保持静止或匀速直线运动状态。
【题目】
题干：以下哪项最符合牛顿第一定律？
A. 受力越大，速度一定越大
B. 不受外力时物体保持原有运动状态
C. 所有物体都会自动停止
答案：B
【解析】
牛顿第一定律强调的是“保持原有状态”，而不是“自动停止”。`,
  },
];

const PARSE_MODE_LABELS: Record<TextParseMode, string> = {
  auto: '自动识别',
  knowledge: '知识点模式',
  qa: '问答模式',
  paragraph: '段落模式',
};

const RECOGNIZED_MODE_LABELS: Record<RecognizedMode, string> = {
  json: 'JSON 结构化导入',
  knowledge: '知识点模式',
  qa: '问答模式',
  paragraph: '段落模式',
};

const CONFIDENCE_LABELS: Record<ParseConfidence, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const cleanOptionPrefix = (text: string): string => text.replace(/^[A-G][\.\)、:：]\s*/, '').trim();

const normalizeText = (content: string): string => content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

const splitBlocks = (content: string): string[] =>
  normalizeText(content)
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(Boolean);

const createId = (prefix: string, index: number) =>
  `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;

const createParseWarning = (
  message: string,
  suggestion: string,
  level: 'info' | 'warning' = 'warning',
): ParseWarning => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  level,
  message,
  suggestion,
});

const ensureExplanation = (value?: string): string => {
  const text = String(value ?? '').trim();
  return text || '待补充';
};

const normalizeKey = (value?: string): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const inferParagraphTitle = (text: string, index: number): string => {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return `段落 ${index + 1}`;
  }

  return compact.length > 28 ? `${compact.slice(0, 28)}...` : compact;
};

const detectTextParseMode = (content: string): Exclude<RecognizedMode, 'json'> => {
  const normalized = normalizeText(content);

  if (!normalized) {
    return 'paragraph';
  }

  if (/^Q[:：]/im.test(normalized) && /^A[:：]/im.test(normalized)) {
    return 'qa';
  }

  if (/^【知识点】/m.test(normalized) || /^#\s+/m.test(normalized)) {
    return 'knowledge';
  }

  return 'paragraph';
};

const parseJsonContent = (content: string): ParsedImportData => {
  let data: any;

  try {
    data = JSON.parse(content);
  } catch (error) {
    throw new Error(`JSON 解析失败：${error instanceof Error ? error.message : '未知错误'}`);
  }

  let knowledgePoints: ImportedKnowledgeDraft[] = [];
  let questions: ImportedQuestionDraft[] = [];

  if (Array.isArray(data)) {
    knowledgePoints = data;
  } else if (data && typeof data === 'object') {
    if (Array.isArray(data.knowledgePoints)) {
      knowledgePoints = data.knowledgePoints;
    } else if (Array.isArray(data.data)) {
      knowledgePoints = data.data;
    }

    if (Array.isArray(data.questions)) {
      questions = data.questions.map((question: any) => ({
        id: question.id,
        knowledgePointId: question.knowledgePointId,
        knowledgePointName: String(
          question.knowledgePointName ??
          question.knowledgePoint ??
          question.kpName ??
          question.knowledgeName ??
          '',
        ).trim(),
        subjectId: question.subjectId,
        type: question.type ?? 'single_choice',
        stem: String(question.stem ?? '').trim(),
        options: Array.isArray(question.options)
          ? question.options.map((option: any, index: number) => ({
              id: String(option.id ?? `option-${index + 1}`),
              text: cleanOptionPrefix(String(option.text ?? option.label ?? '').trim()),
            }))
          : [],
        correctAnswers: Array.isArray(question.correctAnswers)
          ? question.correctAnswers.map((answer: any) => String(answer))
          : [],
        explanation: String(question.explanation ?? '').trim(),
      }));
    }
  }

  const normalizedKnowledgePoints = knowledgePoints
    .map(item => ({
      id: item.id,
      subjectId: item.subjectId,
      chapterId: item.chapterId,
      name: String(item.name ?? '').trim(),
      explanation: String(item.explanation ?? item.raw_text ?? '').trim(),
      proficiency: item.proficiency,
      source: item.source,
      raw_text: item.raw_text,
      type: item.type,
    }))
    .filter(item => item.name);

  if (normalizedKnowledgePoints.length === 0) {
    throw new Error('JSON 中没有可导入的知识点数据');
  }

  return {
    knowledgePoints: normalizedKnowledgePoints,
    questions: questions.filter(question => question.stem),
    sourceType: 'json',
    recognizedMode: 'json',
    warnings: [],
    skippedCount: 0,
    confidence: 'high',
  };
};

const parseQuestionFromTemplate = (
  questionLines: string[],
  explanation: string,
  knowledgePointId: string,
  index: number,
): ImportedQuestionDraft | null => {
  const lines = questionLines.map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return null;
  }

  const answerIndex = lines.findIndex(line => /^(答案|正确答案)[:：]/i.test(line));
  const answerLine = answerIndex >= 0 ? lines[answerIndex] : '';
  const contentLines = lines.filter((_, lineIndex) => lineIndex !== answerIndex);

  const optionPattern = /^([A-D])[\.\)、:：]\s*(.+)$/i;
  const optionLines = contentLines.filter(line => optionPattern.test(line));
  const stemLines = contentLines
    .filter(line => !optionPattern.test(line))
    .map(line => line.replace(/^题干[:：]\s*/i, '').trim())
    .filter(Boolean);

  if (optionLines.length > 0) {
    const options = optionLines.map(line => {
      const match = line.match(optionPattern)!;
      return {
        id: match[1].toUpperCase(),
        text: cleanOptionPrefix(match[2]),
      };
    });

    const correctAnswers = answerLine
      .replace(/^(答案|正确答案)[:：]\s*/i, '')
      .split(/[，,、\s]+/)
      .map(answer => answer.trim().toUpperCase())
      .filter(Boolean);

    if (correctAnswers.length === 0) {
      return null;
    }

    return {
      id: `template-question-${index + 1}`,
      knowledgePointId,
      knowledgePointName: '',
      type: correctAnswers.length > 1 ? 'multi_choice' : 'single_choice',
      stem: stemLines.join(' ') || `题目 ${index + 1}`,
      options,
      correctAnswers,
      explanation: explanation.trim(),
    };
  }

  const answerText = answerLine.replace(/^(答案|正确答案)[:：]\s*/i, '').trim().toLowerCase();
  if (['对', '错', '正确', '错误', 'true', 'false'].includes(answerText)) {
    return {
      id: `template-question-${index + 1}`,
      knowledgePointId,
      knowledgePointName: '',
      type: 'true_false',
      stem: stemLines.join(' ') || `判断题 ${index + 1}`,
      options: [
        { id: 'true', text: '正确' },
        { id: 'false', text: '错误' },
      ],
      correctAnswers: ['对', '正确', 'true'].includes(answerText) ? ['true'] : ['false'],
      explanation: explanation.trim(),
    };
  }

  return null;
};

const parseKnowledgeQuestionTemplate = (content: string): ParseModeResult => {
  const blocks = normalizeText(content)
    .split(/(?=^【知识点】)/m)
    .map(block => block.trim())
    .filter(Boolean);

  const knowledgePoints: ImportedKnowledgeDraft[] = [];
  const questions: ImportedQuestionDraft[] = [];
  const warnings: ParseWarning[] = [];
  let skippedCount = 0;
  let missingExplanationCount = 0;

  blocks.forEach((block, index) => {
    const lines = block.split('\n');
    const knowledgeLines: string[] = [];
    const contentLines: string[] = [];
    const questionBlocks: ParsedQuestionBlock[] = [];
    let currentQuestionBlock: ParsedQuestionBlock | null = null;
    let section: 'knowledge' | 'content' | 'question' | 'explanation' = 'knowledge';

    const ensureCurrentQuestionBlock = () => {
      if (!currentQuestionBlock) {
        currentQuestionBlock = {
          questionLines: [],
          explanationLines: [],
        };
      }

      return currentQuestionBlock;
    };

    const flushCurrentQuestionBlock = () => {
      if (
        currentQuestionBlock
        && (currentQuestionBlock.questionLines.length > 0 || currentQuestionBlock.explanationLines.length > 0)
      ) {
        questionBlocks.push(currentQuestionBlock);
      }
      currentQuestionBlock = null;
    };

    lines.forEach((rawLine, lineIndex) => {
      const line = rawLine.trim();
      if (!line) {
        return;
      }

      const knowledgeMatch = line.match(/^【知识点】\s*(.*)$/);
      const contentMatch = line.match(/^内容[:：]?\s*(.*)$/);
      const questionMatch = line.match(/^【题目】\s*(.*)$/);
      const explanationMatch = line.match(/^【解析】\s*(.*)$/);

      if (knowledgeMatch) {
        section = 'knowledge';
        if (knowledgeMatch[1]) {
          knowledgeLines.push(knowledgeMatch[1].trim());
        }
        return;
      }

      if (contentMatch) {
        section = 'content';
        if (contentMatch[1]) {
          contentLines.push(contentMatch[1].trim());
        }
        return;
      }

      if (questionMatch) {
        flushCurrentQuestionBlock();
        section = 'question';
        if (questionMatch[1]) {
          ensureCurrentQuestionBlock().questionLines.push(questionMatch[1].trim());
        }
        return;
      }

      if (explanationMatch) {
        section = 'explanation';
        if (explanationMatch[1]) {
          ensureCurrentQuestionBlock().explanationLines.push(explanationMatch[1].trim());
        }
        return;
      }

      if (lineIndex === 0 && !knowledgeLines.length) {
        knowledgeLines.push(line);
        return;
      }

      if (section === 'knowledge') {
        knowledgeLines.push(line);
      } else if (section === 'content') {
        contentLines.push(line);
      } else if (section === 'question') {
        ensureCurrentQuestionBlock().questionLines.push(line);
      } else {
        ensureCurrentQuestionBlock().explanationLines.push(line);
      }
    });

    flushCurrentQuestionBlock();

    const knowledgePointId = `template-kp-${index + 1}`;
    const knowledgeName = knowledgeLines.join(' ').trim() || `知识点 ${index + 1}`;
    const explanation = ensureExplanation(contentLines.join('\n'));

    knowledgePoints.push({
      id: knowledgePointId,
      name: knowledgeName,
      explanation,
      type: 'knowledge',
    });

    const baseQuestionIndex = questions.length;
    questionBlocks.forEach((questionBlock, questionIndex) => {
      if (questionBlock.questionLines.length > 0 && questionBlock.explanationLines.length === 0) {
        missingExplanationCount += 1;
      }

      const question = parseQuestionFromTemplate(
        questionBlock.questionLines,
        questionBlock.explanationLines.join('\n') || explanation,
        knowledgePointId,
        baseQuestionIndex + questionIndex,
      );

      if (question) {
        questions.push({
          ...question,
          knowledgePointName: knowledgeName,
        });
      } else if (questionBlock.questionLines.length > 0 || questionBlock.explanationLines.length > 0) {
        skippedCount += 1;
      }
    });
  });

  if (missingExplanationCount > 0) {
    warnings.push(createParseWarning(
      `检测到 ${missingExplanationCount} 个【题目】块缺少【解析】。`,
      '请在每个【题目】后补上对应的【解析】段落；初版会先用知识点内容兜底，但建议补齐以提升学习质量。',
    ));
  }

  if (skippedCount > 0) {
    warnings.push(createParseWarning(
      `有 ${skippedCount} 个题目块未能成功解析，已跳过。`,
      '请检查题目块是否包含完整题干、选项与答案；如果是判断题，也请补上明确答案。',
    ));
  }

  return {
    knowledgePoints,
    questions,
    warnings,
    skippedCount,
    confidence: skippedCount > 0 || missingExplanationCount > 0 ? 'medium' : 'high',
  };
};

const parseKnowledgeMode = (content: string): ParseModeResult => {
  if (/^【知识点】/m.test(content)) {
    return parseKnowledgeQuestionTemplate(content);
  }

  if (/^#\s+/m.test(content)) {
    const sections: Array<{ title: string; body: string[] }> = [];
    let current: { title: string; body: string[] } | null = null;

    normalizeText(content).split('\n').forEach(line => {
      const titleMatch = line.trim().match(/^#\s+(.+)$/);
      if (titleMatch) {
        if (current) {
          sections.push(current);
        }
        current = { title: titleMatch[1].trim(), body: [] };
        return;
      }

      if (!current) {
        current = { title: inferParagraphTitle(line.trim(), sections.length), body: [] };
      }

      if (line.trim()) {
        current.body.push(line.trim());
      }
    });

    if (current) {
      sections.push(current);
    }

    const knowledgePoints = sections
      .map((section, index) => ({
        id: `knowledge-${index + 1}`,
        name: section.title || `知识点 ${index + 1}`,
        explanation: ensureExplanation(section.body.join('\n')),
        type: 'knowledge',
      }))
      .filter(item => item.name);

    if (knowledgePoints.length > 0) {
      return {
        knowledgePoints,
        questions: [],
        warnings: [],
        skippedCount: 0,
        confidence: 'high',
      };
    }
  }

  const blocks = splitBlocks(content);
  const knowledgePoints = blocks.map((block, index) => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const name = lines[0]?.replace(/^#\s*/, '').trim() || `知识点 ${index + 1}`;
    const explanation = ensureExplanation(lines.slice(1).join('\n'));

    return {
      id: `knowledge-${index + 1}`,
      name,
      explanation,
      type: 'knowledge',
    };
  });

  if (knowledgePoints.length === 0) {
    throw new Error('没有解析出可导入的知识点，请检查文本格式');
  }

  return {
    knowledgePoints,
    questions: [],
    warnings: [],
    skippedCount: 0,
    confidence: /^#\s+/m.test(content) ? 'high' : 'medium',
  };
};

const parseQaMode = (content: string): ParseModeResult => {
  const lines = normalizeText(content).split('\n');
  const knowledgePoints: ImportedKnowledgeDraft[] = [];
  const warnings: ParseWarning[] = [];
  let currentQuestion = '';
  let answerLines: string[] = [];
  let collectingAnswer = false;
  let missingAnswerCount = 0;

  const flushCurrent = () => {
    const name = currentQuestion.trim();
    const explanation = answerLines.join('\n').trim();

    if (name) {
      if (!explanation) {
        missingAnswerCount += 1;
      }
      knowledgePoints.push({
        id: `qa-${knowledgePoints.length + 1}`,
        name,
        explanation: ensureExplanation(explanation),
        type: 'qa',
      });
    }

    currentQuestion = '';
    answerLines = [];
    collectingAnswer = false;
  };

  lines.forEach(rawLine => {
    const line = rawLine.trim();

    if (!line) {
      if (collectingAnswer && answerLines.length > 0) {
        answerLines.push('');
      }
      return;
    }

    const questionMatch = line.match(/^Q[:：]\s*(.+)$/i);
    const answerMatch = line.match(/^A[:：]\s*(.*)$/i);

    if (questionMatch) {
      if (currentQuestion) {
        flushCurrent();
      }
      currentQuestion = questionMatch[1].trim();
      return;
    }

    if (answerMatch) {
      collectingAnswer = true;
      if (answerMatch[1].trim()) {
        answerLines.push(answerMatch[1].trim());
      }
      return;
    }

    if (collectingAnswer) {
      answerLines.push(line);
      return;
    }

    if (currentQuestion) {
      currentQuestion = `${currentQuestion} ${line}`.trim();
    }
  });

  if (currentQuestion) {
    flushCurrent();
  }

  if (knowledgePoints.length === 0) {
    throw new Error('没有识别到 Q/A 结构，请检查是否使用 Q: / A: 格式');
  }

  if (missingAnswerCount > 0) {
    warnings.push(createParseWarning(
      `检测到 ${missingAnswerCount} 个 Q: 缺少对应的 A:。`,
      '请确保每个 Q: 后面都有 A:；如果答案有多行，也请从 A: 那一行开始继续补全。',
    ));
  }

  return {
    knowledgePoints,
    questions: [],
    warnings,
    skippedCount: 0,
    confidence: missingAnswerCount > 0 ? 'medium' : 'high',
  };
};

const parseParagraphMode = (content: string): ParseModeResult => {
  const blocks = splitBlocks(content);
  const knowledgePoints = blocks.map((block, index) => {
    const compact = block.replace(/\s+/g, ' ').trim();
    return {
      id: `paragraph-${index + 1}`,
      name: inferParagraphTitle(compact, index),
      explanation: ensureExplanation(compact),
      type: 'paragraph',
    };
  });

  if (knowledgePoints.length === 0) {
    throw new Error('没有解析出可导入内容，请检查文本是否为空');
  }

  return {
    knowledgePoints,
    questions: [],
    warnings: [],
    skippedCount: 0,
    confidence: 'medium',
  };
};

const parseTextContent = (content: string, parseMode: TextParseMode): ParsedImportData => {
  const normalized = normalizeText(content);
  if (!normalized) {
    throw new Error('文本内容为空，请先输入或选择文件');
  }

  const autoDetectedMode = detectTextParseMode(normalized);
  const recognizedMode = parseMode === 'auto' ? autoDetectedMode : parseMode;

  const parsed =
    recognizedMode === 'qa'
      ? parseQaMode(normalized)
      : recognizedMode === 'knowledge'
        ? parseKnowledgeMode(normalized)
        : parseParagraphMode(normalized);

  const warnings = [...parsed.warnings];
  let confidence = parsed.confidence;
  const hasQaSignal = /^Q[:：]/im.test(normalized);
  const hasKnowledgeSignal = /^【知识点】/m.test(normalized) || /^#\s+/m.test(normalized);
  const hasQuestionSignal = /^【题目】/m.test(normalized);

  if (parseMode === 'auto' && recognizedMode === 'paragraph') {
    if (hasQaSignal || hasKnowledgeSignal || hasQuestionSignal) {
      warnings.unshift(createParseWarning(
        '文本结构不完整，已回退为 paragraph 模式。',
        '如果你本来想按模板导入，请补齐 Q/A、【知识点】/【题目】/【解析】或 # 标题结构；也可以直接切换到对应解析方式查看效果。',
      ));
      confidence = 'medium';
    } else {
      warnings.unshift(createParseWarning(
        '未识别到有效结构，建议优先使用模板。',
        '你可以直接展开上方模板说明，复制 Q/A、知识点模板或知识点+题目模板后再导入。',
      ));
      confidence = 'low';
    }
  }

  return {
    knowledgePoints: parsed.knowledgePoints,
    questions: parsed.questions,
    sourceType: 'text',
    recognizedMode,
    warnings,
    skippedCount: parsed.skippedCount,
    confidence,
  };
};

const parseSubmittedSource = (
  source: SubmittedSource,
  parseMode: TextParseMode,
): ParsedImportData => {
  if (source.sourceHint === 'json') {
    return parseJsonContent(source.content);
  }

  if (source.sourceHint === 'text') {
    return parseTextContent(source.content, parseMode);
  }

  const trimmed = source.content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return parseJsonContent(source.content);
    } catch {
      return parseTextContent(source.content, parseMode);
    }
  }

  return parseTextContent(source.content, parseMode);
};

export default function ImportKnowledgePage() {
  const { navigate } = useUser();
  const { learningState, learningDispatch, recordHistory } = useLearning();
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<PasteMode>('file');
  const [textInput, setTextInput] = useState('');
  const [parseMode, setParseMode] = useState<TextParseMode>('auto');
  const [submittedSource, setSubmittedSource] = useState<SubmittedSource | null>(null);
  const [previewData, setPreviewData] = useState<ParsedImportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const availableSubjects = useMemo(
    () => (learningState.subjects.length > 0 ? learningState.subjects : [DEFAULT_SUBJECT]),
    [learningState.subjects],
  );

  useEffect(() => {
    if (!selectedSubjectId || !availableSubjects.some(subject => subject.id === selectedSubjectId)) {
      setSelectedSubjectId(availableSubjects[0]?.id ?? DEFAULT_SUBJECT.id);
    }
  }, [availableSubjects, selectedSubjectId]);

  useEffect(() => {
    if (!submittedSource) {
      return;
    }

    try {
      const parsed = parseSubmittedSource(submittedSource, parseMode);
      if (parsed.knowledgePoints.length === 0) {
        throw new Error('没有解析出可导入的知识点');
      }

      setPreviewData({
        ...parsed,
        fileName: submittedSource.fileName,
      });
      setError(null);
    } catch (parseError) {
      setPreviewData(null);
      setError(parseError instanceof Error ? parseError.message : '解析失败');
    }
  }, [parseMode, submittedSource]);

  useEffect(() => {
    if (!copiedTemplateId) {
      return;
    }

    const timer = window.setTimeout(() => setCopiedTemplateId(null), 1500);
    return () => window.clearTimeout(timer);
  }, [copiedTemplateId]);

  const resetPreview = useCallback(() => {
    setSubmittedSource(null);
    setPreviewData(null);
    setError(null);
  }, []);

  const handleCopyTemplate = useCallback((template: TemplateDefinition) => {
    navigator.clipboard.writeText(template.example).then(() => {
      setCopiedTemplateId(template.id);
    }).catch(() => {
      setCopiedTemplateId(null);
    });
  }, []);

  const submitTextInput = useCallback(() => {
    if (!textInput.trim()) {
      setError('请先粘贴 JSON、模板文本或普通段落内容');
      setPreviewData(null);
      return;
    }

    setSubmittedSource({
      content: textInput,
      sourceHint: 'auto',
    });
  }, [textInput]);

  const handleFileUpload = useCallback((file: File) => {
    const lowerFileName = file.name.toLowerCase();
    const isJson = lowerFileName.endsWith('.json');
    const isTxt = lowerFileName.endsWith('.txt');

    if (!isJson && !isTxt) {
      setError('请上传 JSON 或 TXT 文件');
      setPreviewData(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const content = String(event.target?.result ?? '');
      setSubmittedSource({
        content,
        fileName: file.name,
        sourceHint: isJson ? 'json' : 'text',
      });
    };
    reader.onerror = () => {
      setPreviewData(null);
      setError('文件读取失败');
    };
    reader.readAsText(file, 'utf-8');
  }, []);

  const handleConfirmImport = useCallback(() => {
    if (!previewData || previewData.knowledgePoints.length === 0 || isImporting) {
      return;
    }

    setIsImporting(true);

    try {
      const now = new Date().toISOString();
      const existingSubject = learningState.subjects.find(subject => subject.id === selectedSubjectId);
      const targetSubject = existingSubject ?? {
        ...DEFAULT_SUBJECT,
        id: selectedSubjectId || DEFAULT_SUBJECT.id,
      };

      const subjectPayload = existingSubject ? [] : [targetSubject];
      const subjectChapters = learningState.chapters.filter(chapter => chapter.subjectId === targetSubject.id);
      const targetChapter: Chapter = subjectChapters[0] ?? {
        id: `${targetSubject.id}-default-chapter`,
        subjectId: targetSubject.id,
        name: '默认章节',
        order: 1,
      };
      const chapterPayload = subjectChapters.length > 0 ? [] : [targetChapter];

      const knowledgePointIdMap = new Map<string, string>();
      const knowledgePointNameMap = new Map<string, string>();
      const importedKnowledgePoints: KnowledgePointExtended[] = previewData.knowledgePoints.map((item, index) => {
        const generatedId = createId('kp-import', index);
        if (item.id) {
          knowledgePointIdMap.set(item.id, generatedId);
        }
        knowledgePointNameMap.set(normalizeKey(item.name), generatedId);

        return {
          id: generatedId,
          subjectId: targetSubject.id,
          chapterId: targetChapter.id,
          name: item.name.trim(),
          explanation: ensureExplanation(item.explanation || item.raw_text),
          proficiency: item.proficiency ?? 'none',
          source: item.source ?? 'import',
          lastReviewedAt: null,
          nextReviewAt: now,
          reviewCount: 0,
          createdAt: now,
          studyRecords: [],
          quizRecords: [],
          currentScore: 0,
        };
      });
      const importedKnowledgePointIds = importedKnowledgePoints.map(item => item.id);

      const importedQuestions = previewData.questions.reduce<Question[]>((result, item, index) => {
        const mappedKnowledgePointId =
          (item.knowledgePointId ? knowledgePointIdMap.get(item.knowledgePointId) : undefined)
          || (item.knowledgePointName ? knowledgePointNameMap.get(normalizeKey(item.knowledgePointName)) : undefined)
          || (
            importedKnowledgePoints.length === 1
              ? importedKnowledgePoints[0]?.id
              : previewData.questions.length === previewData.knowledgePoints.length
                ? importedKnowledgePoints[index]?.id
                : undefined
          );
        if (!mappedKnowledgePointId) {
          return result;
        }

        if (!item.stem.trim() || item.options.length === 0 || item.correctAnswers.length === 0) {
          return result;
        }

        result.push({
          id: createId('q-import', index),
          knowledgePointId: mappedKnowledgePointId,
          chapterId: targetChapter.id,
          subjectId: targetSubject.id,
          type: item.type ?? 'single_choice',
          stem: item.stem.trim(),
          options: item.options,
          correctAnswers: item.correctAnswers,
          explanation: item.explanation?.trim() || '',
        });

        return result;
      }, []);
      const skippedQuestionCount = previewData.questions.length - importedQuestions.length;

      recordHistory();
      learningDispatch({
        type: 'SET_KNOWLEDGE_DATA',
        payload: {
          subjects: subjectPayload,
          chapters: chapterPayload,
          knowledgePoints: importedKnowledgePoints,
          questions: importedQuestions,
        },
      });
      learningDispatch({
        type: 'SET_IMPORTED_STUDY_SESSION',
        payload: {
          id: `import-session-${Date.now()}`,
          source: 'import',
          knowledgePointIds: importedKnowledgePointIds,
          subjectId: targetSubject.id,
          chapterId: targetChapter.id,
          importedKnowledgeCount: importedKnowledgePoints.length,
          importedQuestionCount: importedQuestions.length,
          skippedQuestionCount,
          createdAt: now,
        },
      });

      navigate('flashcard-learning');
    } finally {
      setIsImporting(false);
    }
  }, [
    isImporting,
    learningDispatch,
    learningState.chapters,
    learningState.knowledgePoints,
    learningState.subjects,
    navigate,
    previewData,
    recordHistory,
    selectedSubjectId,
  ]);

  const previewCards = previewData?.knowledgePoints.slice(0, 5) ?? [];
  const previewCount = previewData?.knowledgePoints.length ?? 0;
  const showParseControls = !!submittedSource && submittedSource.sourceHint !== 'json';
  const questionPreviewMap = useMemo(() => {
    const map = new Map<string, ImportedQuestionDraft[]>();

    if (!previewData) {
      return map;
    }

    previewData.questions.forEach(question => {
      const keys = [
        question.knowledgePointId?.trim(),
        normalizeKey(question.knowledgePointName),
      ].filter(Boolean) as string[];

      keys.forEach(key => {
        const existing = map.get(key) ?? [];
        existing.push(question);
        map.set(key, existing);
      });
    });

    return map;
  }, [previewData]);
  const previewQuestions = previewData?.questions.slice(0, 5) ?? [];
  const isManualParseMode = Boolean(previewData && previewData.sourceType === 'text' && parseMode !== 'auto');
  const errorSuggestions = useMemo(() => {
    if (!error || !submittedSource) {
      return [] as string[];
    }

    const normalized = normalizeText(submittedSource.content);
    const suggestions: string[] = [];

    if (/^Q[:：]/im.test(normalized) && !/^A[:：]/im.test(normalized)) {
      suggestions.push('检测到 Q: 但没有 A:，请为每个问题补上对应答案。');
    }

    if (/^【题目】/m.test(normalized) && !/^【解析】/m.test(normalized)) {
      suggestions.push('检测到【题目】但没有【解析】，建议每道题后面补一个【解析】块。');
    }

    if (/^#\s+/m.test(normalized) === false && /^【知识点】/m.test(normalized) === false && /^Q[:：]/im.test(normalized) === false) {
      suggestions.push('如果只是普通文本，建议直接按段落拆分；如果想更稳定导入，优先使用上方模板。');
    }

    if (suggestions.length === 0) {
      suggestions.push('你可以展开上方模板说明，先复制一种模板结构，再把内容贴进去重新解析。');
    }

    return suggestions;
  }, [error, submittedSource]);

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="导入知识点" onBack={() => navigate('knowledge')} />

      <div className="px-4 pt-4 space-y-4">
        <div className="rounded-2xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>模板说明</p>
              <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                默认优先按模板结构解析，但不强制；普通 TXT 或段落内容也会兜底处理。
              </p>
            </div>
            <button
              onClick={() => setShowTemplates(prev => !prev)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors"
              style={{ backgroundColor: theme.border, color: theme.textPrimary }}
            >
              {showTemplates ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showTemplates ? '收起模板' : '查看模板'}
            </button>
          </div>

          {showTemplates ? (
            <div className="space-y-3">
              {TEMPLATE_LIST.map(template => (
                <div
                  key={template.id}
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: theme.textPrimary }}>{template.title}</p>
                      <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>{template.description}</p>
                    </div>
                    <button
                      onClick={() => handleCopyTemplate(template)}
                      className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
                      style={{ backgroundColor: theme.border, color: theme.textPrimary }}
                    >
                      <Copy size={14} />
                      {copiedTemplateId === template.id ? '已复制' : '一键复制'}
                    </button>
                  </div>

                  <pre
                    className="mt-3 rounded-xl p-3 text-xs whitespace-pre-wrap break-words overflow-x-auto"
                    style={{ backgroundColor: theme.bgCard, color: theme.textSecondary }}
                  >
                    {template.example}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="rounded-xl px-3 py-3 text-xs"
              style={{ backgroundColor: theme.bg, color: theme.textMuted }}
            >
              已收起模板示例，点击右上角“查看模板”后可展开三种导入模板与一键复制。
            </div>
          )}
        </div>

        <div className="flex gap-2 rounded-xl p-1" style={{ backgroundColor: theme.border }}>
          <button
            onClick={() => {
              setMode('file');
              setTextInput('');
              resetPreview();
            }}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            style={{
              backgroundColor: mode === 'file' ? theme.bgCard : 'transparent',
              color: mode === 'file' ? theme.primary : theme.textSecondary,
            }}
          >
            <Upload size={16} />
            上传文件
          </button>
          <button
            onClick={() => {
              setMode('paste');
              resetPreview();
            }}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            style={{
              backgroundColor: mode === 'paste' ? theme.bgCard : 'transparent',
              color: mode === 'paste' ? theme.primary : theme.textSecondary,
            }}
          >
            <FileJson size={16} />
            粘贴内容
          </button>
        </div>

        <div className="rounded-2xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <p className="text-xs font-medium mb-2" style={{ color: theme.textSecondary }}>目标学科</p>
          <div className="flex flex-wrap gap-2">
            {availableSubjects.map(subject => (
              <button
                key={subject.id}
                onClick={() => setSelectedSubjectId(subject.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  backgroundColor: selectedSubjectId === subject.id ? theme.primary : theme.border,
                  color: selectedSubjectId === subject.id ? '#ffffff' : theme.textSecondary,
                }}
              >
                {subject.icon} {subject.name}
              </button>
            ))}
          </div>
          {learningState.subjects.length === 0 && (
            <p className="text-xs mt-2" style={{ color: theme.textMuted }}>
              当前没有可用学科，导入时会自动使用默认学科兜底。
            </p>
          )}
        </div>

        {!previewData && mode === 'file' && (
          <div
            onDrop={event => {
              event.preventDefault();
              setIsDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) {
                handleFileUpload(file);
              }
            }}
            onDragOver={event => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors"
            style={{
              borderColor: isDragging ? theme.primary : theme.border,
              backgroundColor: isDragging ? `${theme.primary}08` : 'transparent',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                }
                event.target.value = '';
              }}
              className="hidden"
            />
            <Upload size={40} className="mx-auto mb-3" style={{ color: theme.textMuted }} />
            <p className="text-sm font-medium mb-1" style={{ color: theme.textPrimary }}>
              {isDragging ? '松开以上传文件' : '拖拽文件到这里，或点击选择'}
            </p>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              支持 JSON 和 TXT；TXT 会优先按模板自动识别，也支持普通文本兜底解析。
            </p>
          </div>
        )}

        {!previewData && mode === 'paste' && (
          <div className="space-y-3">
            <textarea
              value={textInput}
              onChange={event => setTextInput(event.target.value)}
              placeholder={`粘贴 JSON、模板文本或普通段落内容...

支持：
1. JSON 数组 / JSON 对象
2. Q: / A: 模板
3. # 标题 + 内容 模板
4. 【知识点】/【题目】/【解析】模板`}
              rows={12}
              className="w-full rounded-xl px-4 py-3 text-sm font-mono outline-none transition-colors resize-none"
              style={{
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.bgCard,
                color: theme.textPrimary,
              }}
            />
            <button
              onClick={submitTextInput}
              className="w-full font-medium py-2.5 rounded-xl text-sm transition-colors"
              style={{ backgroundColor: theme.primary, color: '#ffffff' }}
            >
              解析并进入预览
            </button>
          </div>
        )}

        {showParseControls && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
            <p className="text-xs font-medium mb-3" style={{ color: theme.textSecondary }}>解析方式切换</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PARSE_MODE_LABELS) as TextParseMode[]).map(item => (
                <button
                  key={item}
                  onClick={() => setParseMode(item)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: parseMode === item ? theme.primary : theme.border,
                    color: parseMode === item ? '#ffffff' : theme.textSecondary,
                  }}
                >
                  {PARSE_MODE_LABELS[item]}
                </button>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: theme.textMuted }}>
              切换后会立即重新解析当前内容并刷新预览。
            </p>
            {parseMode !== 'auto' && (
              <div
                className="mt-3 rounded-xl px-3 py-2 text-xs"
                style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}
              >
                当前为手动模式，不再自动识别；如需恢复自动识别，请切回“自动识别”。
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
          >
            <AlertCircle size={18} style={{ color: '#ef4444' }} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
              {errorSuggestions.length > 0 && (
                <div className="mt-2 space-y-1">
                  {errorSuggestions.map((item, index) => (
                    <p key={`${item}-${index}`} className="text-xs" style={{ color: '#b91c1c' }}>
                      {index + 1}. {item}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {previewData && (
          <div className="space-y-4">
            <div
              className="rounded-2xl p-4"
              style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                <p className="text-sm font-medium" style={{ color: theme.textPrimary }}>解析成功，等待确认导入</p>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}>
                  模式：{RECOGNIZED_MODE_LABELS[previewData.recognizedMode]}
                </span>
                <span
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor:
                      previewData.confidence === 'high'
                        ? '#dcfce7'
                        : previewData.confidence === 'medium'
                          ? '#fef3c7'
                          : '#fee2e2',
                    color:
                      previewData.confidence === 'high'
                        ? '#166534'
                        : previewData.confidence === 'medium'
                          ? '#92400e'
                          : '#b91c1c',
                  }}
                >
                  置信度：{CONFIDENCE_LABELS[previewData.confidence]}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: theme.border, color: theme.textSecondary }}>
                  卡片 {previewCount}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: theme.border, color: theme.textSecondary }}>
                  跳过块 {previewData.skippedCount}
                </span>
              </div>
              <div className="space-y-1 text-xs" style={{ color: theme.textSecondary }}>
                <p>来源：{previewData.fileName || (previewData.sourceType === 'json' ? 'JSON 内容' : '文本内容')}</p>
                <p>当前识别模式：{RECOGNIZED_MODE_LABELS[previewData.recognizedMode]}</p>
                <p>当前解析方式：{previewData.sourceType === 'json' ? 'JSON 结构化导入' : PARSE_MODE_LABELS[parseMode]}</p>
                <p>总条数：{previewCount}</p>
                <p>题目数量：{previewData.questions.length}</p>
                <p>跳过块数量：{previewData.skippedCount}</p>
                <p>识别置信提示：{CONFIDENCE_LABELS[previewData.confidence]}</p>
                <p>预览卡片：展示前 {Math.min(previewCards.length, 5)} 条</p>
                <p>目标学科：{availableSubjects.find(subject => subject.id === selectedSubjectId)?.name || DEFAULT_SUBJECT.name}</p>
              </div>
              {isManualParseMode && (
                <div
                  className="mt-3 rounded-xl px-3 py-2 text-xs"
                  style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}
                >
                  当前为手动模式，不再自动识别；如果想让系统重新判断模板类型，请切回“自动识别”。
                </div>
              )}
              {previewData.warnings.length > 0 && (
                <div className="mt-3 space-y-2">
                  {previewData.warnings.map(warning => (
                    <div
                      key={warning.id}
                      className="rounded-xl px-3 py-3"
                      style={{
                        backgroundColor: warning.level === 'info' ? `${theme.primary}08` : '#fff7ed',
                        border: warning.level === 'info' ? `1px solid ${theme.primary}22` : '1px solid #fed7aa',
                      }}
                    >
                      <p
                        className="text-xs font-medium"
                        style={{ color: warning.level === 'info' ? theme.primary : '#9a3412' }}
                      >
                        {warning.message}
                      </p>
                      <p className="text-xs mt-1 leading-5" style={{ color: theme.textSecondary }}>
                        怎么修：{warning.suggestion}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {previewCards.map((item, index) => {
                const relatedQuestions =
                  questionPreviewMap.get(item.id?.trim() || '')
                  ?? questionPreviewMap.get(normalizeKey(item.name))
                  ?? [];

                return (
                  <div
                    key={`${item.id || item.name}-${index}`}
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: theme.border, color: theme.textSecondary }}>
                          卡片 {index + 1}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}>
                          {RECOGNIZED_MODE_LABELS[previewData.recognizedMode]}
                        </span>
                      </div>
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
                        style={{
                          backgroundColor: relatedQuestions.length > 0 ? '#ecfdf5' : theme.border,
                          color: relatedQuestions.length > 0 ? '#047857' : theme.textMuted,
                        }}
                      >
                        {relatedQuestions.length} 道题
                      </span>
                    </div>
                    <p className="text-sm font-semibold mt-3" style={{ color: theme.textPrimary }}>{item.name}</p>
                    <p className="text-xs mt-2 leading-6 whitespace-pre-wrap" style={{ color: theme.textSecondary }}>
                      {ensureExplanation(item.explanation)}
                    </p>

                    {relatedQuestions.length > 0 && (
                      <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: theme.bg }}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium" style={{ color: theme.textPrimary }}>关联题目</p>
                          <span className="text-[11px]" style={{ color: theme.textMuted }}>
                            {relatedQuestions.length} 道
                          </span>
                        </div>
                        <div className="mt-2 space-y-2">
                          {relatedQuestions.slice(0, 2).map((question, questionIndex) => (
                            <div key={`${question.id || question.stem}-${questionIndex}`} className="text-xs" style={{ color: theme.textSecondary }}>
                              <p className="font-medium" style={{ color: theme.textPrimary }}>
                                题目 {questionIndex + 1}：{question.stem}
                              </p>
                              {question.correctAnswers.length > 0 && (
                                <p className="mt-1" style={{ color: theme.textMuted }}>
                                  答案：{question.correctAnswers.join('、')}
                                </p>
                              )}
                            </div>
                          ))}
                          {relatedQuestions.length > 2 && (
                            <p className="text-[11px]" style={{ color: theme.textMuted }}>
                              还有 {relatedQuestions.length - 2} 道题目将在导入后一起写入
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {previewQuestions.length > 0 && (
              <div
                className="rounded-2xl p-4"
                style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>题目预览</p>
                  <span className="text-xs" style={{ color: theme.textMuted }}>
                    展示前 {Math.min(previewQuestions.length, 5)} 道
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {previewQuestions.map((question, index) => (
                    <div
                      key={`${question.id || question.stem}-${index}`}
                      className="rounded-xl p-3"
                      style={{ backgroundColor: theme.bg }}
                    >
                      <p className="text-xs font-medium" style={{ color: theme.textPrimary }}>
                        {index + 1}. {question.stem}
                      </p>
                      {question.knowledgePointName && (
                        <p className="text-[11px] mt-1" style={{ color: theme.textMuted }}>
                          关联知识点：{question.knowledgePointName}
                        </p>
                      )}
                      {question.options.length > 0 && (
                        <p className="text-[11px] mt-1" style={{ color: theme.textSecondary }}>
                          选项：{question.options.map(option => `${option.id}. ${option.text}`).join(' / ')}
                        </p>
                      )}
                      {question.correctAnswers.length > 0 && (
                        <p className="text-[11px] mt-1" style={{ color: theme.textMuted }}>
                          答案：{question.correctAnswers.join('、')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={resetPreview}
                className="font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: theme.border, color: theme.textPrimary }}
              >
                <RefreshCw size={16} />
                重新选择文件
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="font-medium py-3 rounded-xl text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: theme.primary, color: '#ffffff' }}
              >
                {isImporting ? '导入中...' : '确认导入'}
              </button>
            </div>
          </div>
        )}

        {!previewData && (
          <div
            className="rounded-2xl p-4 text-xs space-y-2"
            style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.textMuted }}
          >
            <p className="font-medium" style={{ color: theme.textSecondary }}>导入说明</p>
            <p>保留现有 JSON 导入能力，仍然支持数组和包含 `knowledgePoints` 的对象结构。</p>
            <p>TXT 与粘贴文本会优先按模板自动识别，无法命中模板时再兜底为段落模式。</p>
            <p>文件中不要求提供 `subjectId`，页面会把本次导入统一归到你选择的目标学科。</p>
          </div>
        )}
      </div>
    </div>
  );
}
