import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertIsolatedTruthDirectory, createIsolatedTruthDirectory, parseSourceMetadata, scanFangfengSource } from './truth-import-fangfeng.mjs';

test('directory metadata preserves blank-group observation time and labels unverified identity', () => {
  const { metadata } = parseSourceMetadata('给药第三天/空白组/雄/雄1/IRI_20231208_160757.jpg');
  assert.equal(metadata.groupName, '空白组');
  assert.equal(metadata.phase, 'dosing');
  assert.equal(metadata.timeValue, 3);
  assert.equal(metadata.animalId, '雄1');
  assert.match(metadata.batchCode, /^TEST-/);
  assert.equal(metadata.species, '未记录');
  const second = parseSourceMetadata('停药第三天/空白组/雄/雄1/IRI_20231213_160757.jpg').metadata;
  assert.notEqual(metadata.batchCode, second.batchCode, 'Unconfirmed cross-day animal identities must not be merged');
});

test('metadata missing in source stays unknown, while pre/post and image type remain separate', () => {
  const { metadata, reviewReasons } = parseSourceMetadata('性别因素考察/雌/给药前/IRI_20231128_143520.jpg');
  assert.equal(metadata.phase, 'unknown');
  assert.equal(metadata.timeValue, null);
  assert.equal(metadata.animalId, null);
  assert.equal(metadata.sex, 'female');
  assert.equal(metadata.captureStage, 'before');
  assert.equal(metadata.imageType, 'thermal');
  assert(reviewReasons.includes('目录缺少动物编号'));
});

test('fixture refuses normal directories and the source directory as data targets', () => {
  const source = fs.mkdtempSync(path.join(tmpdir(), 'truth-source-test-'));
  const fixture = createIsolatedTruthDirectory();
  try {
    assert.throws(() => assertIsolatedTruthDirectory(source), /Unrecognized fixture/);
    assert.throws(() => assertIsolatedTruthDirectory(fixture, fixture), /must be separate/);
    assert.equal(assertIsolatedTruthDirectory(fixture, source), fs.realpathSync(fixture));
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('content dedup preserves aliases, folder PDFs cover every sibling image, and named PDFs stay strict', () => {
  const source = fs.mkdtempSync(path.join(tmpdir(), 'truth-source-test-'));
  const put = (relative, contents) => {
    const target = path.join(source, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  };
  try {
    put('给药第三天/防风/实验前（雌）/雌1/IRI_20231208_150000.jpg', 'thermal-1');
    put('给药第三天/防风/实验前（雌）/雌1/VIS_20231208_150000.jpg', 'visible-1');
    put('给药第三天/防风/实验前（雌）/雌1/雌1.pdf', '%PDF-1');
    put('给药第三天/防风/pdf汇总/实验前（雌）/雌1.pdf', '%PDF-1');
    put('给药第三天/防风 - 副本/实验前（雌）/雌1/IRI_20231208_150000.jpg', 'thermal-1');
    put('剂量因素考察/低剂量组/IRI_20231130_153559.jpg', 'thermal-unknown');
    put('剂量因素考察/低剂量组/IRI_20231130_153658.jpg', 'thermal-unknown-2');
    put('剂量因素考察/低剂量组/images.pdf', '%PDF-ambiguous');
    const manifest = scanFangfengSource(source);
    assert.equal(manifest.summary.sourceImages, 5);
    assert.equal(manifest.summary.uniqueImages, 4);
    assert.equal(manifest.summary.uniquePdfs, 2);
    assert.equal(manifest.summary.linkedPdfs, 2);
    assert.equal(manifest.summary.reviewPdfs, 0);
    assert.equal(manifest.summary.directoryPdfs, 1);
    assert.equal(manifest.summary.directoryImageLinks, 2);
    assert.equal(manifest.summary.exactPairedCaptures, 1);
    assert.equal(manifest.images.find(item => item.sourcePaths.length === 2).metadata.imageType, 'thermal');
    assert.equal(manifest.attachments.find(item => item.associationScope === 'capture').sourcePaths.length, 2);
    assert.equal(manifest.attachments.find(item => item.associationScope === 'directory').imageSha256s.length, 2);
    put('给药第三天/防风/实验前（雌）/雌1/IRI_20231208_150100.jpg', 'thermal-2');
    const changed = scanFangfengSource(source);
    assert.equal(changed.summary.linkedPdfs, 1, 'Named animal PDF still requires a unique capture');
    assert.equal(changed.summary.reviewPdfs, 1);
    assert.equal(changed.summary.directoryImageLinks, 2, 'Folder PDF still covers every sibling image');
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
  }
});
