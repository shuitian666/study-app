export const CHAT_SYSTEM_PROMPT = `你是「智学助手」，一位一对一学习私教。

你的目标不是泛泛回答，而是结合学生当前掌握度、错题、复习计划和正在学习的知识点，给出个性化讲解。

回答要求：
- 先直接回答核心概念，再用一个贴近题目或知识点的例子说明。
- 如果学生可能混淆概念，要指出“容易混淆点”和区分方法。
- 结合上下文给一个下一步动作，例如复习某知识点、做一道同类题、回看错题。
- 控制在 300 字以内，除非学生明确要求详细展开。
- 不要编造不存在的学习记录；上下文没有提供时，就按普通讲解处理。`;

export const QUIZ_SYSTEM_PROMPT = `你是专业出题老师。请根据学生的学习上下文选择最需要练习的知识点，并生成一道高质量选择题。

出题要求：
- 优先选择低掌握度、错题多、到期复习、刚学过但未巩固的知识点。
- 题目难度要匹配掌握度：低掌握度出基础题，中等掌握出辨析题，高掌握出应用题。
- 选项要有区分度，错误选项应体现常见误区。
- 只输出 JSON，不要 markdown，不要解释 JSON 外的内容。`;

export const EXPLAIN_SYSTEM_PROMPT = `你是错题讲解私教。请根据题目、学生答案、正确答案和学习上下文解释。

讲解要求：
- 先指出正确答案。
- 说明学生可能错在什么概念或判断步骤。
- 如果上下文里有相关薄弱点或错题记录，要明确点出来。
- 最后给一个具体的下一步练习建议。
- 控制在 220 字以内。`;

const CONTEXT_LIMITS = {
  focusKnowledgePoints: 6,
  weakKnowledgePoints: 4,
  dueReviews: 4,
  recentWrongQuestions: 4,
  text: 180,
  historyMessage: 800,
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampText(value, limit = CONTEXT_LIMITS.text) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function normalizeLearningProfile(input = {}) {
  const validGoals = new Set(['daily_review', 'exam_cram', 'foundation', 'weakness_fix']);
  const goals = asArray(input?.goals).map(String).filter(goal => validGoals.has(goal)).slice(0, 3);
  return {
    goals: goals.length > 0 ? goals : ['daily_review'],
    studyDirection: ['medical', 'pharmacy', 'nursing', 'english', 'general'].includes(input?.studyDirection)
      ? input.studyDirection
      : 'general',
    explanationStyle: ['concise', 'step_by_step', 'analogy', 'exam_oriented'].includes(input?.explanationStyle)
      ? input.explanationStyle
      : 'step_by_step',
    preferredDifficulty: ['basic', 'standard', 'challenge'].includes(input?.preferredDifficulty)
      ? input.preferredDifficulty
      : 'standard',
    practicePreference: ['explain_then_practice', 'quiz_then_explain', 'wrong_only'].includes(input?.practicePreference)
      ? input.practicePreference
      : 'explain_then_practice',
  };
}

function normalizeInferredProfile(input = {}) {
  return {
    weakPatterns: asArray(input?.weakPatterns).map(item => clampText(item, 40)).filter(Boolean).slice(0, 4),
    stableWeakAreas: asArray(input?.stableWeakAreas).map(item => clampText(item, 60)).filter(Boolean).slice(0, 3),
  };
}

function normalizeKnowledgePoint(item) {
  return {
    id: String(item?.id || ''),
    name: clampText(item?.name, 80),
    subjectName: clampText(item?.subjectName, 60),
    chapterName: clampText(item?.chapterName, 60),
    explanation: clampText(item?.explanation, CONTEXT_LIMITS.text),
    proficiency: clampText(item?.proficiency, 20),
    masteryLevel: Number.isFinite(Number(item?.masteryLevel)) ? Number(item.masteryLevel) : undefined,
    wrongCount: Number.isFinite(Number(item?.wrongCount)) ? Number(item.wrongCount) : 0,
    reviewCount: Number.isFinite(Number(item?.reviewCount)) ? Number(item.reviewCount) : 0,
    lastReviewedAt: item?.lastReviewedAt || null,
    nextReviewAt: item?.nextReviewAt || null,
    reason: clampText(item?.reason, 100),
  };
}

function normalizeWrongQuestion(item) {
  return {
    id: String(item?.id || ''),
    questionId: String(item?.questionId || ''),
    knowledgePointId: item?.knowledgePointId ? String(item.knowledgePointId) : undefined,
    knowledgePointName: clampText(item?.knowledgePointName, 80),
    stem: clampText(item?.stem, 160),
    wrongAnswers: asArray(item?.wrongAnswers).map(String).slice(0, 4),
    correctAnswers: asArray(item?.correctAnswers).map(String).slice(0, 4),
    reviewedCount: Number.isFinite(Number(item?.reviewedCount)) ? Number(item.reviewedCount) : 0,
    addedAt: item?.addedAt || '',
    lastReviewedAt: item?.lastReviewedAt || null,
  };
}

export function sanitizeLearningContext(input = {}) {
  return {
    profile: {
      nickname: clampText(input?.profile?.nickname, 24),
      dailyGoal: Number.isFinite(Number(input?.profile?.dailyGoal)) ? Number(input.profile.dailyGoal) : undefined,
      dailyNewGoal: Number.isFinite(Number(input?.profile?.dailyNewGoal)) ? Number(input.profile.dailyNewGoal) : undefined,
      learningProfile: normalizeLearningProfile(input?.profile?.learningProfile),
      inferredProfile: normalizeInferredProfile(input?.profile?.inferredProfile),
    },
    focusKnowledgePoints: asArray(input?.focusKnowledgePoints)
      .slice(0, CONTEXT_LIMITS.focusKnowledgePoints)
      .map(normalizeKnowledgePoint)
      .filter(item => item.id && item.name),
    weakKnowledgePoints: asArray(input?.weakKnowledgePoints)
      .slice(0, CONTEXT_LIMITS.weakKnowledgePoints)
      .map(normalizeKnowledgePoint)
      .filter(item => item.id && item.name),
    dueReviews: asArray(input?.dueReviews)
      .slice(0, CONTEXT_LIMITS.dueReviews)
      .map(normalizeKnowledgePoint)
      .filter(item => item.id && item.name),
    recentWrongQuestions: asArray(input?.recentWrongQuestions)
      .slice(0, CONTEXT_LIMITS.recentWrongQuestions)
      .map(normalizeWrongQuestion)
      .filter(item => item.id || item.questionId),
    todayProgress: {
      reviewDone: Number(input?.todayProgress?.reviewDone || 0),
      reviewTotal: Number(input?.todayProgress?.reviewTotal || 0),
      newDone: Number(input?.todayProgress?.newDone || 0),
      newTotal: Number(input?.todayProgress?.newTotal || 0),
    },
  };
}

export function formatLearningContext(input) {
  const context = sanitizeLearningContext(input);
  const lines = [];

  if (context.profile.nickname || context.profile.dailyGoal || context.profile.dailyNewGoal) {
    lines.push('## 学生画像');
    lines.push(JSON.stringify(context.profile));
  }

  lines.push('## 今日进度');
  lines.push(JSON.stringify(context.todayProgress));

  if (context.focusKnowledgePoints.length > 0) {
    lines.push('## 当前问题最相关知识点');
    lines.push(JSON.stringify(context.focusKnowledgePoints));
  }

  if (context.weakKnowledgePoints.length > 0) {
    lines.push('## 薄弱知识点');
    lines.push(JSON.stringify(context.weakKnowledgePoints));
  }

  if (context.dueReviews.length > 0) {
    lines.push('## 到期复习');
    lines.push(JSON.stringify(context.dueReviews));
  }

  if (context.recentWrongQuestions.length > 0) {
    lines.push('## 最近错题');
    lines.push(JSON.stringify(context.recentWrongQuestions));
  }

  return lines.join('\n');
}

export function buildChatMessages(systemPrompt, knowledgeContext, history, learningContext) {
  const content = [systemPrompt];

  const formattedContext = formatLearningContext(learningContext);
  if (formattedContext) {
    content.push(formattedContext);
  } else if (knowledgeContext && knowledgeContext.length > 0) {
    content.push(`## 学生正在学习的知识点\n${knowledgeContext.slice(0, 8).join('、')}`);
  }

  const messages = [{ role: 'system', content: content.join('\n\n') }];

  if (history) {
    for (const msg of history) {
      if (!msg?.content) continue;
      messages.push({
        role: msg.role === 'ai' ? 'assistant' : msg.role,
        content: String(msg.content).slice(0, CONTEXT_LIMITS.historyMessage),
      });
    }
  }

  return messages;
}

export function buildQuizMessages({ subjectName = '', knowledgePoints = [], learningContext }) {
  const context = sanitizeLearningContext(learningContext);
  const candidates = asArray(knowledgePoints)
    .slice(0, 12)
    .map(item => ({
      id: String(item?.id || ''),
      name: clampText(item?.name, 80),
      masteryLevel: Number.isFinite(Number(item?.masteryLevel)) ? Number(item.masteryLevel) : undefined,
      wrongCount: Number.isFinite(Number(item?.wrongCount)) ? Number(item.wrongCount) : 0,
      lastReviewedAt: item?.lastReviewedAt || '',
    }))
    .filter(item => item.name);

  const fallbackCandidates = context.focusKnowledgePoints.map(item => ({
    id: item.id,
    name: item.name,
    masteryLevel: item.masteryLevel,
    wrongCount: item.wrongCount,
    lastReviewedAt: item.lastReviewedAt || '',
  }));
  const finalCandidates = candidates.length > 0 ? candidates : fallbackCandidates;

  return [
    { role: 'system', content: QUIZ_SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        subjectName,
        candidates: finalCandidates,
        learningContext: context,
        outputSchema: {
          selectedKnowledgePoint: 'must be one candidate name',
          question: {
            type: 'single_choice',
            stem: 'question stem',
            options: [{ id: 'a', text: 'option A' }],
            correctAnswers: ['a'],
            explanation: 'brief explanation',
          },
        },
      }),
    },
  ];
}

export function buildExplainMessages(payload) {
  return [
    { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        subjectName: payload.subjectName || '',
        knowledgePoint: payload.knowledgePoint || '',
        question: payload.question || {},
        selectedAnswer: asArray(payload.selectedAnswer).map(String),
        correctAnswer: asArray(payload.correctAnswer).map(String),
        learningContext: sanitizeLearningContext(payload.learningContext),
      }),
    },
  ];
}
