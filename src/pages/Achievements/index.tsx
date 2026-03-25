import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/ui/Common';
import type { AchievementCategory } from '@/types';
import { useState } from 'react';
import { Award, Lock, Star } from 'lucide-react';

const CATEGORY_LABELS: Record<AchievementCategory, { label: string; icon: string }> = {
  beginner: { label: '入门成就', icon: '🌱' },
  learning: { label: '学习成就', icon: '📚' },
  quiz: { label: '测试成就', icon: '🎯' },
};

export default function AchievementsPage() {
  const { state, navigate } = useApp();
  const [tab, setTab] = useState<AchievementCategory | 'all'>('all');

  const filtered = tab === 'all'
    ? state.achievements
    : state.achievements.filter(a => a.category === tab);

  const unlockedCount = state.achievements.filter(a => a.unlocked).length;

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="成就" onBack={() => navigate('profile')} />

      {/* Summary */}
      <div className="mx-4 mt-3 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Award size={18} />
              <span className="font-bold">成就殿堂</span>
            </div>
            <p className="text-white/70 text-xs">
              已解锁 {unlockedCount}/{state.achievements.length} 个成就
            </p>
          </div>
          <div className="text-3xl font-bold">{unlockedCount}</div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 w-full bg-white/20 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${(unlockedCount / state.achievements.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="mx-4 mt-4 flex gap-2 overflow-x-auto pb-1">
        {([['all', '全部'], ...Object.entries(CATEGORY_LABELS).map(([k, v]) => [k, v.label])] as [string, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as AchievementCategory | 'all')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === key ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Achievement list */}
      <div className="mx-4 mt-3 space-y-2">
        {filtered.map(ach => (
          <div
            key={ach.id}
            className={`bg-white rounded-xl p-4 border shadow-sm flex items-center gap-3 ${
              ach.unlocked ? 'border-secondary/30' : 'border-border opacity-70'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
              ach.unlocked ? 'bg-secondary/10' : 'bg-gray-100'
            }`}>
              {ach.unlocked ? ach.icon : <Lock size={18} className="text-text-muted" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${ach.unlocked ? '' : 'text-text-muted'}`}>{ach.name}</span>
                {ach.unlocked && <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">已解锁</span>}
              </div>
              <p className="text-xs text-text-muted mt-0.5">{ach.description}</p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Star size={12} className="text-secondary" />
              <span className="text-xs font-medium text-secondary">{ach.reward.coins}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
