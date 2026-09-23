import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const base = `http://localhost:${process.env.AI_VERIFY_PORT || '4317'}`;
mkdirSync('output/ai-v2', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(base);
  await page.getByPlaceholder('your@email.com').fill('ai-check@example.test');
  await page.getByPlaceholder('至少 8 位').fill('VerifyAI123!');
  await page.getByRole('button', { name: '登录', exact: true }).last().click();
  await expect(page.getByPlaceholder('your@email.com')).toHaveCount(0);
  const dismiss = page.getByRole('button', { name: '稍后再说', exact: true });
  await dismiss.waitFor({ state: 'visible', timeout: 5000 }).then(() => dismiss.click()).catch(() => {});
  await page.getByRole('button', { name: /^AI 问答 已解锁/ }).click();
  await expect(page.getByRole('heading', { name: '让每一个疑问，都有下一步。' })).toBeVisible();
  await expect(page.getByLabel('AI 使用额度')).toBeVisible();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByLabel('AI 使用额度')).toBeVisible();
    await page.waitForTimeout(450);
    await page.screenshot({ path: `output/ai-v2/center-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: /问一问 解释概念/ }).click();
  await page.getByLabel('向 AI 提问').fill('速度和加速度有什么区别？');
  await page.getByRole('button', { name: '发送问题', exact: true }).click();
  await expect(page.getByRole('button', { name: '加入知识库', exact: true })).toBeVisible();
  await expect(page.getByText('速度描述位置的变化，加速度描述速度的变化。', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'output/ai-v2/conversation.png', fullPage: true });
  await page.getByRole('button', { name: '关闭 AI', exact: true }).click();
  await page.getByRole('button', { name: /^速度和加速度有什么区别/ }).first().click();
  await expect(page.getByRole('button', { name: '加入知识库', exact: true })).toBeVisible();
  // An upstream failure must remain visible, never masquerade as success.
  await page.getByLabel('向 AI 提问').fill('模拟中断');
  await page.getByRole('button', { name: '发送问题', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('回答未完成', { exact: true })).toBeVisible();
  await page.getByLabel('向 AI 提问').fill('慢速回答');
  await page.getByRole('button', { name: '发送问题', exact: true }).click();
  await page.getByRole('button', { name: '停止生成', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('生成已停止');
  // Contextual help must leave the original screen intact and trap keyboard focus.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ai:help', { detail: { threadId: 'verification-question', mode: 'question_hint', goal: '理解当前题目', chapterName: '', knowledgePointId: '', knowledgePointName: '当前题目', question: { id: 'q-check', stem: '加速度描述什么？', options: [{ id: 'A', text: '速度的变化率' }, { id: 'B', text: '位移' }] } } })));
  const dialog = page.getByRole('dialog', { name: '学习 AI 帮助' });
  await expect(dialog).toBeVisible();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(450);
    await page.screenshot({ path: `output/ai-v2/help-${width}.png`, fullPage: true });
  }
  await dialog.getByLabel('向 AI 提问').fill('给我一个提示');
  await dialog.getByRole('button', { name: '发送问题' }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '关闭 AI' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log('PASS: login, center, three widths, stream persistence, interruption, stop, contextual dialog and keyboard focus');
} finally { console.log('PAGE_ERRORS', errors); await browser.close(); }
