import { useApp } from '@/store/AppContext';
import { Star } from 'lucide-react';

export default function AchievementPopup() {
  const { state, dispatch } = useApp();
  const popup = state.achievementPopup;

  if (!popup || !popup.show) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50" onClick={() => dispatch({ type: 'DISMISS_ACHIEVEMENT_POPUP' })}>
      <div
        className="bg-white rounded-3xl p-6 mx-8 text-center shadow-2xl animate-bounce-in max-w-xs w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-5xl mb-3">{popup.achievement.icon}</div>
        <h3 className="text-lg font-bold mb-1">成就解锁!</h3>
        <p className="text-base font-semibold text-primary mb-1">{popup.achievement.name}</p>
        <p className="text-xs text-text-muted mb-4">{popup.achievement.description}</p>

        <div className="inline-flex items-center gap-1 bg-secondary/10 text-secondary px-3 py-1.5 rounded-full mb-4">
          <Star size={14} />
          <span className="text-sm font-medium">+{popup.achievement.reward.coins} 星币</span>
        </div>

        <button
          onClick={() => dispatch({ type: 'DISMISS_ACHIEVEMENT_POPUP' })}
          className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-medium active:opacity-80"
        >
          太棒了!
        </button>
      </div>
    </div>
  );
}
