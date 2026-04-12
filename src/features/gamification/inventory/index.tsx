import { useState } from 'react';
import { useGame } from '@/store/GameContext';
import { useUser } from '@/store/UserContext';
import { PageHeader } from '@/components/ui/Common';
import { Backpack, Package, Gift, Ticket, Sparkles, Crown } from 'lucide-react';

const rarityConfig = {
  N: { label: '普通', color: '#9ca3af', bg: 'bg-gray-100' },
  R: { label: '稀有', color: '#3b82f6', bg: 'bg-blue-50' },
  SR: { label: '史诗', color: '#a855f7', bg: 'bg-purple-50' },
  SSR: { label: '传说', color: '#f59e0b', bg: 'bg-amber-50' },
};

const typeConfig = {
  makeup_card: { icon: '📝', label: '补签卡' },
  avatar_frame: { icon: '🖼️', label: '头像框' },
  background: { icon: '🖼️', label: '背景' },
  theme: { icon: '🎨', label: '主题' },
  title: { icon: '🏷️', label: '称号' },
  coin_bag: { icon: '💰', label: '金币袋' },
  vip_card: { icon: '👑', label: 'VIP卡' },
};

// 可重复的道具类型
const STACKABLE_TYPES = ['makeup_card', 'coin_bag', 'vip_card'];

export default function InventoryPage() {
  const { gameState, gameDispatch } = useGame();
  const { navigate } = useUser();
  const [filterType, setFilterType] = useState<string | null>(null);

  const items = gameState.inventory.items;

  // 对物品进行处理：可重复道具堆叠，不可重复道具去重
  const processedItems = (() => {
    const stackableMap = new Map<string, typeof items[0]>();
    const nonStackableSet = new Set<string>();
    const result: typeof items = [];

    items.forEach(item => {
      if (STACKABLE_TYPES.includes(item.type)) {
        // 可重复道具：按名称堆叠
        const existing = stackableMap.get(item.name);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          stackableMap.set(item.name, { ...item });
        }
      } else {
        // 不可重复道具：按名称去重
        if (!nonStackableSet.has(item.name)) {
          nonStackableSet.add(item.name);
          result.push({ ...item, quantity: 1 });
        }
      }
    });

    // 合并可重复道具
    result.push(...stackableMap.values());
    return result;
  })();

  const filteredItems = filterType
    ? processedItems.filter(i => i.type === filterType)
    : processedItems;

  const handleUseItem = (itemId: string) => {
    gameDispatch({ type: 'USE_INVENTORY_ITEM', payload: itemId });
  };

  return (
    <div className="page-scroll pb-4">
      <PageHeader
        title="背包"
        onBack={() => navigate('home')}
      />

      <div className="px-4 pt-3 space-y-4">
        {/* Summary Card */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Backpack size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold">我的背包</h2>
              <p className="text-sm text-white/80">{items.length} 件物品</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/10 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold">{items.filter(i => i.type === 'makeup_card').reduce((s, i) => s + i.quantity, 0)}</p>
              <p className="text-xs text-white/70">补签卡</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold">{items.filter(i => ['avatar_frame', 'background', 'theme'].includes(i.type)).reduce((s, i) => s + i.quantity, 0)}</p>
              <p className="text-xs text-white/70">装饰</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold">{items.filter(i => i.type === 'vip_card').reduce((s, i) => s + i.quantity, 0)}</p>
              <p className="text-xs text-white/70">VIP卡</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilterType(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterType === null ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
            }`}
          >
            全部
          </button>
          {Object.entries(typeConfig).map(([type, config]) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                filterType === type ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
              }`}
            >
              {config.icon}
              {config.label}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package size={40} className="text-gray-400" />
            </div>
            <p className="text-text-secondary font-medium mb-1">背包空空如也</p>
            <p className="text-text-muted text-sm">通过抽签或邮件获取物品吧</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map(item => {
              const rarity = rarityConfig[item.rarity] || rarityConfig.N;
              const typeInfo = typeConfig[item.type] || { icon: '📦', label: '其他' };

              // 来源配置
              const sourceConfig = {
                lottery: { label: '抽签奖励', icon: Gift, color: 'text-amber-500' },
                mail: { label: '邮件附件', icon: Ticket, color: 'text-blue-500' },
                achievement: { label: '成就奖励', icon: Sparkles, color: 'text-purple-500' },
                shop: { label: '商店购买', icon: Crown, color: 'text-yellow-500' },
                manual: { label: '手动添加', icon: Package, color: 'text-gray-500' },
              };
              const sourceInfo = sourceConfig[item.source] || sourceConfig.manual;
              const SourceIcon = sourceInfo.icon;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl p-4 border border-border shadow-sm flex flex-col`}
                >
                  {/* 图标和稀有度 */}
                  <div className="flex items-start justify-between mb-3 flex-shrink-0">
                    <div className="text-4xl leading-none">{item.icon || typeInfo.icon}</div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ color: rarity.color, backgroundColor: rarity.bg }}
                    >
                      {rarity.label}
                    </span>
                  </div>

                  {/* 名称 */}
                  <h4 className="text-sm font-semibold text-text-primary mb-1">{item.name}</h4>

                  {/* 描述 */}
                  <p className="text-xs text-text-muted mb-3 line-clamp-2">{item.description}</p>

                  {/* 来源 - 单独一行 */}
                  <div className="flex items-center gap-1 mb-3">
                    <SourceIcon size={10} className={sourceInfo.color} />
                    <span className="text-[10px] text-text-muted">{sourceInfo.label}</span>
                  </div>

                  {/* 数量和使用按钮 */}
                  <div className="flex items-center justify-between mt-auto">
                    {STACKABLE_TYPES.includes(item.type) ? (
                      <span className="text-xs text-text-muted">数量: <b className="text-text-primary">x{item.quantity}</b></span>
                    ) : (
                      <span className="text-xs text-text-muted">已拥有</span>
                    )}
                    {item.usable && item.quantity > 0 && (
                      <button
                        onClick={() => handleUseItem(item.id)}
                        className="text-xs px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        使用
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
