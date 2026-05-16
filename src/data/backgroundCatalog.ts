import type { InventoryItem, InventoryState, ShopItem, ThemeConfig, UpPoolConfig, UpPoolItem, User } from '@/types';

export type BackgroundRarity = 'N' | 'R' | 'SR' | 'SSR';
export type BackgroundMode = 'light' | 'dark';
export type BackgroundTone = 'neutral' | 'cool' | 'mint' | 'warm' | 'aurora';

export interface BackgroundThemeTokens {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  accent: string;
  accentLight: string;
  bg: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  surface: string;
  surfaceContainerLow: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceContainerLowest: string;
  onSurface: string;
  onSurfaceVariant: string;
  outlineVariant: string;
  primaryFixed: string;
  secondaryFixed: string;
}

export interface BackgroundCatalogItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: BackgroundRarity;
  price: number;
  gradient: string;
  pattern?: string;
  mode: BackgroundMode;
  tone: BackgroundTone;
  purchasable: boolean;
  upPool: boolean;
  theme: BackgroundThemeTokens;
}

export const DEFAULT_BACKGROUND_ID = 'bg-classic-light';

export const backgroundCatalog: BackgroundCatalogItem[] = [
  {
    id: 'bg-classic-light',
    name: '晨光白',
    description: '干净明亮的默认学习背景',
    icon: '□',
    rarity: 'N',
    price: 30,
    gradient: 'linear-gradient(180deg, #ffffff 0%, #f5f7fb 100%)',
    mode: 'light',
    tone: 'neutral',
    purchasable: true,
    upPool: false,
    theme: {
      primary: '#64748b',
      primaryLight: '#94a3b8',
      primaryDark: '#475569',
      secondary: '#d99536',
      secondaryLight: '#e8b568',
      accent: '#6f9f64',
      accentLight: '#8fba86',
      bg: '#f7f9fc',
      bgCard: 'rgba(255,255,255,0.92)',
      textPrimary: '#1f2937',
      textSecondary: '#667085',
      textMuted: '#98a2b3',
      border: 'rgba(148,163,184,0.34)',
      surface: '#f8fafc',
      surfaceContainerLow: '#f1f5f9',
      surfaceContainerHigh: '#e2e8f0',
      surfaceContainerHighest: '#cbd5e1',
      surfaceContainerLowest: '#ffffff',
      onSurface: '#1f2937',
      onSurfaceVariant: '#475569',
      outlineVariant: '#cbd5e1',
      primaryFixed: '#e2e8f0',
      secondaryFixed: '#fef3c7',
    },
  },
  {
    id: 'bg-calm-blue',
    name: '静谧蓝',
    description: '低饱和冷调背景，适合长时间专注',
    icon: '◆',
    rarity: 'N',
    price: 40,
    gradient: 'linear-gradient(180deg, #eef6ff 0%, #cfe3f8 100%)',
    mode: 'light',
    tone: 'cool',
    purchasable: true,
    upPool: false,
    theme: {
      primary: '#2563eb',
      primaryLight: '#60a5fa',
      primaryDark: '#1d4ed8',
      secondary: '#0f766e',
      secondaryLight: '#2dd4bf',
      accent: '#10b981',
      accentLight: '#34d399',
      bg: '#eaf4ff',
      bgCard: 'rgba(255,255,255,0.9)',
      textPrimary: '#172033',
      textSecondary: '#52647a',
      textMuted: '#7f91a8',
      border: 'rgba(96,165,250,0.34)',
      surface: '#eef6ff',
      surfaceContainerLow: '#e2eefb',
      surfaceContainerHigh: '#cfe0f2',
      surfaceContainerHighest: '#b7cee6',
      surfaceContainerLowest: '#ffffff',
      onSurface: '#172033',
      onSurfaceVariant: '#41566d',
      outlineVariant: '#b7cee6',
      primaryFixed: '#dbeafe',
      secondaryFixed: '#ccfbf1',
    },
  },
  {
    id: 'bg-mint-focus',
    name: '薄荷绿',
    description: '清新温和的绿色学习背景',
    icon: '◇',
    rarity: 'N',
    price: 40,
    gradient: 'linear-gradient(180deg, #f1fbf5 0%, #cfeedd 100%)',
    mode: 'light',
    tone: 'mint',
    purchasable: true,
    upPool: true,
    theme: {
      primary: '#15803d',
      primaryLight: '#4ade80',
      primaryDark: '#166534',
      secondary: '#b7791f',
      secondaryLight: '#f6c453',
      accent: '#0f766e',
      accentLight: '#2dd4bf',
      bg: '#eef9f2',
      bgCard: 'rgba(255,255,255,0.9)',
      textPrimary: '#173326',
      textSecondary: '#4b6858',
      textMuted: '#7b9585',
      border: 'rgba(74,222,128,0.3)',
      surface: '#f1fbf5',
      surfaceContainerLow: '#e2f4e9',
      surfaceContainerHigh: '#cce7d7',
      surfaceContainerHighest: '#afd7c0',
      surfaceContainerLowest: '#ffffff',
      onSurface: '#173326',
      onSurfaceVariant: '#3f5f4d',
      outlineVariant: '#afd7c0',
      primaryFixed: '#dcfce7',
      secondaryFixed: '#fef3c7',
    },
  },
  {
    id: 'bg-warm-paper',
    name: '暖纸米',
    description: '纸张感暖色护眼背景',
    icon: '◌',
    rarity: 'R',
    price: 90,
    gradient: 'linear-gradient(180deg, #fffaf0 0%, #f1dfc2 100%)',
    mode: 'light',
    tone: 'warm',
    purchasable: true,
    upPool: false,
    theme: {
      primary: '#9a6a25',
      primaryLight: '#c7903a',
      primaryDark: '#765019',
      secondary: '#5f6f52',
      secondaryLight: '#8fa37b',
      accent: '#7f9b66',
      accentLight: '#a7c08d',
      bg: '#fbf3e4',
      bgCard: 'rgba(255,253,248,0.92)',
      textPrimary: '#2c241b',
      textSecondary: '#6f6355',
      textMuted: '#9a8d7d',
      border: 'rgba(199,144,58,0.28)',
      surface: '#fff8ec',
      surfaceContainerLow: '#f5ead7',
      surfaceContainerHigh: '#e8d8be',
      surfaceContainerHighest: '#d9c4a1',
      surfaceContainerLowest: '#fffdf8',
      onSurface: '#2c241b',
      onSurfaceVariant: '#5f5142',
      outlineVariant: '#d9c4a1',
      primaryFixed: '#fdecc8',
      secondaryFixed: '#e8f0dc',
    },
  },
  {
    id: 'bg-night-study',
    name: '夜读蓝',
    description: '夜间学习用的低亮度护眼背景',
    icon: '●',
    rarity: 'SR',
    price: 220,
    gradient: 'linear-gradient(180deg, #101827 0%, #1f2a44 100%)',
    pattern: 'stars',
    mode: 'dark',
    tone: 'cool',
    purchasable: true,
    upPool: true,
    theme: {
      primary: '#93c5fd',
      primaryLight: '#bfdbfe',
      primaryDark: '#60a5fa',
      secondary: '#f8c471',
      secondaryLight: '#fde68a',
      accent: '#5eead4',
      accentLight: '#99f6e4',
      bg: '#111827',
      bgCard: 'rgba(24,36,58,0.86)',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      border: 'rgba(148,163,184,0.22)',
      surface: '#111827',
      surfaceContainerLow: 'rgba(23,34,54,0.82)',
      surfaceContainerHigh: 'rgba(38,54,82,0.9)',
      surfaceContainerHighest: 'rgba(55,73,106,0.94)',
      surfaceContainerLowest: 'rgba(17,27,45,0.78)',
      onSurface: '#f8fafc',
      onSurfaceVariant: '#cbd5e1',
      outlineVariant: 'rgba(203,213,225,0.28)',
      primaryFixed: 'rgba(37,74,116,0.72)',
      secondaryFixed: 'rgba(72,55,28,0.72)',
    },
  },
  {
    id: 'bg-aurora-night',
    name: '极光夜',
    description: '冷调极光夜色背景，适合作为稀有皮肤',
    icon: '✦',
    rarity: 'SSR',
    price: 520,
    gradient: 'linear-gradient(135deg, #0f172a 0%, #164e63 38%, #3730a3 72%, #701a75 100%)',
    pattern: 'aurora',
    mode: 'dark',
    tone: 'aurora',
    purchasable: true,
    upPool: true,
    theme: {
      primary: '#a5b4fc',
      primaryLight: '#c4b5fd',
      primaryDark: '#818cf8',
      secondary: '#f0abfc',
      secondaryLight: '#f5d0fe',
      accent: '#2dd4bf',
      accentLight: '#5eead4',
      bg: '#0f172a',
      bgCard: 'rgba(18,28,50,0.78)',
      textPrimary: '#f8fafc',
      textSecondary: '#d8e0ee',
      textMuted: '#a8b3c7',
      border: 'rgba(196,181,253,0.24)',
      surface: '#0f172a',
      surfaceContainerLow: '#17213a',
      surfaceContainerHigh: '#263154',
      surfaceContainerHighest: '#35416a',
      surfaceContainerLowest: '#090f1f',
      onSurface: '#f8fafc',
      onSurfaceVariant: '#d8e0ee',
      outlineVariant: 'rgba(196,181,253,0.3)',
      primaryFixed: '#312e81',
      secondaryFixed: '#581c87',
    },
  },
];

const catalogById = new Map(backgroundCatalog.map(bg => [bg.id, bg]));
const catalogByName = new Map(backgroundCatalog.map(bg => [bg.name, bg]));

const legacyBackgroundIdMap: Record<string, string> = {
  'bg-n-1': 'bg-classic-light',
  'bg-n-5': 'bg-classic-light',
  'bg-n-6': 'bg-classic-light',
  'bg-n-2': 'bg-calm-blue',
  'bg-sr-3': 'bg-calm-blue',
  'bg-n-3': 'bg-mint-focus',
  'bg-sr-2': 'bg-mint-focus',
  'bg-n-4': 'bg-warm-paper',
  'bg-r-3': 'bg-warm-paper',
  'bg-r-4': 'bg-warm-paper',
  'bg-sr-4': 'bg-warm-paper',
  'bg-r-1': 'bg-night-study',
  'bg-ssr-1': 'bg-night-study',
  'bg-r-2': 'bg-aurora-night',
  'bg-ssr-2': 'bg-aurora-night',
  'bg-sr-1': 'bg-classic-light',
  'bg-ssr-3': 'bg-aurora-night',
};

const legacyBackgroundNameMap: Record<string, string> = {
  '纯净白': '晨光白',
  '浅烟灰': '晨光白',
  '苹果风': '晨光白',
  '静谧蓝': '静谧蓝',
  '深海蓝': '静谧蓝',
  '薄荷绿': '薄荷绿',
  '竹林风': '薄荷绿',
  '暖米色': '暖纸米',
  '橘光晚霞': '暖纸米',
  '黄昏落日': '暖纸米',
  '沙漠日落': '暖纸米',
  '星空夜': '夜读蓝',
  '璀璨银河': '夜读蓝',
  '森林极光': '极光夜',
  '极光绚烂': '极光夜',
  '春日樱': '晨光白',
  '幻彩云境': '极光夜',
  // Existing source text has mojibake strings; keep them for old persisted data.
  '绾噣鐧?': '晨光白',
  '娴呯儫鐏?': '晨光白',
  '鑻规灉椋?': '晨光白',
  '闈欒哀钃?': '静谧蓝',
  '娣辨捣钃?': '静谧蓝',
  '钖勮嵎缁?': '薄荷绿',
  '绔规灄椋?': '薄荷绿',
  '鏆栫背鑹?': '暖纸米',
  '姗樺厜鏅氶湠': '暖纸米',
  '榛勬槒钀芥棩': '暖纸米',
  '娌欐紶鏃ヨ惤': '暖纸米',
  '鏄熺┖澶?': '夜读蓝',
  '鐠€鐠ㄩ摱娌?': '夜读蓝',
  '妫灄鏋佸厜': '极光夜',
  '鏋佸厜缁氱儌': '极光夜',
  '鏄ユ棩妯?': '晨光白',
  '骞诲僵浜戝': '极光夜',
};

export function normalizeBackgroundId(backgroundId?: string | null): string | null {
  if (!backgroundId) return null;
  if (catalogById.has(backgroundId)) return backgroundId;
  return legacyBackgroundIdMap[backgroundId] ?? DEFAULT_BACKGROUND_ID;
}

export function getBackgroundById(backgroundId?: string | null): BackgroundCatalogItem | undefined {
  const normalizedId = normalizeBackgroundId(backgroundId);
  return normalizedId ? catalogById.get(normalizedId) : undefined;
}

export function getBackgroundByName(name?: string | null): BackgroundCatalogItem | undefined {
  if (!name) return undefined;
  return catalogByName.get(legacyBackgroundNameMap[name] ?? name);
}

export function toShopItem(bg: BackgroundCatalogItem): ShopItem {
  return {
    id: bg.id,
    name: bg.name,
    description: bg.description,
    icon: bg.icon,
    type: 'background',
    price: bg.price,
    rarity: bg.rarity,
    owned: false,
  };
}

export function toUpPoolItem(bg: BackgroundCatalogItem, probability: number): UpPoolItem {
  return {
    id: bg.id,
    name: bg.name,
    description: bg.description,
    icon: bg.icon,
    type: 'background',
    rarity: bg.rarity,
    probability,
    owned: false,
  };
}

export const backgroundShopItems = backgroundCatalog.filter(bg => bg.purchasable).map(toShopItem);

export const backgroundUpPoolItems = [
  toUpPoolItem(backgroundCatalog.find(bg => bg.id === 'bg-aurora-night')!, 0.08),
  toUpPoolItem(backgroundCatalog.find(bg => bg.id === 'bg-night-study')!, 0.12),
  toUpPoolItem(backgroundCatalog.find(bg => bg.id === 'bg-mint-focus')!, 0.16),
];

export function canonicalizeBackgroundInventoryItem(item: InventoryItem): InventoryItem {
  if (item.type !== 'background') return item;
  const bg = catalogById.get(item.id) ?? getBackgroundByName(item.name) ?? (item.id.startsWith('bg-') ? getBackgroundById(item.id) : undefined);
  if (!bg) {
    const fallback = catalogById.get(DEFAULT_BACKGROUND_ID)!;
    return {
      ...item,
      id: item.id,
      name: fallback.name,
      description: fallback.description,
      icon: fallback.icon,
      rarity: fallback.rarity,
    };
  }
  return {
    ...item,
    name: bg.name,
    description: bg.description,
    icon: bg.icon,
    rarity: bg.rarity,
  };
}

export function normalizeBackgroundInventory(inventory: InventoryState): InventoryState {
  const byName = new Map<string, InventoryItem>();
  const result: InventoryItem[] = [];

  for (const item of inventory.items.map(canonicalizeBackgroundInventoryItem)) {
    if (item.type !== 'background') {
      result.push(item);
      continue;
    }

    const existing = byName.get(item.name);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      byName.set(item.name, { ...item, quantity: Math.max(1, item.quantity) });
    }
  }

  result.push(...byName.values());
  return { items: result };
}

export function canonicalizeBackgroundUpPoolItem(item: UpPoolItem): UpPoolItem {
  if (item.type !== 'background') return item;
  const bg = catalogById.get(item.id) ?? getBackgroundByName(item.name) ?? (item.id.startsWith('bg-') ? getBackgroundById(item.id) : undefined);
  const replacement = bg ?? catalogById.get(DEFAULT_BACKGROUND_ID)!;
  return {
    ...item,
    id: replacement.id,
    name: replacement.name,
    description: replacement.description,
    icon: replacement.icon,
    rarity: replacement.rarity,
    type: 'background',
  };
}

export function normalizeBackgroundUpPool(upPool: UpPoolConfig): UpPoolConfig {
  const seenBackgroundIds = new Set<string>();
  const items: UpPoolItem[] = [];

  for (const item of upPool.items.map(canonicalizeBackgroundUpPoolItem)) {
    if (item.type === 'background') {
      if (seenBackgroundIds.has(item.id)) continue;
      seenBackgroundIds.add(item.id);
    }
    items.push(item);
  }

  const existingBgIds = new Set(items.filter(item => item.type === 'background').map(item => item.id));
  for (const bgItem of backgroundUpPoolItems) {
    if (!existingBgIds.has(bgItem.id)) items.push(bgItem);
  }

  return { ...upPool, items };
}

export function normalizeBackgroundShopItems(shopItems: ShopItem[]): ShopItem[] {
  const nonBackground = shopItems.filter(item => item.type !== 'background');
  const oldOwnedNames = new Set(
    shopItems
      .filter(item => item.type === 'background' && item.owned)
      .map(item => getBackgroundById(item.id)?.name ?? getBackgroundByName(item.name)?.name ?? item.name),
  );

  return [
    ...nonBackground,
    ...backgroundShopItems.map(item => ({ ...item, owned: oldOwnedNames.has(item.name) })),
  ];
}

export function normalizeBackgroundUser(user: User): User {
  const background = normalizeBackgroundId(user.background);
  return {
    ...user,
    background,
    currentBackground: background ? getBackgroundById(background)?.gradient : undefined,
    unlockedBackgrounds: Array.from(new Set((user.unlockedBackgrounds ?? []).map(normalizeBackgroundId).filter(Boolean) as string[])),
  };
}

export function applyBackgroundTheme(baseTheme: ThemeConfig, backgroundId?: string | null): ThemeConfig {
  const bg = getBackgroundById(backgroundId);
  if (!bg) return baseTheme;

  return {
    ...baseTheme,
    primary: bg.theme.primary,
    primaryLight: bg.theme.primaryLight,
    primaryDark: bg.theme.primaryDark,
    secondary: bg.theme.secondary,
    secondaryLight: bg.theme.secondaryLight,
    accent: bg.theme.accent,
    accentLight: bg.theme.accentLight,
    bg: bg.theme.bg,
    bgCard: bg.theme.bgCard,
    textPrimary: bg.theme.textPrimary,
    textSecondary: bg.theme.textSecondary,
    textMuted: bg.theme.textMuted,
    border: bg.theme.border,
    surface: bg.theme.surface,
    surfaceContainerLow: bg.theme.surfaceContainerLow,
    surfaceContainerHigh: bg.theme.surfaceContainerHigh,
    surfaceContainerHighest: bg.theme.surfaceContainerHighest,
    surfaceContainerLowest: bg.theme.surfaceContainerLowest,
    onSurface: bg.theme.onSurface,
    onSurfaceVariant: bg.theme.onSurfaceVariant,
    outlineVariant: bg.theme.outlineVariant,
    primaryFixed: bg.theme.primaryFixed,
    secondaryFixed: bg.theme.secondaryFixed,
    background: bg.theme.bg,
    onBackground: bg.theme.textPrimary,
    isFluidScholar: baseTheme.isFluidScholar,
    uiStyle: baseTheme.uiStyle,
  };
}
