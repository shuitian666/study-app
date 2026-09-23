import type {
  AILearningContext,
  ChatMessage,
  GenerateSmartQuizResult,
  KnowledgePoint,
  KnowledgePointExtended,
  LearningStats,
  Question,
} from '@/types';
import { AI_ANSWER_TEMPLATES, ENCOURAGEMENT_RULES } from '@/data/ai-mock';
import { API_BASE, apiFetch, fetchQuiz, streamChat } from '@/services/aiClient';

const MAX_CONTEXT_MESSAGES = 6;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function findRelatedKpIds(query: string, knowledgePoints: KnowledgePoint[]): string[] {
  const queryLower = query.toLowerCase();
  for (const tpl of AI_ANSWER_TEMPLATES) {
    if (tpl.keywords.some(kw => queryLower.includes(kw.toLowerCase()))) {
      return knowledgePoints
        .filter(kp => tpl.keywords.some(kw =>
          kp.name.toLowerCase().includes(kw.toLowerCase()) ||
          kp.explanation.toLowerCase().includes(kw.toLowerCase())
        ))
        .map(kp => kp.id);
    }
  }
  return knowledgePoints
    .filter(kp => queryLower.includes(kp.name.toLowerCase()) || kp.name.toLowerCase().includes(queryLower))
    .map(kp => kp.id);
}



function mockGetSmartEncouragement(stats: LearningStats, wrongCount: number, checkinStreak: number): string {
  const pick = (items: string[]) => items[Math.floor(Math.random() * items.length)];
  if ([7, 14, 30, 60, 100].includes(checkinStreak)) {
    const rule = ENCOURAGEMENT_RULES.find(r => r.condition === 'milestone_days')!;
    return pick(rule.templates).replace('{days}', String(checkinStreak));
  }
  if (wrongCount > 5) {
    const rule = ENCOURAGEMENT_RULES.find(r => r.condition === 'many_wrong')!;
    return pick(rule.templates).replace('{count}', String(wrongCount));
  }
  if (stats.totalKnowledgePoints > 0 && stats.masteredCount / stats.totalKnowledgePoints > 0.6) {
    const rule = ENCOURAGEMENT_RULES.find(r => r.condition === 'high_mastery')!;
    return pick(rule.templates).replace('{count}', String(stats.masteredCount));
  }
  return pick(ENCOURAGEMENT_RULES.find(r => r.condition === 'random')!.templates);
}

function masteryLevelFromKnowledgePoint(kp: KnowledgePoint): number {
  const extended = kp as Partial<KnowledgePointExtended>;
  if (typeof extended.currentScore === 'number' && Number.isFinite(extended.currentScore)) {
    return Math.max(0, Math.min(100, Math.round(extended.currentScore)));
  }
  const values: Record<KnowledgePoint['proficiency'], number> = {
    none: 0,
    rusty: 35,
    normal: 70,
    master: 95,
  };
  return values[kp.proficiency];
}

export interface StreamingAskResult {
  stream: AsyncGenerator<string>;
  relatedKpIds: string[];
}

export async function askQuestionStreaming(
  query: string,
  knowledgePoints: KnowledgePoint[],
  history: ChatMessage[] = [],
  signal?: AbortSignal,
  learningContext?: AILearningContext,
): Promise<StreamingAskResult> {
  const recentHistory = history
    .filter(m => m.role !== 'ai' || m.content.trim().length > 0)
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(m => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.content.slice(0, 800),
    }));
  recentHistory.push({ role: 'user', content: query });

  const focus = learningContext?.focusKnowledgePoints.length ? learningContext.focusKnowledgePoints : knowledgePoints.slice(0, 6);
  return {
    stream: streamChat({ messages: recentHistory, knowledgeContext: focus.map(kp => kp.name), learningContext, signal }),
    relatedKpIds: learningContext?.focusKnowledgePoints.map(kp => kp.id) || findRelatedKpIds(query, knowledgePoints),
  };
}

export async function generateQuiz(
  knowledgePointIds: string[],
  knowledgePoints: KnowledgePoint[],
  _existingQuestions: Question[],
  learningContext?: AILearningContext,
): Promise<GenerateSmartQuizResult> {
  const kps = knowledgePoints.filter(kp => knowledgePointIds.includes(kp.id));
  const contextById = new Map(learningContext?.focusKnowledgePoints.map(kp => [kp.id, kp]));
  const result = await fetchQuiz({
    knowledgePoints: kps.map(kp => ({ id: kp.id, name: kp.name, masteryLevel: contextById.get(kp.id)?.masteryLevel ?? masteryLevelFromKnowledgePoint(kp), wrongCount: contextById.get(kp.id)?.wrongCount ?? 0, lastReviewedAt: kp.lastReviewedAt || '' })),
    knowledgePointNames: kps.map(kp => kp.name), subjectName: '', mode: 'smart', learningContext,
  });
  if (!result.question) throw new Error('AI 没有返回有效题目，请重试');
  const selected = kps.find(kp => kp.name === result.selectedKnowledgePoint) || kps[0];
  return { ...result, question: { ...result.question, id: `ai-q-${crypto.randomUUID()}`, knowledgePointId: selected?.id || '', subjectId: selected?.subjectId || '' } };
}

export async function getSmartEncouragement(stats: LearningStats, wrongCount: number, checkinStreak: number): Promise<string> {
  await delay(100);
  return mockGetSmartEncouragement(stats, wrongCount, checkinStreak);
}

export interface ExplainParams {
  question: { stem?: string; options?: Array<{ id: string; text: string }> };
  selectedAnswer: string[];
  correctAnswer: string[];
  knowledgePoint?: string;
  subjectName?: string;
  learningContext?: AILearningContext;
}

export async function generateQuestionExplanation(params: ExplainParams): Promise<string> {
  try {
    const res = await apiFetch(`${API_BASE}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'AI 解析失败');
    if (data.explanation) return data.explanation;
  } catch (error) {
    throw error instanceof Error ? error : new Error('AI 解析失败，请重试');
  }
  throw new Error('AI 未返回解析，请重试');
}
