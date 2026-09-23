import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, FileText, Images, Search, SlidersHorizontal, Upload, X } from 'lucide-react';
import { createTruthReport, fetchTruthLibrary, TruthRequestError } from '@/services/truthService';
import { useUser } from '@/store/UserContext';
import type { TruthAsset, TruthReport, TruthSearchFilter, TruthSearchResult } from '@/types';
import AuthImage from './AuthImage';
import TruthViewer, { AssetMetadata } from './TruthViewer';
import TruthReports from './TruthReports';
import { captureLabels, conditionLabel, filterLabels, imageLabels, phaseLabels, sexLabels, timeLabel } from './labels';
import './styles.css';

const PAGE_SIZE = 24;
type Tab = 'gallery' | 'compare' | 'reports';
interface Props { onClose?: () => void }
interface QueryState { query: string; filter: TruthSearchFilter; offset: number; revision: number }

function Filters({ value, values, onChange, onSubmit, onClear }: { value: TruthSearchFilter; values?: TruthSearchResult['availableValues']; onChange: (filter: TruthSearchFilter) => void; onSubmit: (event: FormEvent) => void; onClear: () => void }) {
  const update = (field: keyof TruthSearchFilter, next: string | number) => onChange({ ...value, [field]: next === '' ? null : next });
  const select = (field: keyof TruthSearchFilter, entries: string[], labels?: Record<string, string>) => <label className="truth-field" key={field}><span>{filterLabels[field]}</span><select value={String(value[field] ?? '')} onChange={event => update(field, event.target.value)}><option value="">全部</option>{[...new Set([...entries, ...(value[field] ? [String(value[field])] : [])])].map(option => <option value={option} key={option}>{labels?.[option] || option}</option>)}</select></label>;
  return <form onSubmit={onSubmit} className="truth-filter-form"><div className="truth-section-heading"><h2>筛选资料</h2><button type="button" className="truth-text-button" onClick={onClear}>清空</button></div>
    {select('drugName', values?.drugNames || [])}{select('batchCode', values?.batchCodes || [])}
    <label className="truth-field"><span>动物编号</span><input value={value.animalId || ''} list="truth-animal-ids" placeholder="完整编号" onChange={event => update('animalId', event.target.value)} /><datalist id="truth-animal-ids">{values?.animalIds?.map(id => <option key={id} value={id} />)}</datalist></label>
    {select('groupName', values?.groupNames || [])}{select('sex', ['female', 'male', 'unknown'], sexLabels)}{select('phase', ['control', 'dosing', 'withdrawal', 'unknown'], phaseLabels)}
    <div className="truth-time-fields"><label className="truth-field"><span>观察时间</span><input type="number" min="0" step="any" value={value.timeValue ?? ''} placeholder="未限定" onChange={event => update('timeValue', event.target.value === '' ? '' : Number(event.target.value))} /></label><label className="truth-field"><span>时间单位</span><select value={value.timeUnit || ''} onChange={event => update('timeUnit', event.target.value)}><option value="">全部</option><option value="day">天</option><option value="hour">小时</option></select></label></div>
    {select('captureStage', ['before', 'after', 'unknown'], captureLabels)}{select('imageType', ['thermal', 'visible', 'unknown'], imageLabels)}{select('bodyPart', values?.bodyParts || [])}
    <details><summary>更多实验条件</summary>{select('species', values?.species || [])}{select('strain', values?.strains || [])}</details>
    <button className="truth-button truth-primary" type="submit">应用筛选</button>
  </form>;
}

function Comparison({ assets, onView, onRemove }: { assets: TruthAsset[]; onView: (assets: TruthAsset[], index: number) => void; onRemove: (id: string) => void }) {
  const [mobileIndex, setMobileIndex] = useState(0);
  const first = assets[0];
  const sameAnimal = !!first?.batchCode && !!first.groupName && !!first.animalId && first.sex !== 'unknown' && assets.every(asset => asset.batchCode === first.batchCode && asset.groupName === first.groupName && asset.sex === first.sex && asset.animalId === first.animalId);
  const comparableTime = sameAnimal && assets.every(asset => asset.timeValue != null && asset.timeUnit && asset.phase !== 'unknown');
  const ordered = comparableTime ? [...assets].sort((a, b) => {
    const phaseOrder = { control: 0, dosing: 1, withdrawal: 2, unknown: 3 };
    const stageOrder = { before: 0, after: 1, unknown: 2 };
    return phaseOrder[a.phase] - phaseOrder[b.phase] || Number(a.timeValue) * (a.timeUnit === 'day' ? 24 : 1) - Number(b.timeValue) * (b.timeUnit === 'day' ? 24 : 1) || stageOrder[a.captureStage || 'unknown'] - stageOrder[b.captureStage || 'unknown'];
  }) : assets;
  const visibleIndex = Math.min(mobileIndex, ordered.length - 1);
  if (assets.length < 2) return <div className="truth-empty"><Images size={32} /><h2>选择 2–4 张图片开始对照</h2><p>在图库勾选需要比较的资料，图片与实验条件会在这里并排展示。</p></div>;
  return <section aria-label="实验对照"><div className="truth-section-heading"><div><h2>{sameAnimal ? '同一动物的资料对照' : '所选实验资料对照'}</h2><p className="truth-muted">{comparableTime ? '已按阶段和观察时间排列；仅展示已选择的记录。' : '按选择顺序展示，请结合下方条件判断可比性。'}</p></div></div>
    <div className="truth-notice">{!sameAnimal ? '资料身份不同或批次、分组、性别、编号未记录，未自动串联为同一动物。' : !comparableTime ? '部分观察时间或阶段未记录，无法确定时间序列。' : '未选择或未记录的时间点不在此序列中；请核对实验设计，当前资料不能保证覆盖全部时间点。'} 热成像颜色及标注请以原图为准。</div>
    <div className="truth-mobile-compare-nav" aria-label="选择对照图片">{ordered.map((asset, i) => <button className={`truth-button ${visibleIndex === i ? 'truth-primary' : ''}`} key={asset.id} aria-pressed={visibleIndex === i} onClick={() => setMobileIndex(i)}>图片 {i + 1}</button>)}</div>
    <div className="truth-comparison-grid" style={{ gridTemplateColumns: `repeat(${ordered.length}, minmax(0, 1fr))` }}>{ordered.map((asset, index) => <article className={`truth-compare-card ${index === visibleIndex ? 'truth-mobile-active' : ''}`} key={asset.id}><div className="truth-section-heading"><h3>图片 {index + 1}</h3><button className="truth-button" onClick={() => onRemove(asset.id)} aria-label={`移除 ${asset.originalName}`}><X size={16} /></button></div><AuthImage src={asset.originalUrl} alt={asset.originalName} className="truth-compare-image" /><button className="truth-button" onClick={() => onView(ordered, index)}>放大查看</button><AssetMetadata asset={asset} /></article>)}</div>
  </section>;
}

export default function TruthWorkspace(props: Props) {
  const { userState, navigate } = useUser();
  if (!userState.user) return <section className="truth-workspace"><div className="truth-empty"><h1>登录后查看求真图库</h1><p>所有登录用户都可浏览已发布的实验资料。</p><button className="truth-button truth-primary" onClick={() => navigate('login')}>登录</button></div></section>;
  return <WorkspaceContent key={userState.user.id} {...props} />;
}

function WorkspaceContent({ onClose }: Props) {
  const { userState, navigate } = useUser();
  const [tab, setTab] = useState<Tab>('gallery');
  const [queryDraft, setQueryDraft] = useState('');
  const [filterDraft, setFilterDraft] = useState<TruthSearchFilter>({});
  const [request, setRequest] = useState<QueryState>({ query: '', filter: {}, offset: 0, revision: 0 });
  const [resultState, setResultState] = useState<{ request: QueryState; result?: TruthSearchResult; error?: Error } | null>(null);
  const [selected, setSelected] = useState<TruthAsset[]>([]);
  const [viewer, setViewer] = useState<{ assets: TruthAsset[]; index: number } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [reportTitle, setReportTitle] = useState('实验资料求真报告');
  const [report, setReport] = useState<TruthReport | null>(null);
  const [creatingReport, setCreatingReport] = useState(false);
  const [reportError, setReportError] = useState('');
  const reportAbort = useRef<AbortController | null>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const filterRef = useRef<HTMLElement>(null);
  const toggleFilterRef = useRef<HTMLButtonElement>(null);
  const current = resultState?.request === request ? resultState : null;
  const result = current?.result;
  const loading = !current;
  const error = current?.error;
  const selectedIds = new Set(selected.map(asset => asset.id));
  useEffect(() => {
    const controller = new AbortController();
    fetchTruthLibrary({ ...request, limit: PAGE_SIZE }, controller.signal).then(value => {
      if (!controller.signal.aborted) setResultState({ request, result: value });
    }).catch(e => {
      if (!controller.signal.aborted) { console.warn('求真图库检索失败'); setResultState({ request, error: e instanceof Error ? e : new Error('图库读取失败') }); }
    });
    return () => controller.abort();
  }, [request]);
  useEffect(() => () => { reportAbort.current?.abort(); }, []);
  useEffect(() => { workspaceRef.current?.scrollTo({ top: 0 }); }, [tab, request.offset]);
  useEffect(() => { if (filtersOpen) filterRef.current?.querySelector<HTMLElement>('button, input, select')?.focus(); }, [filtersOpen]);
  const apply = (event?: FormEvent) => {
    event?.preventDefault(); setRequest({ query: queryDraft, filter: filterDraft, offset: 0, revision: request.revision + 1 }); setFiltersOpen(false); setNotice('');
  };
  const clear = () => { setQueryDraft(''); setFilterDraft({}); setRequest({ query: '', filter: {}, offset: 0, revision: request.revision + 1 }); setNotice(''); };
  const toggle = (asset: TruthAsset) => {
    setNotice('');
    if (selectedIds.has(asset.id)) setSelected(items => items.filter(item => item.id !== asset.id));
    else if (selected.length < 4) setSelected(items => [...items, asset]);
    else setNotice('最多选择 4 张图片，请先取消一张。');
  };
  const generate = async () => {
    if (!selected.length || creatingReport) return;
    const controller = new AbortController(); reportAbort.current = controller; setCreatingReport(true); setReportError('');
    try {
      const response = await createTruthReport({ assetIds: selected.map(asset => asset.id), assetVersions: Object.fromEntries(selected.map(asset => [asset.id, asset.version || 1])), title: reportTitle.trim() || '实验资料求真报告', queryText: request.query, filter: result?.filter || request.filter }, controller.signal);
      if (!controller.signal.aborted) { setReport(response.report); setTab('reports'); }
    } catch (e) { if (!controller.signal.aborted) setReportError(e instanceof Error ? e.message : '报告生成失败，请重试'); }
    finally { if (!controller.signal.aborted) setCreatingReport(false); }
  };
  return <main ref={workspaceRef} className="truth-workspace"><div className="truth-container">
    <header className="truth-header"><div className="truth-heading-row"><button className="truth-button" onClick={onClose || (() => navigate('ai-chat'))}><ArrowLeft size={18} /><span>AI 中心</span></button><div><h1>求真</h1><p>可信实验图库 · 查阅、对照与记录</p></div></div>{userState.user?.permissions?.includes('truth.assets.upload') && <button className="truth-button" onClick={() => navigate('truth-admin')}><Upload size={17} /><span>管理图库</span></button>}</header>
    <nav className="truth-tabs" aria-label="求真功能">{([{ id: 'gallery', label: '图库', icon: Images }, { id: 'compare', label: `对照${selected.length ? ` · ${selected.length}` : ''}`, icon: SlidersHorizontal }, { id: 'reports', label: '我的报告', icon: FileText }] as const).map(item => <button className={tab === item.id ? 'active' : ''} aria-current={tab === item.id ? 'page' : undefined} key={item.id} onClick={() => setTab(item.id)}><item.icon size={18} />{item.label}</button>)}</nav>
    {tab === 'gallery' && <><form className="truth-search" onSubmit={apply}><label className="truth-search-input"><Search size={19} /><input aria-label="描述需要查找的实验图片" value={queryDraft} onChange={event => setQueryDraft(event.target.value)} placeholder="例如：防风，给药第三天，雌性，实验前" /></label><button className="truth-button truth-primary" type="submit">查找图片</button><button ref={toggleFilterRef} className="truth-button truth-filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls="truth-filters" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={18} />筛选</button></form>
      <div className="truth-library-layout"><aside id="truth-filters" ref={filterRef} className={`truth-filter-sidebar ${filtersOpen ? 'is-open' : ''}`} onKeyDown={event => { if (event.key === 'Escape') { setFiltersOpen(false); toggleFilterRef.current?.focus(); } }}><Filters value={filterDraft} values={resultState?.result?.availableValues} onChange={setFilterDraft} onSubmit={apply} onClear={clear} /></aside>
      <section className="truth-gallery" aria-label="已发布图库" aria-busy={loading}><div className="truth-section-heading"><div><h2>已发布图库 {result && <span className="truth-count">{result.total} 张</span>}</h2><p className="truth-muted">管理员发布的原始资料，所有登录用户均可查阅。</p></div><span className="truth-muted">每页 {PAGE_SIZE} 张</span></div>
        {!!result && <div className="truth-applied" aria-label="实际检索条件">{Object.entries(result.filter).filter(([,value]) => value !== null && value !== undefined && value !== '').length ? Object.entries(result.filter).filter(([,value]) => value !== null && value !== undefined && value !== '').map(([key,value]) => <span className="truth-chip" key={key}>{filterLabels[key as keyof TruthSearchFilter] || key}：{conditionLabel(key,value as string | number)}</span>) : <span className="truth-chip">全部已发布资料</span>}</div>}
        {!!result?.unrecognized?.length && <div className="truth-notice" role="status">以下内容尚未确认为筛选条件：{result.unrecognized.join('、')}。请在筛选中补充确认；当前结果仅依据上方条件。</div>}
        {result?.warnings?.map((warning,index) => <p className="truth-notice" key={index}>{warning}</p>)}
        {result?.clarification && <div className="truth-notice"><p>{result.clarification.message}</p><div className="truth-actions">{result.clarification.options.map(option => <button className="truth-button" key={option.value} onClick={() => { const filter = { ...request.filter, phase: option.value }; setFilterDraft(filter); setRequest({ ...request, filter, offset: 0 }); }}>{option.label}</button>)}</div></div>}
        {loading && <div className="truth-empty" role="status">正在加载实验资料…</div>}
        {error && <div className="truth-empty" role="alert"><h3>图库暂时无法读取</h3><p>{error.message}</p><button className="truth-button" onClick={() => error instanceof TruthRequestError && error.status === 401 ? navigate('login') : setRequest({ ...request, revision: request.revision + 1 })}>{error instanceof TruthRequestError && error.status === 401 ? '重新登录' : '重新加载'}</button></div>}
        {result && !result.clarification && !result.assets.length && <div className="truth-empty"><Search size={32} /><h3>没有找到符合当前条件的图片</h3><p>筛选条件已保留。可调整批次、分组和时间，或浏览全部资料。</p><button className="truth-button" onClick={clear}>查看全部已发布资料</button></div>}
        {!!result?.assets.length && <><div className="truth-gallery-grid">{result.assets.map((asset,index) => <article className={`truth-asset-card ${selectedIds.has(asset.id) ? 'is-selected' : ''}`} key={asset.id}><div className="truth-thumbnail"><AuthImage src={asset.previewUrl} alt={`${asset.drugName || '实验资料'} ${asset.originalName}`} /><span className="truth-image-type">{imageLabels[asset.imageType || 'unknown']}</span></div><div className="truth-card-info"><h3>{asset.drugName || '药物未记录'} · {asset.groupName || '分组未记录'}</h3><p>{phaseLabels[asset.phase]} · {timeLabel(asset)} · {captureLabels[asset.captureStage || 'unknown']}</p><p>{asset.batchCode || '批次未记录'} · {asset.animalId || '编号未记录'} · {sexLabels[asset.sex]}</p><div className="truth-card-actions"><button className="truth-button" onClick={() => setViewer({ assets: result.assets, index })}>查看原图</button><button className={`truth-button ${selectedIds.has(asset.id) ? 'truth-selected' : ''}`} aria-pressed={selectedIds.has(asset.id)} aria-label={`${selectedIds.has(asset.id) ? '取消选择' : '选择'} ${asset.originalName}`} onClick={() => toggle(asset)}>{selectedIds.has(asset.id) && <Check size={16} />}{selectedIds.has(asset.id) ? '已选择' : '选择'}</button></div></div></article>)}</div>
          <div className="truth-pagination"><span>第 {request.offset + 1}–{Math.min(request.offset + result.assets.length, result.total)} 张，共 {result.total} 张</span><div className="truth-actions"><button className="truth-button" disabled={request.offset === 0} onClick={() => setRequest({ ...request, offset: Math.max(0, request.offset - PAGE_SIZE) })}><ChevronLeft size={16} />上一页</button><button className="truth-button" disabled={request.offset + PAGE_SIZE >= result.total} onClick={() => setRequest({ ...request, offset: request.offset + PAGE_SIZE })}>下一页<ChevronRight size={16} /></button></div></div></>}
      </section></div></>}
    {tab === 'compare' && <Comparison assets={selected} onView={(assets,index) => setViewer({ assets,index })} onRemove={id => setSelected(items => items.filter(item => item.id !== id))} />}
    {tab === 'reports' && <TruthReports key={report?.id || 'history'} initialReport={report} onViewed={() => setReport(null)} />}
    {notice && <p className="truth-notice" role="status">{notice}</p>}
    {reportError && <p className="truth-notice" role="alert">{reportError}</p>}
    {tab !== 'reports' && !!selected.length && <section className="truth-selection-bar" aria-label="已选择资料"><div><strong>已选 {selected.length} / 4 张</strong><p className="truth-muted">报告根据已确认记录整理。</p></div><div className="truth-actions"><button className="truth-button" disabled={creatingReport} onClick={() => setSelected([])}>清空选择</button><button className="truth-button" disabled={selected.length < 2} onClick={() => setTab('compare')}>对照查看</button></div><label className="truth-report-title"><span className="sr-only">报告标题</span><input aria-label="报告标题" value={reportTitle} maxLength={120} onChange={event => setReportTitle(event.target.value)} /></label><button className="truth-button truth-primary" disabled={creatingReport} onClick={() => void generate()}><FileText size={17} />{creatingReport ? '生成中…' : '生成资料报告'}</button></section>}
  </div>{viewer && <TruthViewer key={viewer.assets[viewer.index]?.id} assets={viewer.assets} initialIndex={viewer.index} onClose={() => setViewer(null)} />}</main>;
}
