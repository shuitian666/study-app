import { useState } from 'react';
import { Check, CheckCircle, Copy, Gift, ShoppingBag, Star } from 'lucide-react';
import { PageHeader } from '@/components/ui/Common';
import { useGame, isValidRedeemCode, REDEMPTION_CODES } from '@/store/GameContext';
import { useUser } from '@/store/UserContext';
import type { ShopItem, ShopItemType, UpPoolItem } from '@/types';
import { createInventoryItemFromReward, isInventoryRewardOwned } from '@/utils/rewardGranting';

const TYPE_LABELS: Record<ShopItemType, string> = {
  makeup_card: '功能道具',
  avatar_frame: '头像框',
  background: '背景',
  theme_skin: '主题皮肤',
  ai_skin: 'AI皮肤',
  theme: '主题',
  vip_card: 'VIP会员',
  coin_bag: '星币包',
};

const STACKABLE_SHOP_TYPES = new Set<ShopItemType>(['makeup_card', 'coin_bag', 'vip_card']);

function toRewardItem(item: ShopItem): UpPoolItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    icon: item.icon,
    type: item.type === 'theme_skin' || item.type === 'ai_skin' ? 'theme' : item.type as UpPoolItem['type'],
    rarity: item.rarity || 'N',
    probability: 1,
    owned: false,
  };
}

export default function ShopPage() {
  const { userState, userDispatch, navigate } = useUser();
  const { gameState, gameDispatch } = useGame();
  const [tab, setTab] = useState<ShopItemType | 'all' | 'redeem'>('all');
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemMessage, setRedeemMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const coins = userState.user?.totalPoints ?? 0;

  const isOwned = (item: ShopItem) => {
    if (STACKABLE_SHOP_TYPES.has(item.type)) return false;
    return isInventoryRewardOwned(userState.inventory, toRewardItem(item));
  };

  const filtered = tab === 'all'
    ? gameState.shopItems
    : tab === 'redeem'
      ? []
      : gameState.shopItems.filter(item => item.type === tab);

  const handleBuy = (itemId: string) => {
    const item = gameState.shopItems.find(entry => entry.id === itemId);
    if (!item || coins < item.price) return;
    if (!STACKABLE_SHOP_TYPES.has(item.type) && isOwned(item)) return;

    userDispatch({ type: 'ADD_STAR_COINS', payload: -item.price });

    if (item.type !== 'makeup_card') {
      userDispatch({
        type: 'ADD_INVENTORY_ITEM',
        payload: createInventoryItemFromReward(toRewardItem(item), 'shop', 'inv-shop'),
      });
    }

    gameDispatch({ type: 'BUY_SHOP_ITEM', payload: itemId });
  };

  const handleRedeem = () => {
    const code = redeemInput.trim();
    if (!code) return;

    if (gameState.redeemedCodes.includes(code)) {
      setRedeemMessage({ type: 'error', text: '该兑换码已经使用过' });
      setTimeout(() => setRedeemMessage(null), 3000);
      return;
    }

    if (!isValidRedeemCode(code)) {
      setRedeemMessage({ type: 'error', text: '无效的兑换码' });
      setTimeout(() => setRedeemMessage(null), 3000);
      return;
    }

    const reward = REDEMPTION_CODES[code];
    gameDispatch({ type: 'REDEEM_CODE', payload: code });
    if (reward.coins > 0) {
      userDispatch({ type: 'ADD_STAR_COINS', payload: reward.coins });
    }

    const rewardText = [
      reward.upDraws > 0 ? `UP抽签 +${reward.upDraws}` : '',
      reward.regularDraws > 0 ? `常规抽签 +${reward.regularDraws}` : '',
      reward.coins > 0 ? `星币 +${reward.coins}` : '',
    ].filter(Boolean).join(' ');

    setRedeemMessage({ type: 'success', text: `兑换成功：${rewardText}` });
    setRedeemInput('');
    setTimeout(() => setRedeemMessage(null), 3000);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="商城" onBack={() => navigate('profile')} />

      <div className="mx-4 mt-3 flex items-center justify-between rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-400 p-4 text-white">
        <div className="flex items-center gap-2">
          <ShoppingBag size={20} />
          <span className="font-bold">星币商城</span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1">
          <Star size={14} fill="currentColor" />
          <span className="font-bold">{coins}</span>
        </div>
      </div>

      <div className="mx-4 mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setTab('all')}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
          }`}
        >
          全部
        </button>
        {(Object.entries(TYPE_LABELS) as [ShopItemType, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === key ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setTab('redeem')}
          className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === 'redeem' ? 'bg-pink-500 text-white' : 'bg-pink-50 text-pink-600'
          }`}
        >
          <Gift size={12} />
          兑换码
        </button>
      </div>

      {tab === 'redeem' ? (
        <div className="mx-4 mt-4">
          <div className="mb-4">
            <h4 className="mb-2 text-sm font-medium text-text-secondary">可用兑换码</h4>
            <div className="space-y-2">
              {Object.entries(REDEMPTION_CODES).map(([code, reward]) => {
                const isUsed = gameState.redeemedCodes.includes(code);
                const rewardText = [
                  reward.upDraws > 0 ? `UP抽签 ${reward.upDraws}` : '',
                  reward.regularDraws > 0 ? `常规 +${reward.regularDraws}` : '',
                  reward.coins > 0 ? `${reward.coins}星币` : '',
                ].filter(Boolean).join(' ');

                return (
                  <div key={code} className={`rounded-xl border bg-white p-3 ${isUsed ? 'border-gray-200 opacity-60' : 'border-pink-200'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-mono text-sm font-bold">{code}</span>
                        {isUsed ? (
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">已使用</span>
                        ) : (
                          <button onClick={() => handleCopyCode(code)} className="rounded bg-pink-50 p-1 text-pink-600 hover:bg-pink-100">
                            {copied === code ? <CheckCircle size={14} /> : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-medium text-pink-600">{rewardText}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4">
            <h4 className="mb-3 text-sm font-medium">输入兑换码</h4>
            <input
              type="text"
              value={redeemInput}
              onChange={event => { setRedeemInput(event.target.value); setRedeemMessage(null); }}
              onKeyDown={event => event.key === 'Enter' && handleRedeem()}
              placeholder="请输入兑换码"
              className="mb-3 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
            />
            {redeemMessage && (
              <div className={`mb-3 rounded-xl border p-3 text-sm ${
                redeemMessage.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}>
                {redeemMessage.text}
              </div>
            )}
            <button
              onClick={handleRedeem}
              disabled={!redeemInput.trim()}
              className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              确认兑换
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
          {filtered.map(item => {
            const owned = isOwned(item);
            return (
              <div key={item.id} className="flex flex-col items-center rounded-2xl border border-border bg-white p-4 shadow-sm">
                <div className="mb-2 text-4xl">{item.icon}</div>
                <h4 className="mb-0.5 text-sm font-medium">{item.name}</h4>
                <p className="mb-3 text-center text-[10px] text-text-muted">{item.description}</p>

                {owned ? (
                  <div className="flex items-center gap-1 text-xs font-medium text-accent">
                    <Check size={12} />
                    已拥有
                  </div>
                ) : (
                  <button
                    onClick={() => handleBuy(item.id)}
                    disabled={coins < item.price}
                    className={`flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all ${
                      coins >= item.price
                        ? 'bg-primary text-white active:scale-[0.97]'
                        : 'cursor-not-allowed bg-gray-100 text-text-muted'
                    }`}
                  >
                    <Star size={10} fill="currentColor" />
                    {item.price}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
