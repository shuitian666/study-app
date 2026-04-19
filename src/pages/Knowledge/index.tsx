import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { Undo2, Redo2 } from 'lucide-react';
import { ProficiencyBadge, PageHeader, EmptyState } from '@/components/ui/Common';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { Plus, Search, ChevronRight, Filter, Sparkles, BookOpen, LayoutGrid, List, Upload, Trash2, Check, Cloud, History, X } from 'lucide-react';
import { TopAppBar, FloatingAIPanel } from '@/components/layout';
import CloudDownloadModal from '@/components/ui/CloudDownloadModal';

const sourceConfig = {
  manual: {
    label: '手动',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: BookOpen,
  },
  ai: {
    label: 'AI',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    icon: Sparkles,
  },
  import: {
    label: '导入',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    icon: BookOpen,
  },
};

function getImportDateKey(createdAt?: string) {
  if (!createdAt) {
    return '';
  }

  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) {
    return createdAt.slice(0, 10);
  }

  const year = createdDate.getFullYear();
  const month = String(createdDate.getMonth() + 1).padStart(2, '0');
  const day = String(createdDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatImportDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-');
  if (!year || !month || !day) {
    return dateKey;
  }

  return `${Number(month)} 月 ${Number(day)} 日`;
}

export default function KnowledgePage() {
  const { navigate } = useUser();
  const { learningState, learningDispatch, undo, redo, recordHistory, _canUndo, _canRedo } = useLearning();
  const { theme } = useTheme();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProf, setFilterProf] = useState<ProficiencyLevel | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'proficiency'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);

  const uiStyle = theme.uiStyle || 'playful';

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

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredKPs.map(kp => kp.id)));
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`确定删除选中的 ${selectedIds.size} 个知识点吗？`)) {
      selectedIds.forEach(id => {
        learningDispatch({ type: 'DELETE_KNOWLEDGE_POINT', payload: id });
      });
      setSelectedIds(new Set());
      setIsSelectMode(false);
    }
  };

  // 从云端导入知识库 - 打开弹窗
  const handleCloudImport = () => {
    setShowSortMenu(false);
    setShowCloudModal(true);
  };

  // 处理从云端弹窗导入的数据
  const handleCloudImportData = (newSubjects: any[], chapters: any[], knowledgePoints: any[], questions: any[]) => {
    // 构建导入数据 - 合并新subject和现有subject
    const existingSubjectIds = new Set(learningState.subjects.map(s => s.id));
    const mergedSubjects = [
      ...learningState.subjects,
      ...newSubjects.filter(s => !existingSubjectIds.has(s.id))
    ];

    const importData = {
      subjects: mergedSubjects,
      chapters,
      knowledgePoints,
      questions
    };

    // 更新状态
    learningDispatch({ type: 'SET_KNOWLEDGE_DATA', payload: importData });
  };

  const subjects = learningState.subjects;
  const allKPs = learningState.knowledgePoints;
  const importBatches = useMemo(() => {
    const batchMap = new Map<string, { knowledgeCount: number; kpIds: Set<string> }>();

    allKPs.forEach(kp => {
      if (kp.source !== 'import' || !kp.id.startsWith('kp-import-')) {
        return;
      }

      const dateKey = getImportDateKey(kp.createdAt);
      if (!dateKey) {
        return;
      }

      const existing = batchMap.get(dateKey) ?? { knowledgeCount: 0, kpIds: new Set<string>() };
      existing.knowledgeCount += 1;
      existing.kpIds.add(kp.id);
      batchMap.set(dateKey, existing);
    });

    return Array.from(batchMap.entries())
      .map(([dateKey, batch]) => ({
        dateKey,
        displayDate: formatImportDateLabel(dateKey),
        knowledgeCount: batch.knowledgeCount,
        questionCount: learningState.questions.filter(
          question => question.knowledgePointId && batch.kpIds.has(question.knowledgePointId)
        ).length,
      }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [allKPs, learningState.questions]);

  const handleDeleteImportBatch = (dateKey: string, knowledgeCount: number, displayDate: string) => {
    if (!confirm(`确定删除 ${displayDate} 导入的 ${knowledgeCount} 个知识点，以及它们关联的题目吗？`)) {
      return;
    }

    recordHistory();
    learningDispatch({ type: 'DELETE_IMPORT_BATCH', payload: { dateKey } });
  };

  const openImportHistory = () => {
    setShowSortMenu(false);
    setShowImportHistory(true);
  };

  const knowledgeFabMenuItems = useMemo(() => [
    {
      id: 'flashcard',
      label: '闪记',
      icon: Sparkles,
      onSelect: () => navigate('flashcard-learning'),
      accentColor: theme.primary,
      backgroundColor: theme.bgCard,
    },
    {
      id: 'local-import',
      label: '本地导入',
      icon: Upload,
      onSelect: () => navigate('import-knowledge'),
      accentColor: theme.primary,
      backgroundColor: theme.bgCard,
    },
    {
      id: 'cloud-import',
      label: '云端导入',
      icon: Cloud,
      onSelect: handleCloudImport,
      accentColor: theme.iconColors?.knowledgeMap || theme.primary,
      backgroundColor: theme.bgCard,
    },
    {
      id: 'import-history',
      label: '导入记录',
      icon: History,
      onSelect: openImportHistory,
      accentColor: theme.iconColors?.achievement || theme.primary,
      backgroundColor: theme.bgCard,
    },
  ], [navigate, theme]);

  const knowledgeFloatingPanel = (
    <FloatingAIPanel
      hidden={isSelectMode}
      ownerPage="knowledge"
      onPrimaryAction={() => navigate('add-knowledge')}
      menuItems={knowledgeFabMenuItems}
      primaryIcon={Plus}
      primaryTitle="添加知识点"
    />
  );

  const importHistoryModal = showImportHistory ? (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={() => setShowImportHistory(false)}
      />
      <div
        className="relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[78vh] overflow-hidden"
        style={{ backgroundColor: theme.bgCard, boxShadow: '0 24px 64px -28px rgba(15,23,42,0.42)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: theme.textPrimary }}>导入记录</h3>
            <p className="text-sm mt-1" style={{ color: theme.textMuted }}>按导入日期撤销本地导入，删除后可用撤销恢复。</p>
          </div>
          <button
            onClick={() => setShowImportHistory(false)}
            className="shrink-0 p-2 rounded-xl transition-colors"
            style={{ backgroundColor: theme.bg, color: theme.textMuted }}
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm" style={{ color: theme.textMuted }}>
            共 {importBatches.length} 条导入记录
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={!_canUndo}
              className="px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: _canUndo ? `${theme.primary}16` : theme.bg,
                color: _canUndo ? theme.primary : theme.textMuted,
              }}
            >
              撤销
            </button>
            <button
              onClick={redo}
              disabled={!_canRedo}
              className="px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: _canRedo ? `${theme.primary}16` : theme.bg,
                color: _canRedo ? theme.primary : theme.textMuted,
              }}
            >
              恢复
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-y-auto max-h-[52vh] pr-1">
          {importBatches.length === 0 ? (
            <div
              className="rounded-2xl px-5 py-10 text-center border"
              style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.textMuted }}
            >
              暂无可撤销的导入记录
            </div>
          ) : (
            <div className="space-y-3">
              {importBatches.map(batch => (
                <div
                  key={batch.dateKey}
                  className="rounded-2xl px-4 py-4 border"
                  style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold" style={{ color: theme.textPrimary }}>
                        {batch.displayDate}
                      </div>
                      <div className="text-xs mt-1" style={{ color: theme.textMuted }}>
                        {batch.dateKey}
                      </div>
                      <div className="text-sm mt-2" style={{ color: theme.textSecondary }}>
                        {batch.knowledgeCount} 个知识点{batch.questionCount > 0 ? ` · ${batch.questionCount} 道题目` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteImportBatch(batch.dateKey, batch.knowledgeCount, batch.displayDate)}
                      className="shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                      style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
                      title="删除这次导入"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const filteredKPs = useMemo(() => {
    return allKPs
      .filter(kp => {
        if (selectedSubject && kp.subjectId !== selectedSubject) return false;
        if (filterProf !== 'all' && kp.proficiency !== filterProf) return false;
        if (searchQuery && !kp.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'name') {
          cmp = a.name.localeCompare(b.name);
        } else if (sortBy === 'createdAt') {
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        } else if (sortBy === 'proficiency') {
          const profOrder = { none: 0, rusty: 1, normal: 2, master: 3 };
          cmp = profOrder[a.proficiency] - profOrder[b.proficiency];
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [allKPs, selectedSubject, filterProf, searchQuery, sortBy, sortOrder]);

  const grouped = filteredKPs.reduce<Record<string, typeof filteredKPs>>((acc, kp) => {
    const chapter = learningState.chapters.find(c => c.id === kp.chapterId);
    const key = chapter?.name ?? '未分类';
    if (!acc[key]) acc[key] = [];
    acc[key].push(kp);
    return acc;
  }, {});

  // ===== Scholar 风格渲染 =====
  if (uiStyle === 'scholar') {
    const masteredCount = allKPs.filter(kp => kp.proficiency === 'master' || kp.proficiency === 'normal').length;
    const reviewCount = allKPs.filter(kp => kp.proficiency === 'rusty' || kp.proficiency === 'none').length;

    // 熟练度标签配置
    const profBadgeConfig: Record<string, { label: string; color: string; bg: string }> = {
      master: { label: '已熟练', color: '#0d6e49', bg: '#dcfce7' },
      normal: { label: '掌握中', color: '#b45309', bg: '#fef3c7' },
      rusty:  { label: '需复习', color: '#c2410c', bg: '#ffedd5' },
      none:   { label: '未学习', color: '#757684', bg: '#f3f4f5' },
    };

    const recentKPs = [...filteredKPs]
      .sort((a, b) => new Date((b as any).updatedAt || (b as any).createdAt || 0).getTime() - new Date((a as any).updatedAt || (a as any).createdAt || 0).getTime())
      .slice(0, 12);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayLearnedKPs = recentKPs.filter(kp => {
      const ts = (kp as any).updatedAt || (kp as any).createdAt;
      if (!ts) return false;
      return new Date(ts).toISOString().slice(0, 10) === todayStr;
    });
    const recentDisplay = recentExpanded ? todayLearnedKPs : recentKPs.slice(0, 2);

    const tileBgs   = [theme.primaryFixed || '#dee0ff', theme.secondaryFixed || '#ffdfa0', '#e8f0fe', theme.tertiaryFixed || '#fdd6ff', '#e0f2fe', '#f0fdf4'];
    const tileTexts = [theme.primary || '#24389c', '#795900', '#1a56db', theme.tertiary || '#73008e', '#0369a1', '#166534'];

    return (
      <div className="page-scroll" style={{ backgroundColor: theme.bg || '#f8f9fa' }}>
        <TopAppBar />

        <div className="pt-5 pb-28 space-y-6">
          {/* Search Bar */}
          <div className="px-6">
            <div
              className="flex items-center gap-3 px-4 py-3 border"
              style={{
                backgroundColor: 'rgba(255,255,255,0.76)',
                borderRadius: '999px',
                borderColor: 'rgba(255,255,255,0.8)',
                boxShadow: '0 18px 34px -30px rgba(15,23,42,0.22)',
              }}
            >
              <Search size={18} style={{ color: theme.onSurfaceVariant || '#454652' }} className="shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索知识点..."
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: theme.onSurface || '#191c1d' }}
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {[
                { label: '总知识点', value: allKPs.length },
                { label: '已掌握', value: masteredCount },
                { label: '待巩固', value: reviewCount },
              ].map(item => (
                <div key={item.label} className="rounded-2xl px-3.5 py-3" style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff' }}>
                  <div className="text-[0.62rem] uppercase tracking-[0.16em]" style={{ color: theme.onSurfaceVariant || '#454652' }}>{item.label}</div>
                  <div className="mt-1 text-lg font-extrabold" style={{ color: theme.onSurface || '#191c1d' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Subject Category Tiles */}
          {learningState.subjects.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-6 mb-3">
                <h3 className="font-bold text-base" style={{ color: theme.onSurface || '#191c1d', fontFamily: '"Plus Jakarta Sans","Noto Sans SC",sans-serif' }}>
                  知识分类
                </h3>
                <button className="text-sm font-semibold" style={{ color: theme.primary || '#24389c' }} onClick={() => setSelectedSubject(null)}>
                  {selectedSubject ? '清除筛选' : '全部学科'}
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto px-6 pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
                {learningState.subjects.map((subject, idx) => {
                  const subjectKPCount = allKPs.filter(kp => kp.subjectId === subject.id).length;
                  const isSelected = selectedSubject === subject.id;
                  const bg = tileBgs[idx % tileBgs.length];
                  const tc = tileTexts[idx % tileTexts.length];
                  return (
                    <button
                      key={subject.id}
                      onClick={() => setSelectedSubject(isSelected ? null : subject.id)}
                      className="snap-start shrink-0 flex flex-col justify-between p-4 active:scale-[0.97] transition-all overflow-hidden"
                      style={{
                        width: '168px',
                        height: '118px',
                        backgroundColor: isSelected ? (theme.primary || '#24389c') : bg,
                        borderRadius: '1.25rem',
                      }}
                    >
                      <span className="text-2xl block leading-none">{subject.icon}</span>
                      <div className="text-left min-w-0">
                        <div className="font-bold text-sm truncate" style={{ color: isSelected ? '#ffffff' : (theme.onSurface || '#191c1d') }}>
                          {subject.name}
                        </div>
                        <div className="text-xs mt-0.5 truncate" style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : tc }}>
                          {subjectKPCount} 个知识点
                        </div>
                      </div>
                    </button>
                  );
                })}
                <button
                  onClick={() => navigate('add-knowledge')}
                  className="snap-start shrink-0 flex items-center justify-center"
                  style={{
                    width: '118px',
                    height: '118px',
                    borderRadius: '1.25rem',
                    backgroundColor: theme.surfaceContainerLowest || '#ffffff',
                    border: `2px dashed ${theme.outlineVariant || '#c5c5d4'}`,
                  }}
                >
                  <Plus size={24} style={{ color: theme.onSurfaceVariant || '#454652' }} />
                </button>
              </div>
            </div>
          )}

          {/* 最近学习 List */}
          <div className="px-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base" style={{ color: theme.onSurface || '#191c1d', fontFamily: '"Plus Jakarta Sans","Noto Sans SC",sans-serif' }}>
                {recentExpanded ? '今日学习过的' : (selectedSubject ? learningState.subjects.find(s => s.id === selectedSubject)?.name : '最近学习')}
              </h3>
              <button
                onClick={() => setRecentExpanded(prev => !prev)}
                className="text-sm font-semibold"
                style={{ color: theme.primary || '#24389c' }}
              >
                {recentExpanded ? '收起' : '展开'}
              </button>
            </div>

            {filteredKPs.length === 0 ? (
              <div className="p-10 rounded-2xl flex flex-col items-center" style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff' }}>
                <BookOpen size={36} style={{ color: theme.outlineVariant || '#c5c5d4' }} className="mb-3" />
                <p className="text-sm font-medium" style={{ color: theme.onSurfaceVariant || '#454652' }}>暂无知识点</p>
                <p className="text-xs mt-1 text-center" style={{ color: theme.outlineVariant || '#c5c5d4' }}>点按右下角悬浮球添加知识点</p>
              </div>
            ) : recentDisplay.length === 0 ? (
              <div className="p-8 rounded-2xl text-center" style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff', color: theme.onSurfaceVariant || '#454652' }}>
                {recentExpanded ? '今天还没有学习记录' : '暂无最近学习记录'}
              </div>
            ) : (
              <div className="space-y-3">
                {recentDisplay.map(kp => {
                  const subject = learningState.subjects.find(s => s.id === kp.subjectId);
                  const badge   = profBadgeConfig[kp.proficiency] || profBadgeConfig.none;
                  const subIdx  = learningState.subjects.findIndex(s => s.id === kp.subjectId);
                  const iconBg  = tileBgs[subIdx >= 0 ? subIdx % tileBgs.length : 0];
                  const timeAgo = (() => {
                    const ts = (kp as any).updatedAt || (kp as any).createdAt;
                    if (!ts) return '';
                    const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
                    if (days === 0) return '刚刚更新';
                    if (days === 1) return '1天前更新';
                    return `${days}天前更新`;
                  })();
                  return (
                    <button
                      key={kp.id}
                      onClick={() => navigate('knowledge-detail', { id: kp.id })}
                      className="w-full p-4 rounded-2xl flex items-start gap-4 text-left active:scale-[0.98] transition-transform"
                      style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff' }}
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: iconBg }}>
                        {subject?.icon || '📚'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-bold text-sm line-clamp-1" style={{ color: theme.onSurface || '#191c1d' }}>{kp.name}</span>
                          <span
                            className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: badge.bg, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                        </div>
                        {kp.explanation && (
                          <p className="text-xs line-clamp-1" style={{ color: theme.onSurfaceVariant || '#454652' }}>{kp.explanation}</p>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-xs" style={{ color: theme.outlineVariant || '#c5c5d4' }}>
                            {learningState.chapters.find(ch => ch.id === kp.chapterId)?.name || '未分类'}
                          </p>
                          {timeAgo && (
                            <p className="text-xs" style={{ color: theme.outlineVariant || '#c5c5d4' }}>{timeAgo}</p>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: theme.outlineVariant || '#c5c5d4' }} className="shrink-0 mt-1" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {knowledgeFloatingPanel}

        <CloudDownloadModal
          isOpen={showCloudModal}
          onClose={() => setShowCloudModal(false)}
          onImport={handleCloudImportData}
        />

        {importHistoryModal}
      </div>
    );
  }

  // ===== Playful 风格渲染 =====
  return (
    <div className="page-scroll pb-4">
      <PageHeader
        title={isSelectMode ? `已选择 ${selectedIds.size} 项` : "知识库"}
        onBack={isSelectMode ? toggleSelectMode : undefined}
        rightAction={
          isSelectMode ? (
            <div className="flex items-center gap-1">
              <button
                onClick={selectAll}
                className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                全选
              </button>
              <button
                onClick={deleteSelected}
                disabled={selectedIds.size === 0}
                className="p-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-30"
              >
                <Trash2 size={18} className="text-red-600" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={toggleSelectMode}
                className="p-1.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                title="批量选择"
              >
                <Check size={18} className="text-gray-600" />
              </button>
              <button
                onClick={undo}
                disabled={!_canUndo}
                className="p-1.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="撤销"
              >
                <Undo2 size={18} className="text-gray-600" />
              </button>
              <button
                onClick={redo}
                disabled={!_canRedo}
                className="p-1.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="恢复"
              >
                <Redo2 size={18} className="text-gray-600" />
              </button>
            </div>
          )
        }
      />

      {/* Search and Sort */}
      <div className={`px-4 pt-3 pb-2 ${getAnimationClass(1)}`}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索知识点..."
              className="w-full border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              style={{ backgroundColor: theme.bgCard, borderColor: theme.border, color: theme.textPrimary }}
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="h-full px-3 border rounded-xl flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
              style={{ backgroundColor: theme.bgCard, borderColor: theme.border, color: theme.textSecondary }}
            >
              <Filter size={14} />
              <span className="hidden sm:inline">排序</span>
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-1 rounded-xl shadow-lg py-1 z-10 min-w-[140px]"
                style={{ backgroundColor: theme.bgCard, borderColor: theme.border, border: `1px solid ${theme.border}` }}>
                <div className="px-3 py-1.5 text-xs" style={{ color: theme.textMuted }}>排序方式</div>
                <button
                  onClick={() => { setSortBy('name'); setShowSortMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:opacity-80 transition-opacity ${sortBy === 'name' ? 'font-medium' : ''}`}
                  style={{ color: sortBy === 'name' ? theme.primary : theme.textPrimary }}
                >
                  名称
                </button>
                <button
                  onClick={() => { setSortBy('createdAt'); setShowSortMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:opacity-80 transition-opacity ${sortBy === 'createdAt' ? 'font-medium' : ''}`}
                  style={{ color: sortBy === 'createdAt' ? theme.primary : theme.textPrimary }}
                >
                  导入时间
                </button>
                <button
                  onClick={() => { setSortBy('proficiency'); setShowSortMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:opacity-80 transition-opacity ${sortBy === 'proficiency' ? 'font-medium' : ''}`}
                  style={{ color: sortBy === 'proficiency' ? theme.primary : theme.textPrimary }}
                >
                  熟练程度
                </button>
                <div className="border-t my-1" style={{ borderColor: theme.border }} />
                <div className="px-3 py-1.5 text-xs" style={{ color: theme.textMuted }}>排序顺序</div>
                <button
                  onClick={() => setSortOrder('asc')}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:opacity-80 transition-opacity ${sortOrder === 'asc' ? 'font-medium' : ''}`}
                  style={{ color: sortOrder === 'asc' ? theme.primary : theme.textPrimary }}
                >
                  升序 ↑
                </button>
                <button
                  onClick={() => setSortOrder('desc')}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:opacity-80 transition-opacity ${sortOrder === 'desc' ? 'font-medium' : ''}`}
                  style={{ color: sortOrder === 'desc' ? theme.primary : theme.textPrimary }}
                >
                  降序 ↓
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subject Filter */}
      <div className={`px-4 pb-2 ${getAnimationClass(2)}`}>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedSubject(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedSubject === null ? 'text-white' : ''
            }`}
            style={{ 
              backgroundColor: selectedSubject === null ? theme.primary : theme.bgCard,
              color: selectedSubject === null ? '#ffffff' : theme.textSecondary
            }}
          >
            全部
          </button>

          {subjects.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSubject(s.id === selectedSubject ? null : s.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedSubject === s.id ? 'text-white' : ''
              }`}
              style={{ 
                backgroundColor: selectedSubject === s.id ? theme.primary : theme.bgCard,
                color: selectedSubject === s.id ? '#ffffff' : theme.textSecondary
              }}
            >
              {s.icon} {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Proficiency Filter */}
      <div className={`px-4 pb-3 flex items-center justify-between ${getAnimationClass(3)}`}>
        <div className="flex gap-1.5 items-center">
          <Filter size={12} style={{ color: theme.textMuted }} />
          {(['all', 'none', 'rusty', 'normal', 'master'] as const).map(level => (
            <button
              key={level}
              onClick={() => setFilterProf(level)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors`}
              style={filterProf === level
                ? level === 'all'
                  ? { backgroundColor: theme.textSecondary, color: '#ffffff' }
                  : { backgroundColor: PROFICIENCY_MAP[level].color, color: '#ffffff' }
                : { backgroundColor: theme.bgCard, color: theme.textMuted }
              }
            >
              {level === 'all' ? '全部' : PROFICIENCY_MAP[level].label}
            </button>
          ))}
        </div>
        
        {/* View mode toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors`}
            style={{ 
              backgroundColor: viewMode === 'list' ? `${theme.primary}20` : 'transparent',
              color: viewMode === 'list' ? theme.primary : theme.textMuted
            }}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors`}
            style={{ 
              backgroundColor: viewMode === 'grid' ? `${theme.primary}20` : 'transparent',
              color: viewMode === 'grid' ? theme.primary : theme.textMuted
            }}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`px-4 ${getAnimationClass(4)}`}>
        {Object.keys(grouped).length === 0 ? (
          <EmptyState 
            icon="📚" 
            title="暂无知识点" 
            description="点按右下角悬浮球添加知识点" 
          />
        ) : viewMode === 'list' ? (
          // List View
          Object.entries(grouped).map(([chapter, kps]) => (
            <div key={chapter} className="mb-4">
              <h4 className="text-xs font-medium mb-2 px-1" style={{ color: theme.textMuted }}>{chapter}</h4>
              <div className="space-y-2">
                {kps.map(kp => {
                  const subject = subjects.find(s => s.id === kp.subjectId);
                  const src = kp.source || 'manual';
                  const isSelected = selectedIds.has(kp.id);
                  return (
                    <div
                      key={kp.id}
                      className={`w-full rounded-xl p-3 border shadow-sm text-left flex items-center justify-between ${
                        isSelectMode ? 'cursor-pointer' : ''
                      }`}
                      style={{ 
                        backgroundColor: theme.bgCard, 
                        borderColor: isSelected ? theme.primary : theme.border
                      }}
                      onClick={() => isSelectMode ? toggleSelect(kp.id) : undefined}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {isSelectMode && (
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-primary bg-primary' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check size={12} className="text-white" />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0" onClick={!isSelectMode ? () => navigate('knowledge-detail', { id: kp.id }) : undefined}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium truncate" style={{ color: theme.textPrimary }}>{kp.name}</span>
                            <ProficiencyBadge level={kp.proficiency} />
                            <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px]`}
                              style={{ color: sourceConfig[src].color.replace('text-', ''), backgroundColor: theme.bgCard }}>
                              {(() => { const Icon = sourceConfig[src].icon; return <Icon size={10} />; })()}
                              {sourceConfig[src].label}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px]" style={{ color: theme.textMuted }}>
                            <span>{subject?.icon} {subject?.name}</span>
                            <span>|</span>
                            <span>复习{kp.reviewCount}次</span>
                          </div>
                        </div>
                      </div>

                      {!isSelectMode && <ChevronRight size={14} style={{ color: theme.textMuted }} className="shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          // Grid View
          <div className="grid grid-cols-2 gap-3">
            {filteredKPs.map(kp => {
              const subject = subjects.find(s => s.id === kp.subjectId);
              const isSelected = selectedIds.has(kp.id);
              return (
                <div
                  key={kp.id}
                  onClick={() => isSelectMode ? toggleSelect(kp.id) : navigate('knowledge-detail', { id: kp.id })}
                  className={`rounded-xl p-4 border shadow-sm text-left relative`}
                  style={{ 
                    backgroundColor: theme.bgCard, 
                    borderColor: isSelected ? theme.primary : theme.border
                  }}
                >
                  {isSelectMode && (
                    <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-primary bg-primary' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl">{subject?.icon}</span>
                    <ProficiencyBadge level={kp.proficiency} />
                  </div>
                  <h4 className="text-sm font-medium mb-1 truncate" style={{ color: theme.textPrimary }}>{kp.name}</h4>
                  <p className="text-[10px] truncate" style={{ color: theme.textMuted }}>{subject?.name}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cloud Download Modal */}
      <CloudDownloadModal
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
        onImport={handleCloudImportData}
      />

      {knowledgeFloatingPanel}

      {importHistoryModal}
    </div>
  );
}
