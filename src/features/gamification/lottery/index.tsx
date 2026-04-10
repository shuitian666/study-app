import { useState, useMemo } from 'react';
import { useUser } from '@/store/UserContext';
import { useGame, isValidRedeemCode } from '@/store/GameContext';
import { PageHeader } from '@/components/ui/Common';
import { Sparkles, Clock, Star, Gift } from 'lucide-react';
import { drawLottery, LOTTERY_TIERS, drawFromUpPool } from '@/utils/lottery';
import type { LotteryResult, UpPoolResult } from '@/types';

type PoolTab = 'regular' | 'up';

const RARITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SSR: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  SR: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  R: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};

export default function LotteryPage() {
  const { navigate } = useUser();
  const { gameState, gameDispatch } = useGame();
  const { drawBalance, upPool, checkin, redeemedCodes } = gameState;
  const [activeTab, setActiveTab] = useState<PoolTab>('regular');
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // 安全的 upPool items - 防御性检查
  const safeUpPoolItems = useMemo(() => {
    if (!upPool || !Array.isArray(upPool.items) || upPool.items.length === 0) {
      return [];
    }
    return upPool.items;
  }, [upPool]);

  // 安全的 upPool 名称
  const safeUpPoolName = useMemo(() => {
    if (!upPool || typeof upPool.name !== 'string') {
      return '限时奖池';
    }
    return upPool.name;
  }, [upPool]);

  // 安全的 upPool 描述
  const safeUpPoolDesc = useMemo(() => {
    if (!upPool || typeof upPool.description !== 'string') {
      return '限时UP奖池';
    }
    return upPool.description;
  }, [upPool]);

  // 安全的 upPool banner
  const safeUpPoolBanner = useMemo(() => {
    if (!upPool || typeof upPool.banner !== 'string') {
      return '🎁';
    }
    return upPool.banner;
  }, [upPool]);

  // ---- Regular pool draw ----
  const handleRegularDraw = () => {
    if (drawBalance.regular <= 0) return;
    const { result } = drawLottery(checkin.lotteryPity);
    gameDispatch({ type: 'DRAW_REGULAR', payload: result });
    gameDispatch({
      type: 'SHOW_LOTTERY_POPUP',
      payload: { show: true, result, pool: 'regular', phase: 'shaking' },
    });
  };

  // ---- Regular pool 10 draws ----
  const handleRegularDrawTen = () => {
    if (drawBalance.regular < 10) return;
    const results: LotteryResult[] = [];
    let currentPity = checkin.lotteryPity;

    // 连续抽取10次，每次更新保底计数
    for (let i = 0; i < 10; i++) {
      const { result, newPity } = drawLottery(currentPity);
      results.push(result);
      gameDispatch({ type: 'DRAW_REGULAR', payload: result });
      currentPity = newPity;
    }

    // 弹出结果汇总，显示最后一次
    const lastResult = results[9];
    gameDispatch({
      type: 'SHOW_LOTTERY_POPUP',
      payload: { show: true, result: lastResult, pool: 'regular', phase: 'shaking', isTenDraw: true, allResults: results },
    });
  };

  // ---- UP pool draw ----
  const handleUpDraw = () => {
    if (drawBalance.up <= 0) return;
    const result = drawFromUpPool(upPool);
    gameDispatch({ type: 'DRAW_UP', payload: result });
    gameDispatch({
      type: 'SHOW_LOTTERY_POPUP',
      payload: { show: true, result, pool: 'up', phase: 'shaking' },
    });
  };

  // ---- UP pool 10 draws ----
  const handleUpDrawTen = () => {
    if (drawBalance.up < 10) return;
    const results: UpPoolResult[] = [];
    for (let i = 0; i < 10; i++) {
      results.push(drawFromUpPool(upPool));
    }
    // 依次派发：最后一个结果弹出展示
    for (let i = 0; i < 9; i++) {
      gameDispatch({ type: 'DRAW_UP', payload: results[i] });
    }
    // 最后一个结果弹出动画
    const lastResult = results[9];
    gameDispatch({ type: 'DRAW_UP', payload: lastResult });
    gameDispatch({
      type: 'SHOW_LOTTERY_POPUP',
      payload: { show: true, result: lastResult, pool: 'up', phase: 'shaking', isTenDraw: true, allResults: results },
    });
  };

  // ---- Redeem code ----
  const handleRedeem = () => {
    const code = redeemInput.trim();
    if (!code) return;
    if (redeemedCodes.includes(code)) {
      setRedeemMsg({ text: '该兑换码已使用过', ok: false });
      setTimeout(() => setRedeemMsg(null), 3000);
      return;
    }
    if (!isValidRedeemCode(code)) {
      setRedeemMsg({ text: '无效的兑换码', ok: false });
      setTimeout(() => setRedeemMsg(null), 3000);
      return;
    }
    gameDispatch({ type: 'REDEEM_CODE', payload: code });
    setRedeemInput('');
    setRedeemMsg({ text: '兑换成功!', ok: true });
    setTimeout(() => setRedeemMsg(null), 3000);
  };

  // Time remaining for UP pool
  const endDate = new Date(upPool.endDate);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86400000));

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="抽签" onBack={() => navigate('checkin')} />

      {/* Balance bar */}
      <div className="mx-4 mt-3 bg-white rounded-2xl p-4 border border-border shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{drawBalance.regular}</p>
              <p className="text-[10px] text-text-muted mt-0.5">常规抽签</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{drawBalance.up}</p>
              <p className="text-[10px] text-text-muted mt-0.5">UP池抽签</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-text-muted">保底距离</p>
            <p className="text-xs text-secondary font-medium">
              SR: {10 - checkin.lotteryPity.sinceLastSR}抽 | SSR: {80 - checkin.lotteryPity.sinceLastSSR}抽
            </p>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="mx-4 mt-4 flex bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('regular')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'regular' ? 'bg-white text-primary shadow-sm' : 'text-text-muted'
          }`}
        >
          🎋 常规池
        </button>
        <button
          onClick={() => setActiveTab('up')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'up' ? 'bg-white text-purple-600 shadow-sm' : 'text-text-muted'
          }`}
        >
          ✨ UP池
        </button>
      </div>

      {/* Regular pool content */}
      {activeTab === 'regular' && (
        <div className="mx-4 mt-4">
          <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
            <h3 className="text-sm font-semibold mb-3">常规奖池一览</h3>
            <div className="space-y-2">
              {LOTTERY_TIERS.map(config => (
                <div key={config.tier} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{config.icon}</span>
                    <div>
                      <span className="text-sm font-medium" style={{ color: config.color }}>{config.label}</span>
                      <span className="text-[10px] text-text-muted ml-1.5">
                        {config.rewardType === 'makeup_card' ? '补签卡x1' : config.rewardType === 'coins' ? `${config.rewardAmount}星币` : '一句祝福'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-muted">
                    {(config.probability * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Draw buttons - 单抽 + 十连抽 */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={handleRegularDraw}
              disabled={drawBalance.regular <= 0}
              className={`py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                drawBalance.regular > 0
                  ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/30 active:scale-[0.97]'
                  : 'bg-gray-100 text-text-muted cursor-not-allowed'
              }`}
            >
              {drawBalance.regular > 0 ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Sparkles size={14} />
                  单抽
                </span>
              ) : (
                '次数不足'
              )}
            </button>

            <button
              onClick={handleRegularDrawTen}
              disabled={drawBalance.regular < 10}
              className={`py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                drawBalance.regular >= 10
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 active:scale-[0.97]'
                  : 'bg-gray-100 text-text-muted cursor-not-allowed'
              }`}
            >
              {drawBalance.regular >= 10 ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Star size={14} />
                  十连抽 ({drawBalance.regular})
                </span>
              ) : (
                '需要10次'
              )}
            </button>
          </div>

          <p className="text-[10px] text-text-muted text-center mt-2">
            每日签到+1次 | 组队签到额外+1次
          </p>
        </div>
      )}

      {/* UP pool content */}
      {activeTab === 'up' && (
        <div className="mx-4 mt-4">
          {/* Banner */}
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-white font-bold text-base">{safeUpPoolBanner} {safeUpPoolName}</h3>
                <p className="text-white/70 text-xs mt-0.5">{safeUpPoolDesc}</p>
              </div>
              <div className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1">
                <Clock size={12} className="text-white/80" />
                <span className="text-white/80 text-xs">{daysLeft}天</span>
              </div>
            </div>
          </div>

          {/* UP pool items */}
          <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
            <h3 className="text-sm font-semibold mb-3">限时奖品</h3>
            {safeUpPoolItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {safeUpPoolItems.map(item => {
                  const rc = RARITY_COLORS[item.rarity] || RARITY_COLORS.R;
                  return (
                    <div key={item.id} className={`rounded-xl p-3 border ${rc.border} ${rc.bg} relative`}>
                      {item.owned && (
                        <div className="absolute top-1.5 right-1.5 bg-accent text-white text-[8px] px-1.5 py-0.5 rounded-full">
                          已拥有
                        </div>
                      )}
                      <div className="text-2xl mb-1">{item.icon}</div>
                      <p className={`text-xs font-semibold ${rc.text}`}>{item.name}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{item.description}</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className={`text-[9px] font-bold ${rc.text}`}>{item.rarity}</span>
                        <span className="text-[9px] text-text-muted">{(item.probability * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-text-muted text-sm">
                暂无可用奖品
              </div>
            )}
          </div>

          {/* UP draw buttons - 单抽 + 十连抽 */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={handleUpDraw}
              disabled={drawBalance.up <= 0}
              className={`py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                drawBalance.up > 0
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30 active:scale-[0.97]'
                  : 'bg-gray-100 text-text-muted cursor-not-allowed'
              }`}
            >
              {drawBalance.up > 0 ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Star size={14} />
                  单抽
                </span>
              ) : (
                '次数不足'
              )}
            </button>

            <button
              onClick={handleUpDrawTen}
              disabled={drawBalance.up < 10}
              className={`py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                drawBalance.up >= 10
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 active:scale-[0.97]'
                  : 'bg-gray-100 text-text-muted cursor-not-allowed'
              }`}
            >
              {drawBalance.up >= 10 ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Sparkles size={14} />
                  十连抽 ({drawBalance.up})
                </span>
              ) : (
                '需要10次'
              )}
            </button>
          </div>

          <p className="text-[10px] text-text-muted text-center mt-2">
            连续签到里程碑可获得UP池抽签次数
          </p>
        </div>
      )}

      {/* Redemption code */}
      <div className="mx-4 mt-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Gift size={14} className="text-accent" />
          兑换码
        </h3>
        <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex gap-2">
            <input
              type="text"
              value={redeemInput}
              onChange={e => setRedeemInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRedeem()}
              placeholder="输入兑换码"
              className="flex-1 px-3 py-2 text-sm border border-border rounded-xl bg-gray-50 focus:outline-none focus:border-primary focus:bg-white transition-colors"
            />
            <button
              onClick={handleRedeem}
              disabled={!redeemInput.trim()}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                redeemInput.trim()
                  ? 'bg-accent text-white active:scale-[0.97]'
                  : 'bg-gray-100 text-text-muted cursor-not-allowed'
              }`}
            >
              兑换
            </button>
          </div>
          {redeemMsg && (
            <p className={`text-xs mt-2 ${redeemMsg.ok ? 'text-accent' : 'text-red-500'}`}>
              {redeemMsg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
