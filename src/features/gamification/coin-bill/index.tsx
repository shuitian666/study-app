import React, { useState, useMemo } from 'react';
import { useGame } from '@/store/GameContext';
import { useUser } from '@/store/UserContext';
import { PageHeader } from '@/components/ui/Common';
import { Coins, TrendingUp, TrendingDown, Calendar, Gift, ShoppingBag, Ticket, Sparkles, AlertTriangle } from 'lucide-react';
import type { CoinBillRecord, CoinBillType } from '@/store/GameContext';

const billTypeConfig: Record<CoinBillType, { icon: React.ReactNode; label: string; color: string }> = {
  mail_attachment: { icon: <Gift size={14} />, label: '邮件附件', color: 'text-emerald-500' },
  shop_purchase: { icon: <ShoppingBag size={14} />, label: '商城消费', color: 'text-red-500' },
  lottery_reward: { icon: <Ticket size={14} />, label: '抽奖奖励', color: 'text-amber-500' },
  compensation: { icon: <Sparkles size={14} />, label: '补偿奖励', color: 'text-purple-500' },
  system: { icon: <AlertTriangle size={14} />, label: '系统', color: 'text-gray-500' },
};

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days === 0 && hours < 1) return '刚刚';
  if (days === 0 && hours < 24) return `${hours}小时前`;
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

type TimeFilter = 'all' | 'week' | 'month';

export default function CoinBillPage() {
  const { gameState } = useGame();
  const { userState, navigate } = useUser();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const bills = gameState.coinBills;
  const totalCoins = userState.user?.totalPoints ?? 0;

  // Filter bills by time
  const filteredBills = useMemo(() => {
    if (timeFilter === 'all') return bills;
    const now = new Date();
    const cutoff = new Date();
    if (timeFilter === 'week') {
      cutoff.setDate(now.getDate() - 7);
    } else {
      cutoff.setMonth(now.getMonth() - 1);
    }
    return bills.filter(b => new Date(b.timestamp) >= cutoff);
  }, [bills, timeFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const income = filteredBills.filter(b => b.amount > 0).reduce((sum, b) => sum + b.amount, 0);
    const expense = filteredBills.filter(b => b.amount < 0).reduce((sum, b) => sum + Math.abs(b.amount), 0);
    return { income, expense, count: filteredBills.length };
  }, [filteredBills]);

  // Group bills by date
  const groupedBills = useMemo(() => {
    const groups: Record<string, CoinBillRecord[]> = {};
    filteredBills.forEach(bill => {
      const dateKey = new Date(bill.timestamp).toLocaleDateString('zh-CN');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(bill);
    });
    return Object.entries(groups);
  }, [filteredBills]);

  return (
    <div className="page-scroll pb-4">
      <PageHeader
        title="星币账单"
        onBack={() => navigate('home')}
      />

      <div className="px-4 pt-3 space-y-4">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 rounded-2xl p-5 text-white shadow-xl shadow-amber-200/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Coins size={24} />
              <span className="text-sm opacity-90">当前余额</span>
            </div>
            <div className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {totalCoins.toLocaleString()} 星币
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-3">
              <div className="flex items-center gap-1 text-green-200 mb-1">
                <TrendingUp size={14} />
                <span className="text-xs">收入</span>
              </div>
              <p className="text-xl font-bold text-white">+{stats.income.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <div className="flex items-center gap-1 text-red-200 mb-1">
                <TrendingDown size={14} />
                <span className="text-xs">支出</span>
              </div>
              <p className="text-xl font-bold text-white">-{stats.expense.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Time Filter */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: '全部' },
            { key: 'week', label: '近7天' },
            { key: 'month', label: '近30天' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setTimeFilter(tab.key as TimeFilter)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                timeFilter === tab.key
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-gray-50 text-gray-500 border border-gray-100'
              }`}
            >
              <Calendar size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bills List */}
        {groupedBills.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Coins size={40} className="text-gray-400" />
            </div>
            <p className="text-text-secondary font-medium mb-1">暂无账单记录</p>
            <p className="text-text-muted text-sm">参与活动获取星币吧</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedBills.map(([date, dayBills]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-500">{date}</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                {/* Day Bills */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  {dayBills.map((bill, idx) => {
                    const config = billTypeConfig[bill.type];
                    const isPositive = bill.amount > 0;

                    return (
                      <div
                        key={bill.id}
                        className={`flex items-center justify-between p-3 ${
                          idx !== dayBills.length - 1 ? 'border-b border-gray-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            isPositive ? 'bg-green-50' : 'bg-red-50'
                          }`}>
                            <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
                              {config.icon}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{bill.description}</p>
                            <p className="text-xs text-gray-400">{formatTime(bill.timestamp)}</p>
                          </div>
                        </div>
                        <div className={`text-sm font-bold ${
                          isPositive ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {isPositive ? '+' : ''}{bill.amount.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
