import { useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import { generateQuestionExplanation, generateQuiz } from '@/services/aiService';

/**
 * Hook for pre-generating quiz questions and AI explanations
 * Call this when user starts learning a new stage
 */
export function usePreGenerate() {
  const { state, dispatch } = useApp();

  const getSavedExplanation = useCallback((questionId: string): string | null => {
    const saved = state.questionExplanations.find(e => e.questionId === questionId);
    return saved ? saved.explanation : null;
  }, [state.questionExplanations]);

  /**
   * Pre-generate explanations for existing questions
   */
  const preGenerateExplanations = useCallback(async (
    questions: { id: string; stem: string; options: Array<{ id: string; text: string }> }[],
    onProgress?: (current: number, total: number) => void
  ): Promise<void> => {
    const total = questions.length;
    
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      // Skip if already has explanation
      if (getSavedExplanation(q.id)) {
        onProgress?.(i + 1, total);
        continue;
      }

      try {
        const explanation = await generateQuestionExplanation({
          question: { stem: q.stem, options: q.options },
          selectedAnswer: [],
          correctAnswer: [],
        });

        dispatch({
          type: 'SAVE_QUESTION_EXPLANATION',
          payload: {
            questionId: q.id,
            explanation,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isUserModified: false,
          },
        });
      } catch (error) {
        console.warn(`Failed to pre-generate explanation for question ${q.id}:`, error);
      }

      onProgress?.(i + 1, total);
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }, [dispatch, getSavedExplanation]);

  /**
   * Generate new questions for the next stage
   * This is called when user completes a stage
   */
  const generateNextStageQuestions = useCallback(async (
    subjectId: string,
    knowledgePointIds: string[],
    count: number = 5,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> => {
    const kps = state.knowledgePoints.filter(kp => 
      knowledgePointIds.includes(kp.id) || (subjectId && kp.subjectId === subjectId)
    );
    
    for (let i = 0; i < count; i++) {
      try {
        const result = await generateQuiz(
          knowledgePointIds,
          kps,
          state.questions
        );

        if (result.question) {
          dispatch({
            type: 'AI_ADD_GENERATED_QUESTION',
            payload: result.question,
          });
          
          // Also pre-generate explanation for the new question
          const explanation = await generateQuestionExplanation({
            question: { stem: result.question.stem, options: result.question.options },
            selectedAnswer: [],
            correctAnswer: result.question.correctAnswers,
          });

          dispatch({
            type: 'SAVE_QUESTION_EXPLANATION',
            payload: {
              questionId: result.question.id,
              explanation,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isUserModified: false,
            },
          });
        }
      } catch (error) {
        console.warn(`Failed to generate question ${i + 1}:`, error);
      }

      onProgress?.(i + 1, count);
      
      // Delay between generations
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }, [state.knowledgePoints, state.questions, dispatch]);

  /**
   * 按需生成单个题目的解析（用户点击才生成，不预先生成）
   * 按照用户需求：点击才生成，节省token
   */
  const generateExplanationOnDemand = useCallback(async (
    questionId: string,
    question: { stem: string; options: Array<{ id: string; text: string }> },
    selectedAnswer: string[],
    correctAnswer: string[],
    knowledgePointName?: string,
    subjectName?: string,
  ): Promise<string> => {
    // 如果已经生成过，直接返回
    const existing = getSavedExplanation(questionId);
    if (existing) return existing;

    const explanation = await generateQuestionExplanation({
      question,
      selectedAnswer,
      correctAnswer,
      knowledgePoint: knowledgePointName,
      subjectName,
    });

    dispatch({
      type: 'SAVE_QUESTION_EXPLANATION',
      payload: {
        questionId,
        explanation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isUserModified: false,
      },
    });

    return explanation;
  }, [dispatch, getSavedExplanation]);

  return {
    getSavedExplanation,
    preGenerateExplanations,
    generateNextStageQuestions,
    generateExplanationOnDemand,
  };
}
