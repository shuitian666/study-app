import { useState, useCallback, useMemo } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import FlashcardCard from '@/components/ui/FlashcardCard';
import FlashcardControls from '@/components/ui/FlashcardControls';
import { useFlashcardGesture } from '@/hooks/useFlashcardGesture';
import { ArrowLeft, Settings } from 'lucide-react';

type DecisionLevel = 'none' | 'rusty' | 'normal';

// Score calculation based on attempt number
function calculateScore(attemptNumber: number): number {
  const scores = [100, 80, 60, 40];
  return scores[Math.min(attemptNumber - 1, scores.length - 1)];
}

export default function FlashcardLearningPage() {
  const { navigate } = useUser();
  const { learningState, learningDispatch } = useLearning();
  const { theme } = useTheme();

  // Get knowledge points with questions for learning
  const learnablePoints = useMemo(() => {
    return learningState.knowledgePoints.filter(kp => {
      // Filter points that have either no questions or have questions to review
      const relatedQuestions = learningState.questions.filter(q => q.knowledgePointId === kp.id);
      return relatedQuestions.length === 0 || relatedQuestions.some(q => {
        // Include if the question hasn't been answered correctly recently
        const records = kp.quizRecords || [];
        const lastCorrect = records.filter(r => r.questionId === q.id && r.correct);
        return lastCorrect.length === 0;
      });
    });
  }, [learningState.knowledgePoints, learningState.questions]);

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasDecided, setHasDecided] = useState(false);
  const [swipeDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);

  const currentKP = learnablePoints[currentIndex];
  const relatedQuestion = useMemo(() => {
    if (!currentKP) return undefined;
    return learningState.questions.find(q => q.knowledgePointId === currentKP.id);
  }, [currentKP, learningState.questions]);

  // Track attempt count for this knowledge point
  const attemptCount = useMemo(() => {
    if (!currentKP) return 1;
    return (currentKP.studyRecords?.length || 0) + 1;
  }, [currentKP]);

  // Gesture handlers
  const handleSelect = useCallback((_level: DecisionLevel) => {
    if (!currentKP) return;

    // Calculate score based on attempt
    const score = calculateScore(attemptCount);

    // Record the study
    learningDispatch({
      type: 'RECORD_FLASHCARD_STUDY',
      payload: { knowledgePointId: currentKP.id, score },
    });

    setHasDecided(true);
    setIsFlipped(false); // Flip back after decision
  }, [currentKP, attemptCount, learningDispatch]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setHasDecided(false);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < learnablePoints.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setHasDecided(false);
      setIsFlipped(false);
    }
  }, [currentIndex, learnablePoints.length]);

  // Gesture handlers for swipe
  const gestureHandlers = useFlashcardGesture({
    onSwipeLeft: () => {
      if (!hasDecided) {
        handleSelect('rusty'); // Left = 有点印象
      }
    },
    onSwipeRight: () => {
      if (!hasDecided) {
        handleSelect('normal'); // Right = 会
      }
    },
    onSwipeUp: () => {
      if (hasDecided) handlePrev();
    },
    onSwipeDown: () => {
      if (hasDecided) handleNext();
    },
  });

  // Handle flip
  const handleFlip = useCallback(() => {
    if (!hasDecided) {
      setIsFlipped(prev => !prev);
    }
  }, [hasDecided]);

  if (learnablePoints.length === 0 || !currentKP) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: theme.bg }}>
        <div className="flex items-center px-4 py-3 border-b" style={{ borderColor: theme.border }}>
          <button
            onClick={() => navigate('home')}
            className="p-2 rounded-lg"
            style={{ color: theme.textSecondary }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="flex-1 text-center font-semibold" style={{ color: theme.textPrimary }}>
            闪记学习
          </h1>
          <div className="w-10" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-5xl mb-4">🎉</div>
          <p className="font-medium" style={{ color: theme.textSecondary }}>
            所有知识点都已学习完成！
          </p>
          <button
            onClick={() => navigate('home')}
            className="mt-6 px-6 py-3 rounded-xl font-medium"
            style={{ backgroundColor: theme.primary, color: '#ffffff' }}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: theme.bg }}
      {...gestureHandlers.handlers}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: theme.border }}>
        <button
          onClick={() => navigate('home')}
          className="p-2 rounded-lg"
          style={{ color: theme.textSecondary }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-sm font-medium" style={{ color: theme.textSecondary }}>
          {currentIndex + 1} / {learnablePoints.length}
        </div>
        <button
          className="p-2 rounded-lg"
          style={{ color: theme.textSecondary }}
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2">
        <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: theme.border }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / learnablePoints.length) * 100}%`,
              backgroundColor: theme.primary,
            }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <FlashcardCard
          name={currentKP.name}
          explanation={currentKP.explanation}
          memoryTip={currentKP.memoryTip}
          relatedQuestion={relatedQuestion ? {
            stem: relatedQuestion.stem,
            options: relatedQuestion.options,
          } : undefined}
          isFlipped={isFlipped}
          onFlip={handleFlip}
          swipeDirection={swipeDirection}
        />
      </div>

      {/* Gesture hint */}
      {hasDecided && (
        <div className="text-center text-xs pb-2" style={{ color: theme.textMuted }}>
          ↑ 上一题 · 下一题 ↓
        </div>
      )}

      {/* Controls */}
      <FlashcardControls
        hasDecided={hasDecided}
        onSelect={handleSelect}
        onPrev={handlePrev}
        onNext={handleNext}
        canGoPrev={currentIndex > 0}
        canGoNext={currentIndex < learnablePoints.length - 1}
      />
    </div>
  );
}
