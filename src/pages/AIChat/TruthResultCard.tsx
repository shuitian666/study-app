import { useMemo, useState } from 'react';
import { CheckSquare, Download, FileText, ImageOff, Loader2, Square } from 'lucide-react';
import { createTruthReport, truthPdfUrl } from '@/services/truthService';
import type { TruthAsset, TruthPhase, TruthReport, TruthSearchResult } from '@/types';

interface TruthResultCardProps {
  result: TruthSearchResult;
  onClarify: (phase: TruthPhase) => void;
}

function phaseLabel(asset: TruthAsset) {
  if (asset.phase === 'dosing') return '给药阶段';
  if (asset.phase === 'withdrawal') return '停药后';
  return '对照组';
}

function timeLabel(asset: TruthAsset) {
  if (asset.timeValue === null || !asset.timeUnit) return '';
  return `${asset.timeValue}${asset.timeUnit === 'hour' ? '小时' : '天'}`;
}

export default function TruthResultCard({ result, onClarify }: TruthResultCardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(result.assets.map(asset => asset.id));
  const [report, setReport] = useState<TruthReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  if (result.clarification) {
    return (
      <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3" aria-label="检索条件确认">
        <p className="text-sm font-semibold text-amber-900">{result.clarification.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {result.clarification.options.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => onClarify(option.value)}
              className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-800 shadow-sm ring-1 ring-amber-200"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (result.assets.length === 0) {
    const values = result.availableValues;
    return (
      <section className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <ImageOff size={17} />
          没有完全匹配的图片
        </div>
        <p className="mt-2 text-xs leading-5">系统没有返回近似图片。请修改药物、实验阶段、时间点或性别后重新检索。</p>
        {values && (
          <p className="mt-2 text-xs text-slate-500">
            当前可用药物：{values.drugNames.join('、') || '暂无'}；批次：{values.batchCodes.join('、') || '暂无'}
          </p>
        )}
      </section>
    );
  }

  const toggleAsset = (id: string) => {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const generateReport = async () => {
    if (selectedIds.length === 0 || reportLoading) return;
    setReportLoading(true);
    setReportError('');
    try {
      const response = await createTruthReport({
        assetIds: selectedIds,
        queryText: result.query,
        filter: result.filter,
      });
      setReport(response.report);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : '报告生成失败');
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <section className="mt-3 space-y-3" aria-label={`完全匹配图片，共${result.total}张`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-emerald-700">完全匹配 {result.total} 张</p>
        <button
          type="button"
          onClick={generateReport}
          disabled={selectedIds.length === 0 || reportLoading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          {reportLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          生成报告 ({selectedIds.length})
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {result.assets.map(asset => {
          const selected = selectedSet.has(asset.id);
          return (
            <article key={asset.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => toggleAsset(asset.id)}
                className="relative block w-full text-left"
                aria-pressed={selected}
                aria-label={`${selected ? '取消选择' : '选择'}图片 ${asset.animalId || asset.id}`}
              >
                <img
                  src={asset.previewUrl}
                  alt={`${asset.drugName || '热成像'} ${phaseLabel(asset)} ${timeLabel(asset)} ${asset.animalId || ''}`}
                  className="aspect-[4/3] w-full bg-slate-100 object-contain"
                  loading="lazy"
                />
                <span className="absolute right-2 top-2 rounded-md bg-white/90 p-1 text-emerald-700 shadow">
                  {selected ? <CheckSquare size={18} /> : <Square size={18} />}
                </span>
              </button>
              <div className="space-y-1 p-3">
                <p className="text-xs font-bold text-slate-900">{asset.drugName || '未记录药物'} · {phaseLabel(asset)} {timeLabel(asset)}</p>
                <p className="text-[11px] text-slate-500">
                  批次 {asset.batchCode} · {asset.animalId || '未记录动物编号'} · {asset.sex === 'female' ? '雌性' : asset.sex === 'male' ? '雄性' : '性别未知'}
                </p>
                {asset.observation && <p className="text-[11px] leading-4 text-slate-600">人工观察：{asset.observation}</p>}
                <a
                  href={asset.downloadUrl}
                  className="inline-flex items-center gap-1 pt-1 text-[11px] font-bold text-blue-600"
                >
                  <Download size={12} />
                  下载原图
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {reportError && <p className="text-xs font-semibold text-red-600">{reportError}</p>}
      {report && (
        <article className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-violet-950">{report.title}</h4>
            <a
              href={truthPdfUrl(report.id)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-violet-700 shadow-sm"
            >
              <Download size={13} />
              PDF
            </a>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-violet-950">{report.content}</p>
        </article>
      )}
    </section>
  );
}
