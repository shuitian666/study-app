import type { InventoryItem, InventoryState, UpPoolItem } from '@/types';
import {
  backgroundCatalog,
  canonicalizeBackgroundInventoryItem,
  getBackgroundByName,
  normalizeBackgroundInventory,
} from '@/data/backgroundCatalog';

type RewardLikeItem = Pick<InventoryItem, 'id' | 'type' | 'name' | 'rarity'> | UpPoolItem;

const STACKABLE_TYPES = new Set(['makeup_card', 'coin_bag', 'vip_card']);

export function getCompensationCoins(rarity: string): number {
  switch (rarity) {
    case 'N': return 10;
    case 'R': return 30;
    case 'SR': return 60;
    case 'SSR': return 150;
    default: return 10;
  }
}

export function normalizeOwnedKey(item: RewardLikeItem): string {
  if (item.type === 'background') {
    const background = backgroundCatalog.find(entry => entry.id === item.id) ?? getBackgroundByName(item.name);
    return `background:${background?.id ?? item.name}`;
  }

  return `${item.type}:${item.name}`;
}

export function isStackableInventoryItem(item: Pick<InventoryItem, 'type'>): boolean {
  return STACKABLE_TYPES.has(item.type);
}

export function getOwnedRewardKeys(inventory: InventoryState): Set<string> {
  return new Set(
    normalizeBackgroundInventory(inventory).items
      .filter(item => !isStackableInventoryItem(item))
      .map(normalizeOwnedKey),
  );
}

export function isInventoryRewardOwned(inventory: InventoryState, item: RewardLikeItem): boolean {
  if (isStackableInventoryItem(item as InventoryItem)) return false;
  return getOwnedRewardKeys(inventory).has(normalizeOwnedKey(item));
}

export function createInventoryItemFromReward(
  item: UpPoolItem,
  source: InventoryItem['source'],
  idPrefix = 'inv-reward',
): InventoryItem {
  return canonicalizeBackgroundInventoryItem({
    id: `${idPrefix}-${item.id}-${Date.now()}`,
    type: item.type as InventoryItem['type'],
    name: item.name,
    description: item.description || `${item.name}`,
    icon: item.icon,
    rarity: item.rarity,
    quantity: 1,
    obtainedAt: new Date().toISOString(),
    source,
    usable: false,
  });
}

export function mergeInventoryItem(inventory: InventoryState, incomingItem: InventoryItem): InventoryState {
  const incoming = canonicalizeBackgroundInventoryItem(incomingItem);
  const items = normalizeBackgroundInventory(inventory).items;

  if (isStackableInventoryItem(incoming)) {
    const existing = items.find(item => item.type === incoming.type && item.name === incoming.name);
    if (existing) {
      return {
        items: items.map(item =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + incoming.quantity }
            : item,
        ),
      };
    }
    return { items: [...items, incoming] };
  }

  const incomingKey = normalizeOwnedKey(incoming);
  const existing = items.find(item => !isStackableInventoryItem(item) && normalizeOwnedKey(item) === incomingKey);
  if (existing) {
    return {
      items: items.map(item =>
        item.id === existing.id
          ? { ...item, quantity: Math.max(item.quantity, incoming.quantity, 1) }
          : item,
      ),
    };
  }

  return normalizeBackgroundInventory({ items: [...items, { ...incoming, quantity: Math.max(1, incoming.quantity) }] });
}
