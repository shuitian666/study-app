import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { PageHeader, ProficiencyBadge } from '@/components/ui/Common';
import { PROFICIENCY_MAP } from '@/types';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function KnowledgeMapPage() {
  const { state, navigate } = useApp();
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set(state.subjects.map(s => s.id)));
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

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
    const kps = state.knowledgePoints.filter(k => k.subjectId === subjectId);
    const total = kps.length;
    if (total === 0) return { total: 0, mastered: 0, percent: 0 };
    const mastered = kps.filter(k => k.proficiency === 'master' || k.proficiency === 'normal').length;
    return { total, mastered, percent: Math.round((mastered / total) * 100) };
  };

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="知识图谱" />

      {/* Legend */}
      <div className="px-4 pt-3 pb-2">
        <div className="bg-white rounded-xl p-3 border border-border flex items-center justify-center gap-4">
          {(['none', 'rusty', 'normal', 'master'] as const).map(level => (
            <div key={level} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PROFICIENCY_MAP[level].color }} />
              <span className="text-[10px] text-text-muted">{PROFICIENCY_MAP[level].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tree Structure */}
      <div className="px-4 pt-2">
        {state.subjects.map(subject => {
          const isExpanded = expandedSubjects.has(subject.id);
          const subjectStats = getSubjectStats(subject.id);
          const chapters = state.chapters.filter(c => c.subjectId === subject.id);

          return (
            <div key={subject.id} className="mb-3">
              {/* Subject Node */}
              <button
                onClick={() => toggleSubject(subject.id)}
                className="w-full bg-white rounded-2xl p-4 border border-border shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: subject.color + '20' }}
                  >
                    {subject.icon}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">{subject.name}</div>
                    <div className="text-xs text-text-muted">
                      {subjectStats.mastered}/{subjectStats.total} 已掌握
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Mini progress ring */}
                  <div className="relative w-8 h-8">
                    <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                      <circle cx="16" cy="16" r="12" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle
                        cx="16" cy="16" r="12" fill="none"
                        stroke={subject.color}
                        strokeWidth="3"
                        strokeDasharray={`${subjectStats.percent * 0.754} 75.4`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-text-secondary">
                      {subjectStats.percent}%
                    </span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                </div>
              </button>

              {/* Chapters */}
              {isExpanded && (
                <div className="ml-5 border-l-2 border-border pl-4 mt-1">
                  {chapters.map(chapter => {
                    const isChapterExpanded = expandedChapters.has(chapter.id);
                    const chapterKPs = state.knowledgePoints.filter(k => k.chapterId === chapter.id);

                    return (
                      <div key={chapter.id} className="mb-2">
                        {/* Chapter Node */}
                        <button
                          onClick={() => toggleChapter(chapter.id)}
                          className="w-full flex items-center justify-between py-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <span className="text-sm font-medium">{chapter.name}</span>
                            <span className="text-[10px] text-text-muted">({chapterKPs.length})</span>
                          </div>
                          {isChapterExpanded ? <ChevronDown size={12} className="text-text-muted" /> : <ChevronRight size={12} className="text-text-muted" />}
                        </button>

                        {/* Knowledge Points */}
                        {isChapterExpanded && (
                          <div className="ml-4 border-l border-border/50 pl-3 space-y-1 mb-2">
                            {chapterKPs.map(kp => (
                              <button
                                key={kp.id}
                                onClick={() => navigate('knowledge-detail', { id: kp.id })}
                                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: PROFICIENCY_MAP[kp.proficiency].color }}
                                  />
                                  <span className="text-xs">{kp.name}</span>
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
