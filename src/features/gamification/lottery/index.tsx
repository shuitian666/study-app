import { useMemo, useState } from 'react';
import { useUser } from '@/store/UserContext';
import { useGame, isValidRedeemCode } from '@/store/GameContext';
import { PageHeader } from '@/components/ui/Common';
import { Clock, Gift, Sparkles, Star } from 'lucide-react';
import { LOTTERY_TIERS } from '@/utils/lottery';
import { accountDrawLottery, accountRedeem } from '@/services/aiClient';
import { applyServerAccountPayload, logoutOnUnauthorized } from '@/store/accountSync';

type PoolTab = 'regular' | 'up';

const RARITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SSR: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  SR: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  R: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};

export default function LotteryPage() {
  const { userDispatch, navigate } = useUser();
  const { gameState, gameDispatch } = useGame();
  const { drawBalance, upPool, checkin, redeemedCodes } = gameState;
  const [activeTab, setActiveTab] = useState<PoolTab>('regular');
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const safeUpPoolItems = useMemo(() => {
    if (!upPool || !Array.isArray(upPool.items) || upPool.items.length === 0) return [];
    return upPool.items;
  }, [upPool]);
  const safeUpPoolName = typeof upPool?.name === 'string' ? upPool.name : '限时奖池';
  const safeUpPoolDesc = typeof upPool?.description === 'string' ? upPool.description : '限时 UP 奖池';
  const safeUpPoolBanner = typeof upPool?.banner === 'string' ? upPool.banner : '🎁';

  const handleDraw = async (pool: PoolTab, count: 1 | 10) => {
    if (drawing) return;
    if (pool === 'regular' && drawBalance.regular < count) return;
    if (pool === 'up' && drawBalance.up < count) return;

    setDrawing(true);
    try {
      applyServerAccountPayload(await accountDrawLottery(pool, count), userDispatch, gameDispatch);
    } catch (err) {
      logoutOnUnauthorized(err, userDispatch);
    } finally {
      setDrawing(false);
    }
  };

  const handleRedeem = async () => {
    const code = redeemInput.trim();
    if (!code || redeeming) return;
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

    setRedeeming(true);
    try {
      applyServerAccountPayload(await accountRedeem(code), userDispatch, gameDispatch);
      setRedeemInput('');
      setRedeemMsg({ text: '兑换成功', ok: true });
    } catch (err) {
      logoutOnUnauthorized(err, userDispatch);
      setRedeemMsg({ text: err instanceof Error ? err.message : '兑换失败', ok: false });
    } finally {
      setRedeeming(false);
      setTimeout(() => setRedeemMsg(null), 3000);
    }
  };

  const endDate = new Date(upPool.endDate);
  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000));

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="抽签" onBack={() => navigate('checkin')} />

      <div className="mx-4 mt-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{drawBalance.regular}</p>
              <p className="mt-0.5 text-[10px] text-text-muted">常规抽签</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{drawBalance.up}</p>
              <p className="mt-0.5 text-[10px] text-text-muted">UP 池抽签</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-text-muted">保底距离</p>
            <p className="text-xs font-medium text-secondary">
              SR: {10 - checkin.lotteryPity.sinceLastSR} 抽 | SSR: {80 - checkin.lotteryPity.sinceLastSSR} 抽
            </p>
          </div>
        </div>
      </div>

      <div className="mx-4 mt-4 flex rounded-xl bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab('regular')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${activeTab === 'regular' ? 'bg-white text-primary shadow-sm' : 'text-text-muted'}`}
        >
          🎇 常规池
        </button>
        <button
          onClick={() => setActiveTab('up')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${activeTab === 'up' ? 'bg-white text-purple-600 shadow-sm' : 'text-text-muted'}`}
        >
          ✨ UP 池
        </button>
      </div>

      {activeTab === 'regular' && (
        <div className="mx-4 mt-4">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold">常规奖池一览</h3>
            <div className="space-y-2">
              {LOTTERY_TIERS.map(config => (
                <div key={config.tier} className="flex items-center justify-between border-b border-gray-50 py-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{config.icon}</span>
                    <div>
                      <span className="text-sm font-medium" style={{ color: config.color }}>{config.label}</span>
                      <span className="ml-1.5 text-[10px] text-text-muted">
                        {config.rewardType === 'makeup_card' ? '补签卡 x1' : config.rewardType === 'coins' ? `${config.rewardAmount} 星币` : '一句祝福'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-muted">{(config.probability * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => void handleDraw('regular', 1)}
              disabled={drawing || drawBalance.regular <= 0}
              className={`rounded-2xl py-3.5 text-sm font-semibold transition-all ${
                drawBalance.regular > 0 ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/30 active:scale-[0.97]' : 'cursor-not-allowed bg-gray-100 text-text-muted'
              }`}
            >
              {drawBalance.regular > 0 ? <span className="flex items-center justify-center gap-1.5"><Sparkles size={14} />单抽</span> : '次数不足'}
            </button>
            <button
              onClick={() => void handleDraw('regular', 10)}
              disabled={drawing || drawBalance.regular < 10}
              className={`rounded-2xl py-3.5 text-sm font-semibold transition-all ${
                drawBalance.regular >= 10 ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 active:scale-[0.97]' : 'cursor-not-allowed bg-gray-100 text-text-muted'
              }`}
            >
              {drawBalance.regular >= 10 ? <span className="flex items-center justify-center gap-1.5"><Star size={14} />十连抽 ({drawBalance.regular})</span> : '需要 10 次'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'up' && (
        <div className="mx-4 mt-4">
          <div className="mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{safeUpPoolBanner} {safeUpPoolName}</h3>
                <p className="mt-0.5 text-xs text-white/70">{safeUpPoolDesc}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
                <Clock size={12} className="text-white/80" />
                <span className="text-xs text-white/80">{daysLeft} 天</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold">限时奖品</h3>
            {safeUpPoolItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {safeUpPoolItems.map(item => {
                  const rc = RARITY_COLORS[item.rarity] || RARITY_COLORS.R;
                  return (
                    <div key={item.id} className={`relative rounded-xl border p-3 ${rc.border} ${rc.bg}`}>
                      {item.owned && <div className="absolute right-1.5 top-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[8px] text-white">已拥有</div>}
                      <div className="mb-1 text-2xl">{item.icon}</div>
                      <p className={`text-xs font-semibold ${rc.text}`}>{item.name}</p>
                      <p className="mt-0.5 text-[10px] text-text-muted">{item.description}</p>
                      <div className="mt-1.5 flex items-center gap-1">
                        <span className={`text-[9px] font-bold ${rc.text}`}>{item.rarity}</span>
                        <span className="text-[9px] text-text-muted">{(item.probability * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-text-muted">暂无可用奖品</div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => void handleDraw('up', 1)}
              disabled={drawing || drawBalance.up <= 0}
              className={`rounded-2xl py-3.5 text-sm font-semibold transition-all ${
                drawBalance.up > 0 ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30 active:scale-[0.97]' : 'cursor-not-allowed bg-gray-100 text-text-muted'
              }`}
            >
              {drawBalance.up > 0 ? <span className="flex items-center justify-center gap-1.5"><Star size={14} />单抽</span> : '次数不足'}
            </button>
            <button
              onClick={() => void handleDraw('up', 10)}
              disabled={drawing || drawBalance.up < 10}
              className={`rounded-2xl py-3.5 text-sm font-semibold transition-all ${
                drawBalance.up >= 10 ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 active:scale-[0.97]' : 'cursor-not-allowed bg-gray-100 text-text-muted'
              }`}
            >
              {drawBalance.up >= 10 ? <span className="flex items-center justify-center gap-1.5"><Sparkles size={14} />十连抽 ({drawBalance.up})</span> : '需要 10 次'}
            </button>
          </div>
        </div>
      )}

      <div className="mx-4 mt-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Gift size={14} className="text-accent" />
          兑换码
        </h3>
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex gap-2">
            <input
              type="text"
              value={redeemInput}
              onChange={event => setRedeemInput(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') void handleRedeem(); }}
              placeholder="输入兑换码"
              className="flex-1 rounded-xl border border-border bg-gray-50 px-3 py-2 text-sm transition-colors focus:border-primary focus:bg-white focus:outline-none"
            />
            <button
              onClick={() => void handleRedeem()}
              disabled={redeeming || !redeemInput.trim()}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                redeemInput.trim() ? 'bg-accent text-white active:scale-[0.97]' : 'cursor-not-allowed bg-gray-100 text-text-muted'
              }`}
            >
              兑换
            </button>
          </div>
          {redeemMsg && <p className={`mt-2 text-xs ${redeemMsg.ok ? 'text-accent' : 'text-red-500'}`}>{redeemMsg.text}</p>}
        </div>
      </div>
    </div>
  );
}
