import { db, nowIso } from './db.js';
import { decryptSecret } from './security.js';
import { secureCompletionFetch } from './ai/transport.js';
import { requestScope } from './ai/quota.js';

const DEFAULT_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/+$/, '');
}

export function getAiConfigForUser(userId) {
  if (userId) {
    const custom = db.prepare('SELECT * FROM user_ai_configs WHERE user_id = ?').get(userId);
    if (custom?.mode === 'custom' && custom.base_url && custom.model && custom.encrypted_api_key) {
      const apiKey = decryptSecret(custom.encrypted_api_key);
      if (apiKey) {
        return {
          mode: 'custom',
          baseURL: normalizeBaseUrl(custom.base_url),
          model: custom.model,
          apiKey,
        };
      }
    }
    if (custom?.mode === 'custom') throw new Error('自定义 AI 配置不可用，请重新保存密钥');
  }

  return {
    mode: 'platform',
    baseURL: normalizeBaseUrl(DEFAULT_BASE_URL),
    model: DEFAULT_MODEL,
    apiKey: process.env.DEEPSEEK_API_KEY || '',
  };
}

export function getAiConfigStatus(userId) {
  const row = userId
    ? db.prepare('SELECT mode, base_url, model, encrypted_api_key FROM user_ai_configs WHERE user_id = ?').get(userId)
    : null;

  return {
    mode: row?.mode === 'custom' ? 'custom' : 'platform',
    customConfigured: Boolean(row?.encrypted_api_key),
    baseUrl: row?.base_url || '',
    model: row?.model || '',
    platformConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
  };
}

export async function chatCompletion(userId, messages, opts = {}) {
  const { stream = false, temperature = 0.7, maxTokens = 1024 } = opts;
  const config = getAiConfigForUser(userId);
  if (!config.apiKey) {
    throw new Error('AI service is not configured');
  }

  const scope = requestScope.getStore();
  const timeout = AbortSignal.timeout(stream ? 120000 : 45000);
  const response = await secureCompletionFetch(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream,
      temperature,
      max_tokens: maxTokens,
    }),
    signal: scope?.signal ? AbortSignal.any([scope.signal, timeout]) : timeout,
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`AI upstream returned ${response.status}`);
  }
  if (scope) scope.accepted = true;

  if (userId) {
    const dateKey = new Date().toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO ai_usage_daily (user_id, date_key, request_count, updated_at)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(user_id, date_key)
      DO UPDATE SET request_count = request_count + 1, updated_at = excluded.updated_at
    `).run(userId, dateKey, nowIso());
  }

  return response;
}

export async function extractContent(response) {
  const data = await response.json();
  const scope = requestScope.getStore();
  if (scope && data.usage) db.prepare('UPDATE ai_usage_events SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ? WHERE request_id = ?')
    .run(Number(data.usage.prompt_tokens) || 0, Number(data.usage.completion_tokens) || 0, scope.requestId);
  return data.choices?.[0]?.message?.content?.trim() || '';
}
