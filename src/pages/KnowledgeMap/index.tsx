import { useState, useMemo } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { ProficiencyBadge } from '@/components/ui/Common';
import { PROFICIENCY_MAP } from '@/types';
import { ChevronRight, Search } from 'lucide-react';
import { TopAppBar } from '@/components/layout';

// ===== 通用辅助类型和子组件 =====

const PROFICIENCY_ORDER = ['none', 'rusty', 'normal', 'master'] as const;

function getProficiencyBreakdown(kps: { proficiency: string }[]) {
  const counts = { none: 0, rusty: 0, normal: 0, master: 0 };
  for (const kp of kps) {
    if (kp.proficiency in counts) counts[kp.proficiency as keyof typeof counts]++;
  }
  return counts;
}

function StackedBar({ breakdown, total, height = 8 }: {
  breakdown: Record<'none' | 'rusty' | 'normal' | 'master', number>;
  total: number;
  height?: number;
}) {
  if (total === 0) {
    return (
      <div className="w-full rounded-full" style={{ height, backgroundColor: '#e5e7eb' }} />
    );
  }
  return (
    <div className="w-full rounded-full overflow-hidden flex" style={{ height }}>
      {PROFICIENCY_ORDER.map(level => {
        const pct = (breakdown[level] / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={level}
            style={{ width: `${pct}%`, backgroundColor: PROFICIENCY_MAP[level].color, minWidth: 2 }}
          />
        );
      })}
    </div>
  );
}

function NextReviewChip({ nextReviewAt, fsrsState }: { nextReviewAt: string | null; fsrsState?: string }) {
  if (!fsrsState || !nextReviewAt) return null;
  const now = new Date();
  const next = new Date(nextReviewAt);
  const diffHours = (next.getTime() - now.getTime()) / (1000 * 60 * 60);
  let text: string;
  let color: string;
  let bg: string;
  if (diffHours < -24) {
    text = `逾期${Math.floor(-diffHours / 24)}天`;
    color = '#ef4444'; bg = '#fef2f2';
  } else if (diffHours < 1) {
    text = '今天到期';
    color = '#f59e0b'; bg = '#fffbeb';
  } else if (diffHours < 24) {
    text = '今天';
    color = '#10b981'; bg = '#ecfdf5';
  } else {
    text = `${Math.ceil(diffHours / 24)}天后`;
    color = '#6b7280'; bg = '#f3f4f6';
  }
  return (
    <span
      className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none"
      style={{ color, backgroundColor: bg }}
    >
      {text}
    </span>
  );
}

export default function KnowledgeMapPage() {
  const { navigate } = useUser();
  const { learningState } = useLearning();
  const { theme } = useTheme();
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set(learningState.subjects.map(s => s.id)));
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // 获取动画类名（已移除动画效果设置，保留固定延迟类）
  const getAnimationClass = (delay: number) => {
    return `scroll-slide-up reveal-delay-${delay}`;
  };

  const toggleSubject = (id: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleChapter = (id: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Calculate subject-level proficiency summary (now includes breakdown)
  const getSubjectStats = (subjectId: string) => {
    const kps = learningState.knowledgePoints.filter(k => k.subjectId === subjectId);
    const total = kps.length;
    const breakdown = getProficiencyBreakdown(kps);
    const mastered = breakdown.normal + breakdown.master;
    return { total, mastered, percent: total > 0 ? Math.round((mastered / total) * 100) : 0, breakdown };
  };

  // 全局统计（overview card）
  const globalStats = useMemo(() => {
    const kps = learningState.knowledgePoints;
    const total = kps.length;
    const breakdown = getProficiencyBreakdown(kps);
    const mastered = breakdown.normal + breakdown.master;
    return { total, breakdown, mastered, percent: total > 0 ? Math.round((mastered / total) * 100) : 0 };
  }, [learningState.knowledgePoints]);

  // 搜索
  const [searchQuery, setSearchQuery] = useState('');
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return learningState.knowledgePoints
      .filter(kp => kp.name.toLowerCase().includes(q))
      .map(kp => ({
        kp,
        subject: learningState.subjects.find(s => s.id === kp.subjectId),
        chapter: learningState.chapters.find(c => c.id === kp.chapterId),
      }));
  }, [searchQuery, learningState.knowledgePoints, learningState.subjects, learningState.chapters]);

  const uiStyle = theme.uiStyle || 'playful';

  if (uiStyle === 'scholar') {
    return (
      <div className="page-scroll pb-6" style={{ backgroundColor: theme.bg }}>
        <TopAppBar />

        {/* Page title */}
        <section className="px-5 pt-5 pb-3">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: theme.textPrimary, fontFamily: 'Plus Jakarta Sans, Noto Sans SC, sans-serif' }}>
            知识图谱
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: theme.textSecondary }}>
            可视化学科知识结构与掌握进度
          </p>
        </section>

        {/* ====== 全局总览卡 ====== */}
        <section className="px-4 pb-4">
          <div
            className="rounded-2xl p-4 border"
            style={{ backgroundColor: theme.bgCard, borderColor: theme.border, boxShadow: '0 2px 12px rgba(15,23,42,0.07)' }}
          >
            {/* 顶行：已掌握数字 + 大进度环 */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs font-medium mb-0.5" style={{ color: theme.textSecondary }}>
                  已掌握（一般 + 熟练）
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold" style={{ color: theme.primary }}>
                    {globalStats.mastered}
                  </span>
                  <span className="text-sm" style={{ color: theme.textMuted }}>
                    / {globalStats.total} 个知识点
                  </span>
                </div>
              </div>
              {/* 大环形进度 */}
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke={theme.border} strokeWidth="5" />
                  <circle
                    cx="32" cy="32" r="26" fill="none"
                    stroke={theme.primary} strokeWidth="5"
                    strokeDasharray={`${globalStats.percent * 1.634} 163.4`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[15px] font-extrabold leading-none" style={{ color: theme.primary }}>
                    {globalStats.percent}%
                  </span>
                  <span className="text-[9px] mt-0.5" style={{ color: theme.textMuted }}>掌握率</span>
                </div>
              </div>
            </div>

            {/* 掌握度分布色条 */}
            <div className="text-[10px] mb-1.5 font-medium" style={{ color: theme.textMuted }}>掌握度分布</div>
            <StackedBar breakdown={globalStats.breakdown} total={globalStats.total} height={10} />

            {/* 四色图例（带数字） */}
            <div className="flex gap-4 mt-3 flex-wrap">
              {PROFICIENCY_ORDER.map(level => (
                <div key={level} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PROFICIENCY_MAP[level].color }} />
                  <span className="text-xs" style={{ color: theme.textSecondary }}>
                    {PROFICIENCY_MAP[level].label}
                    <span className="font-bold ml-1" style={{ color: theme.textPrimary }}>
                      {globalStats.breakdown[level]}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== 搜索框 ====== */}
        <section className="px-4 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: theme.textMuted }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索知识点名称..."
              className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm border outline-none transition-colors"
              style={{
                backgroundColor: theme.bgCard,
                borderColor: searchQuery ? theme.primary : theme.border,
                color: theme.textPrimary,
              }}
            />
          </div>
        </section>

        {/* ====== 搜索结果 / 科目树 ====== */}
        {searchResults ? (
          <section className="px-4">
            {searchResults.length === 0 ? (
              <div className="text-center py-10 text-sm" style={{ color: theme.textMuted }}>
                没有找到匹配的知识点
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-xs mb-2 px-1 font-medium" style={{ color: theme.textMuted }}>
                  找到 {searchResults.length} 个结果
                </div>
                {searchResults.map(({ kp, subject, chapter }) => (
                  <button
                    key={kp.id}
                    onClick={() => navigate('knowledge-detail', { id: kp.id })}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all active:opacity-70"
                    style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PROFICIENCY_MAP[kp.proficiency].color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: theme.textPrimary }}>{kp.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
                        {subject?.icon} {subject?.name} · {chapter?.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <NextReviewChip nextReviewAt={kp.nextReviewAt} fsrsState={kp.fsrsState} />
                      <ProficiencyBadge level={kp.proficiency} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          /* ====== 科目树结构 ====== */
          <section className="px-4 space-y-3">
            {learningState.subjects.map(subject => {
              const isExpanded = expandedSubjects.has(subject.id);
              const subjectStats = getSubjectStats(subject.id);
              const chapters = learningState.chapters
                .filter(c => c.subjectId === subject.id)
                .sort((a, b) => a.order - b.order);
              if (subjectStats.total === 0) return null;

              return (
                <div key={subject.id}>
                  {/* 科目卡片 */}
                  <button
                    onClick={() => toggleSubject(subject.id)}
                    className="w-full rounded-2xl p-4 border flex items-center gap-3 text-left"
                    style={{
                      backgroundColor: theme.bgCard,
                      borderColor: theme.border,
                      borderLeft: `4px solid ${subject.color}`,
                      boxShadow: '0 1px 8px rgba(15,23,42,0.06)',
                    }}
                  >
                    {/* 图标 */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: subject.color + '22' }}
                    >
                      {subject.icon}
                    </div>
                    {/* 名称 + 分布条 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-semibold text-sm" style={{ color: theme.textPrimary }}>
                          {subject.name}
                        </span>
                        <span className="text-xs tabular-nums shrink-0" style={{ color: theme.textMuted }}>
                          {subjectStats.mastered}/{subjectStats.total} 掌握
                        </span>
                      </div>
                      <StackedBar breakdown={subjectStats.breakdown} total={subjectStats.total} height={6} />
                    </div>
                    {/* 环形进度 + 展开箭头 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="relative w-10 h-10">
                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r="15" fill="none" stroke={theme.border} strokeWidth="3.5" />
                          <circle
                            cx="20" cy="20" r="15" fill="none"
                            stroke={subject.color} strokeWidth="3.5"
                            strokeDasharray={`${subjectStats.percent * 0.942} 94.2`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold" style={{ color: theme.textSecondary }}>
                          {subjectStats.percent}%
                        </span>
                      </div>
                      <ChevronRight
                        size={14}
                        style={{ color: theme.textMuted, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                      />
                    </div>
                  </button>

                  {/* 章节列表 */}
                  {isExpanded && (
                    <div className="ml-5 border-l-2 pl-3 mt-1.5 space-y-0.5" style={{ borderColor: subject.color + '55' }}>
                      {chapters.map(chapter => {
                        const isChExpanded = expandedChapters.has(chapter.id);
                        const chKPs = learningState.knowledgePoints.filter(k => k.chapterId === chapter.id);
                        const chBreakdown = getProficiencyBreakdown(chKPs);
                        const chMastered = chBreakdown.normal + chBreakdown.master;
                        const chPct = chKPs.length > 0 ? Math.round((chMastered / chKPs.length) * 100) : 0;
                        const chPendingReview = chKPs.filter(k => {
                          if (!k.nextReviewAt) return false;
                          return new Date(k.nextReviewAt) <= new Date();
                        }).length;

                        return (
                          <div key={chapter.id}>
                            {/* 章节行 */}
                            <button
                              onClick={() => toggleChapter(chapter.id)}
                              className="w-full flex items-start gap-2.5 py-3 px-2.5 rounded-xl transition-colors"
                              style={{ backgroundColor: isChExpanded ? `${theme.primary}09` : 'transparent' }}
                            >
                              <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: subject.color }} />
                              <div className="flex-1 min-w-0">
                                {/* 章节名 + 掌握数 */}
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <span className="text-sm font-medium" style={{ color: theme.textPrimary }}>
                                    {chapter.name}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {chPendingReview > 0 && (
                                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: '#f59e0b', backgroundColor: '#fffbeb' }}>
                                        {chPendingReview}待复
                                      </span>
                                    )}
                                    <span className="text-xs tabular-nums" style={{ color: theme.textMuted }}>
                                      {chMastered}/{chKPs.length}
                                    </span>
                                  </div>
                                </div>
                                {/* 章节进度条 */}
                                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: theme.border }}>
                                  <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{ width: `${chPct}%`, backgroundColor: subject.color }}
                                  />
                                </div>
                              </div>
                              <ChevronRight
                                size={12}
                                className="shrink-0 mt-1"
                                style={{ color: theme.textMuted, transform: isChExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                              />
                            </button>

                            {/* 知识点列表 */}
                            {isChExpanded && (
                              <div className="ml-4 border-l pl-3 space-y-0.5 mt-0.5 mb-2" style={{ borderColor: theme.border }}>
                                {chKPs.map(kp => (
                                  <button
                                    key={kp.id}
                                    onClick={() => navigate('knowledge-detail', { id: kp.id })}
                                    className="w-full flex items-center gap-2 py-2 px-2 rounded-xl text-left transition-colors active:opacity-70"
                                    style={{ backgroundColor: 'transparent' }}
                                  >
                                    <div
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{ backgroundColor: PROFICIENCY_MAP[kp.proficiency].color }}
                                    />
                                    <span className="flex-1 text-xs font-medium truncate" style={{ color: theme.textPrimary }}>
                                      {kp.name}
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <NextReviewChip nextReviewAt={kp.nextReviewAt} fsrsState={kp.fsrsState} />
                                      <ProficiencyBadge level={kp.proficiency} />
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </div>
    );
  }

  // ===== Playful 风格渲染 =====
  return (
    <div className="page-scroll pb-4">
      <div
        className="mx-4 mt-4 mb-4 rounded-2xl border px-5 py-5 shadow-sm"
        style={{
          backgroundColor: theme.bgCard,
          borderColor: theme.border,
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: theme.textPrimary }}>知识图谱</h2>
        </div>
        <p className="text-sm mt-1" style={{ color: theme.textSecondary }}>可视化掌握知识进度</p>
      </div>

      {/* Legend */}
      <div className={`px-4 pt-3 pb-2 ${getAnimationClass(1)}`}>
        <div className="rounded-xl p-3 border flex items-center justify-center gap-4" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          {(['none', 'rusty', 'normal', 'master'] as const).map(level => (
            <div key={level} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PROFICIENCY_MAP[level].color }} />
              <span className="text-[10px]" style={{ color: theme.textSecondary }}>{PROFICIENCY_MAP[level].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tree Structure */}
      <div className={`px-4 pt-2 ${getAnimationClass(2)}`}>
        {learningState.subjects.map(subject => {
          const isExpanded = expandedSubjects.has(subject.id);
          const subjectStats = getSubjectStats(subject.id);
          const chapters = learningState.chapters.filter(c => c.subjectId === subject.id);

          return (
            <div key={subject.id} className="mb-3">
              {/* Subject Node */}
              <button
                onClick={() => toggleSubject(subject.id)}
                className="w-full rounded-2xl p-4 border shadow-sm flex items-center justify-between"
                style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: subject.color + '30' }}
                  >
                    {subject.icon}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>{subject.name}</div>
                    <div className="text-xs" style={{ color: theme.textMuted }}>
                      {subjectStats.mastered}/{subjectStats.total} 已掌握
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-8 h-8">
                    <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                      <circle cx="16" cy="16" r="12" fill="none" stroke={theme.border} strokeWidth="3" />
                      <circle
                        cx="16" cy="16" r="12" fill="none"
                        stroke={subject.color}
                        strokeWidth="3"
                        strokeDasharray={`${subjectStats.percent * 0.754} 75.4`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ color: theme.textSecondary }}>
                      {subjectStats.percent}%
                    </span>
                  </div>
                  <ChevronRight size={14} style={{ color: theme.textMuted, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </div>
              </button>

              {/* Chapters */}
              {isExpanded && (
                <div className="ml-5 border-l-2 pl-4 mt-1" style={{ borderColor: theme.border }}>
                  {chapters.map(chapter => {
                    const isChapterExpanded = expandedChapters.has(chapter.id);
                    const chapterKPs = learningState.knowledgePoints.filter(k => k.chapterId === chapter.id);

                    return (
                      <div key={chapter.id} className="mb-2">
                        <button
                          onClick={() => toggleChapter(chapter.id)}
                          className="w-full flex items-center justify-between py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: theme.primary }} />
                            <span className="text-sm font-medium truncate" style={{ color: theme.textPrimary }}>{chapter.name}</span>
                            <span className="text-[10px] shrink-0" style={{ color: theme.textMuted }}>({chapterKPs.length})</span>
                          </div>
                          <ChevronRight size={12} className="shrink-0" style={{ color: theme.textMuted, transform: isChapterExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                        </button>

                        {isChapterExpanded && (
                          <div className="ml-4 border-l pl-3 space-y-1 mb-2" style={{ borderColor: theme.border }}>
                            {chapterKPs.map(kp => (
                              <button
                                key={kp.id}
                                onClick={() => navigate('knowledge-detail', { id: kp.id })}
                                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bgCard}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: PROFICIENCY_MAP[kp.proficiency].color }}
                                  />
                                  <span className="text-xs truncate" style={{ color: theme.textPrimary }}>{kp.name}</span>
                                </div>
                                <ProficiencyBadge level={kp.proficiency} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
