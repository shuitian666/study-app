import { useCallback, useEffect } from 'react';
import { Star } from 'lucide-react';
import { useGame } from '@/store/GameContext';

const PARTICLE_STYLES = [
  { width: 15, height: 15, left: 10, top: 20, duration: 2.5, delay: 0.2 },
  { width: 20, height: 20, left: 30, top: 15, duration: 1.8, delay: 0.5 },
  { width: 12, height: 12, left: 50, top: 80, duration: 2.0, delay: 0.1 },
  { width: 18, height: 18, left: 70, top: 40, duration: 2.2, delay: 0.8 },
  { width: 14, height: 14, left: 85, top: 60, duration: 1.9, delay: 0.3 },
  { width: 16, height: 16, left: 25, top: 55, duration: 2.4, delay: 0.6 },
  { width: 22, height: 22, left: 60, top: 30, duration: 2.1, delay: 0.4 },
  { width: 11, height: 11, left: 40, top: 70, duration: 2.3, delay: 0.7 },
  { width: 19, height: 19, left: 5, top: 45, duration: 1.7, delay: 0.9 },
  { width: 13, height: 13, left: 90, top: 25, duration: 2.6, delay: 0.15 },
  { width: 17, height: 17, left: 35, top: 85, duration: 2.0, delay: 0.35 },
  { width: 21, height: 21, left: 75, top: 10, duration: 1.8, delay: 0.55 },
  { width: 14, height: 14, left: 15, top: 35, duration: 2.2, delay: 0.25 },
  { width: 18, height: 18, left: 55, top: 50, duration: 2.4, delay: 0.65 },
  { width: 12, height: 12, left: 80, top: 75, duration: 1.9, delay: 0.45 },
  { width: 20, height: 20, left: 45, top: 5, duration: 2.1, delay: 0.85 },
  { width: 16, height: 16, left: 20, top: 90, duration: 2.3, delay: 0.1 },
  { width: 13, height: 13, left: 65, top: 65, duration: 1.75, delay: 0.5 },
  { width: 19, height: 19, left: 8, top: 55, duration: 2.5, delay: 0.3 },
  { width: 15, height: 15, left: 95, top: 38, duration: 2.0, delay: 0.7 },
];

export default function AchievementPopup() {
  const { gameState, gameDispatch } = useGame();
  const popup = gameState.achievementPopup;

  const handleDismiss = useCallback(() => {
    gameDispatch({ type: 'DISMISS_ACHIEVEMENT_POPUP' });
  }, [gameDispatch]);

  useEffect(() => {
    if (!popup?.show) return;
    const timer = window.setTimeout(handleDismiss, 4200);
    return () => window.clearTimeout(timer);
  }, [handleDismiss, popup?.show]);

  if (!popup?.show) return null;

  const isHiddenAchievement = popup.achievement.category === 'hidden';

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[90] flex justify-center sm:inset-x-auto sm:right-5 sm:top-5">
      <div
        className={`pointer-events-auto relative w-full max-w-[320px] overflow-hidden rounded-3xl bg-white p-4 text-left shadow-2xl ring-1 ring-black/5 ${
          isHiddenAchievement ? 'animate-bounce-in' : 'animate-scale-in'
        }`}
        onClick={handleDismiss}
      >
        {isHiddenAchievement && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {PARTICLE_STYLES.map((style, i) => (
              <div
                key={i}
                className="absolute animate-pulse rounded-full bg-primary/30"
                style={{
                  width: `${style.width}px`,
                  height: `${style.height}px`,
                  left: `${style.left}%`,
                  top: `${style.top}%`,
                  animationDuration: `${style.duration}s`,
                  animationDelay: `${style.delay}s`,
                }}
              />
            ))}
          </div>
        )}

        <div className="relative flex items-start gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl ${isHiddenAchievement ? 'animate-spin' : ''}`}>
            {popup.achievement.icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">成就解锁</div>
            <h3 className={`mt-1 truncate text-base font-bold ${isHiddenAchievement ? 'text-primary' : 'text-text-primary'}`}>
              {popup.achievement.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">
              {popup.achievement.description}
            </p>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-xs">
              <Star size={14} className="fill-yellow-500 text-yellow-500" />
              <span className="font-bold text-yellow-600">+{popup.achievement.reward.coins}</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="relative mt-3 w-full rounded-full bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90"
        >
          太棒了！
        </button>
      </div>
    </div>
  );
}
