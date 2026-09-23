// Run against scripts/truth-verification-server.mjs only; credentials stay in ignored local files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { chromium, expect } from '@playwright/test';

const out = path.resolve('output/truth-verification');
const connection = JSON.parse(fs.readFileSync(path.join(out, 'connection.local.json'), 'utf8').replace(/^\uFEFF/, ''));
const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
const base = connection.baseUrl;
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Only an isolated localhost fixture may be tested');
const checks = [];
assert(fs.existsSync(path.join(connection.dataDir, '.truth-test-only')), 'Fixture marker must exist');
const storage = new DatabaseSync(path.join(connection.dataDir, 'app.sqlite'), { readOnly: true });
try {
  for (const entry of manifest.images) {
    const row = storage.prepare('SELECT stored_name, thumbnail_name FROM truth_assets WHERE id = ?').get(entry.assetId);
    assert(row, `Missing imported image record: ${entry.sourcePath}`);
    const original = fs.readFileSync(path.join(connection.dataDir, 'truth-images', 'originals', row.stored_name));
    assert.equal(crypto.createHash('sha256').update(original).digest('hex'), entry.sha256, entry.sourcePath);
    assert(fs.statSync(path.join(connection.dataDir, 'truth-images', 'thumbnails', row.thumbnail_name)).size > 0);
  }
  for (const entry of manifest.attachments.filter(item => item.attachmentId)) {
    const row = storage.prepare('SELECT stored_name FROM truth_attachments WHERE id = ?').get(entry.attachmentId);
    assert(row, `Missing imported PDF record: ${entry.sourcePath}`);
    const pdf = fs.readFileSync(path.join(connection.dataDir, 'truth-images', 'attachments', row.stored_name));
    assert.equal(crypto.createHash('sha256').update(pdf).digest('hex'), entry.sha256, entry.sourcePath);
  }
  checks.push('Every imported original and linked PDF matches its source SHA-256; all thumbnails exist');
} finally { storage.close(); }
async function api(route, role = 'user', options = {}) {
  return fetch(`${base}/api${route}`, { ...options, headers: { ...(role ? { Authorization: `Bearer ${connection.accounts[role].token}` } : {}), ...options.headers } });
}
async function json(route, role = 'user', options = {}) {
  const response = await api(route, role, options);
  assert(response.ok, `${route} failed: ${response.status} ${await response.clone().text()}`);
  return response.json();
}
assert.equal((await api('/truth/library', null)).status, 401);
for (const expected of manifest.expectedQueries) {
  const result = await json(`/truth/library?${new URLSearchParams(expected.filter)}`);
  assert.equal(result.total, expected.total, expected.name);
  checks.push(`${expected.name}: ${result.total}`);
}
const ids = new Set();
const publishedAssets = [];
for (let offset = 0; offset < manifest.summary.uniqueImages; offset += 200) {
  const result = await json(`/truth/library?limit=200&offset=${offset}`);
  result.assets.forEach(asset => { assert(!ids.has(asset.id)); ids.add(asset.id); publishedAssets.push(asset); });
}
assert.equal(ids.size, manifest.summary.uniqueImages);
checks.push('All unique images reachable across 200-item pagination');
const folderPdfs = manifest.attachments.filter(item => item.associationScope === 'directory');
assert.equal(folderPdfs.length, 8);
for (const pdf of folderPdfs) {
  const folder = path.posix.dirname(pdf.sourcePath);
  const expected = manifest.images.filter(image => image.sourcePaths.some(sourcePath => path.posix.dirname(sourcePath) === folder));
  assert.equal(expected.length, pdf.imageSha256s.length, pdf.sourcePath);
  for (const image of expected) {
    const asset = publishedAssets.find(item => item.id === image.assetId);
    assert(asset?.attachments.some(item => item.id === pdf.attachmentId), `${pdf.sourcePath} missing on ${image.sourcePath}`);
  }
  assert.equal(publishedAssets.filter(asset => asset.attachments.some(item => item.id === pdf.attachmentId)).length,
    expected.length, `${pdf.sourcePath} leaked outside its folder`);
}
const largePdf = folderPdfs.find(item => item.sourcePath === '文本记录/images.pdf');
assert(largePdf && largePdf.sizeBytes > 20 * 1024 * 1024);
const largePdfResponse = await api(`/truth/attachments/${largePdf.attachmentId}/preview`);
assert.equal(largePdfResponse.status, 200);
assert.equal((await largePdfResponse.arrayBuffer()).byteLength, largePdf.sizeBytes);
checks.push('Eight folder PDFs appear on exactly their 42 sibling photos; 40 MB PDF loads with token only');
for (const role of ['user', 'otherUser']) {
  assert.equal((await api('/truth/assets', role)).status, 403);
  assert.equal((await api('/truth/assets/upload', role, { method: 'POST' })).status, 403);
  for (const status of ['draft', 'pending', 'archived']) {
    assert.equal((await api(`/truth/assets/${connection.boundaryAssets[status]}/original`, role)).status, 404);
    assert.equal((await api(`/truth/attachments/${connection.boundaryAssets[`${status}Attachment`]}/preview`, role)).status, 404);
  }
}
assert.equal((await api(`/truth/assets/${connection.boundaryAssets.draft}/publish`, 'subAdmin', { method: 'POST' })).status, 403);
assert.equal((await api(`/truth/reports/${connection.reportId}`, 'otherUser')).status, 404);
const query = '防风，给药第三天，雌性，实验前';
const found = await json(`/truth/library?query=${encodeURIComponent(query)}`);
assert.equal(found.total, 24);
assert.equal(found.warnings.length, 0);
const image = found.assets.find(asset => asset.attachments.length);
assert(image);
for (const url of [image.previewUrl, image.originalUrl, image.downloadUrl, image.attachments[0].previewUrl, image.attachments[0].downloadUrl, `/api/truth/reports/${connection.reportId}/pdf`]) {
  const response = await api(url.replace('/api', ''));
  assert.equal(response.status, 200, url);
  assert((await response.arrayBuffer()).byteLength > 0);
}
checks.push('Cookie-free user media, PDF, report; role boundaries and report ownership');
const revisionObservation = `隔离验收修订 ${Date.now()}，不应提前公开`;
const pending = await json(`/truth/assets/${image.id}`, 'subAdmin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observation: revisionObservation }) });
assert(pending.asset.pendingRevision);
assert.notEqual((await json(`/truth/library?query=${encodeURIComponent(query)}`)).assets.find(a => a.id === image.id).observation, revisionObservation);
const published = await json(`/truth/assets/${image.id}/publish`, 'admin', { method: 'POST' });
assert.equal(published.asset.observation, revisionObservation);
checks.push('Sub-admin revision is private until administrator approval');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await context.addInitScript(token => localStorage.setItem('study-app:session-token:v1', token), connection.accounts.user.token);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.goto(base);
  const dismiss = page.getByRole('button', { name: '稍后再说', exact: true });
  await dismiss.waitFor({ state: 'visible', timeout: 3500 }).then(() => dismiss.click()).catch(() => {});
  await page.getByRole('button', { name: /^AI 问答 已解锁/ }).click();
  await page.getByRole('button', { name: /专业工具/ }).click();
  await expect(page.getByRole('heading', { name: /已发布图库/ })).toContainText('690');
  await expect(page.locator('.truth-thumbnail img')).toHaveCount(24);
  await page.getByLabel('描述需要查找的实验图片').fill(query);
  await page.getByRole('button', { name: '查找图片', exact: true }).click();
  await expect(page.getByRole('heading', { name: /已发布图库/ })).toContainText('24');
  await expect(page.locator('.truth-thumbnail img')).toHaveCount(24);
  for (const width of [1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: path.join(out, `gallery-${width}.png`), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  const openImage = page.getByRole('button', { name: '查看原图', exact: true }).first();
  await openImage.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('img.truth-original')).toBeVisible();
  await dialog.getByRole('button', { name: '放大原图', exact: true }).click();
  await expect(dialog.getByText('150%', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '查看 PDF', exact: true }).first().click();
  await expect(dialog.locator('iframe')).toHaveAttribute('src', /^blob:/);
  const pdfDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载', exact: true }).first().click();
  assert((await pdfDownload).suggestedFilename().endsWith('.pdf'));
  await dialog.getByRole('button', { name: '返回图片', exact: true }).click();
  for (const width of [1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: path.join(out, `viewer-${width}.png`), fullPage: true });
  }
  await dialog.getByRole('button', { name: '关闭原图查看器' }).focus();
  await page.keyboard.press('Shift+Tab');
  assert(await page.evaluate(() => !!document.activeElement?.closest('dialog')));
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(openImage).toBeFocused();
  await page.getByRole('button', { name: /^选择 IRI_/ }).first().click();
  await page.getByRole('button', { name: /^选择 VIS_/ }).first().click();
  await page.getByRole('button', { name: '对照查看', exact: true }).click();
  await expect(page.getByRole('region', { name: '实验对照' })).toBeVisible();
  for (const width of [1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: path.join(out, `compare-${width}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: '生成资料报告', exact: true }).click();
  await expect(page.getByRole('button', { name: '下载 PDF', exact: true })).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: path.join(out, 'report.png'), fullPage: true });
  const reportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 PDF', exact: true }).click();
  assert((await reportDownload).suggestedFilename().endsWith('.pdf'));
  await page.getByRole('button', { name: '报告列表', exact: true }).click();
  await expect(page.locator('.truth-report-row').first()).toBeVisible();
  for (const width of [390, 768]) {
    const responsive = await browser.newContext({ viewport: { width, height: 1000 } });
    await responsive.addInitScript(token => localStorage.setItem('study-app:session-token:v1', token), connection.accounts.user.token);
    const view = await responsive.newPage();
    view.on('pageerror', error => errors.push(error.message));
    await view.goto(base);
    await view.getByRole('button', { name: '稍后再说', exact: true }).waitFor({ state: 'visible', timeout: 2000 }).then(() => view.getByRole('button', { name: '稍后再说', exact: true }).click()).catch(() => {});
    await view.getByRole('button', { name: /^AI 问答 已解锁/ }).click();
    await view.getByRole('button', { name: /专业工具/ }).click();
    await view.getByLabel('描述需要查找的实验图片').fill(query);
    await view.getByRole('button', { name: '查找图片', exact: true }).click();
    await expect(view.locator('.truth-thumbnail img')).toHaveCount(24);
    await view.screenshot({ path: path.join(out, `gallery-${width}.png`), fullPage: true });
    assert(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await view.getByRole('button', { name: '查看原图', exact: true }).first().click();
    await expect(view.locator('dialog img.truth-original')).toBeVisible();
    await view.screenshot({ path: path.join(out, `viewer-${width}.png`), fullPage: true });
    await view.keyboard.press('Escape');
    await view.getByRole('button', { name: /^选择 IRI_/ }).first().click();
    await view.getByRole('button', { name: /^选择 VIS_/ }).first().click();
    await view.getByRole('button', { name: '对照查看', exact: true }).click();
    await expect(view.getByRole('region', { name: '实验对照' })).toBeVisible();
    await view.screenshot({ path: path.join(out, `compare-${width}.png`), fullPage: true });
    if (width === 390) { await view.getByRole('button', { name: '图片 2', exact: true }).click(); await expect(view.locator('.truth-mobile-active')).toContainText('图片 2'); }
    await responsive.close();
  }
  assert.deepEqual(await context.cookies(), []);
  assert.deepEqual(errors, []);
  checks.push('Browser: gallery/filter, 390/768/1440, original zoom, PDF/download, focus/Escape, compare, generation/history, zero console errors, no cookies');
} finally {
  fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ checks, errors, completedAt: new Date().toISOString() }, null, 2));
  await browser.close();
}
console.log(checks.join('\n'));
