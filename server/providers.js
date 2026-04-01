/**
 * 统一 Provider 适配层
 * 三家 Provider 都走 OpenAI /chat/completions 兼容格式
 * 支持从请求参数动态接收 API Key
 */

/**
 * 获取 Provider 的连接配置
 * @param {string} name - provider 名称
 * @param {object} userConfig - 用户传入的配置（API Key 等）
 */
export function getProviderConfig(name, userConfig = {}) {
  switch (name) {
    case 'ollama':
      return {
        baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
        headers: { 'Content-Type': 'application/json' },
        model: process.env.OLLAMA_MODEL || 'gemma3:1b',
      };
    case 'volcengine':
      return {
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        headers: {
          'Content-Type': 'application/json',
          // 优先使用用户传入的 API Key，其次使用环境变量
          Authorization: `Bearer ${userConfig.apiKey || process.env.VOLC_API_KEY || ''}`,
        },
        model: userConfig.modelId || process.env.VOLC_MODEL_ID || '',
      };
    case 'minimax':
      return {
        baseURL: 'https://api.minimax.chat/v1',
        headers: {
          'Content-Type': 'application/json',
          // 优先使用用户传入的 API Key，其次使用环境变量
          Authorization: `Bearer ${userConfig.apiKey || process.env.MINIMAX_API_KEY || ''}`,
        },
        model: process.env.MINIMAX_MODEL || 'MiniMax-Text-01',
      };
    case 'openclaw':
      // OpenClaw 本地接入 - 默认运行在 localhost，端口由 OpenClaw 控制
      // 可通过环境变量 OPENCLAW_BASE_URL 修改
      return {
        baseURL: process.env.OPENCLAW_BASE_URL || 'http://localhost:8080/v1',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userConfig.apiKey || process.env.OPENCLAW_API_KEY || 'openclaw-local'}`,
        },
        model: userConfig.modelId || process.env.OPENCLAW_MODEL || 'default',
      };
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

/**
 * 统一的 chat completion 调用
 * @param {string} provider - ollama | volcengine | minimax
 * @param {Array} messages - OpenAI 格式的 messages
 * @param {object} opts - { stream, temperature, maxTokens, userConfig }
 * @returns {Promise<Response>} 原始 fetch Response（stream 时需要读 body）
 */
export async function chatCompletion(provider, messages, opts = {}) {
  const { stream = false, temperature = 0.7, maxTokens = 1024, userConfig = {} } = opts;
  const config = getProviderConfig(provider, userConfig);

  // 验证 API Key（支持用户动态传入）
  const apiKey = userConfig.apiKey || 
    (provider === 'volcengine' ? process.env.VOLC_API_KEY : '') ||
    (provider === 'minimax' ? process.env.MINIMAX_API_KEY : '');
  
  if (provider === 'volcengine' && !apiKey) {
    throw new Error('火山引擎 API Key 未配置，请在设置中输入您的 API Key');
  }
  if (provider === 'minimax' && !apiKey) {
    throw new Error('Minimax API Key 未配置，请在设置中输入您的 API Key');
  }

  const url = `${config.baseURL}/chat/completions`;
  const body = {
    model: config.model,
    messages,
    stream,
    temperature,
    max_tokens: maxTokens,
  };

  // Minimax 需要 group_id 参数
  if (provider === 'minimax') {
    body.group_id = userConfig.groupId || process.env.MINIMAX_GROUP_ID || '';
  }

  // 流式请求超时 2 分钟，非流式 30 秒
  const timeout = stream ? 120000 : 30000;

  const response = await fetch(url, {
    method: 'POST',
    headers: config.headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorData = await response.json();
      errorDetail = errorData.error?.message || errorData.message || '';
    } catch {
      errorDetail = await response.text().catch(() => '');
    }
    throw new Error(`${provider} error ${response.status}: ${errorDetail.slice(0, 300)}`);
  }

  return response;
}

/** 从非流式响应中提取文本 */
export async function extractContent(response) {
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/** 检测可用的 Provider 列表（仅检测 Ollama 本地） */
export async function listAvailableProviders() {
  const providers = [];

  // Ollama: 检测连通性
  try {
    const ollamaBase = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
    const base = ollamaBase.replace(/\/v1$/, '');
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const models = (data.models || []).map(m => m.name);
      providers.push({ name: 'ollama', available: true, models });
    } else {
      providers.push({ name: 'ollama', available: false, models: [], error: 'Connection failed' });
    }
  } catch (err) {
    providers.push({ name: 'ollama', available: false, models: [], error: err.message });
  }

  // 云端 Provider 由用户在前端配置，不自动检测
  providers.push({
    name: 'volcengine',
    available: false,
    models: [],
    note: '请在设置中输入 API Key',
  });

  providers.push({
    name: 'minimax',
    available: false,
    models: [],
    note: '请在设置中输入 API Key',
  });

  // OpenClaw 本地接入 - 检测连通性
  try {
    const openclawBase = process.env.OPENCLAW_BASE_URL || 'http://localhost:8080/v1';
    const base = openclawBase.replace(/\/v1$/, '');
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      providers.push({ 
        name: 'openclaw', 
        available: true, 
        models: ['default'],
        note: '本地 OpenClaw 已连接，自带知识库' 
      });
    } else {
      providers.push({ 
        name: 'openclaw', 
        available: false, 
        models: [], 
        error: 'Connection failed' 
      });
    }
  } catch (err) {
    providers.push({ 
      name: 'openclaw', 
      available: false, 
      models: [], 
      error: err.message 
    });
  }

  return providers;
}
