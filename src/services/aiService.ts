import type {
  AILearningContext,
  ChatMessage,
  GenerateSmartQuizResult,
  KnowledgePoint,
  KnowledgePointExtended,
  LearningStats,
  Question,
} from '@/types';
import { AI_ANSWER_TEMPLATES, AI_GENERIC_ANSWER, AI_QUIZ_POOL, ENCOURAGEMENT_RULES } from '@/data/ai-mock';
import { API_BASE, checkBackendAvailable, fetchQuiz, streamChat } from '@/services/aiClient';

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

function mockAskQuestion(query: string, knowledgePoints: KnowledgePoint[]) {
  const matched = knowledgePoints.find(kp => query.includes(kp.name));
  if (matched) {
    return {
      answer: `关于「${matched.name}」，核心内容是：\n\n${matched.explanation}\n\n当前是离线兜底回答。联网 AI 可用后，我会结合你的掌握度、错题和复习计划继续讲解。`,
      relatedKpIds: [matched.id],
    };
  }
  return { answer: AI_GENERIC_ANSWER, relatedKpIds: [] };
}

function mockGenerateQuiz(knowledgePointIds: string[], knowledgePoints: KnowledgePoint[], existingQuestions: Question[]): Question | null {
  const usedIds = new Set(existingQuestions.map(q => q.id));
  const poolMatch = AI_QUIZ_POOL.find(q => q.knowledgePointId && knowledgePointIds.includes(q.knowledgePointId) && !usedIds.has(q.id));
  if (poolMatch) return { ...poolMatch, id: `ai-q-${Date.now()}` };
  const kp = knowledgePoints.find(k => knowledgePointIds.includes(k.id));
  if (!kp) return null;
  return {
    id: `ai-q-${Date.now()}`,
    knowledgePointId: kp.id,
    subjectId: kp.subjectId,
    type: 'single_choice',
    stem: `以下关于「${kp.name}」的说法是否正确：${kp.explanation.slice(0, 50)}...`,
    options: [
      { id: 'A', text: '正确' },
      { id: 'B', text: '错误' },
      { id: 'C', text: '不确定' },
      { id: 'D', text: '以上都不对' },
    ],
    correctAnswers: ['A'],
    explanation: `${kp.name}: ${kp.explanation}`,
  };
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

  if (await checkBackendAvailable()) {
    const focus = learningContext?.focusKnowledgePoints.length
      ? learningContext.focusKnowledgePoints
      : knowledgePoints.slice(0, 6);

    return {
      stream: streamChat({
        messages: recentHistory,
        knowledgeContext: focus.map(kp => kp.name),
        learningContext,
        signal,
      }),
      relatedKpIds: learningContext?.focusKnowledgePoints.map(kp => kp.id) || findRelatedKpIds(query, knowledgePoints),
    };
  }

  await delay(300);
  const result = mockAskQuestion(query, knowledgePoints);
  return {
    relatedKpIds: result.relatedKpIds,
    stream: (async function* () {
      for (let i = 0; i < result.answer.length; i += 2) {
        yield result.answer.slice(i, i + 2);
        await delay(15);
      }
    })(),
  };
}

export async function generateQuiz(
  knowledgePointIds: string[],
  knowledgePoints: KnowledgePoint[],
  existingQuestions: Question[],
  learningContext?: AILearningContext,
): Promise<GenerateSmartQuizResult> {
  if (await checkBackendAvailable()) {
    try {
      const kps = knowledgePoints.filter(kp => knowledgePointIds.includes(kp.id));
      const contextById = new Map(learningContext?.focusKnowledgePoints.map(kp => [kp.id, kp]));
      const result = await fetchQuiz({
        knowledgePoints: kps.map(kp => ({
          id: kp.id,
          name: kp.name,
          masteryLevel: contextById.get(kp.id)?.masteryLevel ?? masteryLevelFromKnowledgePoint(kp),
          wrongCount: contextById.get(kp.id)?.wrongCount ?? 0,
          lastReviewedAt: kp.lastReviewedAt || '',
        })),
        knowledgePointNames: kps.map(kp => kp.name),
        subjectName: '',
        mode: 'smart',
        learningContext,
      });
      if (result.question) {
        const selectedKp = kps.find(kp => kp.name === result.selectedKnowledgePoint) || kps[0];
        return {
          question: {
            ...result.question,
            id: `ai-q-${Date.now()}`,
            knowledgePointId: selectedKp?.id || '',
            subjectId: selectedKp?.subjectId || '',
          },
          selectedKnowledgePoint: result.selectedKnowledgePoint,
          mode: 'smart',
        };
      }
    } catch {
      // Fallback below.
    }
  }
  return { question: mockGenerateQuiz(knowledgePointIds, knowledgePoints, existingQuestions), mode: 'random' };
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
    const res = await fetch(`${API_BASE}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data.explanation) return data.explanation;
  } catch {
    // Fallback below.
  }
  return `正确答案是 ${params.correctAnswer.join('、')}。建议回顾相关知识点，再做一道同类题巩固。`;
}
