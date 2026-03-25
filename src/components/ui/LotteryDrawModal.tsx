import { useState, useEffect } from 'react';
import { useApp } from '@/store/AppContext';
import { Star, Ticket } from 'lucide-react';
import { getTierConfig } from '@/utils/lottery';
import type { LotteryResult, UpPoolResult } from '@/types';

function isLotteryResult(r: LotteryResult | UpPoolResult): r is LotteryResult {
  return 'tier' in r;
}

const RARITY_COLORS: Record<string, string> = {
  SSR: '#FFD700',
  SR: '#8B5CF6',
  R: '#3B82F6',
};

export default function LotteryDrawModal() {
  const { state, dispatch } = useApp();
  const popup = state.lotteryPopup;
  const [phase, setPhase] = useState<'shaking' | 'revealing' | 'result'>('shaking');

  const resultTimestamp = popup?.result
    ? ('timestamp' in popup.result ? popup.result.timestamp : '')
    : '';

  useEffect(() => {
    if (!popup?.show) {
      setPhase('shaking');
      return;
    }
    setPhase('shaking');
    const t1 = setTimeout(() => setPhase('revealing'), 1500);
    const t2 = setTimeout(() => setPhase('result'), 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [popup?.show, resultTimestamp]);

  if (!popup?.show || !popup.result) return null;

  const result = popup.result;
  const isRegular = isLotteryResult(result);

  // Colors & labels for regular pool
  const regularConfig = isRegular ? getTierConfig(result.tier) : null;

  // Color for UP pool based on rarity
  const upColor = !isRegular ? RARITY_COLORS[result.item.rarity] ?? '#3B82F6' : '';

  const accentColor = isRegular ? regularConfig!.color : upColor;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-w-xs w-full mx-6" onClick={e => e.stopPropagation()}>

        {/* Shaking phase */}
        {phase === 'shaking' && (
          <div className="text-center animate-fade-in">
            <div className="text-7xl mb-4 animate-shake">
              {popup.pool === 'up' ? '✨' : '🏮'}
            </div>
            <p className="text-white/90 text-sm font-medium">
              {popup.pool === 'up' ? '限时奖池抽取中...' : '诚心祈愿中...'}
            </p>
            <div className="flex justify-center gap-1 mt-2">
              <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}

        {/* Revealing phase */}
        {phase === 'revealing' && (
          <div className="text-center animate-slide-out">
            <div className="text-6xl mb-2">{popup.pool === 'up' ? '🎁' : '🎋'}</div>
            <p className="text-white/80 text-xs">
              {popup.pool === 'up' ? '即将揭晓...' : '签已落定...'}
            </p>
          </div>
        )}

        {/* Result phase */}
        {phase === 'result' && (
          <div className="bg-white rounded-3xl p-6 text-center shadow-2xl animate-scale-in overflow-hidden relative">
            {/* Decorative top stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: accentColor }} />

            {isRegular ? (
              <>
                {/* Regular pool result */}
                <div className="text-5xl mb-2 mt-1">{regularConfig!.icon}</div>
                <h3 className="text-xl font-bold mb-1" style={{ color: regularConfig!.color }}>
                  {regularConfig!.label}
                </h3>
                {result.isPity && (
                  <span className="inline-block text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full mb-2">
                    保底触发
                  </span>
                )}
                <div className="my-4">
                  {result.reward.type === 'makeup_card' && (
                    <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-4 py-2 rounded-full border border-amber-200">
                      <Ticket size={16} />
                      <span className="text-sm font-semibold">获得 补签卡 x1</span>
                    </div>
                  )}
                  {result.reward.type === 'coins' && (
                    <div className="inline-flex items-center gap-1.5 bg-primary/5 text-primary px-4 py-2 rounded-full border border-primary/20">
                      <Star size={16} />
                      <span className="text-sm font-semibold">获得 {result.reward.amount} 星币</span>
                    </div>
                  )}
                  {result.reward.type === 'blessing' && (
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-sm text-text-muted italic">"{result.blessing}"</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* UP pool result */}
                <div className="text-5xl mb-2 mt-1">{result.item.icon}</div>
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1" style={{ color: upColor, backgroundColor: `${upColor}15` }}>
                  {result.item.rarity}
                </span>
                <h3 className="text-lg font-bold mb-0.5" style={{ color: upColor }}>
                  {result.item.name}
                </h3>
                <p className="text-xs text-text-muted mb-3">{result.item.description}</p>
                {result.isNew ? (
                  <div className="inline-flex items-center gap-1.5 bg-accent/5 text-accent px-4 py-2 rounded-full border border-accent/20">
                    <span className="text-sm font-semibold">NEW! 首次获得</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 bg-gray-50 text-text-muted px-4 py-2 rounded-full border border-gray-200">
                    <span className="text-sm">已拥有</span>
                  </div>
                )}
                <div className="mt-3" />
              </>
            )}

            {/* Dismiss button */}
            <button
              onClick={() => dispatch({ type: 'DISMISS_LOTTERY_POPUP' })}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white active:opacity-80 transition-opacity"
              style={{ backgroundColor: accentColor }}
            >
              {isRegular && result.tier === 'NN' ? '收下好运' : '太棒了!'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
