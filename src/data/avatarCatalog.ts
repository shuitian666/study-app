import { backgroundCatalog, type BackgroundCatalogItem } from './backgroundCatalog';

export const rarityConfig = {
  N: { label: '普通', color: '#9ca3af', gradient: 'linear-gradient(135deg, #94a3b8, #64748b)' },
  R: { label: '稀有', color: '#3b82f6', gradient: 'linear-gradient(135deg, #60a5fa, #2563eb)' },
  SR: { label: '史诗', color: '#a855f7', gradient: 'linear-gradient(135deg, #c084fc, #9333ea)' },
  SSR: { label: '传说', color: '#f59e0b', gradient: 'linear-gradient(135deg, #fbbf24, #d97706)' },
};

export type RarityType = 'N' | 'R' | 'SR' | 'SSR';

export interface FrameConfig {
  id: string;
  name: string;
  icon: string;
  rarity: RarityType;
  gradient: string;
  borderStyle?: string;
  decorations?: string[];
  shapeTransform?: string;
  animation?: boolean;
}

export const allFrames: FrameConfig[] = [
  { id: 'frame-n-1', name: '简约银框', icon: '⬜', rarity: 'N', gradient: 'linear-gradient(135deg, #e5e7eb, #9ca3af)' },
  { id: 'frame-n-2', name: '冰川蓝框', icon: '🧊', rarity: 'N', gradient: 'linear-gradient(135deg, #93c5fd, #3b82f6)' },
  { id: 'frame-n-3', name: '翡翠绿框', icon: '💚', rarity: 'N', gradient: 'linear-gradient(135deg, #86efac, #22c55e)' },
  { id: 'frame-n-4', name: '珊瑚红框', icon: '❤️', rarity: 'N', gradient: 'linear-gradient(135deg, #fca5a5, #ef4444)' },
  { id: 'frame-n-5', name: '优雅黑金', icon: '🖤', rarity: 'N', gradient: 'linear-gradient(135deg, #fbbf24, #1f2937)' },
  { id: 'frame-r-1', name: '星空紫框', icon: '🌌', rarity: 'R', gradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)', borderStyle: 'dashed', animation: true },
  { id: 'frame-r-2', name: '极光蓝框', icon: '🌊', rarity: 'R', gradient: 'linear-gradient(135deg, #67e8f9, #0891b2)', borderStyle: 'double', animation: true },
  { id: 'frame-r-3', name: '樱花粉框', icon: '🌸', rarity: 'R', gradient: 'linear-gradient(135deg, #fbcfe8, #ec4899)', borderStyle: 'dotted', animation: true },
  { id: 'frame-r-4', name: '闪电黑框', icon: '⚡', rarity: 'R', gradient: 'linear-gradient(135deg, #1f2937, #000000, #4b5563)', borderStyle: 'double', animation: true },
  { id: 'frame-r-5', name: '彩虹缤纷', icon: '🌈', rarity: 'R', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 33%, #4facfe 66%, #00f2fe 100%)', animation: true },
  { id: 'frame-sr-1', name: '春日花环', icon: '🌸', rarity: 'SR', gradient: 'linear-gradient(135deg, #fce7f3, #db2777)', decorations: ['🌸', '🌺', '🍃'], shapeTransform: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', animation: true },
  { id: 'frame-sr-2', name: '金桂飘香', icon: '🌼', rarity: 'SR', gradient: 'linear-gradient(135deg, #fef3c7, #d97706)', decorations: ['🌼', '🍂'], shapeTransform: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)', animation: true },
  { id: 'frame-sr-3', name: '紫藤花架', icon: '💜', rarity: 'SR', gradient: 'linear-gradient(135deg, #e9d5ff, #9333ea)', decorations: ['💮', '🌿'], shapeTransform: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)', animation: true },
  { id: 'frame-sr-4', name: '圣诞花环', icon: '🎄', rarity: 'SR', gradient: 'linear-gradient(135deg, #bbf7d0, #16a34a)', decorations: ['❄️', '🔔', '🎁'], shapeTransform: 'circle(50%)', animation: true },
  { id: 'frame-sr-5', name: '爱心包围', icon: '❤️', rarity: 'SR', gradient: 'linear-gradient(135deg, #fecdd3, #fb7185)', decorations: ['💖', '💕', '💗'], shapeTransform: 'circle(50%)', animation: true },
  { id: 'frame-ssr-1', name: '星河璀璨', icon: '✨', rarity: 'SSR', gradient: 'linear-gradient(135deg, #fef9c3, #fbbf24, #f59e0b)', decorations: ['⭐', '✨', '🌟'], shapeTransform: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)', animation: true },
  { id: 'frame-ssr-2', name: '永恒钻石', icon: '💎', rarity: 'SSR', gradient: 'linear-gradient(135deg, #a5f3fc, #22d3d3, #06b6d4)', decorations: ['💎', '✨'], shapeTransform: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)', animation: true },
  { id: 'frame-ssr-3', name: '火焰图腾', icon: '🔥', rarity: 'SSR', gradient: 'linear-gradient(135deg, #fef9c3, #fb923c, #ef4444)', decorations: ['🔥', '💥', '⭐'], shapeTransform: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', animation: true },
  { id: 'frame-ssr-4', name: '双龙戏珠', icon: '🐲', rarity: 'SSR', gradient: 'linear-gradient(135deg, #10b981, #059669, #047857)', decorations: ['🐉', '🔥', '💎'], shapeTransform: 'circle(50%)', animation: true },
];

export type BackgroundConfig = BackgroundCatalogItem;
export const allBackgrounds: BackgroundConfig[] = backgroundCatalog;

export interface TitleConfig {
  id: string;
  name: string;
  icon: string;
  rarity: RarityType;
  gradient: string;
  textColor: string;
}

export const allTitles: TitleConfig[] = [
  { id: 'title-n-1', name: '初来乍到', icon: '📚', rarity: 'N', gradient: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', textColor: '#475569' },
  { id: 'title-n-2', name: '今天也在学', icon: '🔍', rarity: 'N', gradient: 'linear-gradient(135deg, #fef3c7, #fde68a)', textColor: '#92400e' },
  { id: 'title-r-1', name: '低调会一点', icon: '📝', rarity: 'R', gradient: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', textColor: '#1e40af' },
  { id: 'title-r-2', name: '半夜还在看', icon: '🌙', rarity: 'R', gradient: 'linear-gradient(135deg, #e0e7ff, #818cf8)', textColor: '#3730a3' },
  { id: 'title-sr-1', name: '风里有笔记', icon: '🍃', rarity: 'SR', gradient: 'linear-gradient(135deg, #d1fae5, #6ee7b7)', textColor: '#065f46' },
  { id: 'title-sr-2', name: '把书读薄了', icon: '⭐', rarity: 'SR', gradient: 'linear-gradient(135deg, #fce7f3, #f472b6)', textColor: '#9d174d' },
  { id: 'title-sr-ai-explorer', name: 'AI 学习探索者', icon: '✦', rarity: 'SR', gradient: 'linear-gradient(135deg, #e0f2fe, #c4b5fd)', textColor: '#3730a3' },
];
