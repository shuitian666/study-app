import { useState, useEffect } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { ProficiencyBadge } from '@/components/ui/Common';
import { PROFICIENCY_MAP } from '@/types';
import { ChevronRight } from 'lucide-react';
import { TopAppBar } from '@/components/layout';

export default function KnowledgeMapPage() {
  const { navigate } = useUser();
  const { learningState } = useLearning();
  const { theme } = useTheme();
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set(learningState.subjects.map(s => s.id)));
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // 动画效果 - 使用主界面动画设置
  const [animationEffect, setAnimationEffect] = useState(() => {
    const saved = localStorage.getItem('main-animation-effect');
    return saved || 'slide-up';
  });

  // 监听动画效果变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'main-animation-effect' && e.newValue) {
        setAnimationEffect(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 获取动画类名
  const getAnimationClass = (delay: number) => {
    const baseClass = `scroll-${animationEffect}`;
    const delayClass = `reveal-delay-${delay}`;
    return `${baseClass} ${delayClass}`;
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

  // Calculate subject-level proficiency summary
  const getSubjectStats = (subjectId: string) => {
    const kps = learningState.knowledgePoints.filter(k => k.subjectId === subjectId);
    const total = kps.length;
    if (total === 0) return { total: 0, mastered: 0, percent: 0 };
    const mastered = kps.filter(k => k.proficiency === 'master' || k.proficiency === 'normal').length;
    return { total, mastered, percent: Math.round((mastered / total) * 100) };
  };

  const uiStyle = theme.uiStyle || 'playful';

  if (uiStyle === 'scholar') {
    return (
      <div className="page-scroll pb-4" style={{ backgroundColor: theme.bg || '#f8f9fa' }}>
        <TopAppBar />

        {/* Page title */}
        <section className="px-5 pt-5 pb-2">
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ color: theme.textPrimary, fontFamily: 'Plus Jakarta Sans, Noto Sans SC, sans-serif' }}
          >
            知识图谱
          </h1>
          <p className="mt-1 text-sm" style={{ color: theme.textSecondary }}>
            看清知识结构和掌握进度
          </p>
        </section>

        {/* Legend */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-center gap-4 rounded-2xl px-4 py-3" style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 6px rgba(15,23,42,0.06)' }}>
            {(['none', 'rusty', 'normal', 'master'] as const).map(level => (
              <div key={level} className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: PROFICIENCY_MAP[level].color }} />
                <span className="text-[10px]" style={{ color: theme.onSurfaceVariant || '#454652' }}>{PROFICIENCY_MAP[level].label}</span>
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
                    {/* Mini progress ring */}
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
                          {/* Chapter Node */}
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

                          {/* Knowledge Points */}
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

  // ===== Playful 风格渲染 =====
  return (
    <div className="page-scroll pb-4">
      {/* 渐变头部背景 */}
      <div
        className="text-white px-6 pt-5 pb-8 rounded-b-3xl mb-4 overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">知识图谱</h2>
        </div>
        <p className="text-sm mt-1" style={{ color: '#ffffff' }}>可视化掌握知识进度</p>
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
