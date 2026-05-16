import { useEffect, useState } from 'react';
import { Sparkles, Star, Ticket } from 'lucide-react';
import { useGame } from '@/store/GameContext';
import type { LotteryPopup, LotteryResult, UpPoolResult } from '@/types';
import { getTierConfig } from '@/utils/lottery';
import { getCompensationCoins } from '@/utils/rewardGranting';

function isLotteryResult(result: LotteryResult | UpPoolResult): result is LotteryResult {
  return 'tier' in result;
}

const RARITY_COLORS: Record<string, string> = {
  SSR: '#FFD700',
  SR: '#8B5CF6',
  R: '#3B82F6',
  N: '#9CA3AF',
};

export default function LotteryDrawModal() {
  const { gameState, gameDispatch } = useGame();
  const popup: LotteryPopup | null = gameState.lotteryPopup;
  const [phase, setPhase] = useState<'shaking' | 'revealing' | 'result' | 'summary'>('shaking');

  const resultTimestamp = popup?.result ? popup.result.timestamp : '';
  const isTenDraw = Boolean(popup?.isTenDraw && popup.allResults?.length === 10);

  useEffect(() => {
    if (!popup?.show) {
      setPhase('shaking');
      return;
    }

    setPhase('shaking');
    const revealTimer = setTimeout(() => setPhase('revealing'), 1500);
    const resultTimer = setTimeout(() => setPhase(isTenDraw ? 'summary' : 'result'), 2300);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(resultTimer);
    };
  }, [popup?.show, resultTimestamp, isTenDraw]);

  if (!popup?.show || !popup.result) return null;

  const result = popup.result;
  const isRegular = isLotteryResult(result);
  const regularConfig = isRegular ? getTierConfig(result.tier) : null;
  const upColor = !isRegular ? RARITY_COLORS[result.item.rarity] ?? '#3B82F6' : '';
  const accentColor = isRegular ? regularConfig!.color : upColor;

  const dismiss = () => gameDispatch({ type: 'DISMISS_LOTTERY_POPUP' });

  const renderTenDrawSummary = () => {
    if (!isTenDraw || !popup.allResults) return null;

    let totalCoins = 0;
    let duplicateCount = 0;

    for (const item of popup.allResults) {
      if (isLotteryResult(item)) {
        if (item.reward.type === 'coins') totalCoins += item.reward.amount;
      } else if (!item.isNew) {
        duplicateCount += 1;
        totalCoins += getCompensationCoins(item.item.rarity);
      }
    }

    return (
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-5 shadow-2xl animate-scale-in">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Sparkles size={18} className="text-amber-500" />
            十连抽结果
          </h3>
        </div>

        <div className="mb-4 grid grid-cols-5 gap-2">
          {popup.allResults.map((item, index) => {
            if (isLotteryResult(item)) {
              const cfg = getTierConfig(item.tier);
              return (
                <div
                  key={`${item.timestamp}-${index}`}
                  className="flex aspect-square flex-col items-center justify-center rounded-lg border"
                  style={{ borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}10` }}
                >
                  <span className="text-xl">{cfg.icon}</span>
                  <span className="text-[8px] font-bold" style={{ color: cfg.color }}>{item.tier}</span>
                </div>
              );
            }

            const color = RARITY_COLORS[item.item.rarity] ?? RARITY_COLORS.R;
            return (
              <div
                key={`${item.timestamp}-${index}`}
                className="flex aspect-square flex-col items-center justify-center rounded-lg border"
                style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}
              >
                <span className="text-xl">{item.item.icon}</span>
                <span className="text-[8px] font-bold" style={{ color }}>{item.item.rarity}</span>
              </div>
            );
          })}
        </div>

        {totalCoins > 0 && (
          <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-yellow-700">获得星币</span>
              <span className="flex items-center gap-1 text-sm font-bold text-yellow-700">
                <Star size={14} fill="currentColor" />
                {totalCoins}
              </span>
            </div>
            {duplicateCount > 0 && (
              <p className="mt-1 text-[10px] text-yellow-600">包含 {duplicateCount} 个重复物品补偿</p>
            )}
          </div>
        )}

        <button
          onClick={dismiss}
          className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-sm font-medium text-white transition-opacity active:opacity-80"
        >
          收下全部奖励
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm" onClick={event => event.stopPropagation()}>
        {phase === 'shaking' && (
          <div className="text-center animate-fade-in">
            <div className="mb-4 text-7xl animate-shake">{popup.pool === 'up' ? '✨' : '🎯'}</div>
            <p className="text-sm font-medium text-white/90">
              {isTenDraw ? '十连抽取中...' : popup.pool === 'up' ? '限时奖池抽取中...' : '诚心祈愿中...'}
            </p>
          </div>
        )}

        {phase === 'revealing' && (
          <div className="text-center animate-slide-out">
            <div className="mb-2 text-6xl">{popup.pool === 'up' ? '🎁' : '🎯'}</div>
            <p className="text-xs text-white/80">{isTenDraw ? '十连抽即将揭晓...' : '签已落定...'}</p>
          </div>
        )}

        {phase === 'summary' && renderTenDrawSummary()}

        {phase === 'result' && (
          <div className="relative overflow-hidden rounded-3xl bg-white p-6 text-center shadow-2xl animate-scale-in">
            <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: accentColor }} />

            {isRegular ? (
              <>
                <div className="mb-2 mt-1 text-5xl">{regularConfig!.icon}</div>
                <h3 className="mb-1 text-xl font-bold" style={{ color: regularConfig!.color }}>{regularConfig!.label}</h3>
                {result.isPity && (
                  <span className="mb-2 inline-block rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] text-secondary">保底触发</span>
                )}
                <div className="my-4">
                  {result.reward.type === 'makeup_card' && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-amber-700">
                      <Ticket size={16} />
                      <span className="text-sm font-semibold">获得 补签卡 x{result.reward.amount}</span>
                    </div>
                  )}
                  {result.reward.type === 'coins' && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-primary">
                      <Star size={16} />
                      <span className="text-sm font-semibold">获得 {result.reward.amount} 星币</span>
                    </div>
                  )}
                  {result.reward.type === 'blessing' && (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-sm italic text-text-muted">"{result.blessing}"</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mb-2 mt-1 text-5xl">{result.item.icon}</div>
                <span className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: upColor, backgroundColor: `${upColor}15` }}>
                  {result.item.rarity}
                </span>
                <h3 className="mb-0.5 text-lg font-bold" style={{ color: upColor }}>{result.item.name}</h3>
                <p className="mb-3 text-xs text-text-muted">{result.item.description}</p>
                {result.isNew ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-4 py-2 text-accent">
                    <span className="text-sm font-semibold">NEW! 首次获得</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2 text-yellow-700">
                    <Star size={14} />
                    <span className="text-sm font-medium">重复补偿 {getCompensationCoins(result.item.rarity)} 星币</span>
                  </div>
                )}
              </>
            )}

            <button
              onClick={dismiss}
              className="mt-4 w-full rounded-xl py-2.5 text-sm font-medium text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: accentColor }}
            >
              收下奖励
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
