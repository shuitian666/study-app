import crypto from 'node:crypto';
import { db, getAssets, getGameState, getInventory, getUserById, nowIso, toPublicUser } from './db.js';
import { getAiConfigStatus } from './providers.js';

const STREAK_REWARDS = [
  { days: 1, coins: 5, upDraws: 0, label: '1天' },
  { days: 3, coins: 10, upDraws: 1, label: '3天' },
  { days: 7, coins: 15, upDraws: 2, label: '7天' },
  { days: 14, coins: 25, upDraws: 3, label: '14天' },
  { days: 30, coins: 50, upDraws: 5, label: '30天' },
];

const SHOP_ITEMS = [
  { id: 'item-1', name: '补签卡', description: '可补签1天', icon: '🎟️', type: 'makeup_card', price: 30, rarity: 'R', usable: true },
  { id: 'frame-n-1', name: '简约银框', description: '简约风格银色边框', icon: '⬜', type: 'avatar_frame', price: 30, rarity: 'N' },
  { id: 'frame-n-2', name: '冰川蓝框', description: '清爽蓝色边框', icon: '🧊', type: 'avatar_frame', price: 30, rarity: 'N' },
  { id: 'frame-n-3', name: '翡翠绿框', description: '自然绿色边框', icon: '💚', type: 'avatar_frame', price: 30, rarity: 'N' },
  { id: 'frame-n-4', name: '珊瑚红框', description: '热情红色边框', icon: '❤️', type: 'avatar_frame', price: 30, rarity: 'N' },
  { id: 'frame-n-5', name: '优雅黑金', description: '黑金头像框', icon: '🖤', type: 'avatar_frame', price: 50, rarity: 'N' },
  { id: 'frame-r-1', name: '星空紫框', description: '星空紫色头像框', icon: '🌌', type: 'avatar_frame', price: 100, rarity: 'R' },
  { id: 'frame-r-2', name: '极光蓝框', description: '极光蓝色头像框', icon: '🌠', type: 'avatar_frame', price: 100, rarity: 'R' },
  { id: 'frame-r-3', name: '樱花粉框', description: '樱花粉色头像框', icon: '🌸', type: 'avatar_frame', price: 120, rarity: 'R' },
  { id: 'frame-r-4', name: '闪电黑框', description: '闪电风格头像框', icon: '⚡', type: 'avatar_frame', price: 120, rarity: 'R' },
  { id: 'frame-r-5', name: '彩虹缤纷', description: '彩虹头像框', icon: '🌈', type: 'avatar_frame', price: 150, rarity: 'R' },
  { id: 'item-10', name: '暗夜主题', description: '深色护眼主题', icon: '🌙', type: 'theme', price: 200, rarity: 'R' },
  { id: 'item-11', name: '樱花主题', description: '粉色樱花风格', icon: '🌸', type: 'theme', price: 200, rarity: 'R' },
  { id: 'item-12', name: '猫咪助手', description: 'AI 助手猫咪外观', icon: '🐱', type: 'ai_skin', price: 150, rarity: 'R' },
  { id: 'item-13', name: '机器人助手', description: 'AI 助手机器人外观', icon: '🤖', type: 'ai_skin', price: 150, rarity: 'R' },
];

const UP_POOL_ITEMS = [
  { id: 'up-1', name: '春日花环', description: '限定樱花头像框', icon: '🌸', type: 'avatar_frame', rarity: 'SSR', probability: 0.02 },
  { id: 'up-4', name: '海洋框', description: '蓝色波浪头像框', icon: '🌊', type: 'avatar_frame', rarity: 'SR', probability: 0.10 },
  { id: 'up-5', name: '把书读薄了', description: '稀有称号', icon: '⭐', type: 'title', rarity: 'SR', probability: 0.10 },
  { id: 'up-7', name: '简约银框', description: '简约头像框', icon: '⬜', type: 'avatar_frame', rarity: 'R', probability: 0.22 },
  { id: 'up-8', name: '今天也在学', description: '普通称号', icon: '📓', type: 'title', rarity: 'N', probability: 0.22 },
];

const REGULAR_TIERS = [
  { tier: 'SSR', probability: 0.001, rewardType: 'makeup_card', rewardAmount: 1 },
  { tier: 'SR', probability: 0.130, rewardType: 'coins', rewardAmount: 5 },
  { tier: 'R', probability: 0.300, rewardType: 'coins', rewardAmount: 3 },
  { tier: 'N', probability: 0.350, rewardType: 'coins', rewardAmount: 1 },
  { tier: 'NN', probability: 0.219, rewardType: 'blessing', rewardAmount: 0 },
];

export const REDEMPTION_CODES = {
  学习使我快乐: { upDraws: 10, regularDraws: 0, coins: 0 },
  勤奋好学: { upDraws: 5, regularDraws: 0, coins: 0 },
  全部解锁: { upDraws: 99, regularDraws: 99, coins: 9999 },
};

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function calculateStreak(records) {
  if (records.length === 0) return 0;
  const sorted = [...records].map(record => record.date_key).sort().reverse();
  let streak = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    if (Math.round((prev.getTime() - curr.getTime()) / 86400000) === 1) streak += 1;
    else break;
  }
  return streak;
}

function readCheckins(userId) {
  return db.prepare('SELECT * FROM checkin_records WHERE user_id = ? ORDER BY date_key ASC').all(userId);
}

function inventoryPayload(row) {
  const payload = parseJson(row.payload, {});
  return {
    id: row.id,
    type: row.item_type,
    name: row.name,
    quantity: row.quantity,
    description: payload.description || row.name,
    icon: payload.icon || '🎁',
    rarity: payload.rarity || 'R',
    obtainedAt: row.created_at,
    source: payload.source || 'manual',
    usable: Boolean(payload.usable),
    payload,
  };
}

function writeGameState(userId, patch) {
  const existing = getGameState(userId);
  db.prepare(`
    UPDATE user_game_state
    SET redeemed_codes = ?, shop_owned_ids = ?, up_pool_owned_ids = ?, updated_at = ?
    WHERE user_id = ?
  `).run(
    JSON.stringify(patch.redeemedCodes ?? parseJson(existing.redeemed_codes, [])),
    JSON.stringify(patch.shopOwnedIds ?? parseJson(existing.shop_owned_ids, [])),
    JSON.stringify(patch.upPoolOwnedIds ?? parseJson(existing.up_pool_owned_ids, [])),
    nowIso(),
    userId,
  );
}

function addInventory(userId, item, source, sourceId) {
  const payload = {
    description: item.description || item.name,
    icon: item.icon || '🎁',
    rarity: item.rarity || 'R',
    source,
    usable: Boolean(item.usable),
    sourceId,
  };
  const existing = db.prepare('SELECT * FROM inventory_items WHERE user_id = ? AND item_type = ? AND name = ?').get(userId, item.type, item.name);
  if (existing && ['makeup_card', 'coin_bag', 'vip_card'].includes(item.type)) {
    db.prepare('UPDATE inventory_items SET quantity = quantity + ?, updated_at = ? WHERE id = ?').run(item.quantity || 1, nowIso(), existing.id);
    return existing.id;
  }
  if (existing) return existing.id;
  const id = `inv_${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO inventory_items (id, user_id, item_type, name, quantity, payload, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, item.type, item.name, item.quantity || 1, JSON.stringify(payload), nowIso(), nowIso());
  return id;
}

function compensationCoins(rarity) {
  if (rarity === 'SSR') return 150;
  if (rarity === 'SR') return 60;
  if (rarity === 'R') return 30;
  return 10;
}

function ownedKey(item) {
  return `${item.type}:${item.name}`;
}

function accountState(userId, extra = {}) {
  const user = getUserById(userId);
  const assets = getAssets(userId);
  const game = getGameState(userId);
  const checkins = readCheckins(userId);
  const redeemedCodes = parseJson(game.redeemed_codes, []);
  const shopOwnedIds = parseJson(game.shop_owned_ids, []);
  const upPoolOwnedIds = parseJson(game.up_pool_owned_ids, []);
  const inventory = getInventory(userId).map(inventoryPayload);

  return {
    user: toPublicUser(user, assets),
    assets: {
      coins: assets?.coins ?? 0,
      experience: assets?.experience ?? 0,
      checkinStreak: assets?.checkin_streak ?? 0,
      regularTickets: assets?.regular_tickets ?? 0,
      upTickets: assets?.up_tickets ?? 0,
      makeupCards: assets?.makeup_cards ?? 0,
      lotteryPity: {
        sinceLastSR: assets?.lottery_pity_sr ?? 0,
        sinceLastSSR: assets?.lottery_pity_ssr ?? 0,
      },
    },
    checkin: {
      records: checkins.map(record => ({
        date: record.date_key,
        type: parseJson(record.reward_payload, {}).type || 'normal',
        teamId: parseJson(record.reward_payload, {}).teamId,
      })),
      streak: assets?.checkin_streak ?? 0,
      makeupCards: assets?.makeup_cards ?? 0,
      totalCheckins: checkins.length,
      lotteryPity: {
        sinceLastSR: assets?.lottery_pity_sr ?? 0,
        sinceLastSSR: assets?.lottery_pity_ssr ?? 0,
      },
    },
    drawBalance: {
      regular: assets?.regular_tickets ?? 0,
      up: assets?.up_tickets ?? 0,
    },
    inventory,
    game: {
      redeemedCodes,
      shopOwnedIds,
      upPoolOwnedIds,
    },
    aiConfigStatus: getAiConfigStatus(userId),
    ...extra,
  };
}

export function getAccountState(userId) {
  return accountState(userId);
}

export function performCheckin(userId, { date = todayKey(), type = 'normal', teamId = null } = {}) {
  const exists = db.prepare('SELECT 1 FROM checkin_records WHERE user_id = ? AND date_key = ?').get(userId, date);
  if (exists) return accountState(userId, { error: 'Already checked in' });

  const assets = getAssets(userId);
  if (type === 'makeup' && (assets?.makeup_cards ?? 0) <= 0) {
    const error = new Error('No makeup cards available');
    error.status = 400;
    throw error;
  }

  const priorRecords = readCheckins(userId);
  const previousStreak = assets?.checkin_streak ?? calculateStreak(priorRecords);
  const nextRecords = [...priorRecords, { date_key: date }];
  const streak = calculateStreak(nextRecords);
  const milestone = streak !== previousStreak ? STREAK_REWARDS.find(reward => reward.days === streak) : null;
  const regularTickets = type === 'normal' ? 1 : type === 'team' ? 2 : 0;
  const upTickets = milestone?.upDraws ?? 0;
  const streakCoins = milestone?.coins ?? 0;
  const experience = 50;

  db.prepare(`
    INSERT INTO checkin_records (id, user_id, date_key, reward_payload, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(`chk_${crypto.randomUUID()}`, userId, date, JSON.stringify({ type, teamId, regularTickets, upTickets, streakCoins, experience }), nowIso());

  db.prepare(`
    UPDATE user_assets
    SET coins = coins + ?, experience = experience + ?, checkin_streak = ?,
      regular_tickets = regular_tickets + ?, up_tickets = up_tickets + ?,
      makeup_cards = makeup_cards + ?, updated_at = ?
    WHERE user_id = ?
  `).run(streakCoins, experience, streak, regularTickets, upTickets, type === 'makeup' ? -1 : 0, nowIso(), userId);

  db.prepare(`
    INSERT OR IGNORE INTO asset_ledger (id, user_id, event_type, source_id, coins_delta, experience_delta, metadata, created_at)
    VALUES (?, ?, 'checkin', ?, ?, ?, ?, ?)
  `).run(`led_${crypto.randomUUID()}`, userId, date, streakCoins, experience, JSON.stringify({ regularTickets, upTickets, type }), nowIso());

  return accountState(userId, {
    lastCheckinReward: { regularTickets, upTickets, streakCoins, streakLabel: milestone?.label, source: type === 'makeup' ? 'makeup' : 'checkin' },
  });
}

export function buyShopItem(userId, itemId) {
  const item = SHOP_ITEMS.find(entry => entry.id === itemId);
  if (!item) {
    const error = new Error('Shop item not found');
    error.status = 404;
    throw error;
  }
  const assets = getAssets(userId);
  if ((assets?.coins ?? 0) < item.price) {
    const error = new Error('Not enough coins');
    error.status = 400;
    throw error;
  }
  const game = getGameState(userId);
  const shopOwnedIds = parseJson(game.shop_owned_ids, []);
  if (!['makeup_card', 'coin_bag', 'vip_card'].includes(item.type) && shopOwnedIds.includes(item.id)) {
    return accountState(userId);
  }
  db.prepare('UPDATE user_assets SET coins = coins - ?, makeup_cards = makeup_cards + ?, updated_at = ? WHERE user_id = ?')
    .run(item.price, item.type === 'makeup_card' ? 1 : 0, nowIso(), userId);
  if (item.type !== 'makeup_card') addInventory(userId, item, 'shop', item.id);
  writeGameState(userId, { shopOwnedIds: Array.from(new Set([...shopOwnedIds, item.id])) });
  return accountState(userId);
}

export function redeemCode(userId, code) {
  const reward = REDEMPTION_CODES[code];
  if (!reward) {
    const error = new Error('Invalid redemption code');
    error.status = 400;
    throw error;
  }
  const game = getGameState(userId);
  const redeemedCodes = parseJson(game.redeemed_codes, []);
  if (redeemedCodes.includes(code)) return accountState(userId);
  db.prepare('UPDATE user_assets SET coins = coins + ?, regular_tickets = regular_tickets + ?, up_tickets = up_tickets + ?, updated_at = ? WHERE user_id = ?')
    .run(reward.coins, reward.regularDraws, reward.upDraws, nowIso(), userId);
  writeGameState(userId, { redeemedCodes: [...redeemedCodes, code] });
  return accountState(userId);
}

function drawRegular(assets) {
  let tier;
  let isPity = false;
  if ((assets.lottery_pity_ssr ?? 0) >= 79) {
    tier = 'SSR';
    isPity = true;
  } else if ((assets.lottery_pity_sr ?? 0) >= 9) {
    tier = 'SR';
    isPity = true;
  } else {
    const rand = Math.random();
    let cumulative = 0;
    tier = 'NN';
    for (const config of REGULAR_TIERS) {
      cumulative += config.probability;
      if (rand < cumulative) {
        tier = config.tier;
        break;
      }
    }
  }
  const config = REGULAR_TIERS.find(entry => entry.tier === tier);
  const pity = tier === 'SSR'
    ? { sr: 0, ssr: 0 }
    : tier === 'SR'
      ? { sr: 0, ssr: (assets.lottery_pity_ssr ?? 0) + 1 }
      : { sr: (assets.lottery_pity_sr ?? 0) + 1, ssr: (assets.lottery_pity_ssr ?? 0) + 1 };
  return {
    result: {
      tier,
      reward: { type: config.rewardType, amount: config.rewardAmount },
      blessing: tier === 'NN' ? '今天也认真学了一点。' : undefined,
      isPity,
      timestamp: nowIso(),
    },
    pity,
  };
}

function drawUp(userId) {
  const game = getGameState(userId);
  const upPoolOwnedIds = parseJson(game.up_pool_owned_ids, []);
  const rand = Math.random();
  let cumulative = 0;
  let item = UP_POOL_ITEMS[UP_POOL_ITEMS.length - 1];
  for (const candidate of UP_POOL_ITEMS) {
    cumulative += candidate.probability;
    if (rand < cumulative) {
      item = candidate;
      break;
    }
  }
  const key = ownedKey(item);
  const isNew = !upPoolOwnedIds.includes(key);
  if (isNew) {
    addInventory(userId, item, 'lottery', item.id);
    writeGameState(userId, { upPoolOwnedIds: [...upPoolOwnedIds, key] });
  }
  return {
    result: { item: { ...item, owned: !isNew }, isNew, timestamp: nowIso() },
    compensation: isNew ? 0 : compensationCoins(item.rarity),
  };
}

export function drawLotteryForUser(userId, pool, count = 1) {
  const safeCount = count === 10 ? 10 : 1;
  const assets = getAssets(userId);
  const available = pool === 'up' ? assets?.up_tickets ?? 0 : assets?.regular_tickets ?? 0;
  if (available < safeCount) {
    const error = new Error('Not enough draw tickets');
    error.status = 400;
    throw error;
  }

  const results = [];
  let coinDelta = 0;
  let makeupDelta = 0;
  let pitySr = assets?.lottery_pity_sr ?? 0;
  let pitySsr = assets?.lottery_pity_ssr ?? 0;

  for (let i = 0; i < safeCount; i += 1) {
    if (pool === 'up') {
      const drawn = drawUp(userId);
      results.push(drawn.result);
      coinDelta += drawn.compensation;
    } else {
      const drawn = drawRegular({ ...assets, lottery_pity_sr: pitySr, lottery_pity_ssr: pitySsr });
      results.push(drawn.result);
      pitySr = drawn.pity.sr;
      pitySsr = drawn.pity.ssr;
      if (drawn.result.reward.type === 'coins') coinDelta += drawn.result.reward.amount;
      if (drawn.result.reward.type === 'makeup_card') makeupDelta += drawn.result.reward.amount;
    }
  }

  db.prepare(`
    UPDATE user_assets
    SET coins = coins + ?, makeup_cards = makeup_cards + ?,
      regular_tickets = regular_tickets - ?, up_tickets = up_tickets - ?,
      lottery_pity_sr = ?, lottery_pity_ssr = ?, updated_at = ?
    WHERE user_id = ?
  `).run(
    coinDelta,
    makeupDelta,
    pool === 'regular' ? safeCount : 0,
    pool === 'up' ? safeCount : 0,
    pitySr,
    pitySsr,
    nowIso(),
    userId,
  );

  return accountState(userId, {
    lottery: {
      pool,
      result: results[results.length - 1],
      allResults: results,
      isTenDraw: safeCount === 10,
    },
  });
}

export function useInventoryItem(userId, itemId) {
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ? AND user_id = ?').get(itemId, userId);
  if (!item) {
    const error = new Error('Inventory item not found');
    error.status = 404;
    throw error;
  }

  const payload = parseJson(item.payload, {});
  if (!payload.usable || item.quantity <= 0) {
    const error = new Error('Inventory item is not usable');
    error.status = 400;
    throw error;
  }

  if (item.quantity > 1) {
    db.prepare('UPDATE inventory_items SET quantity = quantity - 1, updated_at = ? WHERE id = ?').run(nowIso(), item.id);
  } else {
    db.prepare('DELETE FROM inventory_items WHERE id = ?').run(item.id);
  }

  db.prepare(`
    INSERT OR IGNORE INTO asset_ledger (id, user_id, event_type, source_id, metadata, created_at)
    VALUES (?, ?, 'inventory_use', ?, ?, ?)
  `).run(`led_${crypto.randomUUID()}`, userId, item.id, JSON.stringify({ itemType: item.item_type, name: item.name }), nowIso());

  return accountState(userId);
}
