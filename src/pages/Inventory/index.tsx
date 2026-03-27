import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/ui/Common';
import { Backpack, Package, Gift, Ticket, Sparkles, Crown } from 'lucide-react';

const rarityConfig = {
  N: { label: '普通', color: '#9ca3af', bg: 'bg-gray-100' },
  R: { label: '稀有', color: '#3b82f6', bg: 'bg-blue-50' },
  SR: { label: '超稀有', color: '#a855f7', bg: 'bg-purple-50' },
  SSR: { label: '超超稀有', color: '#f59e0b', bg: 'bg-amber-50' },
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

export default function InventoryPage() {
  const { state, dispatch, navigate } = useApp();
  const [filterType, setFilterType] = useState<string | null>(null);

  const items = state.inventory.items;

  const filteredItems = filterType
    ? items.filter(i => i.type === filterType)
    : items;

  const handleUseItem = (itemId: string) => {
    dispatch({ type: 'USE_INVENTORY_ITEM', payload: itemId });
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

              return (
                <div
                  key={item.id}
                  className={`${rarity.bg} rounded-xl p-3 border border-gray-200/50`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-3xl">{typeInfo.icon}</div>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ color: rarity.color, backgroundColor: 'white' }}
                    >
                      {rarity.label}
                    </span>
                  </div>

                  <h4 className="text-sm font-medium text-gray-900 mb-1">{item.name}</h4>
                  <p className="text-[10px] text-gray-500 mb-2 line-clamp-2">{item.description}</p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">x{item.quantity}</span>
                    {item.usable && item.quantity > 0 && (
                      <button
                        onClick={() => handleUseItem(item.id)}
                        className="text-xs px-2 py-1 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
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

        {/* Source Legend */}
        <div className="bg-gray-50 rounded-xl p-3">
          <h4 className="text-xs font-medium text-text-secondary mb-2">物品来源</h4>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs bg-white px-2 py-1 rounded-lg flex items-center gap-1">
              <Gift size={12} className="text-amber-500" /> 抽签奖励
            </span>
            <span className="text-xs bg-white px-2 py-1 rounded-lg flex items-center gap-1">
              <Ticket size={12} className="text-blue-500" /> 邮件附件
            </span>
            <span className="text-xs bg-white px-2 py-1 rounded-lg flex items-center gap-1">
              <Sparkles size={12} className="text-purple-500" /> 成就奖励
            </span>
            <span className="text-xs bg-white px-2 py-1 rounded-lg flex items-center gap-1">
              <Crown size={12} className="text-yellow-500" /> 商店购买
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
