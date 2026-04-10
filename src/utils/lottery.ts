import type { LotteryTier, LotteryTierConfig, LotteryResult, LotteryPityState, UpPoolConfig, UpPoolResult } from '@/types';
import { BLESSINGS } from '@/data/blessings';

// Tier configuration table
export const LOTTERY_TIERS: LotteryTierConfig[] = [
  { tier: 'SSR', label: '上上签', probability: 0.001, rewardType: 'makeup_card', rewardAmount: 1, color: '#FFD700', icon: '🏆' },
  { tier: 'SR',  label: '上签',   probability: 0.130, rewardType: 'coins',       rewardAmount: 5, color: '#8B5CF6', icon: '✨' },
  { tier: 'R',   label: '中签',   probability: 0.300, rewardType: 'coins',       rewardAmount: 3, color: '#3B82F6', icon: '🎋' },
  { tier: 'N',   label: '下签',   probability: 0.350, rewardType: 'coins',       rewardAmount: 1, color: '#6B7280', icon: '🎍' },
  { tier: 'NN',  label: '下下签', probability: 0.219, rewardType: 'blessing',    rewardAmount: 0, color: '#9CA3AF', icon: '🍃' },
];

export function getTierConfig(tier: LotteryTier): LotteryTierConfig {
  return LOTTERY_TIERS.find(t => t.tier === tier)!;
}

function randomBlessing(): string {
  return BLESSINGS[Math.floor(Math.random() * BLESSINGS.length)];
}

function weightedRandom(): LotteryTier {
  const rand = Math.random();
  let cumulative = 0;
  for (const config of LOTTERY_TIERS) {
    cumulative += config.probability;
    if (rand < cumulative) return config.tier;
  }
  return 'NN'; // fallback
}

export function drawLottery(pity: LotteryPityState): {
  result: LotteryResult;
  newPity: LotteryPityState;
} {
  let tier: LotteryTier;
  let isPity = false;

  // Pity check: SSR pity has highest priority
  if (pity.sinceLastSSR >= 79) {
    tier = 'SSR';
    isPity = true;
  } else if (pity.sinceLastSR >= 9) {
    tier = 'SR';
    isPity = true;
  } else {
    tier = weightedRandom();
  }

  const config = getTierConfig(tier);

  // Update pity counters
  let newPity: LotteryPityState;
  if (tier === 'SSR') {
    newPity = { sinceLastSSR: 0, sinceLastSR: 0 };
  } else if (tier === 'SR') {
    newPity = { sinceLastSSR: pity.sinceLastSSR + 1, sinceLastSR: 0 };
  } else {
    newPity = { sinceLastSSR: pity.sinceLastSSR + 1, sinceLastSR: pity.sinceLastSR + 1 };
  }

  const result: LotteryResult = {
    tier,
    reward: { type: config.rewardType, amount: config.rewardAmount },
    isPity,
    timestamp: new Date().toISOString(),
  };

  if (tier === 'NN') {
    result.blessing = randomBlessing();
  }

  return { result, newPity };
}

// ===== UP Pool Draw =====

export function drawFromUpPool(config: UpPoolConfig): UpPoolResult {
  const items = config.items;

  // Defensive check: if no items, return a default
  if (!items || items.length === 0) {
    return {
      item: {
        id: 'default',
        name: '谢谢参与',
        description: '感谢您的参与',
        icon: '🎁',
        type: 'avatar_frame',
        rarity: 'N',
        probability: 1,
        owned: false,
      },
      isNew: true,
      timestamp: new Date().toISOString(),
    };
  }

  const rand = Math.random();
  let cumulative = 0;

  for (const item of items) {
    cumulative += item.probability;
    if (rand < cumulative) {
      return {
        item,
        isNew: !item.owned,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Fallback to last item
  const last = items[items.length - 1];
  return {
    item: last,
    isNew: !last.owned,
    timestamp: new Date().toISOString(),
  };
}
