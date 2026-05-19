import type { ChatMessage, GenerateSmartQuizResult, KnowledgePoint, LearningStats, Question } from '@/types';
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
      answer: `关于「${matched.name}」，核心内容是：\n\n${matched.explanation}\n\n你可以继续追问，也可以让我基于这个知识点出题练习。`,
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
    stem: `以下关于「${kp.name}」的说法是否正确？${kp.explanation.slice(0, 50)}...`,
    options: [
      { id: 'A', text: '正确' },
      { id: 'B', text: '错误' },
      { id: 'C', text: '不确定' },
      { id: 'D', text: '以上都不对' },
    ],
    correctAnswers: ['A'],
    explanation: `${kp.name}：${kp.explanation}`,
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

export interface StreamingAskResult {
  stream: AsyncGenerator<string>;
  relatedKpIds: string[];
}

export async function askQuestionStreaming(
  query: string,
  knowledgePoints: KnowledgePoint[],
  history: ChatMessage[] = [],
  signal?: AbortSignal,
): Promise<StreamingAskResult> {
  const recentHistory = history
    .filter(m => m.role !== 'ai' || m.content.trim().length > 0)
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(m => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.content,
    }));
  recentHistory.push({ role: 'user', content: query });

  if (await checkBackendAvailable()) {
    return {
      stream: streamChat({
        messages: recentHistory,
        knowledgeContext: knowledgePoints.slice(0, 20).map(kp => kp.name),
        signal,
      }),
      relatedKpIds: findRelatedKpIds(query, knowledgePoints),
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
): Promise<GenerateSmartQuizResult> {
  if (await checkBackendAvailable()) {
    try {
      const kps = knowledgePoints.filter(kp => knowledgePointIds.includes(kp.id));
      const result = await fetchQuiz({
        knowledgePoints: kps.map(kp => ({
          id: kp.id,
          name: kp.name,
          masteryLevel: 1,
          wrongCount: 0,
          lastReviewedAt: kp.lastReviewedAt || '',
        })),
        knowledgePointNames: kps.map(kp => kp.name),
        subjectName: '',
        mode: 'smart',
      });
      if (result.question) {
        return {
          question: {
            ...result.question,
            id: `ai-q-${Date.now()}`,
            knowledgePointId: kps[0]?.id || '',
            subjectId: kps[0]?.subjectId || '',
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
  return `正确答案是 ${params.correctAnswer.join('、')}。建议回顾相关知识点，再做一遍同类题。`;
}
