import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { TruthAsset, TruthAttachment } from '@/types';
import { downloadTruthFile } from '@/services/truthService';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';
import AuthImage from './AuthImage';
import { useTruthMedia } from './useTruthMedia';
import { captureLabels, imageLabels, phaseLabels, sexLabels, timeLabel } from './labels';
import './styles.css';

export function AssetMetadata({ asset }: { asset: TruthAsset }) {
  const values = [
    ['实验批次', asset.batchCode], ['动物编号', asset.animalId], ['实验分组', asset.groupName],
    ['药物', asset.drugName], ['性别', sexLabels[asset.sex]], ['阶段', phaseLabels[asset.phase]],
    ['观察时间', timeLabel(asset)], ['实验前后', captureLabels[asset.captureStage || 'unknown']],
    ['图片类型', imageLabels[asset.imageType || 'unknown']], ['部位', asset.bodyPart], ['物种 / 品系', [asset.species, asset.strain].filter(Boolean).join(' / ')],
    ['剂量', [asset.doseValue, asset.doseUnit].filter(Boolean).join(' ')], ['给药途径', asset.administrationRoute],
    ['采集记录', asset.captureId], ['资料版本', asset.version ? `v${asset.version}` : '历史版本'], ['来源路径', asset.sourcePath],
    ['标签', asset.tags.join('、')],
  ];
  return <dl className="truth-metadata">{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '未记录'}</dd></div>)}{asset.observation && <div><dt>已确认观察</dt><dd>{asset.observation}</dd></div>}</dl>;
}

export function AttachmentPreview({ attachment }: { attachment: TruthAttachment }) {
  const { navigate } = useUser();
  const { url, error, expired, retry } = useTruthMedia(attachment.previewUrl || attachment.downloadUrl);
  if (error) return <div className="truth-notice" role="alert"><p>{error.message}</p>{expired ? <button className="truth-button" onClick={() => navigate('login')}>重新登录</button> : <button className="truth-button" onClick={retry}>重试附件</button>}</div>;
  if (!url) return <p role="status">正在加载 PDF…</p>;
  return <iframe className="truth-pdf" src={url} title={attachment.fileName || attachment.originalName || '实验记录 PDF'} />;
}

export default function TruthViewer({ assets, initialIndex, onClose }: { assets: TruthAsset[]; initialIndex: number; onClose: () => void }) {
  const { theme } = useTheme();
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [attachment, setAttachment] = useState<TruthAttachment | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const actionRef = useRef<AbortController | null>(null);
  const asset = assets[index];
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { actionRef.current?.abort(); dialog?.close(); previousFocus?.focus(); };
  }, []);
  const move = (next: number) => { setIndex(next); setZoom(1); setAttachment(null); setError(''); };
  const download = async (url: string, name: string) => {
    actionRef.current?.abort();
    const controller = new AbortController(); actionRef.current = controller;
    setDownloading(true); setError('');
    try { await downloadTruthFile(url, name, controller.signal); }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '下载失败'); }
    finally { if (!controller.signal.aborted) setDownloading(false); }
  };
  if (!asset) return null;
  return createPortal(<dialog ref={dialogRef} className="truth-dialog" style={{ background: theme.bgCard, color: theme.textPrimary }} aria-labelledby="truth-viewer-title" onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
    if (event.key === 'Tab') {
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), iframe, [tabindex="0"]')).filter(item => item.getClientRects().length > 0);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || attachment) return;
    if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); move(index - 1); }
    if (event.key === 'ArrowRight' && index < assets.length - 1) { event.preventDefault(); move(index + 1); }
  }}>
    <header className="truth-dialog-header"><div><h2 id="truth-viewer-title">{asset.originalName}</h2><p>{index + 1} / {assets.length} · {imageLabels[asset.imageType || 'unknown']}</p></div><button className="truth-button" autoFocus onClick={onClose} aria-label="关闭原图查看器"><X size={20} /></button></header>
    <div className="truth-viewer-body"><section className="truth-image-section" aria-label="原始资料">
      <div className="truth-viewer-toolbar"><button className="truth-button" disabled={index === 0} onClick={() => move(index - 1)} aria-label="上一张"><ChevronLeft size={18} /></button><button className="truth-button" disabled={index === assets.length - 1} onClick={() => move(index + 1)} aria-label="下一张"><ChevronRight size={18} /></button><button className="truth-button" disabled={zoom <= 1 || !!attachment} onClick={() => setZoom(value => Math.max(1, value - .5))} aria-label="缩小原图"><ZoomOut size={18} /></button><span aria-live="polite">{Math.round(zoom * 100)}%</span><button className="truth-button" disabled={zoom >= 4 || !!attachment} onClick={() => setZoom(value => Math.min(4, value + .5))} aria-label="放大原图"><ZoomIn size={18} /></button><button className="truth-button" disabled={downloading} onClick={() => void download(asset.downloadUrl, asset.originalName)}><Download size={16} />{downloading ? '下载中…' : '下载原图'}</button></div>
      {error && <p className="truth-notice" role="alert">{error}</p>}
      {attachment ? <div className="truth-attachment-preview"><button className="truth-button" onClick={() => setAttachment(null)}>返回图片</button><AttachmentPreview attachment={attachment} /></div> : <div className="truth-zoom-scroll" tabIndex={0} aria-label="原图，放大后可滚动查看"><div style={{ width: `${zoom * 100}%`, minHeight: '100%' }}><AuthImage key={asset.id} src={asset.originalUrl} alt={`${asset.originalName} 原图`} className="truth-original" /></div></div>}
    </section><aside className="truth-viewer-details"><h3>实验记录</h3><AssetMetadata asset={asset} /><h3 className="truth-section-title">关联附件</h3>{asset.attachments?.length ? asset.attachments.map(item => <div className="truth-attachment" key={item.id}><p>{item.fileName || item.originalName}</p><div className="truth-actions"><button className="truth-button" onClick={() => setAttachment(item)}>查看 PDF</button><button className="truth-button" disabled={downloading} onClick={() => void download(item.downloadUrl, item.fileName || item.originalName || '实验记录.pdf')}>下载</button></div></div>) : <p className="truth-muted">暂无关联附件</p>}</aside></div>
  </dialog>, document.body);
}
