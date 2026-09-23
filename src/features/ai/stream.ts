import type { Quota } from './api';
export class AIRequestError extends Error {
  code: string; status: number; quota?: Quota;
  constructor(message: string, code = 'AI_UNAVAILABLE', status = 502, quota?: Quota) {
    super(message); this.code = code; this.status = status; this.quota = quota;
  }
}
export async function* readAIStream(res: Response): AsyncGenerator<string> {
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new AIRequestError(data.message || data.error || 'AI 连接失败', data.code, res.status, data.quota);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', finished = false;
  function parse(line: string) {
    if (!line.startsWith('data:')) return null;
    const payload = JSON.parse(line.slice(5).trim()) as { error?: string; message?: string; content?: string; code?: string; done?: boolean; quota?: Quota };
    if (payload.error) throw new AIRequestError(payload.message || payload.error, payload.code, 502, payload.quota);
    if (payload.done) finished = true;
    return payload.content;
  }
  try {
    while (!finished) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const line of lines) { const content = parse(line.trim()); if (content) yield content; }
      if (done) { if (buffer.trim()) { const content = parse(buffer.trim()); if (content) yield content; } break; }
    }
    if (!finished) throw new AIRequestError('连接中断，已保留生成内容，请重试', 'STREAM_INTERRUPTED');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
