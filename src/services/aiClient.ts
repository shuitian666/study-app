/**
 * AI 后端通信层 — HTTP 客户端 + SSE 流式读取 + 配置管理
 * 支持：Ollama、火山引擎、MiniMax、豆包API
 */
import type { AIConfig, AIProvider, ProviderInfo, Question } from '@/types';

const API_BASE = 'http://localhost:3001/api';
const CONFIG_KEY = 'ai-config';
const DOUBAN_API_URL = 'https://ark.cn-beijing.volces.com/api/v3';

// ===== 配置管理 (localStorage) =====

export function getAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { provider: 'ollama' };
}

export function setAIConfig(config: AIConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// ===== 后端健康检测 =====

let cachedAvailable: boolean | null = null;
let cacheTime = 0;
const CACHE_DURATION = 10000;

export async function checkBackendAvailable(): Promise<boolean> {
  if (cachedAvailable !== null && Date.now() - cacheTime < CACHE_DURATION) {
    return cachedAvailable;
  }
  
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE}/models`, { signal: controller.signal });
    clearTimeout(timer);
    cachedAvailable = res.ok;
  } catch {
    cachedAvailable = false;
  }
  cacheTime = Date.now();
  return cachedAvailable;
}

export function resetBackendCache(): void {
  cachedAvailable = null;
  cacheTime = 0;
}

// ===== API 调用 =====

export async function fetchModels(): Promise<ProviderInfo[]> {
  const res = await fetch(`${API_BASE}/models`);
  const data = await res.json();
  return data.providers || [];
}

function getUserAIConfig() {
  return getAIConfig();
}

// ===== SSE 流式聊天 =====

export async function* streamChat(params: {
  provider: AIProvider;
  messages: { role: string; content: string }[];
  knowledgeContext?: string[];
}): AsyncGenerator<string> {
  const config = getUserAIConfig();
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  const requestBody = {
    ...params,
    apiKey: config.apiKey,
    modelId: config.modelId,
    groupId: config.groupId,
  };

  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.status}`);
  }

  const reader = res.body!.getReader();
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
      try {
        const payload = JSON.parse(trimmed.slice(6));
        if (payload.done) return;
        if (payload.error) throw new Error(payload.error);
        if (payload.content) yield payload.content;
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
          throw e;
        }
      }
    }
  }
}

// ===== 生成题目 =====

export async function fetchQuiz(params: {
  provider: AIProvider;
  knowledgePointNames: string[];
  subjectName: string;
}): Promise<Question | null> {
  const config = getUserAIConfig();
  
  const res = await fetch(`${API_BASE}/quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      apiKey: config.apiKey,
      modelId: config.modelId,
      groupId: config.groupId,
    }),
  });
  const data = await res.json();
  return data.question || null;
}

// ===== 生成鼓励语 =====

export async function fetchEncouragement(params: {
  provider: AIProvider;
  stats: Record<string, unknown>;
  wrongCount: number;
  streak: number;
}): Promise<string> {
  const config = getUserAIConfig();
  
  const res = await fetch(`${API_BASE}/encourage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      apiKey: config.apiKey,
      modelId: config.modelId,
      groupId: config.groupId,
    }),
  });
  const data = await res.json();
  return data.text || '今天也要加油哦！';
}

// ===== 豆包API直接调用 =====

export async function* streamChatDouban(
  apiKey: string,
  messages: { role: string; content: string }[],
  modelId: string = 'doubao-lite-32k'
): AsyncGenerator<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch(`${DOUBAN_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
      throw new Error(`豆包API调用失败: ${res.status}`);
    }

    const reader = res.body!.getReader();
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
        } catch { /* ignore */ }
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchDoubanQuiz(
  apiKey: string,
  knowledgePointNames: string[],
  subjectName: string
): Promise<Question | null> {
  const messages = [
    {
      role: 'user',
      content: `请为${subjectName}学科生成一道练习题，基于以下知识点：${knowledgePointNames.join('、')}。\n\n请按以下JSON格式返回（只需要JSON，不要其他内容）：\n{\n  "type": "single_choice",\n  "stem": "题目描述",\n  "options": [\n    {"id": "A", "text": "选项A内容"},\n    {"id": "B", "text": "选项B内容"},\n    {"id": "C", "text": "选项C内容"},\n    {"id": "D", "text": "选项D内容"}\n  ],\n  "correctAnswers": ["A"],\n  "explanation": "解析说明"\n}`,
    },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(`${DOUBAN_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'doubao-lite-32k',
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
        if (parsed.options) {
          parsed.options = parsed.options.map((opt: any) => ({
            ...opt,
            text: (opt.text || opt.label || '').replace(/^[A-G]\.\s*/, '').trim(),
          }));
        }
        return parsed;
      }
    }
  } catch { /* timeout or error */ }

  return null;
}

export async function fetchDoubanExplanation(
  apiKey: string,
  question: { stem?: string; options?: Array<{ id: string; text: string }> },
  selectedAnswer: string[],
  correctAnswer: string[]
): Promise<string> {
  const isCorrect = selectedAnswer.length === correctAnswer.length &&
    selectedAnswer.every(a => correctAnswer.includes(a));

  const messages = [
    {
      role: 'user',
      content: `题目：${question.stem || ''}\n选项：${(question.options || []).map(o => `${o.id}. ${o.text}`).join(' | ')}\n用户答案：${selectedAnswer.join('、')}\n正确答案：${correctAnswer.join('、')}\n\n请生成详细的题目解析，说明解题思路和知识点。`,
    },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(`${DOUBAN_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'doubao-lite-32k',
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (isCorrect) {
        return '回答正确！这道题考查的知识点你已经掌握了，继续保持！';
      }
      return '这道题的正确答案是 ' + correctAnswer.join('、') + '。建议回顾相关知识点，加强理解后再做一遍。';
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch {
    if (isCorrect) {
      return '回答正确！这道题考查的知识点你已经掌握了，继续保持！';
    }
    return '这道题的正确答案是 ' + correctAnswer.join('、') + '。建议回顾相关知识点，加强理解后再做一遍。';
  }
}
