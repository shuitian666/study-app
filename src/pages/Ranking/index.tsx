import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/ui/Common';
import { useState } from 'react';
import { Clock, Brain, Trophy } from 'lucide-react';

type RankTab = 'studyTime' | 'masterCount';

export default function RankingPage() {
  const { state, navigate } = useApp();
  const [tab, setTab] = useState<RankTab>('studyTime');

  const rankings = state.rankings[tab];
  const tabConfig: Record<RankTab, { label: string; icon: typeof Clock; unit: string }> = {
    studyTime: { label: '学习时长', icon: Clock, unit: '分钟' },
    masterCount: { label: '掌握数量', icon: Brain, unit: '个' },
  };

  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="排行榜" onBack={() => navigate('profile')} />

      {/* Tabs */}
      <div className="mx-4 mt-3 bg-white rounded-2xl p-1 border border-border flex">
        {(Object.entries(tabConfig) as [RankTab, typeof tabConfig[RankTab]][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                tab === key ? 'bg-primary text-white shadow-sm' : 'text-text-muted'
              }`}
            >
              <Icon size={14} />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Top 3 podium */}
      {rankings.length >= 3 && (
        <div className="mx-4 mt-4 flex items-end justify-center gap-3">
          {[rankings[1], rankings[0], rankings[2]].map((entry, i) => {
            const height = i === 1 ? 'h-24' : i === 0 ? 'h-20' : 'h-16';
            const actualRank = entry.rank;
            return (
              <div key={entry.rank} className="flex flex-col items-center flex-1">
                <div className={`text-2xl mb-1 ${entry.isMe ? 'ring-2 ring-primary ring-offset-1' : ''} w-10 h-10 rounded-full flex items-center justify-center bg-gray-100`}>
                  {entry.avatar}
                </div>
                <span className={`text-[10px] mb-1 truncate max-w-full ${entry.isMe ? 'text-primary font-bold' : 'text-text-secondary'}`}>
                  {entry.nickname}
                </span>
                <div className={`${height} w-full rounded-t-xl flex flex-col items-center justify-start pt-2`}
                  style={{ backgroundColor: medalColors[actualRank - 1] + '20', borderTop: `3px solid ${medalColors[actualRank - 1]}` }}
                >
                  <Trophy size={14} style={{ color: medalColors[actualRank - 1] }} />
                  <span className="text-xs font-bold mt-0.5">{entry.value}</span>
                  <span className="text-[9px] text-text-muted">{tabConfig[tab].unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <div className="mx-4 mt-4 space-y-2">
        {rankings.map(entry => (
          <div
            key={entry.rank}
            className={`bg-white rounded-xl p-3 border shadow-sm flex items-center gap-3 ${
              entry.isMe ? 'border-primary/30 bg-primary/5' : 'border-border'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              entry.rank <= 3 ? 'text-white' : 'bg-gray-100 text-text-muted'
            }`}
              style={entry.rank <= 3 ? { backgroundColor: medalColors[entry.rank - 1] } : {}}
            >
              {entry.rank}
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">
              {entry.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-sm ${entry.isMe ? 'font-bold text-primary' : 'font-medium'}`}>
                {entry.nickname}
                {entry.isMe && <span className="text-[10px] ml-1">(我)</span>}
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold">{entry.value}</div>
              <div className="text-[9px] text-text-muted">{tabConfig[tab].unit}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-text-muted text-center mt-4">仅显示排名，不公开个人隐私</p>
    </div>
  );
}
