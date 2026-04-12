import { useUser } from '@/store/UserContext';
import { useGame, isValidRedeemCode } from '@/store/GameContext';
import { PageHeader } from '@/components/ui/Common';
import { ShoppingBag, Star, Check, Gift, Copy, CheckCircle } from 'lucide-react';
import type { ShopItemType } from '@/types';
import { useState } from 'react';

const TYPE_LABELS: Record<ShopItemType, string> = {
  makeup_card: '功能道具',
  avatar_frame: '头像框',
  background: '背景板',
  theme_skin: '主题皮肤',
  ai_skin: 'AI助手皮肤',
  theme: '主题',
  vip_card: 'VIP会员',
  coin_bag: '金币袋',
};

// 兑换码配置（与 GameContext 中的保持一致）
const REDEMPTION_CODES: Record<string, { upDraws: number; regularDraws: number; coins: number }> = {
  '学习使我快乐': { upDraws: 10, regularDraws: 0, coins: 0 },
  '勤奋好学': { upDraws: 5, regularDraws: 0, coins: 0 },
  '创作者体验': { upDraws: 99, regularDraws: 99, coins: 9999 },
};

export default function ShopPage() {
  const { userState, userDispatch, navigate } = useUser();
  const { gameState, gameDispatch } = useGame();
  const [tab, setTab] = useState<ShopItemType | 'all' | 'redeem'>('all');
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemMessage, setRedeemMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const coins = userState.user?.totalPoints ?? 0;

  // 检查物品是否已在背包中（用于非可堆叠物品）
  const isOwned = (item: typeof gameState.shopItems[0]) => {
    // 可堆叠物品（补签卡等）不显示"已拥有"
    if (item.type === 'makeup_card' || item.type === 'coin_bag' || item.type === 'vip_card') {
      return false;
    }
    // 检查背包中是否有该物品
    return gameState.inventory.items.some(i => i.name === item.name);
  };

  const filtered = tab === 'all'
    ? gameState.shopItems
    : tab === 'redeem'
      ? []
      : gameState.shopItems.filter(i => i.type === tab);

  const handleBuy = (itemId: string) => {
    const item = gameState.shopItems.find(i => i.id === itemId);
    if (!item) return;
    // 可堆叠物品可以重复购买，非可堆叠物品检查是否已拥有
    if (item.type !== 'makeup_card' && item.type !== 'coin_bag' && item.type !== 'vip_card') {
      if (isOwned(item)) return;
    }
    if (coins < item.price) return;

    // 消耗星币
    userDispatch({
      type: 'UPDATE_USER',
      payload: { totalPoints: coins - item.price }
    });

    // 补签卡不添加到背包，直接增加补签卡数量
    if (item.type === 'makeup_card') {
      gameDispatch({ type: 'BUY_SHOP_ITEM', payload: itemId });
      return;
    }

    // 将物品添加到背包
    // 类型映射：商店类型 -> 背包类型
    const typeMapping: Record<string, string> = {
      'theme_skin': 'theme',
      'ai_skin': 'theme',
    };
    const inventoryItem = {
      id: `inv-${item.id}-${Date.now()}`,
      type: (typeMapping[item.type] || item.type) as any,
      name: item.name,
      description: item.description || `购买获得: ${item.name}`,
      icon: item.icon,
      rarity: item.rarity || 'N',
      quantity: 1,
      obtainedAt: new Date().toISOString(),
      source: 'shop' as const,
      usable: item.type === 'vip_card',
    };
    gameDispatch({ type: 'ADD_INVENTORY_ITEM', payload: inventoryItem });

    // 购买物品
    gameDispatch({ type: 'BUY_SHOP_ITEM', payload: itemId });
  };

  const handleRedeem = () => {
    if (!redeemInput.trim()) return;
    const code = redeemInput.trim();

    if (gameState.redeemedCodes.includes(code)) {
      setRedeemMessage({ type: 'error', text: '该兑换码已使用过' });
      setTimeout(() => setRedeemMessage(null), 3000);
      return;
    }

    if (!isValidRedeemCode(code)) {
      setRedeemMessage({ type: 'error', text: '无效的兑换码' });
      setTimeout(() => setRedeemMessage(null), 3000);
      return;
    }

    // 使用 GameContext 的兑换码系统
    gameDispatch({ type: 'REDEEM_CODE', payload: code });

    const reward = REDEMPTION_CODES[code];
    let rewardText = '';
    if (reward.upDraws > 0) rewardText += `UP抽签 +${reward.upDraws} `;
    if (reward.regularDraws > 0) rewardText += `常规抽签 +${reward.regularDraws} `;
    if (reward.coins > 0) {
      rewardText += `星币 +${reward.coins}`;
      // 直接给星币
      userDispatch({
        type: 'UPDATE_USER',
        payload: { totalPoints: (userState.user?.totalPoints ?? 0) + reward.coins }
      });
    }

    setRedeemMessage({ type: 'success', text: `兑换成功！${rewardText.trim()}` });
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

      {/* Coins bar */}
      <div className="mx-4 mt-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag size={20} />
          <span className="font-bold">星币商城</span>
        </div>

        <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
          <Star size={14} fill="currentColor" />
          <span className="font-bold">{coins}</span>
        </div>

      </div>


      {/* Category tabs */}
      <div className="mx-4 mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setTab('all')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            tab === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'

          }`}
        >
          全部
        </button>

        {(Object.entries(TYPE_LABELS) as [ShopItemType, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === key ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}

        <button
          onClick={() => setTab('redeem')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
            tab === 'redeem' ? 'bg-pink-500 text-white' : 'bg-pink-50 text-pink-600'
          }`}
        >
          <Gift size={12} />
          兑换码
        </button>
      </div>

      {/* 兑换码区域 */}
      {tab === 'redeem' && (
        <div className="mx-4 mt-4">
          {/* 可用兑换码列表 */}
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2 text-text-secondary">可用兑换码</h4>
            <div className="space-y-2">
              {Object.entries(REDEMPTION_CODES).map(([code, reward]) => {
                const isUsed = gameState.redeemedCodes.includes(code);
                let rewardText = '';
                if (reward.upDraws > 0) rewardText += `UP抽+${reward.upDraws} `;
                if (reward.regularDraws > 0) rewardText += `常规+${reward.regularDraws} `;
                if (reward.coins > 0) rewardText += `${reward.coins}星币`;
                return (
                  <div
                    key={code}
                    className={`bg-white rounded-xl p-3 border ${
                      isUsed ? 'border-gray-200 opacity-60' : 'border-pink-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm">{code}</span>
                          {isUsed ? (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">已使用</span>
                          ) : (
                            <button
                              onClick={() => handleCopyCode(code)}
                              className="p-1 bg-pink-50 rounded text-pink-600 hover:bg-pink-100"
                            >
                              {copied === code ? <CheckCircle size={14} /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-pink-600">{rewardText.trim()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 输入兑换 */}
          <div className="bg-white rounded-2xl p-4 border border-border">
            <h4 className="text-sm font-medium mb-3">输入兑换码</h4>
            <input
              type="text"
              value={redeemInput}
              onChange={(e) => { setRedeemInput(e.target.value); setRedeemMessage(null); }}
              placeholder="请输入兑换码"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors mb-3"
            />
            
            {redeemMessage && (
              <div className={`mb-3 p-3 rounded-xl text-sm ${
                redeemMessage.type === 'success' 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {redeemMessage.text}
              </div>
            )}

            <button
              onClick={handleRedeem}
              disabled={!redeemInput.trim()}
              className="w-full bg-primary text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50"
            >
              确认兑换
            </button>
          </div>
        </div>
      )}

      {/* Items grid */}
      {tab !== 'redeem' && (
        <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
          {filtered.map(item => (
            <div key={item.id} className="bg-white rounded-2xl p-4 border border-border shadow-sm flex flex-col items-center">
              <div className="text-4xl mb-2">{item.icon}</div>

              <h4 className="text-sm font-medium mb-0.5">{item.name}</h4>

              <p className="text-[10px] text-text-muted mb-3 text-center">{item.description}</p>


              {/* 可堆叠功能道具（补签卡）始终显示购买按钮，支持重复购买 */}
              {item.type === 'makeup_card' ? (
                <button
                  onClick={() => handleBuy(item.id)}
                  disabled={coins < item.price}
                  className={`w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                    coins >= item.price
                      ? 'bg-primary text-white active:scale-[0.97]'
                      : 'bg-gray-100 text-text-muted cursor-not-allowed'
                  }`}
                >
                  <Star size={10} fill="currentColor" />
                  {item.price}
                </button>
              ) : isOwned(item) ? (
                <div className="flex items-center gap-1 text-accent text-xs font-medium">
                  <Check size={12} />
                  已拥有
                </div>
              ) : (
                <button
                  onClick={() => handleBuy(item.id)}
                  disabled={coins < item.price}
                  className={`w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                    coins >= item.price
                      ? 'bg-primary text-white active:scale-[0.97]'
                      : 'bg-gray-100 text-text-muted cursor-not-allowed'
                  }`}
                >
                  <Star size={10} fill="currentColor" />
                  {item.price}
                </button>
              )}

            </div>

          ))}

        </div>
      )}

    </div>

  );
}
