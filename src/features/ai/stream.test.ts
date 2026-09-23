import { AIRequestError, readAIStream } from './stream';

async function collect(response: Response) { let result = ''; for await (const chunk of readAIStream(response)) result += chunk; return result; }
test('handles split UTF-8 and a final frame without newline', async () => {
  const bytes = new TextEncoder().encode('data: {"content":"你好"}\n\ndata: {"done":true}');
  const body = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
  expect(await collect(new Response(body))).toBe('你好');
});
test('does not swallow errors in a done frame', async () => {
  await expect(collect(new Response('data: {"error":"生成失败","code":"INVALID_OUTPUT","done":true}\n\n'))).rejects.toMatchObject({ code: 'INVALID_OUTPUT', message: '生成失败' });
});
test('reports unfinished streams instead of accepting partial text as complete', async () => {
  await expect(collect(new Response('data: {"content":"部分内容"}\n\n'))).rejects.toMatchObject({ code: 'STREAM_INTERRUPTED' });
});
test('preserves quota errors from HTTP responses', async () => {
  await expect(collect(new Response(JSON.stringify({ code: 'QUOTA_EXHAUSTED', message: '额度不足' }), { status: 429 }))).rejects.toBeInstanceOf(AIRequestError);
});
