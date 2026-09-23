// Local verification only: isolated data and a deterministic, non-billable upstream.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import https from 'node:https';
import dns from 'node:dns/promises';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'study-ai-browser-'));
process.env.PORT = process.env.AI_VERIFY_PORT || '4317';
process.env.DEEPSEEK_API_KEY = 'verification-only';
process.env.DEEPSEEK_BASE_URL = 'https://fixture.example.test';
process.env.CORS_ORIGINS = `http://localhost:${process.env.PORT}`;
process.env.TRUTH_MODE_ENABLED = 'false';
const originalLookup = dns.lookup;
dns.lookup = async (hostname, options) => hostname === 'fixture.example.test' ? [{ address: '8.8.8.8', family: 4 }] : originalLookup(hostname, options);
const originalRequest = https.request;
https.request = (url, options, callback) => {
  if (new URL(url).hostname !== 'fixture.example.test') return originalRequest(url, options, callback);
  const request = new EventEmitter();
  request.end = body => {
    const input = JSON.parse(body);
    const response = new PassThrough(); response.statusCode = 200; response.headers = { 'content-type': input.stream ? 'text/event-stream' : 'application/json' };
    callback(response);
    const question = { type: 'single_choice', stem: '加速度描述的是哪个量的变化快慢？', options: [{ id: 'A', text: '速度' }, { id: 'B', text: '位置' }], correctAnswers: ['A'], explanation: '加速度表示速度的变化率。' };
    if (!input.stream) { response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(question) } }], usage: { prompt_tokens: 20, completion_tokens: 30 } })); return; }
    const query = input.messages.at(-1).content;
    const chunks = ['先区分速度与加速度。\n\n', '速度描述位置的变化，加速度描述速度的变化。', '\n\n例如，汽车匀速直行时速度不为零，加速度为零。'];
    let i = 0;
    const timer = setInterval(() => {
      if (options.signal?.aborted) { clearInterval(timer); response.destroy(new Error('Verification aborted')); return; }
      if (i < chunks.length) response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunks[i++] } }] })}\n\n`);
      else { clearInterval(timer); if (query.includes('模拟中断')) response.destroy(new Error('Verification interruption')); else response.end('data: [DONE]\n\n'); }
    }, query.includes('慢速') ? 1200 : 100);
  };
  return request;
};
const { createUser } = await import('../server/db.js');
const { hashPassword } = await import('../server/security.js');
createUser('ai-check@example.test', hashPassword('VerifyAI123!'));
await import('../server/index.js');
