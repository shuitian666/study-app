import { useGame } from '@/store/GameContext';
import { Star } from 'lucide-react';

export default function AchievementPopup() {
  const { gameState, gameDispatch } = useGame();
  const popup = gameState.achievementPopup;

  if (!popup || !popup.show) return null;

  const isHiddenAchievement = popup.achievement.category === 'hidden';

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50" onClick={() => gameDispatch({ type: 'DISMISS_ACHIEVEMENT_POPUP' })}>
      <div
        className={`bg-white rounded-3xl p-6 mx-8 text-center shadow-2xl max-w-xs w-full relative overflow-hidden ${
          isHiddenAchievement 
            ? 'animate-bounce-in' 
            : 'animate-scale-in'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* 粒子效果容器 */}
        {isHiddenAchievement && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-primary/30 animate-pulse"
                style={{
                  width: `${Math.random() * 20 + 10}px`,
                  height: `${Math.random() * 20 + 10}px`,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDuration: `${Math.random() * 2 + 1}s`,
                  animationDelay: `${Math.random() * 1}s`,
                }}
              />
            ))}
          </div>
        )}

        <div className={`text-5xl mb-3 transition-all duration-500 ${
          isHiddenAchievement ? 'animate-spin' : ''
        }`}>
          {popup.achievement.icon}
        </div>
        
        <h3 className={`text-lg font-bold mb-1 ${
          isHiddenAchievement ? 'text-primary' : ''
        }`}>
          {isHiddenAchievement ? '🎉 隐藏成就解锁!' : '成就解锁!'}
        </h3>
        
        <p className="text-base font-semibold text-primary mb-1">
          {popup.achievement.name}
        </p>
        
        <p className="text-xs text-text-muted mb-4">
          {popup.achievement.description}
        </p>

        <div className="inline-flex items-center gap-1 bg-secondary/10 text-secondary px-3 py-1.5 rounded-full mb-4">
          <Star size={14} />
          <span className="text-sm font-medium">+{popup.achievement.reward.coins} 星币</span>
        </div>

        <button
          onClick={() => gameDispatch({ type: 'DISMISS_ACHIEVEMENT_POPUP' })}
          className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-medium active:opacity-80"
        >
          太棒了!
        </button>
      </div>
    </div>
  );
}
