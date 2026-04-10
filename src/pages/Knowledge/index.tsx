import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { Undo2, Redo2 } from 'lucide-react';
import { ProficiencyBadge, PageHeader, EmptyState } from '@/components/ui/Common';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { Plus, Search, ChevronRight, Filter, Sparkles, BookOpen, LayoutGrid, List, Upload, Trash2, Check, BookMarked, Cloud } from 'lucide-react';
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

export default function KnowledgePage() {
  const { navigate } = useUser();
  const { learningState, learningDispatch, undo, redo, _canUndo, _canRedo } = useLearning();
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
    setShowCloudModal(true);
  };

  // 处理从云端弹窗导入的数据
  const handleCloudImportData = (knowledgePoints: any[], questions: any[]) => {
    // 构建导入数据
    const importData = {
      subjects: learningState.subjects,
      chapters: learningState.chapters,
      knowledgePoints,
      questions
    };

    // 更新状态
    learningDispatch({ type: 'SET_KNOWLEDGE_DATA', payload: importData });

  };

  const subjects = learningState.subjects;
  const allKPs = learningState.knowledgePoints;

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

  // 计算统计数据
  const stats = useMemo(() => {
    const totalKPs = learningState.knowledgePoints.length;
    const masteredKPs = learningState.knowledgePoints.filter(kp => kp.proficiency === 'master').length;
    const normalKPs = learningState.knowledgePoints.filter(kp => kp.proficiency === 'normal').length;
    const rustyKPs = learningState.knowledgePoints.filter(kp => kp.proficiency === 'rusty').length;
    const noneKPs = learningState.knowledgePoints.filter(kp => kp.proficiency === 'none').length;
    return { totalKPs, masteredKPs, normalKPs, rustyKPs, noneKPs };
  }, [learningState.knowledgePoints]);

  // ===== Scholar 风格渲染 =====
  if (uiStyle === 'scholar') {
    return (
      <div className="page-scroll" style={{ backgroundColor: theme.bg || '#f8f9fa' }}>
        <TopAppBar />

        <div className="px-6 pt-6 space-y-6 pb-32">
          {/* Page Title */}
          <div>
            <h2
              className="text-2xl font-bold mb-1"
              style={{ color: theme.textPrimary, fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              {isSelectMode ? `已选择 ${selectedIds.size} 项` : '知识库'}
            </h2>
            <p className="text-sm" style={{ color: theme.textSecondary }}>
              {isSelectMode ? '选择要操作的知识点了' : '管理你的知识点和学习资源'}
            </p>
          </div>

          {/* Stats Bento Grid */}
          <div className="grid grid-cols-4 gap-3">
            {/* Total */}
            <div
              className="col-span-1 p-4 rounded-2xl flex flex-col items-center justify-center"
              style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff', boxShadow: 'none' }}
            >
              <BookMarked size={18} style={{ color: theme.primary || '#24389c' }} className="mb-1" />
              <span className="text-xl font-bold" style={{ color: theme.onSurface || '#191c1d' }}>{stats.totalKPs}</span>
              <span className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>总计</span>
            </div>

            {/* Mastered */}
            <div
              className="col-span-1 p-4 rounded-2xl flex flex-col items-center justify-center"
              style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff', boxShadow: 'none' }}
            >
              <div className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: theme.profMaster || '#10b981' }} />
              <span className="text-xl font-bold" style={{ color: theme.onSurface || '#191c1d' }}>{stats.masteredKPs}</span>
              <span className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>掌握</span>
            </div>

            {/* Normal */}
            <div
              className="col-span-1 p-4 rounded-2xl flex flex-col items-center justify-center"
              style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff', boxShadow: 'none' }}
            >
              <div className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: theme.profNormal || '#3b82f6' }} />
              <span className="text-xl font-bold" style={{ color: theme.onSurface || '#191c1d' }}>{stats.normalKPs}</span>
              <span className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>熟悉</span>
            </div>

            {/* Needs Review */}
            <div
              className="col-span-1 p-4 rounded-2xl flex flex-col items-center justify-center"
              style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff', boxShadow: 'none' }}
            >
              <div className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: theme.profRusty || '#f59e0b' }} />
              <span className="text-xl font-bold" style={{ color: theme.onSurface || '#191c1d' }}>{stats.rustyKPs + stats.noneKPs}</span>
              <span className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>待巩固</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => navigate('add-knowledge')}
              className="flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: theme.primary || '#24389c' }}
            >
              <Plus size={18} className="text-white" />
              <span className="text-sm font-semibold text-white">添加知识</span>
            </button>
            <button
              onClick={() => navigate('import-knowledge')}
              className="py-3 px-4 rounded-2xl border flex items-center justify-center gap-2"
              style={{ borderColor: theme.outlineVariant || '#c5c5d4' }}
            >
              <Upload size={18} style={{ color: theme.onSurfaceVariant || '#454652' }} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.onSurfaceVariant || '#454652' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索知识点..."
              className="w-full border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-colors"
              style={{
                backgroundColor: theme.surfaceContainerLowest || '#ffffff',
                borderColor: theme.outlineVariant || '#c5c5d4',
                color: theme.onSurface || '#191c1d',
              }}
            />
          </div>

          {/* Subject Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedSubject(null)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                backgroundColor: !selectedSubject ? theme.primary : 'transparent',
                color: !selectedSubject ? '#ffffff' : theme.onSurfaceVariant || '#454652',
                border: `1px solid ${!selectedSubject ? theme.primary : theme.outlineVariant || '#c5c5d4'}`,
              }}
            >
              全部
            </button>
            {learningState.subjects.map(subject => (
              <button
                key={subject.id}
                onClick={() => setSelectedSubject(subject.id)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  backgroundColor: selectedSubject === subject.id ? theme.primary : 'transparent',
                  color: selectedSubject === subject.id ? '#ffffff' : theme.onSurfaceVariant || '#454652',
                  border: `1px solid ${selectedSubject === subject.id ? theme.primary : theme.outlineVariant || '#c5c5d4'}`,
                }}
              >
                {subject.icon} {subject.name}
              </button>
            ))}
          </div>

          {/* Knowledge Points List */}
          <div className="space-y-2">
            {filteredKPs.length === 0 ? (
              <div className="p-8 rounded-2xl text-center" style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff' }}>
                <BookOpen size={40} style={{ color: theme.onSurfaceVariant || '#454652' }} className="mx-auto mb-2" />
                <p className="text-sm" style={{ color: theme.onSurfaceVariant || '#454652' }}>暂无知识点</p>
                <p className="text-xs mt-1" style={{ color: theme.onSurfaceVariant || '#454652', opacity: 0.7 }}>点击上方添加知识按钮开始添加</p>
              </div>
            ) : (
              filteredKPs.map(kp => {
                const subject = learningState.subjects.find(s => s.id === kp.subjectId);
                return (
                  <button
                    key={kp.id}
                    onClick={() => navigate('knowledge-detail', { id: kp.id })}
                    className="w-full p-4 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-transform"
                    style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff', boxShadow: 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{ backgroundColor: subject?.color + '20' || theme.surfaceContainerHigh }}
                      >
                        {subject?.icon || '📚'}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold" style={{ color: theme.onSurface || '#191c1d' }}>{kp.name}</div>
                        <div className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>
                          {subject?.name} · {kp.reviewCount}次复习
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ProficiencyBadge level={kp.proficiency} />
                      <ChevronRight size={16} style={{ color: theme.onSurfaceVariant || '#454652' }} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <FloatingAIPanel />
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
              <button
                onClick={() => navigate('import-knowledge')}
                className="p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                title="导入知识"
              >
                <Upload size={18} className="text-blue-600" />
              </button>
              <button
                onClick={handleCloudImport}
                className="p-1.5 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                title="从云端导入"
              >
                <Cloud size={18} className="text-green-600" />
              </button>
              <button
                onClick={() => navigate('add-knowledge')}
                className="p-1.5 bg-primary/10 rounded-lg"
              >
                <Plus size={18} className="text-primary" />
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
            description="点击右上角添加" 
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
    </div>
  );
}
