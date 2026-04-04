import { drawLottery, drawFromUpPool, LOTTERY_TIERS } from './lottery';
import type { LotteryPityState, UpPoolConfig } from '@/types';

// 测试抽卡算法
describe('Lottery Algorithm', () => {
  test('drawLottery should return a valid result', () => {
    const pity: LotteryPityState = { sinceLastSSR: 0, sinceLastSR: 0 };
    const { result, newPity } = drawLottery(pity);
    
    expect(result).toHaveProperty('tier');
    expect(result).toHaveProperty('reward');
    expect(result).toHaveProperty('isPity');
    expect(result).toHaveProperty('timestamp');
    expect(newPity).toHaveProperty('sinceLastSSR');
    expect(newPity).toHaveProperty('sinceLastSR');
  });

  test('drawLottery should handle SSR pity', () => {
    const pity: LotteryPityState = { sinceLastSSR: 79, sinceLastSR: 0 };
    const { result, newPity } = drawLottery(pity);
    
    expect(result.tier).toBe('SSR');
    expect(result.isPity).toBe(true);
    expect(newPity.sinceLastSSR).toBe(0);
    expect(newPity.sinceLastSR).toBe(0);
  });

  test('drawLottery should handle SR pity', () => {
    const pity: LotteryPityState = { sinceLastSSR: 0, sinceLastSR: 9 };
    const { result, newPity } = drawLottery(pity);
    
    expect(result.tier).toBe('SR');
    expect(result.isPity).toBe(true);
    expect(newPity.sinceLastSR).toBe(0);
    expect(newPity.sinceLastSSR).toBe(1);
  });

  test('drawLottery should update pity counters correctly', () => {
    const pity: LotteryPityState = { sinceLastSSR: 5, sinceLastSR: 3 };
    
    // 测试非SSR/SR的情况
    const { newPity: newPity1 } = drawLottery(pity);
    expect(newPity1.sinceLastSSR).toBeGreaterThan(pity.sinceLastSSR);
    expect(newPity1.sinceLastSR).toBeGreaterThan(pity.sinceLastSR);
  });
});

// 测试UP池抽卡算法
describe('Up Pool Draw Algorithm', () => {
  const mockUpPool: UpPoolConfig = {
    id: 'test-up-pool',
    name: 'Test UP Pool',
    description: 'Test UP pool for testing',
    items: [
      { id: 'item1', name: 'Item 1', type: 'avatar_frame', rarity: 'SSR', probability: 0.1, owned: false, icon: '✨', description: 'Test item 1' },
      { id: 'item2', name: 'Item 2', type: 'background', rarity: 'SR', probability: 0.3, owned: true, icon: '🌟', description: 'Test item 2' },
      { id: 'item3', name: 'Item 3', type: 'title', rarity: 'R', probability: 0.6, owned: false, icon: '🏆', description: 'Test item 3' },
    ],
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  test('drawFromUpPool should return a valid result', () => {
    const result = drawFromUpPool(mockUpPool);
    
    expect(result).toHaveProperty('item');
    expect(result).toHaveProperty('isNew');
    expect(result).toHaveProperty('timestamp');
    expect(mockUpPool.items).toContain(result.item);
  });

  test('drawFromUpPool should correctly determine if item is new', () => {
    const result = drawFromUpPool(mockUpPool);
    const expectedIsNew = !result.item.owned;
    expect(result.isNew).toBe(expectedIsNew);
  });

  test('drawFromUpPool should return fallback to last item if no match', () => {
    // 测试极端情况，虽然概率总和应该是1，但如果计算有问题，应该回退到最后一个物品
    const invalidPool: UpPoolConfig = {
      ...mockUpPool,
      items: [
        { id: 'item1', name: 'Item 1', type: 'avatar_frame', rarity: 'SSR', probability: 0, owned: false, icon: '✨', description: 'Test item 1' },
        { id: 'item2', name: 'Item 2', type: 'background', rarity: 'SR', probability: 0, owned: true, icon: '🌟', description: 'Test item 2' },
      ],
    };
    
    const result = drawFromUpPool(invalidPool);
    expect(result.item.id).toBe('item2');
  });
});
