import { useMemo, useState } from 'react';
import { Brain, Clock, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/ui/Common';
import { allFrames } from '@/data/avatarCatalog';
import { useLearning } from '@/store/LearningContext';
import { useUser } from '@/store/UserContext';
import type { RankEntry } from '@/types';
import { buildMasterCountRanking, buildStudyTimeRanking, estimateStudyMinutes } from '@/utils/ranking';

type RankTab = 'studyTime' | 'masterCount';

function formatMinutes(minutes = 0) {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}小时${rest}分` : `${hours}小时`;
}

export default function RankingPage() {
  const { userState, navigate } = useUser();
  const { learningState, getLearningStats } = useLearning();
  const [tab, setTab] = useState<RankTab>('studyTime');
  const stats = getLearningStats();
  const studyMinutes = useMemo(() => estimateStudyMinutes(learningState, userState.user?.totalStudyMinutes ?? 0), [learningState, userState.user?.totalStudyMinutes]);
  const rankings = useMemo(() => ({
    studyTime: buildStudyTimeRanking({
      user: userState.user,
      learningState,
      masterCount: stats.masteredCount,
    }),
    masterCount: buildMasterCountRanking({
      user: userState.user,
      masterCount: stats.masteredCount,
      studyMinutes,
    }),
  }), [learningState, stats.masteredCount, studyMinutes, userState.user]);

  const currentRankings = rankings[tab];
  const tabConfig: Record<RankTab, { label: string; icon: typeof Clock; unit: string }> = {
    studyTime: { label: '学习投入', icon: Clock, unit: '天数优先' },
    masterCount: { label: '掌握数量', icon: Brain, unit: '个' },
  };

  const medalColors = ['#f59e0b', '#94a3b8', '#b45309'];

  return (
    <div className="page-scroll pb-24">
      <PageHeader title="排行榜" onBack={() => navigate('profile')} />

      <section className="mx-4 mt-3 rounded-[24px] bg-gradient-to-br from-slate-900 to-indigo-900 p-5 text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Trophy size={16} />
              <span>学习排名</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold">先比坚持，再比投入</h1>
            <p className="mt-1 text-sm text-white/68">学习天数相同的时候，估算时长更长的同学排在前面。</p>
          </div>
          <div className="rounded-2xl bg-white/12 px-4 py-3 text-right">
            <div className="text-xs text-white/60">我的时长</div>
            <div className="mt-1 text-lg font-bold">{formatMinutes(studyMinutes)}</div>
          </div>
        </div>
      </section>

      <div className="mx-4 mt-3 flex rounded-2xl border border-border bg-white p-1">
        {(Object.entries(tabConfig) as [RankTab, typeof tabConfig[RankTab]][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-colors ${
                tab === key ? 'bg-primary text-white shadow-sm' : 'text-text-muted'
              }`}
            >
              <Icon size={14} />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {currentRankings.length >= 3 && (
        <div className="mx-4 mt-4 flex items-end justify-center gap-3">
          {[currentRankings[1], currentRankings[0], currentRankings[2]].map((entry, i) => {
            const height = i === 1 ? 'h-24' : i === 0 ? 'h-20' : 'h-16';
            return (
              <div key={`${entry.nickname}-${entry.rank}`} className="flex min-w-0 flex-1 flex-col items-center">
                <Avatar entry={entry} size="large" />
                <span className={`mt-2 max-w-full truncate text-[10px] ${entry.isMe ? 'font-bold text-primary' : 'text-text-secondary'}`}>
                  {entry.nickname}
                </span>
                <div
                  className={`${height} mt-1 flex w-full flex-col items-center justify-start rounded-t-xl pt-2`}
                  style={{ backgroundColor: `${medalColors[entry.rank - 1]}20`, borderTop: `3px solid ${medalColors[entry.rank - 1]}` }}
                >
                  <Trophy size={14} style={{ color: medalColors[entry.rank - 1] }} />
                  <span className="mt-0.5 text-xs font-bold">{entry.rank}</span>
                  <span className="text-[9px] text-text-muted">第{entry.rank}名</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mx-4 mt-4 space-y-2">
        {currentRankings.map(entry => (
          <div
            key={`${entry.nickname}-${entry.rank}`}
            className={`flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm ${
              entry.isMe ? 'border-primary/30 bg-primary/5' : 'border-border'
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                entry.rank <= 3 ? 'text-white' : 'bg-gray-100 text-text-muted'
              }`}
              style={entry.rank <= 3 ? { backgroundColor: medalColors[entry.rank - 1] } : {}}
            >
              {entry.rank}
            </div>
            <Avatar entry={entry} />
            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm ${entry.isMe ? 'font-bold text-primary' : 'font-semibold text-text-primary'}`}>
                {entry.nickname}{entry.isMe ? '（我）' : ''}
              </div>
              <div className="mt-0.5 text-xs text-text-muted">
                学习 {entry.learningDays ?? 0} 天 · {formatMinutes(entry.studyMinutes ?? entry.value)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-text-primary">
                {tab === 'studyTime' ? `${entry.learningDays ?? 0}天` : entry.value}
              </div>
              <div className="text-[9px] text-text-muted">{tabConfig[tab].unit}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-[10px] text-text-muted">仅展示排名，不公开个人隐私</p>
    </div>
  );
}

function Avatar({ entry, size = 'normal' }: { entry: RankEntry; size?: 'normal' | 'large' }) {
  const frameConfig = entry.avatarFrame ? allFrames.find(frame => frame.icon === entry.avatarFrame) : null;
  const isCustomAvatar = entry.avatar?.startsWith('data:') || entry.avatar?.startsWith('http');
  const outerSize = size === 'large' ? 'h-14 w-14' : 'h-10 w-10';
  const fallbackSize = size === 'large' ? 'h-12 w-12 text-2xl' : 'h-9 w-9 text-lg';

  if (!frameConfig) {
    return (
      <div className={`${fallbackSize} flex shrink-0 items-center justify-center rounded-full bg-gray-100`}>
        {isCustomAvatar ? <img src={entry.avatar} alt="头像" className="h-full w-full rounded-full object-cover" /> : entry.avatar}
      </div>
    );
  }

  return (
    <div
      className={`${outerSize} flex shrink-0 items-center justify-center rounded-full ${frameConfig.animation ? 'animate-gradient-shift' : ''}`}
      style={{
        background: frameConfig.gradient,
        clipPath: frameConfig.shapeTransform || 'circle(50%)',
        backgroundSize: frameConfig.animation ? '200% 200%' : '100% 100%',
      }}
    >
      <div className="flex h-[calc(100%-4px)] w-[calc(100%-4px)] items-center justify-center rounded-full bg-white/20 p-0.5">
        {isCustomAvatar ? (
          <img src={entry.avatar} alt="头像" className="h-full w-full rounded-full object-cover" />
        ) : (
          <span className={size === 'large' ? 'text-2xl' : 'text-base'}>{entry.avatar || '👤'}</span>
        )}
      </div>
    </div>
  );
}
