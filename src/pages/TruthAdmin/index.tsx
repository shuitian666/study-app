import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, CheckCircle2, Edit3, ImagePlus, Loader2, RefreshCw, UploadCloud, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/Common';
import {
  archiveTruthAsset,
  fetchTruthAssets,
  fetchTruthStatus,
  publishTruthAsset,
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
  species: '小鼠',
  strain: '',
  sex: 'female',
  drugName: '',
  drugAliases: '',
  doseValue: '',
  doseUnit: '',
  administrationRoute: '',
  phase: 'dosing',
  timeValue: '3',
  timeUnit: 'day',
  bodyPart: '',
  observation: '',
  tags: '',
};

function phaseText(phase: TruthPhase) {
  if (phase === 'dosing') return '给药中';
  if (phase === 'withdrawal') return '停药后';
  return '对照';
}

function statusText(status: TruthAsset['status']) {
  return { draft: '草稿', pending: '待发布', published: '已发布', archived: '已归档' }[status];
}

export default function TruthAdminPage() {
  const { navigate } = useUser();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [form, setForm] = useState<CommonForm>(initialForm);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [assets, setAssets] = useState<TruthAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<TruthAsset | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const previewUrlsRef = useRef<string[]>([]);

  const canUpload = useMemo(
    () => files.length > 0 && form.batchCode.trim() && form.species.trim()
      && (form.phase === 'control' || Number(form.timeValue) >= 0),
    [files.length, form.batchCode, form.phase, form.species, form.timeValue],
  );

  const loadAssets = async () => {
    setLoadingAssets(true);
    try {
      const response = await fetchTruthAssets();
      setAssets(response.assets);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '图片列表加载失败');
    } finally {
      setLoadingAssets(false);
    }
  };

  useEffect(() => {
    fetchTruthStatus()
      .then(status => {
        setAuthorized(status.enabled && status.isAdmin);
        if (status.enabled && status.isAdmin) void loadAssets();
      })
      .catch(() => setAuthorized(false));
  }, []);

  useEffect(() => () => {
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  const selectFiles = (selected: File[]) => {
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    const entries = selected.slice(0, 100).map(file => ({
        file,
        previewUrl: URL.createObjectURL(file),
        animalId: '',
        phase: form.phase,
        timeValue: form.phase === 'control' ? '' : form.timeValue,
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
            timeValue: form.phase === 'control' ? null : Number(form.timeValue),
            status: 'draft',
          },
          items: files.map(entry => ({
            animalId: entry.animalId,
            phase: entry.phase,
            timeValue: entry.phase === 'control' ? null : Number(entry.timeValue),
            timeUnit: entry.phase === 'control' ? null : entry.timeUnit,
          })),
        },
      );
      setMessage(`已创建 ${response.created.length} 张草稿；重复 ${response.duplicates.length} 张；失败 ${response.failed.length} 张。`);
      if (response.failed.length > 0) {
        setError(response.failed.map(item => `${item.fileName}: ${item.error}`).join('；'));
      }
      selectFiles([]);
      await loadAssets();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const changeStatus = async (asset: TruthAsset, next: 'published' | 'archived') => {
    setError('');
    try {
      const response = next === 'published'
        ? await publishTruthAsset(asset.id)
        : await archiveTruthAsset(asset.id);
      setAssets(current => current.map(item => item.id === response.asset.id ? response.asset : item));
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : '状态更新失败');
    }
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
              <h2 className="font-bold text-slate-950">批量上传热成像图</h2>
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
                <option value="control">对照</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">公共时间点
              <div className="mt-1 flex gap-2">
                <input type="number" min="0" step="0.5" disabled={form.phase === 'control'} value={form.timeValue} onChange={event => setForm({ ...form, timeValue: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" />
                <select disabled={form.phase === 'control'} value={form.timeUnit} onChange={event => setForm({ ...form, timeUnit: event.target.value as TruthTimeUnit })} className="rounded-lg border border-slate-200 px-2 text-sm disabled:bg-slate-100">
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
                      <option value="control">对照</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-slate-600">时间点
                    <div className="mt-1 flex gap-1">
                      <input type="number" min="0" disabled={entry.phase === 'control'} value={entry.timeValue} onChange={event => updateFileEntry(index, { timeValue: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-100" />
                      <select disabled={entry.phase === 'control'} value={entry.timeUnit} onChange={event => updateFileEntry(index, { timeUnit: event.target.value as TruthTimeUnit })} className="rounded-lg border border-slate-200 px-1 text-xs disabled:bg-slate-100">
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
          {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-950">图片记录</h2>
              <p className="text-xs text-slate-500">只有“已发布”图片会进入求真检索。</p>
            </div>
            <button type="button" onClick={() => void loadAssets()} className="rounded-lg p-2 text-slate-600" aria-label="刷新图片列表">
              <RefreshCw size={18} className={loadingAssets ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {assets.map(asset => (
              <article key={asset.id} className="grid grid-cols-[100px_1fr] gap-3 rounded-xl border border-slate-200 p-3">
                <img src={asset.previewUrl} alt={`${asset.drugName || '热成像'} ${asset.animalId || ''}`} className="h-24 w-24 rounded-lg bg-slate-100 object-contain" loading="lazy" />
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{asset.drugName || '未记录药物'} · {phaseText(asset.phase)}</p>
                      <p className="text-xs text-slate-500">{asset.batchCode} · {asset.animalId || '无动物编号'}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{statusText(asset.status)}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-600">
                    {asset.sex === 'female' ? '雌性' : asset.sex === 'male' ? '雄性' : '未知'}
                    {asset.timeValue !== null && ` · ${asset.timeValue}${asset.timeUnit === 'hour' ? '小时' : '天'}`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setEditing(asset)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700"><Edit3 size={12} />编辑</button>
                    {asset.status !== 'published' && asset.status !== 'archived' && (
                      <button type="button" onClick={() => void changeStatus(asset, 'published')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700"><CheckCircle2 size={12} />发布</button>
                    )}
                    {asset.status !== 'archived' && (
                      <button type="button" onClick={() => void changeStatus(asset, 'archived')} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700"><Archive size={12} />归档</button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!loadingAssets && assets.length === 0 && <p className="py-8 text-center text-sm text-slate-500">还没有上传图片。</p>}
        </section>
      </main>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="编辑图片标签">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-950">编辑图片标签</h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-2 text-slate-500" aria-label="关闭编辑"><X size={18} /></button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-700">实验批次<input value={editing.batchCode} onChange={event => setEditing({ ...editing, batchCode: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold text-slate-700">动物编号<input value={editing.animalId || ''} onChange={event => setEditing({ ...editing, animalId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold text-slate-700">药物<input value={editing.drugName || ''} onChange={event => setEditing({ ...editing, drugName: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold text-slate-700">性别<select value={editing.sex} onChange={event => setEditing({ ...editing, sex: event.target.value as TruthSex })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="female">雌性</option><option value="male">雄性</option><option value="unknown">未知</option></select></label>
              <label className="text-xs font-semibold text-slate-700">阶段<select value={editing.phase} onChange={event => setEditing({ ...editing, phase: event.target.value as TruthPhase })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="dosing">给药中</option><option value="withdrawal">停药后</option><option value="control">对照</option></select></label>
              <label className="text-xs font-semibold text-slate-700">时间<input type="number" min="0" disabled={editing.phase === 'control'} value={editing.timeValue ?? ''} onChange={event => setEditing({ ...editing, timeValue: event.target.value === '' ? null : Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" /></label>
            </div>
            <label className="mt-3 block text-xs font-semibold text-slate-700">人工观察<textarea rows={4} value={editing.observation || ''} onChange={event => setEditing({ ...editing, observation: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <button type="button" onClick={() => void saveEdit()} disabled={savingEdit} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              {savingEdit && <Loader2 size={16} className="animate-spin" />}
              保存标签
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
