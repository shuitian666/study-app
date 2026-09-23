import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AuthImage from '@/features/truth/AuthImage';
import { AttachmentPreview, AssetMetadata } from '@/features/truth/TruthViewer';
import { apiFetch, API_BASE } from '@/services/aiClient';
import { Archive, CheckCircle2, Edit3, ImagePlus, Loader2, RefreshCw, UploadCloud, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/Common';
import {
  archiveTruthAsset,
  fetchTruthStatus,
  publishTruthAsset,
  submitTruthAsset,
  updateTruthAsset,
  uploadTruthAssets,
} from '@/services/truthService';
import { useUser } from '@/store/UserContext';
import type { TruthAsset, TruthPhase, TruthSex, TruthTimeUnit } from '@/types';

interface CommonForm {
  batchCode: string;
  species: string;
  strain: string;
  sex: TruthSex;
  drugName: string;
  drugAliases: string;
  doseValue: string;
  doseUnit: string;
  administrationRoute: string;
  phase: TruthPhase;
  timeValue: string;
  timeUnit: TruthTimeUnit;
  bodyPart: string;
  observation: string;
  tags: string;
  groupName: string;
  captureStage: 'before' | 'after' | 'unknown';
  imageType: 'thermal' | 'visible' | 'unknown';
  captureId: string;
}

interface FileEntry {
  file: File;
  previewUrl: string;
  animalId: string;
  phase: TruthPhase;
  timeValue: string;
  timeUnit: TruthTimeUnit;
}

const initialForm: CommonForm = {
  batchCode: '',
  species: '未记录',
  strain: '',
  sex: 'unknown',
  drugName: '',
  drugAliases: '',
  doseValue: '',
  doseUnit: '',
  administrationRoute: '',
  phase: 'unknown',
  timeValue: '',
  timeUnit: 'day',
  bodyPart: '',
  observation: '',
  tags: '',
  groupName: '',
  captureStage: 'unknown',
  imageType: 'unknown',
  captureId: '',
};

function phaseText(phase: TruthPhase) {
  if (phase === 'dosing') return '给药中';
  if (phase === 'withdrawal') return '停药后';
  return phase === 'control' ? '对照' : '未记录';
}

function statusText(status: TruthAsset['status']) {
  return { draft: '草稿', pending: '待发布', published: '已发布', archived: '已归档' }[status];
}

export default function TruthAdminPage() {
  const { userState } = useUser();
  return <TruthAdminContent key={userState.user?.id || 'guest'} />;
}

function TruthAdminContent() {
  const { navigate } = useUser();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [form, setForm] = useState<CommonForm>(initialForm);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [assets, setAssets] = useState<TruthAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<TruthAsset | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ asset: TruthAsset; next: 'published' | 'archived' } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const editDialog = useRef<HTMLDialogElement>(null);
  const actionDialog = useRef<HTMLDialogElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  const canUpload = useMemo(
    () => files.length > 0 && form.batchCode.trim() && form.species.trim()
      && (['control', 'unknown'].includes(form.phase) || (form.timeValue !== '' && Number(form.timeValue) >= 0)),
    [files.length, form.batchCode, form.phase, form.species, form.timeValue],
  );
  const canPublish = permissions.includes('truth.assets.publish');
  const canArchive = permissions.includes('truth.assets.archive');
  const canSubmit = permissions.includes('truth.assets.submit');

  const loadAssets = useCallback(async (offset = 0) => {
    setLoadingAssets(true);
    try {
      const response = await apiFetch(`${API_BASE}/truth/assets?limit=49&offset=${offset}`);
      if (!response.ok) throw new Error('图片列表加载失败，请检查登录状态后重试');
      const data = await response.json() as { assets: TruthAsset[] };
      setAssets(data.assets.slice(0, 48).map(asset => ({ ...asset, previewUrl: /^https?:/.test(API_BASE) ? new URL(asset.previewUrl, API_BASE).toString() : asset.previewUrl })));
      setHasMore(data.assets.length > 48);
      setPageOffset(offset);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '图片列表加载失败');
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    fetchTruthStatus()
      .then(status => {
        const nextPermissions = status.permissions ?? [];
        const hasContentAccess = nextPermissions.includes('truth.assets.edit') || nextPermissions.includes('truth.assets.upload');
        setPermissions(nextPermissions);
        setAuthorized(status.enabled && hasContentAccess);
        if (status.enabled && hasContentAccess) void loadAssets();
      })
      .catch(() => setAuthorized(false));
  }, [loadAssets]);

  useEffect(() => () => {
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => { if (editing) editDialog.current?.showModal(); }, [editing]);
  useEffect(() => { if (pendingAction) actionDialog.current?.showModal(); }, [pendingAction]);

  const selectFiles = (selected: File[]) => {
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    const entries = selected.slice(0, 100).map(file => ({
        file,
        previewUrl: URL.createObjectURL(file),
        animalId: '',
        phase: form.phase,
        timeValue: form.timeValue,
        timeUnit: form.timeUnit,
      }));
    previewUrlsRef.current = entries.map(entry => entry.previewUrl);
    setFiles(entries);
    setMessage('');
    setError('');
  };

  const updateFileEntry = (index: number, patch: Partial<FileEntry>) => {
    setFiles(current => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, ...patch } : entry));
  };

  const upload = async () => {
    if (!canUpload || uploading) return;
    setUploading(true);
    setMessage('');
    setError('');
    try {
      const response = await uploadTruthAssets(
        files.map(entry => entry.file),
        {
          common: {
            ...form,
            drugAliases: form.drugAliases.split(/[,，;；]/).map(value => value.trim()).filter(Boolean),
            tags: form.tags.split(/[,，;；]/).map(value => value.trim()).filter(Boolean),
            timeValue: form.timeValue === '' ? null : Number(form.timeValue),
            status: 'draft',
          },
          items: files.map(entry => ({
            animalId: entry.animalId,
            phase: entry.phase,
            timeValue: entry.timeValue === '' ? null : Number(entry.timeValue),
            timeUnit: entry.timeValue === '' ? null : entry.timeUnit,
          })),
        },
      );
      const summary = `已创建 ${response.created.length} 张草稿；重复 ${response.duplicates.length} 张；失败 ${response.failed.length} 张。`;
      const failures = response.failed.map(item => `${item.fileName}: ${item.error}`).join('；');
      if (response.failed.length > 0) {
        setError(response.failed.map(item => `${item.fileName}: ${item.error}`).join('；'));
      }
      selectFiles([]);
      setMessage(summary);
      setError(failures);
      await loadAssets(0);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const changeStatus = async (asset: TruthAsset, next: 'pending' | 'published' | 'archived') => {
    if (actionBusy) return;
    setActionBusy(true);
    setError('');
    try {
      const response = next === 'pending'
        ? await submitTruthAsset(asset.id)
        : next === 'published'
          ? await publishTruthAsset(asset.id)
          : await archiveTruthAsset(asset.id);
      setAssets(current => current.map(item => item.id === response.asset.id ? response.asset : item));
      setPendingAction(null);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : '状态更新失败');
    } finally {
      setActionBusy(false);
    }
  };

  const attachPdf = async (asset: TruthAsset, selected: File[]) => {
    if (!selected.length || actionBusy) return;
    setActionBusy(true);
    setError('');
    try {
      const body = new FormData();
      selected.forEach(file => body.append('attachments', file));
      const response = await apiFetch(`${API_BASE}/truth/assets/${asset.id}/attachments`, { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '附件上传失败');
      setMessage(`PDF 已保存，发布后用户可见。新增 ${result.created.length}，重复 ${result.duplicates.length}。`);
      if (result.failed.length) setError(result.failed.map((item: { fileName: string; error: string }) => `${item.fileName}: ${item.error}`).join('；'));
      await loadAssets(pageOffset);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '附件上传失败'); }
    finally { setActionBusy(false); }
  };

  const saveEdit = async () => {
    if (!editing || savingEdit) return;
    setSavingEdit(true);
    setError('');
    try {
      const response = await updateTruthAsset(editing.id, editing);
      setAssets(current => current.map(item => item.id === response.asset.id ? response.asset : item));
      setEditing(null);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : '保存失败');
    } finally {
      setSavingEdit(false);
    }
  };

  if (authorized === null) {
    return <div className="flex min-h-full items-center justify-center"><Loader2 className="animate-spin text-cyan-700" /></div>;
  }

  if (!authorized) {
    return (
      <div className="min-h-full bg-slate-50">
        <PageHeader title="求真图片库" onBack={() => navigate('ai-chat')} />
        <div className="p-6 text-center text-sm text-slate-600">当前账号没有图片库管理权限，或求真模式尚未启用。</div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <PageHeader title="求真图片库" onBack={() => navigate('ai-chat')} />
      <main className="mx-auto max-w-6xl space-y-5 p-4 pb-24">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <ImagePlus size={20} className="text-cyan-700" />
            <div>
              <h2 className="font-bold text-slate-950">批量上传实验图片</h2>
              <p className="text-xs text-slate-500">上传后先保存为草稿，核对标签后再发布。</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 min-[900px]:grid-cols-3">
            <label className="text-xs font-semibold text-slate-700">实验批次*
              <input value={form.batchCode} onChange={event => setForm({ ...form, batchCode: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-700">药物名称
              <input value={form.drugName} onChange={event => setForm({ ...form, drugName: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="例如：大黄" />
            </label>
            <label className="text-xs font-semibold text-slate-700">药物别名
              <input value={form.drugAliases} onChange={event => setForm({ ...form, drugAliases: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="逗号分隔" />
            </label>
            <label className="text-xs font-semibold text-slate-700">实验分组
              <input value={form.groupName} onChange={event => setForm({ ...form, groupName: event.target.value })} className="ai-input" placeholder="空白组 / 处理组 / 未记录" />
            </label>
            <label className="text-xs font-semibold text-slate-700">实验前后
              <select value={form.captureStage} onChange={event => setForm({ ...form, captureStage: event.target.value as CommonForm['captureStage'] })} className="ai-input"><option value="unknown">未记录</option><option value="before">实验前</option><option value="after">实验后</option></select>
            </label>
            <label className="text-xs font-semibold text-slate-700">图片类型
              <select value={form.imageType} onChange={event => setForm({ ...form, imageType: event.target.value as CommonForm['imageType'] })} className="ai-input"><option value="unknown">未记录</option><option value="thermal">热成像</option><option value="visible">可见光</option></select>
            </label>
            <label className="text-xs font-semibold text-slate-700">采集记录编号（选填）
              <input value={form.captureId} onChange={event => setForm({ ...form, captureId: event.target.value })} className="ai-input" placeholder="仅同次采集的图片填写相同编号" />
            </label>
            <label className="text-xs font-semibold text-slate-700">物种*
              <input value={form.species} onChange={event => setForm({ ...form, species: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-700">品系
              <input value={form.strain} onChange={event => setForm({ ...form, strain: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-700">性别
              <select value={form.sex} onChange={event => setForm({ ...form, sex: event.target.value as TruthSex })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="female">雌性</option>
                <option value="male">雄性</option>
                <option value="unknown">未知</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">实验阶段
              <select value={form.phase} onChange={event => setForm({ ...form, phase: event.target.value as TruthPhase })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="dosing">给药中</option>
                <option value="withdrawal">停药后</option>
                <option value="control">对照（历史阶段）</option><option value="unknown">未记录</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">公共时间点
              <div className="mt-1 flex gap-2">
                <input type="number" min="0" step="0.5" value={form.timeValue} onChange={event => setForm({ ...form, timeValue: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" />
                <select value={form.timeUnit} onChange={event => setForm({ ...form, timeUnit: event.target.value as TruthTimeUnit })} className="rounded-lg border border-slate-200 px-2 text-sm disabled:bg-slate-100">
                  <option value="day">天</option>
                  <option value="hour">小时</option>
                </select>
              </div>
            </label>
            <label className="text-xs font-semibold text-slate-700">给药方式
              <input value={form.administrationRoute} onChange={event => setForm({ ...form, administrationRoute: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-700">剂量
              <div className="mt-1 flex gap-2">
                <input value={form.doseValue} onChange={event => setForm({ ...form, doseValue: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input value={form.doseUnit} onChange={event => setForm({ ...form, doseUnit: event.target.value })} className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="mg/kg" />
              </div>
            </label>
            <label className="text-xs font-semibold text-slate-700">拍摄部位
              <input value={form.bodyPart} onChange={event => setForm({ ...form, bodyPart: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-700">补充标签
              <input value={form.tags} onChange={event => setForm({ ...form, tags: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="逗号分隔" />
            </label>
          </div>
          <label className="mt-3 block text-xs font-semibold text-slate-700">人工观察
            <textarea value={form.observation} onChange={event => setForm({ ...form, observation: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>

          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cyan-200 bg-cyan-50 px-4 py-5 text-sm font-bold text-cyan-800">
            <UploadCloud size={20} />
            选择 JPG/PNG（最多100张，每张20MB）
            <input type="file" accept="image/jpeg,image/png" multiple className="sr-only" onChange={event => selectFiles(Array.from(event.target.files || []))} />
          </label>

          {files.length > 0 && (
            <div className="mt-4 space-y-3">
              {files.map((entry, index) => (
                <article key={`${entry.file.name}-${entry.file.lastModified}`} className="grid grid-cols-[72px_1fr] gap-3 rounded-xl border border-slate-200 p-3 min-[900px]:grid-cols-[84px_1fr_150px_160px]">
                  <img src={entry.previewUrl} alt="" className="h-16 w-16 rounded-lg bg-slate-100 object-contain min-[900px]:h-20 min-[900px]:w-20" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">{entry.file.name}</p>
                    <label className="mt-2 block text-[11px] text-slate-600">动物编号
                      <input value={entry.animalId} onChange={event => updateFileEntry(index, { animalId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                    </label>
                  </div>
                  <label className="text-[11px] text-slate-600">阶段
                    <select value={entry.phase} onChange={event => updateFileEntry(index, { phase: event.target.value as TruthPhase })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                      <option value="dosing">给药中</option>
                      <option value="withdrawal">停药后</option>
                      <option value="control">对照（历史阶段）</option><option value="unknown">未记录</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-slate-600">时间点
                    <div className="mt-1 flex gap-1">
                      <input type="number" min="0" value={entry.timeValue} onChange={event => updateFileEntry(index, { timeValue: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-100" />
                      <select value={entry.timeUnit} onChange={event => updateFileEntry(index, { timeUnit: event.target.value as TruthTimeUnit })} className="rounded-lg border border-slate-200 px-1 text-xs disabled:bg-slate-100">
                        <option value="day">天</option>
                        <option value="hour">时</option>
                      </select>
                    </div>
                  </label>
                </article>
              ))}
              <button type="button" onClick={upload} disabled={!canUpload || uploading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
                {uploading ? <Loader2 size={17} className="animate-spin" /> : <UploadCloud size={17} />}
                上传为草稿
              </button>
            </div>
          )}
          {message && <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p>}
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-950">图片记录</h2>
              <p className="text-xs text-slate-500">只有“已发布”图片会进入求真检索。</p>
            </div>
            <button type="button" onClick={() => void loadAssets(pageOffset)} className="rounded-lg p-2 text-slate-600" aria-label="刷新图片列表">
              <RefreshCw size={18} className={loadingAssets ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {assets.map(asset => (
              <article key={asset.id} className="grid grid-cols-[100px_1fr] gap-3 rounded-xl border border-slate-200 p-3">
                <AuthImage src={asset.previewUrl} alt={`${asset.drugName || '热成像'} ${asset.animalId || ''}`} className="h-24 w-24 rounded-lg bg-slate-100 object-contain" />
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{asset.drugName || '未记录药物'} · {phaseText(asset.phase)}</p>
                      <p className="text-xs text-slate-500">{asset.batchCode} · {asset.animalId || '无动物编号'}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{statusText(asset.status)}</span>
                  </div>
                  {(asset.pendingRevision || !!asset.pendingAttachments?.length) && <p className="mt-2 text-xs font-semibold text-amber-800">有待审核修改，当前公开版本仍为 v{asset.version ?? 1}</p>}
                  <p className="mt-2 text-[11px] text-slate-600">
                    {asset.sex === 'female' ? '雌性' : asset.sex === 'male' ? '雄性' : '未知'}
                    {asset.timeValue !== null && ` · ${asset.timeValue}${asset.timeUnit === 'hour' ? '小时' : '天'}`}
                  </p>
              <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setEditing({ ...asset, ...asset.pendingRevision })} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700"><Edit3 size={12} />编辑</button>
                    {canSubmit && (asset.status === 'draft' || (asset.pendingRevision && asset.revisionStatus !== 'pending')) && (
                      <button type="button" onClick={() => void changeStatus(asset, 'pending')} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700"><CheckCircle2 size={12} />提交审核</button>
                    )}
                    {canPublish && (asset.status !== 'published' || asset.pendingRevision || asset.pendingAttachments?.length) && asset.status !== 'archived' && (
                      <button type="button" onClick={() => setPendingAction({ asset, next: 'published' })} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700"><CheckCircle2 size={12} />发布</button>
                    )}
                    {canArchive && asset.status !== 'archived' && (
                      <button type="button" onClick={() => setPendingAction({ asset, next: 'archived' })} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700"><Archive size={12} />归档</button>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{asset.groupName || '分组未记录'} · PDF {asset.attachments?.length ?? 0} 份{asset.pendingAttachments?.length ? `，待发布 ${asset.pendingAttachments.length} 份` : ''}</p>
                  <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center text-xs font-semibold text-cyan-800">添加 PDF 附件
                    <input aria-label={`为 ${asset.animalId || asset.id} 添加 PDF`} disabled={actionBusy} type="file" accept="application/pdf" multiple className="ml-2 max-w-40 text-xs" onChange={event => { void attachPdf(asset, Array.from(event.target.files || [])); event.target.value = ''; }} />
                  </label>
                </div>
              </article>
            ))}
          </div>
          {!loadingAssets && assets.length === 0 && <p className="py-8 text-center text-sm text-slate-500">还没有上传图片。</p>}
          <nav aria-label="管理图库分页" className="mt-4 flex items-center justify-between gap-3"><button className="ai-action" disabled={pageOffset === 0 || loadingAssets} onClick={() => void loadAssets(Math.max(0, pageOffset - 48))}>上一页</button><span className="text-xs">第 {Math.floor(pageOffset / 48) + 1} 页</span><button className="ai-action" disabled={!hasMore || loadingAssets} onClick={() => void loadAssets(pageOffset + 48)}>下一页</button></nav>
        </section>
      </main>

      {editing && (
        <dialog ref={editDialog} onCancel={() => setEditing(null)} onClose={() => setEditing(null)} className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-24px)] max-w-lg rounded-2xl p-0 backdrop:bg-black/40" aria-label="编辑图片标签">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-950">编辑图片标签</h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-2 text-slate-500" aria-label="关闭编辑"><X size={18} /></button>
            </div>
            {editing.status === 'published' && <p className="mt-3 text-sm text-amber-800">保存后形成待审核修改。管理员发布前，用户仍看到当前公开版本。</p>}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-700">实验分组<input className="ai-input" value={editing.groupName || ''} onChange={event => setEditing({ ...editing, groupName: event.target.value || null })} /></label>
              <label className="text-xs font-semibold text-slate-700">实验前后<select className="ai-input" value={editing.captureStage || 'unknown'} onChange={event => setEditing({ ...editing, captureStage: event.target.value as CommonForm['captureStage'] })}><option value="unknown">未记录</option><option value="before">实验前</option><option value="after">实验后</option></select></label>
              <label className="text-xs font-semibold text-slate-700">图片类型<select className="ai-input" value={editing.imageType || 'unknown'} onChange={event => setEditing({ ...editing, imageType: event.target.value as CommonForm['imageType'] })}><option value="unknown">未记录</option><option value="thermal">热成像</option><option value="visible">可见光</option></select></label>
              <label className="text-xs font-semibold text-slate-700">时间单位<select className="ai-input" value={editing.timeUnit || 'day'} onChange={event => setEditing({ ...editing, timeUnit: event.target.value as TruthTimeUnit })}><option value="day">天</option><option value="hour">小时</option></select></label>
              <label className="text-xs font-semibold text-slate-700">实验批次<input value={editing.batchCode} onChange={event => setEditing({ ...editing, batchCode: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold text-slate-700">动物编号<input value={editing.animalId || ''} onChange={event => setEditing({ ...editing, animalId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold text-slate-700">药物<input value={editing.drugName || ''} onChange={event => setEditing({ ...editing, drugName: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold text-slate-700">性别<select value={editing.sex} onChange={event => setEditing({ ...editing, sex: event.target.value as TruthSex })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="female">雌性</option><option value="male">雄性</option><option value="unknown">未知</option></select></label>
              <label className="text-xs font-semibold text-slate-700">阶段<select value={editing.phase} onChange={event => setEditing({ ...editing, phase: event.target.value as TruthPhase })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="dosing">给药中</option><option value="withdrawal">停药后</option><option value="control">对照（历史阶段）</option><option value="unknown">未记录</option></select></label>
              <label className="text-xs font-semibold text-slate-700">时间<input type="number" min="0" value={editing.timeValue ?? ''} onChange={event => setEditing({ ...editing, timeValue: event.target.value === '' ? null : Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" /></label>
            </div>
            {(editing.sourcePath || editing.captureId) && <p className="mt-3 break-all text-xs text-slate-500">来源：{editing.sourcePath || '未记录'} · 采集：{editing.captureId || '未记录'}</p>}
            {!!editing.pendingAttachments?.length && <details className="mt-3"><summary className="cursor-pointer py-2 text-sm font-semibold">查看待发布 PDF（{editing.pendingAttachments.length}）</summary>{editing.pendingAttachments.map(attachment => <div key={attachment.id} className="mt-2"><p className="text-xs">{attachment.originalName || attachment.fileName}</p><AttachmentPreview attachment={attachment} /></div>)}</details>}
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            <label className="mt-3 block text-xs font-semibold text-slate-700">人工观察<textarea rows={4} value={editing.observation || ''} onChange={event => setEditing({ ...editing, observation: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <button type="button" onClick={() => void saveEdit()} disabled={savingEdit} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              {savingEdit && <Loader2 size={16} className="animate-spin" />}
              保存标签
            </button>
          </div>
        </dialog>
      )}
      {pendingAction && <dialog ref={actionDialog} onCancel={() => { if (!actionBusy) setPendingAction(null); }} className="fixed inset-0 m-auto w-[calc(100%-24px)] max-w-md rounded-2xl p-5 backdrop:bg-black/40" aria-label="确认资料状态变更">
        <h3 className="font-bold">{pendingAction.next === 'published' ? '确认发布资料' : '确认归档资料'}</h3>
        <p className="mt-3 text-sm text-slate-600">{pendingAction.next === 'published' ? '发布后所有登录用户都能查看。本次待审核信息和附件将成为新的公开版本。' : '归档后资料不再出现在图库检索中，已有报告仍保留引用。'}</p>
        <p className="mt-2 text-sm">{pendingAction.asset.batchCode} · {pendingAction.asset.animalId || pendingAction.asset.originalName}</p>
        <details className="mt-3 max-h-80 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs"><summary className="cursor-pointer font-bold">核对本次发布内容</summary><AssetMetadata asset={{ ...pendingAction.asset, ...pendingAction.asset.pendingRevision }} />{pendingAction.asset.pendingAttachments?.map(attachment => <div key={attachment.id}><p>{attachment.originalName || attachment.fileName}</p><AttachmentPreview attachment={attachment} /></div>)}</details>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2"><button className="ai-action" disabled={actionBusy} onClick={() => setPendingAction(null)}>取消</button><button className="ai-action bg-primary text-white" disabled={actionBusy} onClick={() => void changeStatus(pendingAction.asset, pendingAction.next)}>{actionBusy ? '处理中…' : '确认'}</button></div>
      </dialog>}
    </div>
  );
}
