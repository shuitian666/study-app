/**
 * 全局类型定义
 */

// Proficiency levels for knowledge points
export type ProficiencyLevel = 'none' | 'rusty' | 'normal' | 'master';

// Knowledge source type
export type KnowledgeSource = 'ai' | 'manual' | 'import';

export interface ProficiencyConfig {
  label: string;
  color: string;
  bgColor: string;
  reviewIntervalDays: number;
}

export const PROFICIENCY_MAP: Record<ProficiencyLevel, ProficiencyConfig> = {
  none:   { label: '不会', color: '#ef4444', bgColor: '#fef2f2', reviewIntervalDays: 1 },
  rusty:  { label: '生疏', color: '#f59e0b', bgColor: '#fffbeb', reviewIntervalDays: 2.5 },
  normal: { label: '一般', color: '#3b82f6', bgColor: '#eff6ff', reviewIntervalDays: 7 },
  master: { label: '熟练', color: '#10b981', bgColor: '#ecfdf5', reviewIntervalDays: 22 },
};

// User
export interface User {
  id: string;
  nickname: string;
  avatar: string;
  learningDays: number;
  totalPoints: number;
  createdAt: string;
  dailyGoal: number;  // 每日学习目标（题目数）
  todayQuestions: number;  // 今日已完成题目数
  goalAchievedToday: boolean;  // 今日目标是否达成
}

// Subject / Category
export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  knowledgePointCount: number;
}

// Chapter within a subject
export interface Chapter {
  id: string;
  subjectId: string;
  name: string;
  order: number;
}

// Knowledge Point
export interface KnowledgePoint {
  id: string;
  subjectId: string;
  chapterId: string;
  name: string;
  explanation: string;
  proficiency: ProficiencyLevel;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  reviewCount: number;
  createdAt: string;
  source: KnowledgeSource; // 'ai' | 'manual' | 'import'
}

// Question types
export type QuestionType = 'single_choice' | 'multi_choice' | 'true_false';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  knowledgePointId: string;
  subjectId: string;
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  correctAnswers: string[]; // option ids
  explanation: string;
}

// Quiz / Test
export interface QuizAnswer {
  questionId: string;
  selectedAnswers: string[];
  isCorrect: boolean;
}

export interface QuizResult {
  id: string;
  subjectId: string;
  totalQuestions: number;
  correctCount: number;
  score: number;
  answers: QuizAnswer[];
  completedAt: string;
}

// Wrong answer record
export interface WrongRecord {
  id: string;
  questionId: string;
  wrongAnswers: string[];
  correctAnswers: string[];
  addedAt: string;
  reviewedCount: number;
  lastReviewedAt: string | null;
}

// Review plan item
export interface ReviewItem {
  knowledgePointId: string;
  type: 'review' | 'new';
  scheduledAt: string;
  completed: boolean;
}

// Learning stats
export interface LearningStats {
  totalKnowledgePoints: number;
  masteredCount: number;
  normalCount: number;
  rustyCount: number;
  noneCount: number;
  totalQuizzes: number;
  averageScore: number;
  streakDays: number;
  weakSubjects: string[];
}

// ===== AI Chat =====

export type AIProvider = 'ollama' | 'volcengine' | 'minimax' | 'douban';

// AI预设配置
export interface AIPreset {
  id: string;
  name: string;
  provider: AIProvider;
  modelId?: string;
  groupId?: string;
  description: string;
}

export const AI_PRESETS: AIPreset[] = [
  { id: 'ollama-local', name: 'Ollama (本地)', provider: 'ollama', description: '本地部署，无需API密钥' },
  { id: 'douban', name: '豆包 API', provider: 'douban', description: '火山引擎豆包大模型，需密钥' },
  { id: 'volcengine', name: '火山引擎', provider: 'volcengine', modelId: 'ep-xxxxx', description: '豆包大模型' },
  { id: 'minimax', name: 'MiniMax', provider: 'minimax', groupId: 'group-xxxxx', description: '海螺问问' },
  { id: 'custom', name: '自定义', provider: 'ollama', description: '手动输入API配置' },
];

export interface AIConfig {
  provider: AIProvider;
  presetId?: string;
  model?: string;
  apiKey?: string;
  modelId?: string;
  groupId?: string;
}

export interface ProviderInfo {
  name: AIProvider;
  available: boolean;
  models: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  relatedQuestionId?: string;
  isStreaming?: boolean;
}

export interface AIChatSession {
  messages: ChatMessage[];
  isLoading: boolean;
  generatedQuestions: string[];
}

// Page routing
export type PageName =
  | 'home'
  | 'knowledge'
  | 'quiz'
  | 'knowledge-map'
  | 'profile'
  | 'settings'
  | 'login'
  | 'subject-detail'
  | 'knowledge-detail'
  | 'quiz-session'
  | 'quiz-result'
  | 'wrong-book'
  | 'review-session'
  | 'add-knowledge'
  | 'checkin'
  | 'achievements'
  | 'shop'
  | 'ranking'
  | 'lottery'
  | 'ai-chat';

// ===== 激励体系 =====

// Check-in / Sign-in
export interface CheckinRecord {
  date: string; // YYYY-MM-DD
  type: 'normal' | 'makeup' | 'team';
  teamId?: string;
  lotteryResult?: LotteryResult;
}

export interface CheckinState {
  records: CheckinRecord[];
  streak: number;
  makeupCards: number;
  totalCheckins: number;
  lotteryPity: LotteryPityState;
}

// ===== Lottery / 抽签系统 =====

export type LotteryTier = 'SSR' | 'SR' | 'R' | 'N' | 'NN';

export interface LotteryTierConfig {
  tier: LotteryTier;
  label: string;
  probability: number;
  rewardType: 'makeup_card' | 'coins' | 'blessing';
  rewardAmount: number;
  color: string;
  icon: string;
}

export interface LotteryResult {
  tier: LotteryTier;
  reward: { type: 'makeup_card' | 'coins' | 'blessing'; amount: number };
  blessing?: string;
  isPity: boolean;
  timestamp: string;
}

export interface LotteryPityState {
  sinceLastSR: number;
  sinceLastSSR: number;
}

export interface LotteryPopup {
  show: boolean;
  result: LotteryResult | UpPoolResult | null;
  pool: 'regular' | 'up';
  phase: 'shaking' | 'revealing' | 'result';
}

// ===== Draw Balance / 抽签次数 =====

export interface DrawBalance {
  regular: number;
  up: number;
}

// ===== UP Pool / UP池限时奖池 =====

export interface UpPoolItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'avatar_frame' | 'background' | 'theme' | 'title';
  rarity: 'SSR' | 'SR' | 'R';
  probability: number;
  owned: boolean;
}

export interface UpPoolConfig {
  id: string;
  name: string;
  description: string;
  banner: string;
  items: UpPoolItem[];
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface UpPoolResult {
  item: UpPoolItem;
  isNew: boolean;
  timestamp: string;
}

// ===== Team / 组队学习 =====

export interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  isSimulated: boolean;
  progress: TeamMemberProgress;
}

export interface TeamMemberProgress {
  taskCompletionRate: number;
  studyMinutes: number;
  isReady: boolean;
  lastUpdated: string;
}

export interface TeamState {
  id: string;
  inviteCode: string;
  members: TeamMember[];
  status: 'waiting' | 'active' | 'dissolved';
  createdAt: string;
  todayCheckedIn: boolean;
}

// Achievements
export type AchievementCategory = 'beginner' | 'learning' | 'quiz';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  condition: AchievementCondition;
  reward: { coins: number };
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface AchievementCondition {
  type: 'first_learn' | 'first_checkin' | 'streak_days' | 'master_count' | 'perfect_quiz' | 'clear_wrong';
  value: number;
}

// Shop
export type ShopItemType = 'makeup_card' | 'avatar_frame' | 'theme_skin' | 'ai_skin';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: ShopItemType;
  price: number;
  owned: boolean;
}

// Ranking
export interface RankEntry {
  rank: number;
  nickname: string;
  avatar: string;
  value: number;
  isMe: boolean;
}

// Achievement unlock popup
export interface AchievementPopup {
  achievement: Achievement;
  show: boolean;
}
