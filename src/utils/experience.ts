import type { ExperienceLedgerEntry, ExperienceSource, LevelBenefit, LevelConfig } from '@/types';

export const DAILY_LIMITED_EXPERIENCE_CAP = 200;
export const FLASHCARD_EXPERIENCE = 3;
export const QUIZ_QUESTION_EXPERIENCE = 3;
export const MASTERY_EXPERIENCE = 10;
export const DAILY_GOAL_CHECKIN_EXPERIENCE = 50;

export interface AddExperienceInput {
  source: ExperienceSource;
  sourceId: string;
  amount: number;
  capped?: boolean;
  dailyUsedOffset?: number;
  createdAt?: string;
}

export interface AddExperienceResult {
  ledger: ExperienceLedgerEntry[];
  granted: number;
}

export interface LevelProgress {
  level: number;
  currentLevelExp: number;
  nextLevelExp: number;
  progressPercent: number;
  totalExperience: number;
}

export const LEVEL_BENEFITS: LevelBenefit[] = [];

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRequiredTotalExpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let current = 1; current < level; current += 1) {
    total += Math.round(80 + current * 40 + Math.pow(current, 1.35) * 18);
  }
  return total;
}

export function calculateLevelProgress(totalExperience: number): LevelProgress {
  const safeTotal = Math.max(0, Math.floor(totalExperience || 0));
  let level = 1;
  while (safeTotal >= getRequiredTotalExpForLevel(level + 1)) {
    level += 1;
  }

  const levelStart = getRequiredTotalExpForLevel(level);
  const nextLevelTotal = getRequiredTotalExpForLevel(level + 1);
  const nextLevelExp = Math.max(1, nextLevelTotal - levelStart);
  const currentLevelExp = Math.max(0, safeTotal - levelStart);

  return {
    level,
    currentLevelExp,
    nextLevelExp,
    progressPercent: Math.min(100, Math.round((currentLevelExp / nextLevelExp) * 100)),
    totalExperience: safeTotal,
  };
}

export function getLevelConfigs(maxLevel = 60): LevelConfig[] {
  return Array.from({ length: maxLevel }, (_, index) => {
    const level = index + 1;
    return {
      level,
      requiredTotalExp: getRequiredTotalExpForLevel(level),
      benefits: LEVEL_BENEFITS.filter(benefit => benefit.level === level),
    };
  });
}

export function getTodayLimitedExperience(ledger: ExperienceLedgerEntry[], dateKey = getLocalDateKey()): number {
  return ledger
    .filter(entry => entry.capped && entry.dateKey === dateKey)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function addExperienceToLedger(
  ledger: ExperienceLedgerEntry[] | undefined,
  input: AddExperienceInput,
): AddExperienceResult {
  const currentLedger = ledger ?? [];
  if (input.amount <= 0 || currentLedger.some(entry => entry.sourceId === input.sourceId)) {
    return { ledger: currentLedger, granted: 0 };
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const dateKey = getLocalDateKey(new Date(createdAt));
  const capped = input.capped ?? true;
  const requestedAmount = Math.floor(input.amount);
  const todayUsed = capped ? getTodayLimitedExperience(currentLedger, dateKey) + (input.dailyUsedOffset ?? 0) : 0;
  const available = capped ? Math.max(0, DAILY_LIMITED_EXPERIENCE_CAP - todayUsed) : requestedAmount;
  const amount = Math.max(0, Math.min(requestedAmount, available));

  if (amount <= 0) {
    return { ledger: currentLedger, granted: 0 };
  }

  const entry: ExperienceLedgerEntry = {
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: input.source,
    sourceId: input.sourceId,
    amount,
    requestedAmount,
    dateKey,
    capped,
    createdAt,
  };

  return {
    ledger: [...currentLedger, entry],
    granted: amount,
  };
}
