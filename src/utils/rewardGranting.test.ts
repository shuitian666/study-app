import type { InventoryState, UpPoolItem } from '@/types';
import {
  createInventoryItemFromReward,
  getCompensationCoins,
  getOwnedRewardKeys,
  isInventoryRewardOwned,
  mergeInventoryItem,
  normalizeOwnedKey,
} from './rewardGranting';
import { getBackgroundById } from '@/data/backgroundCatalog';

const nightStudy = getBackgroundById('bg-night-study')!;

const nightStudyReward: UpPoolItem = {
  id: nightStudy.id,
  name: nightStudy.name,
  description: nightStudy.description,
  icon: nightStudy.icon,
  type: 'background',
  rarity: nightStudy.rarity,
  probability: 1,
  owned: false,
};

const avatarFrameReward: UpPoolItem = {
  id: 'frame-ssr-1',
  name: '星河璀璨',
  description: 'SSR头像框',
  icon: '✨',
  type: 'avatar_frame',
  rarity: 'SSR',
  probability: 1,
  owned: false,
};

const titleReward: UpPoolItem = {
  id: 'title-sr-1',
  name: '把书读薄了',
  description: '学习称号',
  icon: '★',
  type: 'title',
  rarity: 'SR',
  probability: 1,
  owned: false,
};

describe('rewardGranting', () => {
  test('background ownership uses catalog identity instead of generated inventory id', () => {
    const first = createInventoryItemFromReward(nightStudyReward, 'lottery', 'inv-lottery');
    const second = { ...createInventoryItemFromReward(nightStudyReward, 'shop', 'inv-shop'), id: 'another-generated-id' };

    const afterFirst = mergeInventoryItem({ items: [] }, first);
    const afterSecond = mergeInventoryItem(afterFirst, second);

    expect(afterSecond.items).toHaveLength(1);
    expect(isInventoryRewardOwned(afterSecond, nightStudyReward)).toBe(true);
    expect(getOwnedRewardKeys(afterSecond)).toContain(normalizeOwnedKey(nightStudyReward));
  });

  test('duplicate compensation follows rarity table', () => {
    expect(getCompensationCoins('N')).toBe(10);
    expect(getCompensationCoins('R')).toBe(30);
    expect(getCompensationCoins('SR')).toBe(60);
    expect(getCompensationCoins('SSR')).toBe(150);
  });

  test('ten-draw callers can update an owned key set during the same batch', () => {
    const inventory: InventoryState = { items: [] };
    const ownedKeys = getOwnedRewardKeys(inventory);
    const key = normalizeOwnedKey(nightStudyReward);

    expect(ownedKeys.has(key)).toBe(false);
    ownedKeys.add(key);
    expect(ownedKeys.has(key)).toBe(true);
  });

  test('historical avatar frame draws are treated as duplicates', () => {
    const inventory = mergeInventoryItem(
      { items: [] },
      createInventoryItemFromReward(avatarFrameReward, 'lottery', 'inv-lottery'),
    );

    expect(isInventoryRewardOwned(inventory, avatarFrameReward)).toBe(true);
    expect(getCompensationCoins(avatarFrameReward.rarity)).toBe(150);
  });

  test('historical title draws are treated as duplicates', () => {
    const inventory = mergeInventoryItem(
      { items: [] },
      createInventoryItemFromReward(titleReward, 'lottery', 'inv-lottery'),
    );

    expect(isInventoryRewardOwned(inventory, titleReward)).toBe(true);
    expect(getCompensationCoins(titleReward.rarity)).toBe(60);
  });
});
