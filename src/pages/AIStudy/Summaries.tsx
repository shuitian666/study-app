import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';
import type { AIStudySummary } from '@/types';
import { fetchAIStudySummaries } from '@/services/aiStudyService';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function AIStudySummariesPage() {
  const { navigate } = useUser();
  const { theme } = useTheme();
  const [summaries, setSummaries] = useState<AIStudySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchAIStudySummaries()
      .then(result => {
        if (!cancelled) setSummaries(result.summaries);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : '读取学习总结失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-scroll min-h-screen px-4 py-5" style={{ backgroundColor: theme.bg }}>
      <button onClick={() => navigate('ai-study')} className="mb-5 flex items-center gap-2 text-sm font-semibold" style={{ color: theme.textSecondary }}>
        <ArrowLeft size={18} /> 返回 AI 辅助学习
      </button>
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold" style={{ color: theme.textPrimary }}>学习总结</h1>
        <p className="mt-1 text-sm" style={{ color: theme.textSecondary }}>查看 AI 辅助学习的历史总结和下次建议。</p>
      </header>

      {loading && (
        <div className="flex items-center justify-center rounded-3xl border p-8" style={{ backgroundColor: theme.bgCard, borderColor: theme.border, color: theme.textSecondary }}>
          <Loader2 className="mr-2 animate-spin" size={18} /> 正在加载
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && summaries.length === 0 && (
        <div className="rounded-3xl border p-8 text-center" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          <BookOpen className="mx-auto mb-3" size={30} style={{ color: theme.textMuted }} />
          <div className="font-bold" style={{ color: theme.textPrimary }}>还没有学习总结</div>
          <p className="mt-2 text-sm" style={{ color: theme.textSecondary }}>完成一次 AI 辅助学习后，这里会保存总结和建议。</p>
        </div>
      )}

      <div className="space-y-3">
        {summaries.map(summary => (
          <article key={summary.id} className="rounded-3xl border p-5" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold" style={{ color: theme.textPrimary }}>{summary.subjectName}</h2>
                <p className="mt-1 text-xs" style={{ color: theme.textMuted }}>{formatDate(summary.createdAt)} · {summary.chapterNames.join('、')}</p>
              </div>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}>
                {summary.totalQuestions > 0 ? `${Math.round((summary.correctCount / summary.totalQuestions) * 100)}%` : '未练习'}
              </span>
            </div>
            <p className="text-sm leading-7" style={{ color: theme.textSecondary }}>{summary.summary}</p>
            <div className="mt-3 rounded-2xl p-3 text-sm leading-6" style={{ backgroundColor: theme.bg, color: theme.textSecondary }}>
              {summary.advice}
            </div>
            {summary.weakPoints.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.weakPoints.map(point => (
                  <span key={point} className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">{point}</span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
