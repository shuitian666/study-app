import type { Achievement, ShopItem, RankEntry, UpPoolConfig } from '@/types';

export const MOCK_ACHIEVEMENTS: Achievement[] = [
  // Beginner
  {
    id: 'ach-1', name: '初次学习', description: '完成第一次知识点学习', icon: '🌱',
    category: 'beginner', condition: { type: 'first_learn', value: 1 }, reward: { coins: 10 },
    unlocked: false, unlockedAt: null,
  },
  {
    id: 'ach-2', name: '准时打卡', description: '完成第一次签到', icon: '✅',
    category: 'beginner', condition: { type: 'first_checkin', value: 1 }, reward: { coins: 10 },
    unlocked: false, unlockedAt: null,
  },
  // Learning
  {
    id: 'ach-3', name: '坚持一周', description: '连续学习7天', icon: '🔥',
    category: 'learning', condition: { type: 'streak_days', value: 7 }, reward: { coins: 50 },
    unlocked: false, unlockedAt: null,
  },
  {
    id: 'ach-4', name: '月度学霸', description: '连续学习30天', icon: '👑',
    category: 'learning', condition: { type: 'streak_days', value: 30 }, reward: { coins: 200 },
    unlocked: false, unlockedAt: null,
  },
  {
    id: 'ach-5', name: '知识达人', description: '掌握50个知识点', icon: '🧠',
    category: 'learning', condition: { type: 'master_count', value: 50 }, reward: { coins: 100 },
    unlocked: false, unlockedAt: null,
  },
  {
    id: 'ach-6', name: '初窥门径', description: '掌握10个知识点', icon: '📖',
    category: 'learning', condition: { type: 'master_count', value: 10 }, reward: { coins: 30 },
    unlocked: false, unlockedAt: null,
  },
  // Quiz
  {
    id: 'ach-7', name: '满分达人', description: '测试获得满分', icon: '💯',
    category: 'quiz', condition: { type: 'perfect_quiz', value: 1 }, reward: { coins: 50 },
    unlocked: false, unlockedAt: null,
  },
  {
    id: 'ach-8', name: '错题终结者', description: '错题本清零', icon: '🎯',
    category: 'quiz', condition: { type: 'clear_wrong', value: 1 }, reward: { coins: 30 },
    unlocked: false, unlockedAt: null,
  },
];

export const MOCK_SHOP_ITEMS: ShopItem[] = [
  { id: 'item-1', name: '补签卡', description: '可补签1天', icon: '🎫', type: 'makeup_card', price: 30, owned: false },
  
  // N级 - 普通头像框
  { id: 'frame-n-1', name: '简约银框', description: '简约风格银色边框', icon: '⬜', type: 'avatar_frame', price: 30, owned: false },
  { id: 'frame-n-2', name: '冰川蓝框', description: '清爽冰川蓝色边框', icon: '🧊', type: 'avatar_frame', price: 30, owned: false },
  { id: 'frame-n-3', name: '翡翠绿框', description: '自然清新绿色边框', icon: '💚', type: 'avatar_frame', price: 30, owned: false },
  { id: 'frame-n-4', name: '珊瑚红框', description: '热情珊瑚红色边框', icon: '❤️', type: 'avatar_frame', price: 30, owned: false },
  { id: 'frame-n-5', name: '优雅黑金', description: '优雅黑色金边头像框', icon: '🖤', type: 'avatar_frame', price: 50, owned: false },
  
  // R级 - 稀有头像框
  { id: 'frame-r-1', name: '星空紫框', description: '渐变星空紫色头像框', icon: '🌌', type: 'avatar_frame', price: 100, owned: false },
  { id: 'frame-r-2', name: '极光蓝框', description: '极光渐变蓝色头像框', icon: '🌊', type: 'avatar_frame', price: 100, owned: false },
  { id: 'frame-r-3', name: '樱花粉框', description: '浪漫樱花粉色头像框', icon: '🌸', type: 'avatar_frame', price: 120, owned: false },
  { id: 'frame-r-4', name: '闪电黑框', description: '闪电风格黑色边框', icon: '⚡', type: 'avatar_frame', price: 120, owned: false },
  { id: 'frame-r-5', name: '彩虹缤纷', description: '多彩渐变彩虹头像框', icon: '🌈', type: 'avatar_frame', price: 150, owned: false },
  
  // SR级 - 史诗头像框
  { id: 'frame-sr-1', name: '春日花环', description: '春日樱花花环头像框', icon: '🌸', type: 'avatar_frame', price: 200, owned: false },
  { id: 'frame-sr-2', name: '金桂飘香', description: '金秋桂花装饰头像框', icon: '🌼', type: 'avatar_frame', price: 220, owned: false },
  { id: 'frame-sr-3', name: '紫藤花架', description: '紫色紫藤装饰头像框', icon: '💜', type: 'avatar_frame', price: 220, owned: false },
  { id: 'frame-sr-4', name: '圣诞花环', description: '圣诞节日装饰头像框', icon: '🎄', type: 'avatar_frame', price: 250, owned: false },
  { id: 'frame-sr-5', name: '爱心包围', description: '爱心装饰粉色头像框', icon: '❤️', type: 'avatar_frame', price: 250, owned: false },
  
  // SSR级 - 传说头像框
  { id: 'frame-ssr-1', name: '星河璀璨', description: 'SSR传说星河特效头像框', icon: '✨', type: 'avatar_frame', price: 500, owned: false },
  { id: 'frame-ssr-2', name: '永恒钻石', description: 'SSR永恒钻石特效头像框', icon: '💎', type: 'avatar_frame', price: 550, owned: false },
  { id: 'frame-ssr-3', name: '火焰图腾', description: 'SSR传说火焰特效头像框', icon: '🔥', type: 'avatar_frame', price: 500, owned: false },
  { id: 'frame-ssr-4', name: '双龙戏珠', description: 'SSR传说双龙特效头像框', icon: '🐲', type: 'avatar_frame', price: 600, owned: false },
  
  // N级 - 普通背景
  { id: 'bg-n-1', name: '纯净白', description: '纯净白色背景', icon: '⬜', type: 'background', price: 30, owned: false },
  { id: 'bg-n-2', name: '静谧蓝', description: '安静蓝色背景', icon: '💙', type: 'background', price: 30, owned: false },
  { id: 'bg-n-3', name: '薄荷绿', description: '清新薄荷绿色背景', icon: '🍃', type: 'background', price: 30, owned: false },
  { id: 'bg-n-4', name: '暖米色', description: '温暖米色背景', icon: '🌾', type: 'background', price: 30, owned: false },
  { id: 'bg-n-5', name: '浅烟灰', description: '简约烟灰背景', icon: '🩶', type: 'background', price: 30, owned: false },
  
  // R级 - 稀有背景
  { id: 'bg-r-1', name: '星空夜', description: '星空点点夜晚背景', icon: '🌌', type: 'background', price: 100, owned: false },
  { id: 'bg-r-2', name: '森林极光', description: '森林极光绿色背景', icon: '🌲', type: 'background', price: 120, owned: false },
  { id: 'bg-r-3', name: '橘光晚霞', description: '暖色调渐变晚霞背景', icon: '☁️', type: 'background', price: 120, owned: false },
  { id: 'bg-r-4', name: '黄昏落日', description: '黄昏落日背景', icon: '🌇', type: 'background', price: 150, owned: false },
  
  // SR级 - 史诗背景
  { id: 'bg-sr-1', name: '春日樱', description: '粉色樱花飘落动态背景', icon: '🌸', type: 'background', price: 220, owned: false },
  { id: 'bg-sr-2', name: '竹林风', description: '清幽竹林动态背景', icon: '🎋', type: 'background', price: 250, owned: false },
  { id: 'bg-sr-3', name: '深海蓝', description: '深海波浪动态背景', icon: '🌊', type: 'background', price: 250, owned: false },
  { id: 'bg-sr-4', name: '沙漠日落', description: '沙漠落日风景背景', icon: '🏜️', type: 'background', price: 280, owned: false },
  
  // SSR级 - 传说背景
  { id: 'bg-ssr-1', name: '璀璨银河', description: 'SSR星空闪烁动态背景', icon: '🌌', type: 'background', price: 550, owned: false },
  { id: 'bg-ssr-2', name: '极光绚烂', description: 'SSR多彩极光动态背景', icon: '✨', type: 'background', price: 600, owned: false },
  { id: 'bg-ssr-3', name: '幻彩云境', description: 'SSR彩虹渐变梦幻背景', icon: '🌈', type: 'background', price: 600, owned: false },
  
  // AI皮肤
  { id: 'item-10', name: '暗夜主题', description: '深色护眼主题皮肤', icon: '🌙', type: 'theme', price: 200, owned: false },
  { id: 'item-11', name: '樱花主题', description: '粉嫩樱花风格', icon: '🌸', type: 'theme', price: 200, owned: false },
  { id: 'item-12', name: '猫咪助手', description: 'AI助手变身可爱猫咪', icon: '🐱', type: 'ai_skin', price: 150, owned: false },
  { id: 'item-13', name: '机器人助手', description: 'AI助手科技风外观', icon: '🤖', type: 'ai_skin', price: 150, owned: false },
];

export const MOCK_RANKINGS: { studyTime: RankEntry[]; masterCount: RankEntry[] } = {
  studyTime: [
    { rank: 1, nickname: '学无止境', avatar: '🦊', value: 180, isMe: false },
    { rank: 2, nickname: '拼命三郎', avatar: '🐻', value: 150, isMe: false },
    { rank: 3, nickname: '日积月累', avatar: '🐰', value: 120, isMe: false },
    { rank: 4, nickname: '学习达人', avatar: '👤', value: 90, isMe: true },
    { rank: 5, nickname: '悄悄努力', avatar: '🐱', value: 75, isMe: false },
    { rank: 6, nickname: '每天一点', avatar: '🐶', value: 60, isMe: false },
    { rank: 7, nickname: '新手上路', avatar: '🐼', value: 45, isMe: false },
  ],
  masterCount: [
    { rank: 1, nickname: '百科全书', avatar: '🦁', value: 86, isMe: false },
    { rank: 2, nickname: '学无止境', avatar: '🦊', value: 72, isMe: false },
    { rank: 3, nickname: '学习达人', avatar: '👤', value: 55, isMe: true },
    { rank: 4, nickname: '拼命三郎', avatar: '🐻', value: 48, isMe: false },
    { rank: 5, nickname: '日积月累', avatar: '🐰', value: 35, isMe: false },
    { rank: 6, nickname: '小白进阶', avatar: '🐧', value: 20, isMe: false },
  ],
};

// ===== UP Pool =====

export const MOCK_UP_POOL: UpPoolConfig = {
  id: 'up-spring-2026',
  name: '春日限定',
  description: '限时UP! 春日主题头像框和背景',
  banner: '🌸',
  startDate: '2026-03-01',
  endDate: '2026-04-30',
  active: true,
  items: [
    { id: 'up-1', name: '春日花环框', description: '限定樱花头像框', icon: '🌸', type: 'avatar_frame', rarity: 'SSR', probability: 0.02, owned: false },
    { id: 'up-2', name: '星空背景', description: '璀璨星空学习背景', icon: '🌌', type: 'background', rarity: 'SSR', probability: 0.02, owned: false },
    { id: 'up-3', name: '竹林背景', description: '清幽竹林学习背景', icon: '🎋', type: 'background', rarity: 'SR', probability: 0.10, owned: false },
    { id: 'up-4', name: '海洋框', description: '蓝色波浪头像框', icon: '🌊', type: 'avatar_frame', rarity: 'SR', probability: 0.10, owned: false },
    { id: 'up-5', name: '学霸称号', description: '"知识之星"限定称号', icon: '⭐', type: 'title', rarity: 'SR', probability: 0.10, owned: false },
    { id: 'up-6', name: '绿野背景', description: '清新绿地学习背景', icon: '🍀', type: 'background', rarity: 'R', probability: 0.22, owned: false },
    { id: 'up-7', name: '简约框', description: '简洁线条头像框', icon: '⬜', type: 'avatar_frame', rarity: 'R', probability: 0.22, owned: false },
    { id: 'up-8', name: '新人称号', description: '"初来乍到"称号', icon: '🏷️', type: 'title', rarity: 'R', probability: 0.22, owned: false },
  ],
};

// Streak rewards: coins + UP draws
export const STREAK_REWARDS = [
  { days: 1,  coins: 5,  upDraws: 0, label: '1天' },
  { days: 3,  coins: 10, upDraws: 1, label: '3天' },
  { days: 7,  coins: 15, upDraws: 2, label: '7天' },
  { days: 14, coins: 25, upDraws: 3, label: '14天' },
  { days: 30, coins: 50, upDraws: 5, label: '30天' },
];
