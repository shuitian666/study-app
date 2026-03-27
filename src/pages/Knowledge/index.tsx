import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { ProficiencyBadge, PageHeader, EmptyState } from '@/components/ui/Common';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { Plus, Search, ChevronRight, Filter, Sparkles, BookOpen, LayoutGrid, List, Upload } from 'lucide-react';

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
  const { state, navigate } = useApp();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProf, setFilterProf] = useState<ProficiencyLevel | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const subjects = state.subjects;
  const allKPs = state.knowledgePoints;

  const filteredKPs = allKPs.filter(kp => {
    if (selectedSubject && kp.subjectId !== selectedSubject) return false;
    if (filterProf !== 'all' && kp.proficiency !== filterProf) return false;
    if (searchQuery && !kp.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const grouped = filteredKPs.reduce<Record<string, typeof filteredKPs>>((acc, kp) => {
    const chapter = state.chapters.find(c => c.id === kp.chapterId);
    const key = chapter?.name ?? '未分类';
    if (!acc[key]) acc[key] = [];
    acc[key].push(kp);
    return acc;
  }, {});

  return (
    <div className="page-scroll pb-4">
      <PageHeader
        title="知识库"
        rightAction={
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('import-knowledge')}
              className="p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              title="导入知识"
            >
              <Upload size={18} className="text-blue-600" />
            </button>
            <button
              onClick={() => navigate('add-knowledge')}
              className="p-1.5 bg-primary/10 rounded-lg"
            >
              <Plus size={18} className="text-primary" />
            </button>
          </div>
        }
      />

      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索知识点..."
            className="w-full bg-white border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Subject Filter */}
      <div className="px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedSubject(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedSubject === null ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
            }`}
          >
            全部
          </button>

          {subjects.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSubject(s.id === selectedSubject ? null : s.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedSubject === s.id ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
              }`}
            >
              {s.icon} {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Proficiency Filter */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <div className="flex gap-1.5 items-center">
          <Filter size={12} className="text-text-muted" />
          {(['all', 'none', 'rusty', 'normal', 'master'] as const).map(level => (
            <button
              key={level}
              onClick={() => setFilterProf(level)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                filterProf === level
                  ? level === 'all'
                    ? 'bg-gray-700 text-white'
                    : 'text-white'
                  : 'bg-gray-50 text-text-muted'
              }`}
              style={filterProf === level && level !== 'all' ? { backgroundColor: PROFICIENCY_MAP[level].color } : {}}
            >
              {level === 'all' ? '全部' : PROFICIENCY_MAP[level].label}
            </button>
          ))}
        </div>
        
        {/* View mode toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-text-muted'}`}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg ${viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-text-muted'}`}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
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
              <h4 className="text-xs font-medium text-text-muted mb-2 px-1">{chapter}</h4>
              <div className="space-y-2">
                {kps.map(kp => {
                  const subject = subjects.find(s => s.id === kp.subjectId);
                  const src = kp.source || 'manual';
                  return (
                    <button
                      key={kp.id}
                      onClick={() => navigate('knowledge-detail', { id: kp.id })}
                      className="w-full bg-white rounded-xl p-3 border border-border shadow-sm text-left flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium truncate">{kp.name}</span>
                          <ProficiencyBadge level={kp.proficiency} />
                          <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] ${sourceConfig[src].color} ${sourceConfig[src].bgColor}`}>
                            {(() => { const Icon = sourceConfig[src].icon; return <Icon size={10} />; })()}
                            {sourceConfig[src].label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-text-muted">
                          <span>{subject?.icon} {subject?.name}</span>
                          <span>|</span>
                          <span>复习{kp.reviewCount}次</span>
                        </div>
                      </div>

                      <ChevronRight size={14} className="text-text-muted shrink-0" />
                    </button>
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
              return (
                <button
                  key={kp.id}
                  onClick={() => navigate('knowledge-detail', { id: kp.id })}
                  className="bg-white rounded-xl p-4 border border-border shadow-sm text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl">{subject?.icon}</span>
                    <ProficiencyBadge level={kp.proficiency} />
                  </div>
                  <h4 className="text-sm font-medium mb-1 truncate">{kp.name}</h4>
                  <p className="text-[10px] text-text-muted truncate">{subject?.name}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
