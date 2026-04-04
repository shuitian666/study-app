import { useState, useEffect } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { Undo2, Redo2 } from 'lucide-react';
import { ProficiencyBadge, PageHeader, EmptyState } from '@/components/ui/Common';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel, KnowledgePoint } from '@/types';
import { Plus, Search, ChevronRight, Filter, Sparkles, BookOpen, LayoutGrid, List, Upload, Trash2, Check, CreditCard as FlashCardIcon, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';

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
  
  // 闪卡模式
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
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

  const subjects = learningState.subjects;
  const allKPs = learningState.knowledgePoints;

  const filteredKPs = allKPs
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

  const grouped = filteredKPs.reduce<Record<string, typeof filteredKPs>>((acc, kp) => {
    const chapter = learningState.chapters.find(c => c.id === kp.chapterId);
    const key = chapter?.name ?? '未分类';
    if (!acc[key]) acc[key] = [];
    acc[key].push(kp);
    return acc;
  }, {});

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
                onClick={() => {
                  setCurrentCardIndex(0);
                  setIsFlipped(false);
                  setFlashcardMode(true);
                }}
                disabled={filteredKPs.length === 0}
                className="p-1.5 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-30"
                title="闪卡背诵"
              >
                <FlashCardIcon size={18} className="text-amber-600" />
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

      {/* 全屏闪卡模式 */}
      {flashcardMode && (
        <FlashcardView 
          cards={filteredKPs}
          currentIndex={currentCardIndex}
          isFlipped={isFlipped}
          onClose={() => setFlashcardMode(false)}
          onFlip={() => setIsFlipped(!isFlipped)}
          onPrev={() => {
            setCurrentCardIndex(Math.max(0, currentCardIndex - 1));
            setIsFlipped(false);
          }}
          onNext={() => {
            setCurrentCardIndex(Math.min(filteredKPs.length - 1, currentCardIndex + 1));
            setIsFlipped(false);
          }}
        />
      )}
    </div>
  );
}

// 闪卡全屏视图
interface FlashcardViewProps {
  cards: KnowledgePoint[];
  currentIndex: number;
  isFlipped: boolean;
  onClose: () => void;
  onFlip: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function FlashcardView({ cards, currentIndex, isFlipped, onClose, onFlip, onPrev, onNext }: FlashcardViewProps) {
  const { theme } = useTheme();
  const card = cards[currentIndex];

  // 获取圆角大小
  const getBorderRadius = (size: 'small' | 'medium' | 'large') => {
    const radiusMap: Record<string, Record<string, string>> = {
      small: { sm: '12px', md: '16px', lg: '20px' },
      medium: { sm: '16px', md: '20px', lg: '24px' },
      large: { sm: '20px', md: '24px', lg: '28px' },
    };
    return radiusMap[theme.borderRadius][size];
  };

  return (
    <div className="fixed inset-0 z-50 bg-white/95 dark:bg-black/95 flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="text-sm text-text-muted">
          {currentIndex + 1} / {cards.length}
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-medium"
        >
          关闭
        </button>
      </div>

      {/* 闪卡主体 */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          onClick={onFlip}
          className="w-full max-w-xl min-h-[300px] p-8 border-2 shadow-xl cursor-pointer transition-all duration-300 hover:shadow-2xl flex items-center justify-center"
          style={{
            backgroundColor: isFlipped ? theme.bgCard : '#fafafa',
            borderColor: isFlipped ? theme.primary : theme.border,
            borderRadius: getBorderRadius('large'),
          }}
        >
          <div className="text-center">
            {!isFlipped ? (
              // 正面：问题
              <>
                <div className="text-xs text-text-muted uppercase tracking-wide mb-3">知识点名称</div>
                <h2 className="text-2xl font-bold" style={{ color: theme.textPrimary }}>
                  {card.name}
                </h2>
                <p className="text-sm text-text-muted mt-4">点击卡片翻面看答案</p>
              </>
            ) : (
              // 背面：答案/描述
              <>
                <div className="text-xs text-text-muted uppercase tracking-wide mb-3">知识解析</div>
                <div 
                  className="text-lg leading-relaxed" 
                  style={{ color: theme.textPrimary }}
                  dangerouslySetInnerHTML={{ __html: card.explanation }}
                >
                </div>
                <p className="text-sm text-text-muted mt-4">点击卡片翻回去</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 底部导航 */}
      <div className="flex items-center justify-center gap-4 px-4 py-6 border-t">
        <button
          onClick={onPrev}
          disabled={currentIndex <= 0}
          className="flex items-center gap-1 px-4 py-2 bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
          上一张
        </button>
        <button
          onClick={onNext}
          disabled={currentIndex >= cards.length - 1}
          className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
        >
          下一张
          <ChevronRightIcon size={16} />
        </button>
      </div>
    </div>
  );
}
