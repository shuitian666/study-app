/**
 * ============================================================================
 * AI 服务层 - Service Layer (接口抽象)
 * ============================================================================
 * 
 * 【架构说明】
 * 这是 AI 功能的唯一入口。所有 UI 组件只通过此文件调用 AI 能力。
 * 
 * 【当前状态】v3 - 豆包API直连 + Mock降级
 * - 豆包API可用时：直接调用豆包API
 * - 后端可用时：调用 Express 后端 → Ollama/火山引擎/Minimax
 * - 后端不可用时：自动 fallback 到本地 Mock 模板
 * 
 * 【接口签名】
 * - askQuestion(query, knowledgePoints) → { answer, relatedKpIds }
 * - generateQuiz(kpIds, kps, existingQs) → Question | null
 * - getSmartEncouragement(stats, wrongCount, streak) → string
 * - askQuestionStreaming(query, kps, history) → { stream, relatedKpIds }
 * 
 * ============================================================================
 */

import type { KnowledgePoint, Question, LearningStats, ChatMessage, GenerateSmartQuizResult } from '@/types';
import { AI_ANSWER_TEMPLATES, AI_GENERIC_ANSWER, AI_QUIZ_POOL, ENCOURAGEMENT_RULES } from '@/data/ai-mock';
import {
  checkBackendAvailable, getAIConfig,
  streamChat, fetchQuiz, fetchEncouragement,
  fetchDoubanExplanation, fetchStudyReport, fetchDailySuggestion, fetchKnowledgeExplain,
  API_BASE,
} from '@/services/aiClient';

// ===== 豆包API配置 =====
const DOUBAN_API_URL = 'https://ark.cn-beijing.volces.com/api/v3';

// ===== Helper: simulate network delay (mock 模式) =====
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): Promise<void> {
  return delay(min + Math.random() * (max - min));
}

// ===== 辅助：从 query 中匹配相关知识点 =====
function findRelatedKpIds(query: string, knowledgePoints: KnowledgePoint[]): string[] {
  const queryLower = query.toLowerCase();

  for (const tpl of AI_ANSWER_TEMPLATES) {
    if (tpl.keywords.some(kw => queryLower.includes(kw.toLowerCase()))) {
      const relatedKps = knowledgePoints.filter(kp =>
        tpl.keywords.some(kw =>
          kp.name.toLowerCase().includes(kw.toLowerCase()) ||
          kp.explanation.toLowerCase().includes(kw.toLowerCase())
        )
      );
      if (relatedKps.length > 0) return relatedKps.map(kp => kp.id);
    }
  }

  const matched = knowledgePoints.filter(kp =>
    queryLower.includes(kp.name.toLowerCase()) || kp.name.toLowerCase().includes(queryLower)
  );
  return matched.map(kp => kp.id);
}

// ===== Mock 实现 (作为降级方案) =====

function mockAskQuestion(query: string, knowledgePoints: KnowledgePoint[], _history: ChatMessage[] = []): { answer: string; relatedKpIds: string[] } {
  const queryLower = query.toLowerCase();

  for (const tpl of AI_ANSWER_TEMPLATES) {
    if (tpl.keywords.some(kw => queryLower.includes(kw.toLowerCase()))) {
      const relatedKps = knowledgePoints.filter(kp =>
        tpl.keywords.some(kw =>
          kp.name.toLowerCase().includes(kw.toLowerCase()) ||
          kp.explanation.toLowerCase().includes(kw.toLowerCase())
        )
      );
      return { answer: tpl.template, relatedKpIds: relatedKps.map(kp => kp.id) };
    }
  }

  const matchedKp = knowledgePoints.find(kp =>
    queryLower.includes(kp.name.toLowerCase()) || kp.name.toLowerCase().includes(queryLower)
  );

  if (matchedKp) {
    return {
      answer: `关于「${matchedKp.name}」，以下是核心知识：\n\n${matchedKp.explanation}\n\n建议你通过做题来巩固理解，我来给你出一道题吧！`,
      relatedKpIds: [matchedKp.id],
    };
  }

  return { answer: AI_GENERIC_ANSWER, relatedKpIds: [] };
}

function mockGenerateQuiz(
  knowledgePointIds: string[],
  knowledgePoints: KnowledgePoint[],
  existingQuestions: Question[]
): Question | null {
  const usedIds = new Set(existingQuestions.map(q => q.id));

  const poolMatch = AI_QUIZ_POOL.find(
    q => knowledgePointIds.includes(q.knowledgePointId) && !usedIds.has(q.id)
  );
  if (poolMatch) return { ...poolMatch, id: `ai-q-${Date.now()}` };

  const relatedSubjectIds = new Set(
    knowledgePoints.filter(kp => knowledgePointIds.includes(kp.id)).map(kp => kp.subjectId)
  );
  const subjectMatch = AI_QUIZ_POOL.find(
    q => relatedSubjectIds.has(q.subjectId) && !usedIds.has(q.id)
  );
  if (subjectMatch) return { ...subjectMatch, id: `ai-q-${Date.now()}` };

  const kp = knowledgePoints.find(k => knowledgePointIds.includes(k.id));
  if (kp) {
    return {
      id: `ai-q-${Date.now()}`,
      knowledgePointId: kp.id,
      subjectId: kp.subjectId,
      type: 'single_choice',
      stem: `以下关于「${kp.name}」的描述是否正确：${kp.explanation.slice(0, 50)}...`,
      options: [
        { id: 'A', text: '正确' },
        { id: 'B', text: '错误' },
        { id: 'C', text: '不确定' },
        { id: 'D', text: '以上都不对' },
      ],
      correctAnswers: ['A'],
      explanation: `这个描述是正确的。${kp.name}：${kp.explanation}`,
    };
  }

  return null;
}

function mockGetSmartEncouragement(stats: LearningStats, wrongCount: number, checkinStreak: number): string {
  const pickTemplate = (templates: string[]) =>
    templates[Math.floor(Math.random() * templates.length)];

  const milestones = [7, 14, 30, 60, 100, 200, 365];
  if (milestones.includes(checkinStreak)) {
    const rule = ENCOURAGEMENT_RULES.find(r => r.condition === 'milestone_days')!;
    return pickTemplate(rule.templates).replace('{days}', String(checkinStreak));
  }
  if (stats.weakSubjects.length > 0) {
    const rule = ENCOURAGEMENT_RULES.find(r => r.condition === 'weak_subjects')!;
    const subject = stats.weakSubjects[Math.floor(Math.random() * stats.weakSubjects.length)];
    return pickTemplate(rule.templates).replace('{subject}', subject);
  }
  if (stats.totalKnowledgePoints > 0 && stats.masteredCount / stats.totalKnowledgePoints > 0.6) {
    const rule = ENCOURAGEMENT_RULES.find(r => r.condition === 'high_mastery')!;
    return pickTemplate(rule.templates).replace('{count}', String(stats.masteredCount));
  }
  if (wrongCount > 5) {
    const rule = ENCOURAGEMENT_RULES.find(r => r.condition === 'many_wrong')!;
    return pickTemplate(rule.templates).replace('{count}', String(wrongCount));
  }
  if (stats.noneCount > 3) {
    const rule = ENCOURAGEMENT_RULES.find(r => r.condition === 'many_new')!;
    return pickTemplate(rule.templates).replace('{count}', String(stats.noneCount));
  }
  const rule = ENCOURAGEMENT_RULES.find(r => r.condition === 'random')!;
  return pickTemplate(rule.templates);
}

// ===== 豆包API流式聊天 =====
async function* streamChatDouban(
  apiKey: string,
  messages: { role: string; content: string }[],
  modelId: string
): AsyncGenerator<string> {
  const controller = new AbortController();
  // 缩短超时到 60 秒，避免无限等待
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    // 如果配置了代理，需要确保浏览器能访问
    const res = await fetch(`${DOUBAN_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`, // 清除可能的空格
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let errMsg = `豆包API调用失败: HTTP ${res.status}`;
      if (res.status === 401) errMsg += ' - API Key 无效或过期';
      if (res.status === 403) errMsg += ' - 没有权限访问该模型';
      if (res.status === 429) errMsg += ' - 请求太频繁，速率限制';
      throw new Error(errMsg);
    }

    if (!res.body) {
      throw new Error('豆包API返回为空');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        if (trimmed === 'data: [DONE]') return;

        try {
          const payload = JSON.parse(trimmed.slice(6));
          const content = payload.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch { /* ignore parse errors on partial chunks */ }
      }
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('连接超时，豆包API响应太慢，请检查网络连接');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ===== 清除选项文本开头的标签前缀 =====
const cleanOptionPrefix = (text: string): string => {
  return text.replace(/^[A-G]\.\s*/, '').trim();
};

// ===== 豆包API生成题目 =====
async function fetchDoubanQuiz(
  apiKey: string,
  knowledgePointNames: string[],
  subjectName: string,
  modelId: string
): Promise<Question | null> {
  const messages = [
    {
      role: 'user',
      content: `请为${subjectName}学科生成一道练习题，基于以下知识点：${knowledgePointNames.join('、')}。
请按以下JSON格式返回（只需要JSON，不要其他内容）：
{
  "type": "single_choice",
  "stem": "题目描述",
  "options": [
    {"id": "A", "text": "选项A内容"},
    {"id": "B", "text": "选项B内容"},
    {"id": "C", "text": "选项C内容"},
    {"id": "D", "text": "选项D内容"}
  ],
  "correctAnswers": ["A"],
  "explanation": "解析说明"
}`,
    },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(`${DOUBAN_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // 清除选项前缀
        if (parsed.options) {
          parsed.options = parsed.options.map((opt: any) => ({
            ...opt,
            text: cleanOptionPrefix(opt.text || opt.label || ''),
          }));
        }
        return parsed;
      }
    }
  } catch { /* timeout or error */ }

  return null;
}

// ===== 1. Ask Question (非流式) =====

export interface AskQuestionResult {
  answer: string;
  relatedKpIds: string[];
}

export async function askQuestion(
  query: string,
  knowledgePoints: KnowledgePoint[],
  history: ChatMessage[] = []
): Promise<AskQuestionResult> {
  const config = getAIConfig();

  // 如果使用豆包API且有密钥，直接调用 - 只保留最近N轮消息，控制token消耗
  if (config.provider === 'douban' && config.apiKey && config.modelId) {
    try {
      const recentHistory = history.slice(-MAX_CONTEXT_MESSAGES).map(m => ({
        role: m.role === 'ai' ? 'assistant' : m.role,
        content: m.content,
      }));
      recentHistory.push({ role: 'user', content: query });
      let answer = '';

      for await (const chunk of streamChatDouban(config.apiKey, recentHistory, config.modelId)) {
        answer += chunk;
      }

      const relatedKpIds = findRelatedKpIds(query, knowledgePoints);
      return { answer, relatedKpIds };
    } catch {
      // fallback to mock
    }
  }

  // OpenClaw: always use backend (local gateway)
  // 不需要豆包直连，走后端转发到本地 OpenClaw
  // 如果是 openclaw 模式，强制使用后端，不检测直接尝试
  // 检测只是对于其他本地 provider (ollama)
  const shouldUseBackend = 
    config.provider === 'openclaw' || 
    (config.provider !== 'douban' && await checkBackendAvailable());

  if (shouldUseBackend) {
    try {
      const kpNames = knowledgePoints.slice(0, 20).map(kp => kp.name);
      const recentHistory = history.slice(-MAX_CONTEXT_MESSAGES).map(m => ({
        role: m.role === 'ai' ? 'assistant' : m.role,
        content: m.content,
      }));
      recentHistory.push({ role: 'user', content: query });

      let answer = '';
      const generator = streamChat({
        provider: config.provider,
        messages: recentHistory,
        knowledgeContext: kpNames,
      });
      for await (const chunk of generator) {
        answer += chunk;
      }

      const relatedKpIds = findRelatedKpIds(query, knowledgePoints);
      return { answer, relatedKpIds };
    } catch (err) {
      console.error('[aiService] OpenClaw request failed', err);
      // OpenClaw 不 fallback，直接抛出错误让用户知道连接失败
      if (config.provider === 'openclaw') {
        throw err;
      }
      // others fallback to mock
    }
  }

  await randomDelay(800, 1500);
  return mockAskQuestion(query, knowledgePoints, history);
}

// ===== 1b. Ask Question (流式) =====

export interface StreamingAskResult {
  stream: AsyncGenerator<string>;
  relatedKpIds: string[];
}

// 最大上下文轮数，避免token过多消耗
const MAX_CONTEXT_MESSAGES = 6;

export async function askQuestionStreaming(
  query: string,
  knowledgePoints: KnowledgePoint[],
  history: ChatMessage[] = [],
): Promise<StreamingAskResult> {
  const config = getAIConfig();

  // 豆包API - 只保留最近N轮消息，控制token消耗
  if (config.provider === 'douban' && config.apiKey && config.modelId) {
    const recentHistory = history.slice(-MAX_CONTEXT_MESSAGES).map(m => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.content,
    }));
    recentHistory.push({ role: 'user', content: query });

    const stream = streamChatDouban(config.apiKey, recentHistory, config.modelId);
    const relatedKpIds = findRelatedKpIds(query, knowledgePoints);
    return { stream, relatedKpIds };
  }

  // OpenClaw: always use backend, don't fallback to mock
  const shouldUseBackend = 
    config.provider === 'openclaw' || 
    (config.provider !== 'douban' && await checkBackendAvailable());

  if (shouldUseBackend) {
    const kpNames = knowledgePoints.slice(0, 20).map(kp => kp.name);

    const recentHistory = history.slice(-MAX_CONTEXT_MESSAGES).map(m => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.content,
    }));
    recentHistory.push({ role: 'user', content: query });

    const stream = streamChat({
      provider: config.provider,
      messages: recentHistory,
      knowledgeContext: kpNames,
    });

    const relatedKpIds = findRelatedKpIds(query, knowledgePoints);
    return { stream, relatedKpIds };
  }

  // Mock fallback - only for non-openclaw when backend down
  await randomDelay(500, 800);
  const mockResult = mockAskQuestion(query, knowledgePoints);

  const mockStream = (async function* () {
    const words = mockResult.answer.split('');
    for (let i = 0; i < words.length; i += 2) {
      yield words.slice(i, i + 2).join('');
      await delay(15);
    }
  })();

  return { stream: mockStream, relatedKpIds: mockResult.relatedKpIds };
}

// ===== 2. Generate Quiz =====

export async function generateQuiz(
  knowledgePointIds: string[],
  knowledgePoints: KnowledgePoint[],
  existingQuestions: Question[],
  mode: 'random' | 'smart' = 'random'
): Promise<GenerateSmartQuizResult> {
  const config = getAIConfig();

  // 智能模式或 openclaw 模式直接走后端，因为需要AI选题
  // OpenClaw 强制使用后端，不 fallback 到 mock
  const shouldUseBackend = config.provider === 'openclaw' || mode === 'smart';
  let available = shouldUseBackend ? true : await checkBackendAvailable();

  if (shouldUseBackend || available) {
    try {
      const kps = knowledgePoints.filter(kp => knowledgePointIds.includes(kp.id))
        .map(kp => ({
          id: kp.id,
          name: kp.name,
          subjectId: kp.subjectId,
          masteryLevel: kp.proficiency as unknown as number,
          wrongCount: 0,
          lastReviewedAt: kp.lastReviewedAt || '',
        }));
      const subjectName = kps[0]
        ? knowledgePoints.find(k => k.subjectId === kps[0].subjectId)?.name || ''
        : '';

      const result = await fetchQuiz({
        provider: config.provider,
        knowledgePoints: kps,
        knowledgePointNames: kps.map(k => k.name),
        subjectName,
        mode: 'smart',
      });

      if (result.question) {
        // 找到知识点 id
        const selectedKp = knowledgePoints.find(k => k.name === result.selectedKnowledgePoint);
        return {
          question: {
            ...result.question,
            id: `ai-q-${Date.now()}`,
            knowledgePointId: selectedKp?.id || kps[0]?.id || '',
            subjectId: selectedKp?.subjectId || kps[0]?.subjectId || '',
          },
          selectedKnowledgePoint: result.selectedKnowledgePoint,
          mode: 'smart',
        };
      }
    } catch {
      // fallback to random mode
    }
  }

  // 随机模式 / fallback
  // 豆包API
  if (config.provider === 'douban' && config.apiKey && config.modelId) {
    try {
      const kps = knowledgePoints.filter(kp => knowledgePointIds.includes(kp.id));
      const kpNames = kps.map(kp => kp.name);
      const subjectName = kps[0]
        ? knowledgePoints.find(k => k.subjectId === kps[0].subjectId)?.name || ''
        : '';

      const question = await fetchDoubanQuiz(config.apiKey, kpNames, subjectName, config.modelId);

      if (question) {
        return {
          question: {
            ...question,
            id: `ai-q-${Date.now()}`,
            knowledgePointId: kps[0]?.id || '',
            subjectId: kps[0]?.subjectId || '',
          },
          mode: 'random',
        };
      }
    } catch {
      // fallback to mock
    }
  }

  // random mode fallback - check backend again
  if (!shouldUseBackend && !available) {
    available = await checkBackendAvailable();
  }

  if (available) {
    try {
      const kps = knowledgePoints.filter(kp => knowledgePointIds.includes(kp.id));
      const kpNames = kps.map(kp => kp.name);
      const subjectName = kps[0]
        ? knowledgePoints.find(k => k.subjectId === kps[0].subjectId)?.name || ''
        : '';

      const result = await fetchQuiz({
        provider: config.provider,
        knowledgePointNames: kpNames,
        subjectName,
        mode: 'random',
      });

      if (result.question) {
        return {
          question: {
            ...result.question,
            id: `ai-q-${Date.now()}`,
            knowledgePointId: kps[0]?.id || '',
            subjectId: kps[0]?.subjectId || '',
          },
          mode: 'random',
        };
      }
    } catch {
      // fallback to mock
    }
  }

  await randomDelay(500, 1000);
  return {
    question: mockGenerateQuiz(knowledgePointIds, knowledgePoints, existingQuestions),
    mode: 'random',
  };
}

// ===== 3. Smart Encouragement =====

export async function getSmartEncouragement(
  stats: LearningStats,
  wrongCount: number,
  checkinStreak: number
): Promise<string> {
  const config = getAIConfig();

  // 豆包API
  if (config.provider === 'douban' && config.apiKey && config.modelId) {
    try {
      const messages = [
        {
          role: 'user',
          content: `根据用户的学习情况，生成一句鼓励语：\n- 连续签到天数：${checkinStreak}\n- 错题数量：${wrongCount}\n- 薄弱科目：${(stats as any)?.weakSubjects?.join('、') || '无'}\n\n只需要返回鼓励语，不要其他内容，20字以内。`,
        },
      ];

      let result = '';
      for await (const chunk of streamChatDouban(config.apiKey, messages, config.modelId)) {
        result += chunk;
      }
      return result || '今天也要加油哦！';
    } catch {
      // fallback to mock
    }
  }

  // OpenClaw: always use backend
  const shouldUseBackend = 
    config.provider === 'openclaw' || 
    (config.provider !== 'douban' && await checkBackendAvailable());

  if (shouldUseBackend) {
    try {
      return await fetchEncouragement({
        provider: config.provider,
        stats: stats as unknown as Record<string, unknown>,
        wrongCount,
        streak: checkinStreak,
      });
    } catch {
      // fallback only if not openclaw
      if (config.provider !== 'openclaw') {
        // fallback to mock
      }
    }
  }

  await delay(200);
  return mockGetSmartEncouragement(stats, wrongCount, checkinStreak);
}

// ===== 4. AI 题目解析 =====

export interface ExplainParams {
  question: {
    stem?: string;
    options?: Array<{ id: string; text: string }>;
  };
  selectedAnswer: string[];
  correctAnswer: string[];
  knowledgePoint?: string;
  subjectName?: string;
}

export async function generateQuestionExplanation(params: ExplainParams): Promise<string> {
  const config = getAIConfig();
  const isCorrect = params.selectedAnswer.length === params.correctAnswer.length &&
    params.selectedAnswer.every(a => params.correctAnswer.includes(a));

  // OpenClaw: always use backend
  const shouldUseBackend = 
    config.provider === 'openclaw' || 
    (config.provider !== 'douban' && await checkBackendAvailable());

  if (shouldUseBackend) {
    try {
      // 调用后端增强解析（支持关联知识库）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${API_BASE}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          question: params.question,
          selectedAnswer: params.selectedAnswer,
          correctAnswer: params.correctAnswer,
          knowledgePoint: params.knowledgePoint,
          subjectName: params.subjectName,
          apiKey: config.apiKey,
          modelId: config.modelId,
          groupId: config.groupId,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.explanation) {
        return data.explanation;
      }
    } catch {
      // fallback only if not openclaw
      if (config.provider !== 'openclaw') {
        // fallback
      }
    }
  }

  // 豆包API
  if (config.provider === 'douban' && config.apiKey && config.modelId) {
    try {
      return await fetchDoubanExplanation(
        config.apiKey,
        params.question,
        params.selectedAnswer,
        params.correctAnswer,
        config.modelId
      );
    } catch {
      // fallback to mock
    }
  }

  // Mock fallback - only for non-openclaw
  await delay(500);
  if (isCorrect) {
    return '回答正确！这道题考查的知识点你已经掌握了，继续保持！';
  }
  return '这道题的正确答案是 ' + params.correctAnswer.join('、') + '。建议回顾相关知识点，加强理解后再做一遍。';
}

// ===== 5. 获取学习报告 =====

export interface StudyStats {
  knowledgeStats: Array<{
    name: string;
    masteryLevel: number;
    wrongCount: number;
  }>;
  totalKnowledgePoints: number;
  masteredCount: number;
  subjectName: string;
}

export async function getStudyReport(stats: StudyStats) {
  const config = getAIConfig();
  // OpenClaw 强制使用后端
  const shouldUseBackend = config.provider === 'openclaw' || (await checkBackendAvailable());
  if (!shouldUseBackend) return null;

  try {
    return await fetchStudyReport({
      ...stats,
      provider: config.provider,
    });
  } catch {
    return null;
  }
}

// ===== 6. 获取每日学习建议 =====

export async function getDailySuggestion(stats: StudyStats) {
  const config = getAIConfig();
  // OpenClaw 强制使用后端
  const shouldUseBackend = config.provider === 'openclaw' || (await checkBackendAvailable());
  if (!shouldUseBackend) return null;

  try {
    return await fetchDailySuggestion({
      ...stats,
      provider: config.provider,
    });
  } catch {
    return null;
  }
}

// ===== 7. 获取知识点关联讲解 =====

export async function getKnowledgeExplain(params: {
  knowledgePoint: string;
  subjectName: string;
  relatedTo?: string[];
}) {
  const config = getAIConfig();
  // OpenClaw 强制使用后端
  const shouldUseBackend = config.provider === 'openclaw' || (await checkBackendAvailable());
  if (!shouldUseBackend) return '';
  try {
    return await fetchKnowledgeExplain(params);
  } catch {
    return '';
  }
}
