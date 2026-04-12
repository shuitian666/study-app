import { useState, useEffect, useRef } from 'react';
import { useGame } from '@/store/GameContext';
import { useUser } from '@/store/UserContext';
import { Star, Ticket, Sparkles } from 'lucide-react';
import { getTierConfig } from '@/utils/lottery';
import type { LotteryResult, UpPoolResult, LotteryPopup } from '@/types';

function isLotteryResult(r: LotteryResult | UpPoolResult): r is LotteryResult {
  return 'tier' in r;
}

const RARITY_COLORS: Record<string, string> = {
  SSR: '#FFD700',
  SR: '#8B5CF6',
  R: '#3B82F6',
  N: '#9CA3AF',
};

// 根据稀有度获取补偿星币数
function getCompensationCoins(rarity: string): number {
  switch(rarity) {
    case 'N': return 10;
    case 'R': return 30;
    case 'SR': return 60;
    case 'SSR': return 150;
    default: return 10;
  }
}

export default function LotteryDrawModal() {
  const { gameState, gameDispatch } = useGame();
  const { userState, userDispatch } = useUser();
  const popup: LotteryPopup | null = gameState.lotteryPopup;
  const [phase, setPhase] = useState<'shaking' | 'revealing' | 'result' | 'summary'>('shaking');
  const compensationAddedRef = useRef(false);
  const popupRef = useRef(popup);
  const userRef = useRef(userState.user);

  // 保持最新值的引用
  useEffect(() => {
    popupRef.current = popup;
    userRef.current = userState.user;
  }, [popup, userState.user]);

  const resultTimestamp = popup?.result
    ? ('timestamp' in popup.result ? popup.result.timestamp : '')
    : '';

  const isTenDraw = popup?.isTenDraw && popup?.allResults && popup.allResults.length === 10;

  // 动画阶段控制
  useEffect(() => {
    if (!popup?.show) {
      setPhase('shaking');
      compensationAddedRef.current = false;
      return;
    }
    setPhase('shaking');
    compensationAddedRef.current = false;
    const t1 = setTimeout(() => setPhase('revealing'), 1500);
    const t2 = setTimeout(() => {
      if (isTenDraw) {
        setPhase('summary');
      } else {
        setPhase('result');
      }
    }, 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [popup?.show, resultTimestamp, isTenDraw]);

  // 星币奖励和物品处理（独立的useEffect，避免影响动画）
  useEffect(() => {
    if (phase !== 'result' && phase !== 'summary') return;
    if (compensationAddedRef.current) return;
    if (!userRef.current || !popupRef.current?.result) return;

    let totalCoins = 0;
    const currentPopup = popupRef.current;
    const itemsToAdd: Array<{item: any}> = [];
    
    // 获取当前背包中的物品名称列表
    const ownedItemNames = new Set(
      gameState.inventory.items.map(i => i.name)
    );
    
    if (currentPopup.allResults) {
      // 十连抽
      currentPopup.allResults.forEach(result => {
        if (isLotteryResult(result)) {
          // 常规池子直接获得星币
          if (result.reward.type === 'coins') {
            totalCoins += result.reward.amount;
          }
        } else {
          // UP池
          const upResult = result as UpPoolResult;
          if (ownedItemNames.has(upResult.item.name)) {
            // 已拥有，补偿星币
            totalCoins += getCompensationCoins(upResult.item.rarity);
          } else {
            // 新物品添加到背包
            itemsToAdd.push({ item: upResult.item });
            ownedItemNames.add(upResult.item.name); // 防止十连抽重复添加
          }
        }
      });
    } else if (currentPopup.result) {
      // 单抽
      if (isLotteryResult(currentPopup.result)) {
        // 常规池子
        if (currentPopup.result.reward.type === 'coins') {
          totalCoins = currentPopup.result.reward.amount;
        }
      } else {
        // UP池
        const upResult = currentPopup.result as UpPoolResult;
        if (ownedItemNames.has(upResult.item.name)) {
          // 已拥有，补偿星币
          totalCoins = getCompensationCoins(upResult.item.rarity);
        } else {
          // 新物品添加到背包
          itemsToAdd.push({ item: upResult.item });
        }
      }
    }
    
    // 添加星币
    if (totalCoins > 0) {
      userDispatch({
        type: 'UPDATE_USER',
        payload: { totalPoints: userRef.current.totalPoints + totalCoins }
      });
      // 记录星币账单
      gameDispatch({
        type: 'ADD_COIN_BILL',
        payload: {
          type: 'lottery_reward',
          amount: totalCoins,
          description: '抽奖奖励',
        }
      });
      console.log(`[抽奖] 获得 ${totalCoins} 星币`);
    }
    
    // 添加物品到背包
    itemsToAdd.forEach(({ item }) => {
      const inventoryItem = {
        id: `inv-lottery-${item.id}-${Date.now()}`,
        type: item.type,
        name: item.name,
        description: item.description || `抽签获得: ${item.name}`,
        icon: item.icon,
        rarity: item.rarity,
        quantity: 1,
        obtainedAt: new Date().toISOString(),
        source: 'lottery' as const,
        usable: false,
      };
      gameDispatch({ type: 'ADD_INVENTORY_ITEM', payload: inventoryItem });
      console.log(`[抽奖] 获得物品: ${item.name}`);
    });

    compensationAddedRef.current = true;
  }, [phase, gameDispatch, gameState.inventory.items]);

  if (!popup?.show || !popup.result) return null;

  const result = popup.result;
  const isRegular = isLotteryResult(result);

  // Colors & labels for regular pool
  const regularConfig = isRegular ? getTierConfig(result.tier) : null;

  // Color for UP pool based on rarity
  const upColor = !isRegular ? RARITY_COLORS[result.item.rarity] ?? '#3B82F6' : '';

  const accentColor = isRegular ? regularConfig!.color : upColor;

  // 渲染十连抽结果汇总
  const renderTenDrawSummary = () => {
    if (!isTenDraw || !popup.allResults) return null;

    return (
      <div className="bg-white rounded-3xl p-5 shadow-2xl animate-scale-in overflow-hidden relative max-w-sm w-full">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" />
            十连抽结果
          </h3>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {popup.allResults.map((item, index) => {
            if (isLotteryResult(item)) {
              const cfg = getTierConfig(item.tier);
              return (
                <div
                  key={index}
                  className="aspect-square rounded-lg flex flex-col items-center justify-center border"
                  style={{ borderColor: cfg.color + '40', backgroundColor: cfg.color + '10' }}
                >
                  <span className="text-xl">{cfg.icon}</span>
                  <span className="text-[8px] font-bold" style={{ color: cfg.color }}>
                    {cfg.tier}
                  </span>
                </div>
              );
            } else {
              const color = RARITY_COLORS[item.item.rarity];
              return (
                <div
                  key={index}
                  className="aspect-square rounded-lg flex flex-col items-center justify-center border"
                  style={{ borderColor: color + '40', backgroundColor: color + '10' }}
                >
                  <span className="text-xl">{item.item.icon}</span>
                  <span className="text-[8px] font-bold" style={{ color }}>
                    {item.item.rarity}
                  </span>
                </div>
              );
            }
          })}
        </div>

        {/* 统计信息 */}
        {(() => {
          // 计算十连抽的统计信息
          let totalCoins = 0;
          let duplicateCount = 0;
          
          if (popup.allResults) {
            popup.allResults.forEach(item => {
              if (isLotteryResult(item)) {
                // 常规池子直接获得星币
                if (item.reward.type === 'coins') {
                  totalCoins += item.reward.amount;
                }
              } else {
                // UP池重复物品补偿
                if (!item.isNew) {
                  totalCoins += getCompensationCoins(item.item.rarity);
                  duplicateCount++;
                }
              }
            });
          }
          
          return totalCoins > 0 ? (
            <div className="mb-4 p-3 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-yellow-700">获得星币</span>
                <span className="text-sm font-bold text-yellow-700 flex items-center gap-1">
                  <Star size={14} fill="currentColor" />
                  {totalCoins}
                </span>
              </div>
              {duplicateCount > 0 && (
                <p className="text-[10px] text-yellow-600 mt-1">
                  包含 {duplicateCount} 个重复物品补偿
                </p>
              )}
            </div>
          ) : null;
        })()}

        {/* 最后一个结果详情 */}
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <p className="text-xs text-text-muted mb-2">最后一击</p>
          {isRegular ? (
            <div className="flex items-center gap-3">
              <span className="text-3xl">{regularConfig!.icon}</span>
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: regularConfig!.color }}>
                  {regularConfig!.label}
                </p>
                {result.isPity && (
                  <span className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-full">
                    保底触发
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-3xl">{(result as UpPoolResult).item.icon}</span>
              <div className="text-left">
                <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-1" style={{ color: upColor, backgroundColor: `${upColor}15` }}>
                  {(result as UpPoolResult).item.rarity}
                </span>
                <p className="text-sm font-bold" style={{ color: upColor }}>
                  {(result as UpPoolResult).item.name}
                </p>
                {!(result as UpPoolResult).isNew && (
                  <p className="text-[10px] text-yellow-600 mt-0.5">
                    重复获得，补偿 {getCompensationCoins((result as UpPoolResult).item.rarity)} 星币
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => gameDispatch({ type: 'DISMISS_LOTTERY_POPUP' })}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-white active:opacity-80 transition-opacity bg-gradient-to-r from-amber-500 to-orange-500"
        >
          收下全部奖励
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>

        {/* Shaking phase */}
        {phase === 'shaking' && (
          <div className="text-center animate-fade-in">
            <div className="text-7xl mb-4 animate-shake">
              {popup.pool === 'up' ? '✨' : '🏮'}
            </div>
            <p className="text-white/90 text-sm font-medium">
              {isTenDraw ? '十连抽取中...' : popup.pool === 'up' ? '限时奖池抽取中...' : '诚心祈愿中...'}
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
              {isTenDraw ? '十连抽即将揭晓...' : popup.pool === 'up' ? '即将揭晓...' : '签已落定...'}
            </p>
          </div>
        )}

        {/* Summary phase for ten draws */}
        {phase === 'summary' && renderTenDrawSummary()}

        {/* Result phase for single draw */}
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
                <div className="text-5xl mb-2 mt-1">{(result as UpPoolResult).item.icon}</div>
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1" style={{ color: upColor, backgroundColor: `${upColor}15` }}>
                  {(result as UpPoolResult).item.rarity}
                </span>
                <h3 className="text-lg font-bold mb-0.5" style={{ color: upColor }}>
                  {(result as UpPoolResult).item.name}
                </h3>
                <p className="text-xs text-text-muted mb-3">{(result as UpPoolResult).item.description}</p>
                {(result as UpPoolResult).isNew ? (
                  <div className="inline-flex items-center gap-1.5 bg-accent/5 text-accent px-4 py-2 rounded-full border border-accent/20">
                    <span className="text-sm font-semibold">NEW! 首次获得</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="inline-flex items-center gap-1.5 bg-gray-50 text-text-muted px-4 py-2 rounded-full border border-gray-200">
                      <span className="text-sm">已拥有</span>
                    </div>
                    {/* 显示星币补偿 - 按照你的要求，补偿数量要在这里显示出来 */}
                    <div className="inline-flex items-center gap-1.5 bg-yellow-50 text-yellow-700 px-4 py-2 rounded-full border border-yellow-200">
                      <Star size={14} />
                      <span className="text-sm font-medium">补偿 {
                        (() => {
                          switch((result as UpPoolResult).item.rarity) {
                            case 'N': return 10;
                            case 'R': return 30;
                            case 'SR': return 60;
                            case 'SSR': return 150;
                            default: return 10;
                          }
                        })()} 星币
                      </span>
                    </div>
                  </div>
                )}
                <div className="mt-3" />
              </>
            )}

            {/* Dismiss button */}
            <button
              onClick={() => gameDispatch({ type: 'DISMISS_LOTTERY_POPUP' })}
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
