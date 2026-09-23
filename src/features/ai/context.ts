import type { AIStudyTutorContext, Question } from '@/types';

export function openAIHelp(context: AIStudyTutorContext) { window.dispatchEvent(new CustomEvent('ai:help', { detail: context })); }
export function askAboutQuestion(question: Question, submitted: boolean, selectedAnswers: string[] = [], explanation = question.explanation) {
  openAIHelp({ threadId: `question-${question.id}`, mode: submitted ? 'question_review' : 'question_hint', goal: '理解当前题目', chapterName: '', knowledgePointId: question.knowledgePointId || '', knowledgePointName: '当前题目', question: { id: question.id, stem: question.stem, options: question.options, ...(submitted ? { correctAnswers: question.correctAnswers, selectedAnswers, explanation } : {}) } });
}
