// Read-only source scanner and isolated test importer. Never imports into the application database.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const slash = value => value.split(path.sep).join('/');
const isInside = (root, target) => {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
};

export function createIsolatedTruthDirectory() {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'study-truth-fixture-'));
  fs.writeFileSync(path.join(directory, '.truth-test-only'), 'Isolated local verification database. Never production.\n');
  return directory;
}

export function assertIsolatedTruthDirectory(directory, sourceRoot) {
  const resolved = fs.realpathSync(directory);
  assert(isInside(fs.realpathSync(tmpdir()), resolved), 'Fixture data must stay beneath the OS temporary directory');
  assert(path.basename(resolved).startsWith('study-truth-fixture-'), 'Unrecognized fixture directory');
  assert(fs.existsSync(path.join(resolved, '.truth-test-only')), 'Missing isolation marker');
  if (sourceRoot) {
    const source = fs.realpathSync(sourceRoot);
    assert(source !== resolved && !isInside(source, resolved) && !isInside(resolved, source), 'Source and fixture directory must be separate');
  }
  return resolved;
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const child = path.join(directory, entry.name);
    // Do not follow links out of the source directory.
    if (entry.isSymbolicLink()) return [];
    return entry.isDirectory() ? walk(child) : entry.isFile() ? [child] : [];
  });
}

function numberOf(text) {
  if (/^\d+$/.test(text)) return Number(text);
  const digits = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 零: 0 };
  if (text.includes('十')) {
    const [tens, ones] = text.split('十');
    return (tens ? digits[tens] : 1) * 10 + (ones ? digits[ones] : 0);
  }
  return digits[text] ?? null;
}

export function parseSourceMetadata(sourcePath) {
  const parts = sourcePath.split('/');
  const context = parts.slice(0, -1).join('/');
  const filename = parts.at(-1);
  const time = context.match(/(给药|停药)第?([\d一二两三四五六七八九十]+)[天日]/);
  const animal = [...parts.slice(0, -1)].reverse().find(part => /^[雌雄]\d+$/.test(part));
  const sex = context.includes('雌') ? 'female' : context.includes('雄') ? 'male' : 'unknown';
  const groupName = context.includes('空白组') ? '空白组'
    : parts.find(part => /^(低|中|高)剂量组$/.test(part)) || (parts.some(part => /^防风(?:\s*-\s*副本)?$/.test(part)) ? '处理组' : null);
  const captureStage = /(?:实验|给药)前/.test(context) ? 'before' : /(?:实验|给药)后/.test(context) ? 'after' : 'unknown';
  const stamp = filename.match(/^(IRI|VIS)_(\d{8}_\d{6})(?:\.[^.]+)$/i);
  const imageType = stamp?.[1].toUpperCase() === 'IRI' ? 'thermal' : stamp?.[1].toUpperCase() === 'VIS' ? 'visible' : 'unknown';
  const metadata = {
    // Each top-level directory is a separate TEST bucket. Cross-day identities are unverified.
    batchCode: `TEST-防风-批次待核对-${parts[0]}`,
    animalId: animal || null,
    species: '未记录',
    sex,
    drugName: '防风',
    phase: time ? time[1] === '给药' ? 'dosing' : 'withdrawal' : 'unknown',
    timeValue: time ? numberOf(time[2]) : null,
    timeUnit: time ? 'day' : null,
    groupName,
    captureStage,
    imageType,
    sourcePath,
    captureId: `TEST-capture-${hash(`${context}/${stamp?.[2] || filename}`).slice(0, 24)}`,
    tags: ['防风资料集', '隔离测试', '目录信息待人工核对'],
    observation: '隔离测试资料；元数据仅由目录与文件名提取，未读图、未提取 PDF。批次、物种及动物跨时间身份未人工确认。空白组的防风标签仅表示所属资料集。',
  };
  const reviewReasons = ['真实实验批次及物种未确认'];
  if (!animal) reviewReasons.push('目录缺少动物编号');
  if (!groupName) reviewReasons.push('目录缺少实验分组');
  if (sex === 'unknown') reviewReasons.push('目录缺少性别');
  if (!time) reviewReasons.push('目录未明确给药/停药阶段及观察时间');
  if (captureStage === 'unknown') reviewReasons.push('目录未明确实验前后');
  if (imageType === 'unknown') reviewReasons.push('文件名未明确热成像/可见光类型');
  return { metadata, reviewReasons, timestamp: stamp?.[2] || null };
}

function sourcePreference(a, b) {
  const rank = value => (value.includes('副本') ? 100 : 0) + (value.includes('pdf汇总') ? 10 : 0);
  return rank(a) - rank(b) || a.localeCompare(b, 'zh-CN');
}

export function scanFangfengSource(sourceRoot) {
  const source = fs.realpathSync(sourceRoot);
  const files = walk(source).filter(file => /\.(?:jpe?g|png|pdf)$/i.test(file))
    .map(file => ({ sourcePath: slash(path.relative(source, file)), sizeBytes: fs.statSync(file).size, sha256: hash(fs.readFileSync(file)), kind: /\.pdf$/i.test(file) ? 'pdf' : 'image' }))
    .sort((a, b) => sourcePreference(a.sourcePath, b.sourcePath));
  const unique = new Map();
  for (const file of files) {
    const key = `${file.kind}:${file.sha256}`;
    if (unique.has(key)) unique.get(key).sourcePaths.push(file.sourcePath);
    else unique.set(key, { ...file, sourcePaths: [file.sourcePath] });
  }
  const images = [...unique.values()].filter(file => file.kind === 'image').map(file => ({ ...file, ...parseSourceMetadata(file.sourcePath) }));
  const imagesBySource = new Map(images.flatMap(image => image.sourcePaths.map(sourcePath => [sourcePath, image])));
  const imageLocations = files.filter(file => file.kind === 'image');
  const attachments = [...unique.values()].filter(file => file.kind === 'pdf').map(pdf => {
    const candidates = new Map();
    const directoryCandidates = new Map();
    for (const sourcePath of pdf.sourcePaths) {
      const parts = sourcePath.split('/');
      const basename = parts.at(-1).replace(/\.pdf$/i, '');
      let directory = parts.slice(0, -1).join('/');
      if (basename === 'images' && !/^[雌雄]\d+$/.test(parts.at(-2))) {
        for (const image of imageLocations.filter(item => path.posix.dirname(item.sourcePath) === directory)) {
          const candidate = imagesBySource.get(image.sourcePath);
          directoryCandidates.set(candidate.sha256, candidate);
        }
        continue;
      }
      if (parts.includes('pdf汇总') && /^[雌雄]\d+$/.test(basename)) {
        directory = [...parts.slice(0, -1).filter(part => part !== 'pdf汇总'), basename].join('/');
      }
      const animalDirectory = directory.split('/').at(-1);
      if (!/^[雌雄]\d+$/.test(animalDirectory) || (basename !== animalDirectory && basename !== 'images')) continue;
      for (const image of imageLocations.filter(item => item.sourcePath.slice(0, item.sourcePath.lastIndexOf('/')) === directory)) {
        const candidate = imagesBySource.get(image.sourcePath);
        candidates.set(candidate.sha256, candidate);
      }
    }
    if (directoryCandidates.size) {
      const linked = [...directoryCandidates.values()];
      return { ...pdf, imageSha256: linked[0].sha256, imageSha256s: linked.map(image => image.sha256),
        captureId: null, associationScope: 'directory', reviewReasons: [] };
    }
    const matching = [...candidates.values()];
    const captures = new Set(matching.map(image => image.metadata.captureId));
    if (captures.size !== 1 || matching.length === 0) return { ...pdf, imageSha256: null, imageSha256s: [], captureId: null,
      reviewReasons: [pdf.sourcePaths.some(sourcePath => path.posix.basename(sourcePath).toLowerCase() === 'images.pdf')
        ? 'PDF 所在目录没有照片' : matching.length ? '同一目录存在多次采集，PDF 无法唯一对应' : '缺少唯一动物目录/编号关系，不自动关联'] };
    const primary = matching.find(image => image.metadata.imageType === 'thermal') || matching[0];
    return { ...pdf, imageSha256: primary.sha256, imageSha256s: [primary.sha256],
      captureId: primary.metadata.captureId, associationScope: 'capture', reviewReasons: [] };
  });
  const by = key => Object.fromEntries([...new Set(images.map(image => image.metadata[key] ?? 'unknown'))].map(value => [value, images.filter(image => (image.metadata[key] ?? 'unknown') === value).length]));
  const expectedQueries = [
    { name: '全部已发布图片', filter: {} },
    { name: '防风给药第三天雌性实验前', filter: { drugName: '防风', phase: 'dosing', timeValue: 3, timeUnit: 'day', sex: 'female', captureStage: 'before' } },
    { name: '防风给药第三天雌性实验后', filter: { drugName: '防风', phase: 'dosing', timeValue: 3, timeUnit: 'day', sex: 'female', captureStage: 'after' } },
    { name: '空白组给药第三天', filter: { groupName: '空白组', phase: 'dosing', timeValue: 3, timeUnit: 'day' } },
    { name: '阶段未记录仍可浏览', filter: { phase: 'unknown' } },
  ].map(query => ({ ...query, total: images.filter(image => Object.entries(query.filter).every(([key, value]) => image.metadata[key] === value)).length }));
  return {
    schemaVersion: 2, createdAt: new Date().toISOString(), sourceRoot: source,
    summary: {
      sourceImages: files.filter(file => file.kind === 'image').length, sourcePdfs: files.filter(file => file.kind === 'pdf').length,
      uniqueImages: images.length, uniquePdfs: attachments.length,
      duplicateImages: files.filter(file => file.kind === 'image').length - images.length,
      duplicatePdfs: files.filter(file => file.kind === 'pdf').length - attachments.length,
      linkedPdfs: attachments.filter(pdf => pdf.imageSha256).length,
      reviewPdfs: attachments.filter(pdf => !pdf.imageSha256).length,
      directoryPdfs: attachments.filter(pdf => pdf.associationScope === 'directory').length,
      directoryImageLinks: attachments.filter(pdf => pdf.associationScope === 'directory')
        .reduce((count, pdf) => count + pdf.imageSha256s.length, 0),
      exactPairedCaptures: [...new Set(images.map(image => image.metadata.captureId))].filter(captureId => {
        const peers = images.filter(image => image.metadata.captureId === captureId);
        return peers.length === 2 && peers.some(image => image.metadata.imageType === 'thermal') && peers.some(image => image.metadata.imageType === 'visible');
      }).length,
      byPhase: by('phase'), byImageType: by('imageType'), byCaptureStage: by('captureStage'),
    }, expectedQueries, images, attachments,
  };
}

export async function importFangfengManifest(manifest, userId, { publish = false, onProgress = () => {} } = {}) {
  const dataDir = assertIsolatedTruthDirectory(process.env.DATA_DIR, manifest.sourceRoot);
  const { createTruthAssets, createTruthAttachments, linkTruthAttachmentToDraftAssets, setTruthAssetStatus } = await import('../server/truth.js');
  const sourceFile = entry => path.join(manifest.sourceRoot, ...entry.sourcePath.split('/'));
  const copyToUpload = entry => {
    const sourcePath = sourceFile(entry);
    assert.equal(hash(fs.readFileSync(sourcePath)), entry.sha256, `Source changed after scanning: ${entry.sourcePath}`);
    const destination = path.join(dataDir, `fixture-upload-${crypto.randomUUID()}.tmp`);
    fs.copyFileSync(sourcePath, destination);
    // Windows copies may retain old source timestamps; keep fresh test copies out of age-based temp cleanup.
    const copiedAt = new Date();
    fs.utimesSync(destination, copiedAt, copiedAt);
    return { path: destination, originalname: path.basename(sourcePath), mimetype: entry.kind === 'pdf' ? 'application/pdf' : /\.png$/i.test(sourcePath) ? 'image/png' : 'image/jpeg', size: entry.sizeBytes };
  };
  const assetIds = new Map();
  const failedImages = [];
  for (let start = 0; start < manifest.images.length; start += 50) {
    const batch = manifest.images.slice(start, start + 50);
    const uploaded = await createTruthAssets(userId, batch.map(copyToUpload), { items: batch.map(entry => entry.metadata) });
    for (const image of batch) {
      const asset = uploaded.created.find(item => item.sourcePath === image.sourcePath) || uploaded.duplicates.find(item => item.existing?.sourcePath === image.sourcePath)?.existing;
      if (asset) { assetIds.set(image.sha256, asset.id); image.assetId = asset.id; }
    }
    failedImages.push(...uploaded.failed);
    onProgress({ stage: 'images', processed: Math.min(start + 50, manifest.images.length), total: manifest.images.length });
  }
  const failedAttachments = [];
  let importedAttachments = 0;
  for (const attachment of manifest.attachments.filter(item => item.imageSha256)) {
    const assetId = assetIds.get(attachment.imageSha256);
    if (!assetId) { failedAttachments.push({ fileName: attachment.sourcePath, error: '关联图片导入失败' }); continue; }
    const result = await createTruthAttachments(userId, assetId, [copyToUpload(attachment)], { sourcePaths: [attachment.sourcePath] });
    attachment.assetId = assetId;
    attachment.attachmentId = result.created[0]?.id || result.duplicates[0]?.existing?.id || null;
    if (attachment.associationScope === 'directory' && attachment.attachmentId) {
      const linkedIds = attachment.imageSha256s.map(sha256 => assetIds.get(sha256));
      if (linkedIds.some(id => !id)) failedAttachments.push({ fileName: attachment.sourcePath, error: '目录图片导入失败' });
      else linkTruthAttachmentToDraftAssets(attachment.attachmentId, linkedIds);
    }
    importedAttachments += result.created.length + result.duplicates.length;
    failedAttachments.push(...result.failed);
  }
  if (publish) for (const id of assetIds.values()) setTruthAssetStatus(id, 'published');
  manifest.importResult = { dataDir, publishedInIsolatedTestOnly: publish, importedImages: assetIds.size, importedAttachments, failedImages, failedAttachments };
  assert.equal(failedImages.length, 0, `Images failed: ${JSON.stringify(failedImages)}`);
  assert.equal(assetIds.size, manifest.images.length, 'Every unique source image must be imported');
  assert.equal(failedAttachments.length, 0, `Attachments failed: ${JSON.stringify(failedAttachments)}`);
  return manifest;
}

export function writeManifest(manifest, outputDirectory) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(outputDirectory, 'summary.json'), JSON.stringify({ summary: manifest.summary, expectedQueries: manifest.expectedQueries, importResult: manifest.importResult }, null, 2));
  fs.writeFileSync(path.join(outputDirectory, 'review.json'), JSON.stringify({
    images: manifest.images.map(({ sourcePath, sourcePaths, reviewReasons }) => ({ sourcePath, sourcePaths, reviewReasons })),
    attachments: manifest.attachments.filter(item => item.reviewReasons.length > 0),
  }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const sourceRoot = args[args.indexOf('--source') + 1];
  if (!args.includes('--source') || !sourceRoot) throw new Error('Usage: node scripts/truth-import-fangfeng.mjs --source <read-only-directory> [--import]');
  const manifest = scanFangfengSource(sourceRoot);
  if (args.includes('--import')) {
    process.env.DATA_DIR = createIsolatedTruthDirectory();
    const { createUser, db } = await import('../server/db.js');
    try { await importFangfengManifest(manifest, createUser('truth-import@example.test', 'unused').id); }
    finally { db.close(); }
  }
  const outputDirectory = path.resolve('output/truth-verification');
  writeManifest(manifest, outputDirectory);
  console.log(JSON.stringify({ outputDirectory, summary: manifest.summary, importResult: manifest.importResult }, null, 2));
}
