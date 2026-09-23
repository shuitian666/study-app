import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { downloadTruthFile, fetchTruthReport, fetchTruthReports, truthPdfUrl } from '@/services/truthService';
import type { TruthAsset, TruthReport } from '@/types';
import TruthViewer from './TruthViewer';

export default function TruthReports({ initialReport, onViewed }: { initialReport?: TruthReport | null; onViewed: () => void }) {
  const [reports, setReports] = useState<TruthReport[] | null>(null);
  const [report, setReport] = useState<TruthReport | null>(initialReport || null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchTruthReports(controller.signal).then(result => { setReports(result.reports); setError(''); }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '报告列表加载失败'); });
    return () => { controller.abort(); request.current?.abort(); };
  }, [attempt]);
  const open = async (id: string) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setError('');
    try { const result = await fetchTruthReport(id, controller.signal); if (!controller.signal.aborted) setReport(result.report); }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '报告读取失败'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const download = async () => {
    if (!report) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setError('');
    try { await downloadTruthFile(truthPdfUrl(report.id), `${report.title}.pdf`, controller.signal); }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '报告下载失败'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const sources: TruthAsset[] = (report?.assets || []).map(asset => ({ ...asset,
    status: 'archived', updatedAt: report?.createdAt || '', archivedAt: null, mimeType: 'image/jpeg', sizeBytes: 0,
    previewUrl: `/api/truth/assets/${asset.id}/preview`, originalUrl: `/api/truth/assets/${asset.id}/original`, downloadUrl: `/api/truth/assets/${asset.id}/download`,
  }));
  return <section className="truth-reports" aria-label="我的报告"><div className="truth-section-heading"><div><h2>{report ? report.title : '我的报告'}</h2><p className="truth-muted">依据已确认实验记录整理，保留生成时的资料版本。</p></div>{report && <button className="truth-button" onClick={() => { setReport(null); onViewed(); }}><ArrowLeft size={16} />报告列表</button>}</div>
    {error && <div className="truth-notice" role="alert">{error}<button className="truth-button" onClick={() => setAttempt(value => value + 1)}>重新加载</button></div>}
    {busy && <p role="status">正在处理报告…</p>}
    {report ? <article className="truth-report-detail"><div className="truth-section-heading"><p className="truth-muted">{new Date(report.createdAt).toLocaleString('zh-CN')} · {report.assets.length} 张资料</p><button className="truth-button truth-primary" disabled={busy} onClick={() => void download()}><Download size={16} />下载 PDF</button></div><div className="truth-report-content">{report.content}</div><h3 className="truth-section-title">本报告使用的资料</h3>{report.assets.map((asset,index) => <div key={asset.id} className="truth-report-source"><strong>{asset.originalName}</strong><span>{asset.batchCode} · {asset.animalId || '编号未记录'} · {asset.version ? `v${asset.version}` : '历史版本'}</span><button className="truth-button" onClick={() => setViewIndex(index)}>查看引用原图与记录</button></div>)}</article> : !reports ? !error && <p role="status">正在读取报告…</p> : reports.length ? <div className="truth-report-list">{reports.map(item => <button key={item.id} className="truth-report-row" disabled={busy} onClick={() => void open(item.id)}><FileText size={23} /><span><strong>{item.title}</strong><small>{new Date(item.createdAt).toLocaleString('zh-CN')} · {item.assetCount ?? item.assets?.length ?? 0} 张资料</small></span><span>查看</span></button>)}</div> : <div className="truth-empty"><FileText size={32} /><h3>还没有资料报告</h3><p>在图库勾选图片后生成，报告会保存在这里。</p></div>}
  {viewIndex !== null && <TruthViewer assets={sources} initialIndex={viewIndex} onClose={() => setViewIndex(null)} />}</section>;
}
