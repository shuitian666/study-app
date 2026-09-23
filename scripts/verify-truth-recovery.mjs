import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
const out = path.resolve('output/truth-verification');
const fixture = JSON.parse(fs.readFileSync(path.join(out, 'connection.local.json'), 'utf8').replace(/^\uFEFF/, ''));
assert(['localhost', '127.0.0.1'].includes(new URL(fixture.baseUrl).hostname));
const browser = await chromium.launch();
const checks = [];
async function workspace(role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(token => {
    localStorage.setItem('study-app:session-token:v1', token);
    window.__truthRevoked = 0;
    const original = URL.revokeObjectURL;
    URL.revokeObjectURL = value => { window.__truthRevoked++; return original.call(URL, value); };
  }, fixture.accounts[role].token);
  const page = await context.newPage();
  await page.goto(fixture.baseUrl);
  await page.getByRole('button', { name: '稍后再说', exact: true }).waitFor({ state: 'visible', timeout: 2000 }).then(() => page.getByRole('button', { name: '稍后再说', exact: true }).click()).catch(() => {});
  await page.getByRole('button', { name: /^AI 问答 已解锁/ }).click();
  await page.getByRole('button', { name: /专业工具/ }).click();
  await expect(page.locator('.truth-thumbnail img')).toHaveCount(24);
  return { context, page };
}
try {
  const { context, page } = await workspace('user');
  // One damaged image does not stop the other gallery records from displaying.
  let failImage = true;
  await page.route('**/api/truth/assets/*/preview', async route => {
    if (failImage) { failImage = false; await route.fulfill({ status: 404, json: { error: '图片文件不存在' } }); }
    else await route.continue();
  });
  await page.getByLabel('描述需要查找的实验图片').fill('防风 给药第三天 雌性 实验前');
  await page.getByRole('button', { name: '查找图片', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试图片', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重试图片', exact: true }).click();
  await expect(page.locator('.truth-thumbnail img')).toHaveCount(24);
  await page.unroute('**/api/truth/assets/*/preview');
  checks.push('Missing image displayed with retry; other images stay visible; retry recovers');

  await page.getByRole('button', { name: '查看原图', exact: true }).first().click();
  await expect(page.locator('dialog img')).toBeVisible();
  const before = await page.evaluate(() => window.__truthRevoked);
  await page.keyboard.press('Escape');
  assert(await page.evaluate(() => window.__truthRevoked) > before);
  checks.push('Closing original viewer revokes temporary image URL');

  let failSearch = true;
  await page.route('**/api/truth/library?*', async route => {
    if (failSearch) { failSearch = false; await route.fulfill({ status: 503, json: { error: '测试临时不可用' } }); }
    else await route.continue();
  });
  await page.getByRole('button', { name: '查找图片', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('测试临时不可用');
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.locator('.truth-thumbnail img')).toHaveCount(24);
  await page.unroute('**/api/truth/library?*');
  await page.getByLabel('描述需要查找的实验图片').fill('防风 批次 DOES-NOT-EXIST');
  await page.getByRole('button', { name: '查找图片', exact: true }).click();
  await expect(page.getByRole('heading', { name: '没有找到符合当前条件的图片' })).toBeVisible();
  await expect(page.getByLabel('描述需要查找的实验图片')).toHaveValue('防风 批次 DOES-NOT-EXIST');
  checks.push('Search failure retry recovers; empty search preserves user input');
  await page.route('**/api/truth/library?*', route => route.fulfill({ status: 401, json: { error: '登录已过期' } }));
  await page.getByRole('button', { name: '查找图片', exact: true }).click();
  await expect(page.getByRole('button', { name: '重新登录', exact: true })).toBeVisible();
  checks.push('Expired login shows explicit login recovery');
  await page.unroute('**/api/truth/library?*');
  await page.getByRole('button', { name: '重新登录', exact: true }).click();
  await expect(page.locator('.truth-thumbnail img')).toHaveCount(0);
  await page.getByPlaceholder('your@email.com').fill(fixture.accounts.otherUser.email);
  await page.getByPlaceholder('至少 8 位').fill(fixture.accounts.otherUser.password);
  const loginResponse = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '登录', exact: true }).last().click();
  const auth = await (await loginResponse).json();
  assert.equal(auth.user.id, fixture.accounts.otherUser.id);
  assert.equal(typeof auth.sessionToken, 'string', 'login must return the new session token');
  await expect.poll(() => page.evaluate(token => localStorage.getItem('study-app:session-token:v1') === token, auth.sessionToken)).toBe(true);
  fixture.accounts.otherUser.token = auth.sessionToken;
  fs.writeFileSync(path.join(out, 'connection.local.json'), JSON.stringify(fixture, null, 2));
  await page.getByRole('button', { name: '稍后再说', exact: true }).waitFor({ state: 'visible', timeout: 2000 }).then(() => page.getByRole('button', { name: '稍后再说', exact: true }).click()).catch(() => {});
  await page.getByRole('button', { name: /^AI 问答 已解锁/ }).click();
  await page.getByRole('button', { name: /专业工具/ }).click();
  await expect(page.locator('.truth-thumbnail img')).toHaveCount(24);
  await expect(page.getByRole('region', { name: '已选择资料' })).toHaveCount(0);
  await page.getByRole('button', { name: '我的报告', exact: true }).click();
  const actualUser = await page.evaluate(async () => { const r = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('study-app:session-token:v1') } }); return (await r.json()).user.id; });
  assert.equal(actualUser, fixture.accounts.otherUser.id, 'active token must still represent the new account');
  await expect(page.getByText('还没有资料报告', { exact: true })).toBeVisible();
  checks.push('Changing accounts clears media/selection state and shows only the new account reports');
  await context.close();

  const admin = await workspace('admin');
  await admin.page.getByRole('button', { name: '管理图库', exact: true }).click();
  const card = admin.page.locator('article').filter({ hasText: '防风' }).first();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: '编辑', exact: true }).click();
  const dialog = admin.page.getByRole('dialog', { name: '编辑图片标签' });
  await expect(dialog).toContainText('保存后形成待审核修改');
  const text = `浏览器审核测试 ${Date.now()}`;
  await dialog.getByLabel('人工观察').fill(text);
  const response = admin.page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/truth/assets/'));
  await dialog.getByRole('button', { name: '保存标签', exact: true }).click();
  const edited = (await (await response).json()).asset;
  assert.equal(edited.pendingRevision.observation, text);
  assert.notEqual(edited.observation, text);
  await expect(card).toContainText('有待审核修改');
  await card.getByRole('button', { name: '发布', exact: true }).click();
  const confirm = admin.page.getByRole('dialog', { name: '确认资料状态变更' });
  await expect(confirm).toBeVisible();
  await confirm.getByText('核对本次发布内容', { exact: true }).click();
  await expect(confirm).toContainText(text);
  await admin.page.screenshot({ path: path.join(out, 'admin-review.png'), fullPage: true });
  const publishResponse = admin.page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/publish'));
  await confirm.getByRole('button', { name: '确认', exact: true }).click();
  assert.equal((await (await publishResponse).json()).asset.observation, text);
  checks.push('Administrator edits stage a revision, full metadata review and explicit publish confirmation work');
  await admin.context.close();
  fs.writeFileSync(path.join(out, 'recovery-verification.json'), JSON.stringify({ checks, completedAt: new Date().toISOString() }, null, 2));
  console.log(checks.join('\n'));
} finally { await browser.close(); }
