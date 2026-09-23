import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';
import { Readable } from 'node:stream';
import { aiError } from './storage.js';

export function publicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b))
      || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
  }
  // Accept only global unicast IPv6; reject mapped IPv4, local and transition ranges.
  if (net.isIP(address) === 6) return /^2[0-9a-f]{3}:/i.test(address) && !/^200[12]:/i.test(address);
  return false;
}
export async function validateEndpoint(baseUrl) {
  let url;
  try { url = new URL(baseUrl); } catch { throw aiError('INVALID_ENDPOINT', '请输入有效的 HTTPS 接口地址'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw aiError('INVALID_ENDPOINT', '接口必须使用不含账号、参数和片段的 HTTPS 地址');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let timer;
  const addresses = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }] : await Promise.race([
    dns.lookup(hostname, { all: true }),
    new Promise((_, reject) => { timer = setTimeout(() => reject(aiError('DNS_TIMEOUT', '接口地址解析超时，请重试', 504)), 5000); }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw aiError('UNSAFE_ENDPOINT', '接口地址必须是公网 HTTPS 服务');
  return { url, address: addresses[0] };
}
export async function secureCompletionFetch(url, options) {
  const endpoint = await validateEndpoint(url);
  return new Promise((resolve, reject) => {
    const req = https.request(endpoint.url, {
      method: 'POST', headers: options.headers, signal: options.signal,
      // Pin the validated DNS result to prevent DNS rebinding between checks and connection.
      lookup: (_hostname, opts, cb) => opts.all
        ? cb(null, [endpoint.address]) : cb(null, endpoint.address.address, endpoint.address.family),
    }, response => {
      // Redirects are intentionally rejected; never forward credentials to another host.
      if (response.statusCode >= 300 && response.statusCode < 400) {
        response.resume(); reject(aiError('UPSTREAM_REDIRECT', '接口发生重定向，请填写最终接口地址', 400)); return;
      }
      resolve(new Response(Readable.toWeb(response), { status: response.statusCode, headers: { 'Content-Type': response.headers['content-type'] || 'application/json' } }));
    });
    req.on('error', reject);
    req.end(options.body);
  });
}
