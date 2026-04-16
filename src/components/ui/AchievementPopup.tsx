import { useGame } from '@/store/GameContext';
import { useUser } from '@/store/UserContext';
import { Star } from 'lucide-react';

// Static particle styles for visual effect
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
  const { userState, userDispatch } = useUser();
  const popup = gameState.achievementPopup;

  // 如果签到奖励弹窗正在显示，则不显示成就弹窗（等签到弹窗关闭后再显示成就）
  if (!popup || !popup.show) return null;

  const isHiddenAchievement = popup.achievement.category === 'hidden';

  // 关闭弹窗时发放成就奖励金币
  const handleDismiss = () => {
    const rewardCoins = popup.achievement.reward.coins;
    if (rewardCoins > 0 && userState.user) {
      userDispatch({
        type: 'UPDATE_USER',
        payload: { totalPoints: userState.user.totalPoints + rewardCoins }
      });
      // 记录星币账单
      gameDispatch({
        type: 'ADD_COIN_BILL',
        payload: {
          type: 'compensation',
          amount: rewardCoins,
          description: `成就奖励: ${popup.achievement.name}`,
        }
      });
      console.log(`[成就奖励] 获得 ${rewardCoins} 星币`);
    }
    gameDispatch({ type: 'DISMISS_ACHIEVEMENT_POPUP' });
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50" onClick={handleDismiss}>
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
            {PARTICLE_STYLES.map((style, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-primary/30 animate-pulse"
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

        <div className={`text-5xl mb-3 transition-all duration-500 ${
          isHiddenAchievement ? 'animate-spin' : ''
        }`}>
          {popup.achievement.icon}
        </div>

        <h3 className={`text-lg font-bold mb-1 ${
          isHiddenAchievement ? 'text-primary' : ''
        }`}>
          {popup.achievement.name}
        </h3>
        <p className="text-sm text-text-muted mb-3">
          {popup.achievement.description}
        </p>

        <div className="flex items-center justify-center gap-1 text-sm">
          <Star size={16} className="text-yellow-500 fill-yellow-500" />
          <span className="text-yellow-600 font-medium">+{popup.achievement.reward.coins}</span>
        </div>

        <button
          onClick={handleDismiss}
          className="mt-4 px-4 py-1.5 text-sm bg-primary text-white rounded-full hover:bg-primary/90 transition-colors"
        >
          太棒了！
        </button>
      </div>
    </div>
  );
}
