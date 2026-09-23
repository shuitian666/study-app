// Local smoke check against the real gallery, using an existing ordinary user's session.
// No account credentials or tokens are written to the output.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { chromium, expect } from '@playwright/test';

const base = process.env.TRUTH_LOCAL_BASE_URL || 'http://localhost:3001';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Only a local trial server is allowed');
const db = new DatabaseSync(path.resolve('server/data/app.sqlite'));
let session = db.prepare(`SELECT s.id AS token FROM sessions s JOIN users u ON u.id = s.user_id
  LEFT JOIN user_roles r ON r.user_id = u.id
  WHERE s.expires_at > ? AND COALESCE(r.role, 'user') = 'user' AND lower(u.phone) != ?
  ORDER BY s.created_at DESC LIMIT 1`).get(new Date().toISOString(), '3546064605@qq.com');
let temporaryToken = null;
if (!session) {
  const user = db.prepare(`SELECT u.id FROM users u LEFT JOIN user_roles r ON r.user_id = u.id
    WHERE COALESCE(r.role, 'user') = 'user' AND lower(u.phone) != ? LIMIT 1`).get('3546064605@qq.com');
  assert(user, 'An existing ordinary account is required for the local trial check');
  temporaryToken = `ses_${crypto.randomUUID()}`;
  db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(temporaryToken, user.id, new Date(Date.now() + 60 * 60 * 1000).toISOString(), new Date().toISOString());
  session = { token: temporaryToken };
}
try {
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM truth_assets WHERE status = 'published'").get().n, 690);

const request = async url => fetch(`${base}${url}`, { headers: { Authorization: `Bearer ${session.token}` } });
const library = await request('/api/truth/library?limit=200&offset=0');
assert.equal(library.status, 200);
assert.equal((await library.json()).total, 690);
assert.equal((await request('/api/truth/assets')).status, 403);
const filtered = await request(`/api/truth/library?query=${encodeURIComponent('防风 给药第三天 雌性 实验前')}`);
assert.equal(filtered.status, 200);
const found = await filtered.json();
assert.equal(found.total, 24);
const image = found.assets.find(item => item.attachments.length);
assert(image);
for (const url of [image.previewUrl, image.originalUrl, image.attachments[0].previewUrl]) {
  const response = await request(url);
  assert.equal(response.status, 200, url);
  assert((await response.arrayBuffer()).byteLength > 0);
}
const browser = await chromium.launch();
const outputDir = path.resolve('output/truth-library');
fs.mkdirSync(outputDir, { recursive: true });
const errors = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(token => localStorage.setItem('study-app:session-token:v1', token), session.token);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.getByRole('button', { name: '稍后再说', exact: true }).waitFor({ state: 'visible', timeout: 2000 })
      .then(() => page.getByRole('button', { name: '稍后再说', exact: true }).click()).catch(() => {});
    await page.getByRole('button', { name: /^AI 问答 已解锁/ }).click();
    await page.getByRole('button', { name: /专业工具/ }).click();
    await expect(page.getByRole('heading', { name: /已发布图库/ })).toContainText('690');
    await expect(page.locator('.truth-thumbnail img')).toHaveCount(24);
    await page.screenshot({ path: path.join(outputDir, `formal-gallery-${width}.png`), fullPage: true });
    await page.getByLabel('描述需要查找的实验图片').fill('防风 给药第三天 雌性 实验前');
    await page.getByRole('button', { name: '查找图片', exact: true }).click();
    await expect(page.getByRole('heading', { name: /已发布图库/ })).toContainText('24');
    await page.getByRole('button', { name: '查看原图', exact: true }).first().click();
    await expect(page.locator('dialog img.truth-original')).toBeVisible();
    await page.getByRole('button', { name: '查看 PDF', exact: true }).first().click();
    await expect(page.locator('dialog iframe')).toHaveAttribute('src', /^blob:/);
    await page.screenshot({ path: path.join(outputDir, `formal-pdf-${width}.png`), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await context.close();
  }
  assert.deepEqual(errors, []);
  const summary = { base, publishedImages: 690, matchedQuery: found.total,
    ordinaryUserCanUpload: false, authenticatedOriginalAndPdf: true, widths: [390, 1440], consoleErrors: errors };
  fs.writeFileSync(path.join(outputDir, 'local-trial-verification.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally { await browser.close(); }
} finally {
  if (temporaryToken) db.prepare('DELETE FROM sessions WHERE id = ?').run(temporaryToken);
  db.close();
}
