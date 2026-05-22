import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChatMessages,
  buildQuizMessages,
  sanitizeLearningContext,
} from './prompts.js';

test('sanitizeLearningContext caps arrays and trims long text', () => {
  const context = sanitizeLearningContext({
    profile: { nickname: 'Ada', dailyGoal: 10 },
    focusKnowledgePoints: Array.from({ length: 12 }, (_, index) => ({
      id: `kp-${index}`,
      name: `Card ${index}`,
      explanation: 'x'.repeat(500),
    })),
    weakKnowledgePoints: [],
    dueReviews: [],
    recentWrongQuestions: [],
    todayProgress: { reviewDone: 1, reviewTotal: 3, newDone: 0, newTotal: 2 },
  });

  assert.equal(context.focusKnowledgePoints.length, 6);
  assert.equal(context.focusKnowledgePoints[0].explanation.length, 183);
  assert.equal(context.todayProgress.reviewTotal, 3);
  assert.deepEqual(context.profile.learningProfile.goals, ['daily_review']);
});

test('buildChatMessages includes learning context before conversation history', () => {
  const messages = buildChatMessages(
    'Tutor prompt',
    ['Fallback card'],
    [{ role: 'user', content: 'Explain dose conversion'.repeat(100) }],
    {
      focusKnowledgePoints: [{ id: 'kp-dose', name: 'Dose conversion', proficiency: 'rusty', wrongCount: 2 }],
      todayProgress: { reviewDone: 0, reviewTotal: 1, newDone: 0, newTotal: 1 },
    },
  );

  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /Dose conversion/);
  assert.equal(messages[1].role, 'user');
  assert.ok(messages[1].content.length <= 800);
});

test('sanitizeLearningContext trims profile and inferred profile to budget', () => {
  const context = sanitizeLearningContext({
    profile: {
      learningProfile: {
        goals: ['daily_review', 'exam_cram', 'foundation', 'weakness_fix'],
        studyDirection: 'pharmacy',
        explanationStyle: 'exam_oriented',
        preferredDifficulty: 'challenge',
        practicePreference: 'quiz_then_explain',
        updatedAt: 'x'.repeat(500),
      },
      inferredProfile: {
        weakPatterns: ['low_mastery', 'repeated_mistakes', 'review_overdue', 'needs_error_review', 'extra'],
        stableWeakAreas: ['A'.repeat(100), 'B', 'C', 'D'],
      },
    },
  });

  assert.equal(context.profile.learningProfile.goals.length, 3);
  assert.equal(context.profile.learningProfile.studyDirection, 'pharmacy');
  assert.equal(context.profile.inferredProfile.weakPatterns.length, 4);
  assert.equal(context.profile.inferredProfile.stableWeakAreas.length, 3);
});

test('buildQuizMessages preserves candidate names for selectedKnowledgePoint validation', () => {
  const messages = buildQuizMessages({
    subjectName: 'Pharmacy',
    knowledgePoints: [
      { id: 'kp-1', name: 'Dose conversion', masteryLevel: 30, wrongCount: 2, lastReviewedAt: '' },
    ],
    learningContext: {},
  });

  const payload = JSON.parse(messages[1].content);
  assert.equal(payload.candidates[0].name, 'Dose conversion');
  assert.equal(payload.outputSchema.selectedKnowledgePoint, 'must be one candidate name');
});
