export function writeSse(res, payload) {
  if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
}
export async function* upstreamContent(body) {
  if (!body) throw new Error('Empty upstream stream');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', finished = false;
  function parse(line) {
    if (!line.startsWith('data:')) return '';
    const text = line.slice(5).trim();
    if (text === '[DONE]') { finished = true; return ''; }
    if (!text) return '';
    const chunk = JSON.parse(text);
    if (chunk.error) throw new Error('Upstream stream error');
    const choice = chunk.choices?.[0];
    if (choice?.finish_reason) finished = true;
    // Never expose reasoning_content as the final answer.
    return choice?.delta?.content || choice?.message?.content || choice?.text || '';
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) { const content = parse(line.trim()); if (content) yield content; }
      if (done) {
        const content = parse(buffer.trim()); if (content) yield content;
        if (!finished) { const error = new Error('Upstream stream interrupted'); error.code = 'STREAM_INTERRUPTED'; throw error; }
        return;
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
