import { useEffect, useRef } from 'react';
import { Bot, Sparkles, X } from 'lucide-react';
import type { MilestoneLevelReward } from '@/utils/levelRewards';

interface LevelUpCelebrationProps {
  open: boolean;
  previousLevel: number;
  nextLevel: number;
  rewards: MilestoneLevelReward[];
  claimingReward: boolean;
  rewardClaimed: boolean;
  rewardError?: string;
  onClose: () => void;
  onViewReward: () => void;
}

export default function LevelUpCelebration({
  open,
  previousLevel,
  nextLevel,
  rewards,
  claimingReward,
  rewardClaimed,
  rewardError,
  onClose,
  onViewReward,
}: LevelUpCelebrationProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const milestoneReward = rewards[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/38 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-up-title"
    >
      <div className="motion-safe:animate-[fadeIn_180ms_ease-out] relative w-full max-w-[420px] overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-emerald-400 to-amber-400" />
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          aria-label="关闭升级提示"
        >
          <X size={17} />
        </button>

        <div className="px-6 pb-6 pt-7">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Sparkles size={25} />
          </div>
          <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">Level Up</p>
          <h2 id="level-up-title" className="mt-2 text-center text-2xl font-extrabold text-slate-950">
            Lv.{previousLevel} → Lv.{nextLevel}
          </h2>
          <p className="mt-2 text-center text-sm leading-6 text-slate-600">
            这次学习让账号等级提升了。继续保持当前节奏，后续学习能力会逐步打开。
          </p>

          {milestoneReward && (
            <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
                  <Bot size={21} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-extrabold text-slate-950">{milestoneReward.title}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{milestoneReward.description}</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-500">里程碑奖励</div>
                    <div className="mt-1 truncate text-sm font-extrabold text-slate-950">
                      {milestoneReward.icon} {milestoneReward.rewardName}
                    </div>
                  </div>
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700">
                    {milestoneReward.rewardRarity}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500" role="status">
                  {claimingReward && '正在发放奖励...'}
                  {!claimingReward && rewardClaimed && '奖励已进入背包，可在头像编辑页选择展示。'}
                  {!claimingReward && rewardError && rewardError}
                  {!claimingReward && !rewardClaimed && !rewardError && '奖励将在账号同步后发放。'}
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              继续学习
            </button>
            <button
              type="button"
              onClick={onViewReward}
              className="min-h-11 rounded-2xl bg-indigo-600 px-4 text-sm font-bold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              查看奖励
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
