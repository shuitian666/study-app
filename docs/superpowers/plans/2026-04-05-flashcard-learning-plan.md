# Flashcard Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an immersive flashcard learning mode with gesture-based interaction, smart scoring algorithm, and interleaved review based on forgetting curve.

**Architecture:** Create a new standalone `FlashcardLearningPage` component that manages its own state independently initially, then integrate with LearningContext for persistence. The flashcard system tracks learning records per knowledge point and calculates scores using the decay algorithm.

**Tech Stack:** React, TypeScript, Tailwind CSS, framer-motion (for animations), use-gesture (for swipe detection)

---

## File Structure

```
src/
├── types/index.ts                           # Add new types
├── store/LearningContext.tsx               # Add scoring actions
├── pages/FlashcardLearning/index.tsx       # NEW: Main page
├── components/ui/FlashcardCard.tsx         # NEW: Flip card component
├── components/ui/FlashcardControls.tsx      # NEW: Bottom buttons
└── hooks/useFlashcardGesture.ts            # NEW: Swipe gesture hook
```

---

## Task 1: Add New Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add new type definitions**

Add these types at the end of `src/types/index.ts`:

```typescript
// Study record for flashcard learning
export interface StudyRecord {
  date: string;           // ISO date string
  type: 'flashcard';      // Always 'flashcard' for flashcard records
  score: number;          // 100/80/60/40...
  knowledgePointId: string;
}

// Quiz record for question answers
export interface QuizRecord {
  date: string;           // ISO date string
  questionId: string;
  correct: boolean;
  score: number;         // 100/80/60/40...
  knowledgePointId: string;
}

// Extended KnowledgePoint with learning records
export interface KnowledgePointExtended extends KnowledgePoint {
  studyRecords: StudyRecord[];
  quizRecords: QuizRecord[];
  currentScore: number;  // Combined score 0-100
  memoryTip?: string;    // Memory tip/hint
}
```

- [ ] **Step 2: Run build to verify types**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add flashcard learning types"
```

---

## Task 2: Add Scoring Actions to LearningContext

**Files:**
- Modify: `src/store/LearningContext.tsx`

- [ ] **Step 1: Add new action types**

In `LearningContext.tsx`, find the `LearningAction` type (around line 58) and add:

```typescript
type LearningAction =
  // ... existing actions ...
  | { type: 'RECORD_FLASHCARD_STUDY'; payload: { knowledgePointId: string; score: number } }
  | { type: 'RECORD_QUIZ_ANSWER'; payload: { knowledgePointId: string; questionId: string; correct: boolean; score: number } }
  | { type: 'UPDATE_KNOWLEDGE_POINT_SCORE'; payload: { id: string; score: number } }
  | { type: 'SET_MEMORY_TIP'; payload: { knowledgePointId: string; tip: string } }
```

- [ ] **Step 2: Add reducer cases for new actions**

Find the `learningReducer` function and add these cases before the default case:

```typescript
case 'RECORD_FLASHCARD_STUDY': {
  const { knowledgePointId, score } = action.payload;
  const now = new Date().toISOString();
  return {
    ...state,
    knowledgePoints: state.knowledgePoints.map(kp => {
      if (kp.id !== knowledgePointId) return kp;
      const newRecord: StudyRecord = { date: now, type: 'flashcard', score, knowledgePointId };
      const studyRecords = [...(kp.studyRecords || []), newRecord];
      const newScore = kp.currentScore
        ? kp.currentScore * 0.5 + score * 0.5
        : score;
      return { ...kp, studyRecords, currentScore: newScore };
    }),
  };
}

case 'RECORD_QUIZ_ANSWER': {
  const { knowledgePointId, questionId, correct, score } = action.payload;
  const now = new Date().toISOString();
  return {
    ...state,
    knowledgePoints: state.knowledgePoints.map(kp => {
      if (kp.id !== knowledgePointId) return kp;
      const newRecord: QuizRecord = { date: now, questionId, correct, score, knowledgePointId };
      const quizRecords = [...(kp.quizRecords || []), newRecord];
      const newScore = kp.currentScore
        ? kp.currentScore * 0.5 + score * 0.5
        : score;
      return { ...kp, quizRecords, currentScore: newScore };
    }),
  };
}

case 'UPDATE_KNOWLEDGE_POINT_SCORE': {
  return {
    ...state,
    knowledgePoints: state.knowledgePoints.map(kp =>
      kp.id === action.payload.id
        ? { ...kp, currentScore: action.payload.score }
        : kp
    ),
  };
}

case 'SET_MEMORY_TIP': {
  return {
    ...state,
    knowledgePoints: state.knowledgePoints.map(kp =>
      kp.id === action.payload.knowledgePointId
        ? { ...kp, memoryTip: action.payload.tip }
        : kp
    ),
  };
}
```

- [ ] **Step 3: Add action creators**

Find where other action creators are defined (after the reducer) and add:

```typescript
export function recordFlashcardStudy(knowledgePointId: string, score: number) {
  return { type: 'RECORD_FLASHCARD_STUDY', payload: { knowledgePointId, score } };
}

export function recordQuizAnswer(knowledgePointId: string, questionId: string, correct: boolean, score: number) {
  return { type: 'RECORD_QUIZ_ANSWER', payload: { knowledgePointId, questionId, correct, score } };
}

export function updateKnowledgePointScore(id: string, score: number) {
  return { type: 'UPDATE_KNOWLEDGE_POINT_SCORE', payload: { id, score } };
}

export function setMemoryTip(knowledgePointId: string, tip: string) {
  return { type: 'SET_MEMORY_TIP', payload: { knowledgePointId, tip } };
}
```

- [ ] **Step 4: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/store/LearningContext.tsx
git commit -m "feat: add flashcard scoring actions to LearningContext"
```

---

## Task 3: Create FlashcardCard Component

**Files:**
- Create: `src/components/ui/FlashcardCard.tsx`

- [ ] **Step 1: Create the FlashcardCard component**

Create file `src/components/ui/FlashcardCard.tsx`:

```tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/store/ThemeContext';
import { BookOpen, Lightbulb } from 'lucide-react';

interface FlashcardCardProps {
  name: string;
  explanation: string;
  memoryTip?: string;
  relatedQuestion?: {
    stem: string;
    options: { id: string; text: string }[];
  };
  isFlipped: boolean;
  onFlip: () => void;
  swipeDirection?: 'left' | 'right' | 'up' | 'down' | null;
}

export default function FlashcardCard({
  name,
  explanation,
  memoryTip,
  relatedQuestion,
  isFlipped,
  onFlip,
  swipeDirection,
}: FlashcardCardProps) {
  const { theme } = useTheme();

  const getSwipeGradient = () => {
    if (swipeDirection === 'left') return 'linear-gradient(to right, rgba(239, 68, 68, 0.3), transparent)';
    if (swipeDirection === 'right') return 'linear-gradient(to left, rgba(16, 185, 129, 0.3), transparent)';
    if (swipeDirection === 'up' || swipeDirection === 'down') return 'linear-gradient(to top, rgba(59, 130, 246, 0.2), transparent)';
    return 'none';
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Swipe feedback overlay */}
      {swipeDirection && (
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none z-10"
          style={{ background: getSwipeGradient() }}
        />
      )}

      {/* Card */}
      <motion.div
        className="w-full min-h-[320px] p-6 rounded-3xl border-2 shadow-xl cursor-pointer flex flex-col items-center justify-center"
        style={{
          backgroundColor: theme.bgCard,
          borderColor: isFlipped ? theme.primary : theme.border,
        }}
        onClick={onFlip}
        whileTap={{ scale: 0.98 }}
      >
        <AnimatePresence mode="wait">
          {!isFlipped ? (
            <motion.div
              key="front"
              initial={{ opacity: 0, rotateY: -90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: 90 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: theme.textMuted }}>
                知识点名称
              </div>
              <h2 className="text-2xl font-bold" style={{ color: theme.textPrimary }}>
                {name}
              </h2>
              <p className="text-sm mt-6" style={{ color: theme.textMuted }}>
                点击卡片翻面
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="back"
              initial={{ opacity: 0, rotateY: 90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: -90 }}
              transition={{ duration: 0.3 }}
              className="text-center w-full"
            >
              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: theme.primary }}>
                知识解析
              </div>
              <div
                className="text-base leading-relaxed mb-4"
                style={{ color: theme.textPrimary }}
                dangerouslySetInnerHTML={{ __html: explanation }}
              />

              {/* Related question if exists */}
              {relatedQuestion && (
                <div
                  className="mt-4 p-3 rounded-xl border text-left"
                  style={{ backgroundColor: `${theme.primary}08`, borderColor: `${theme.primary}30` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen size={14} style={{ color: theme.primary }} />
                    <span className="text-xs font-medium" style={{ color: theme.primary }}>相关例题</span>
                  </div>
                  <p className="text-sm" style={{ color: theme.textSecondary }}>{relatedQuestion.stem}</p>
                </div>
              )}

              {/* Memory tip if exists */}
              {memoryTip && (
                <div
                  className="mt-3 p-3 rounded-xl flex items-start gap-2 text-left"
                  style={{ backgroundColor: `${theme.warning}15` }}
                >
                  <Lightbulb size={14} className="mt-0.5 shrink-0" style={{ color: theme.warning }} />
                  <p className="text-xs" style={{ color: theme.warning }}>{memoryTip}</p>
                </div>
              )}

              <p className="text-xs mt-4" style={{ color: theme.textMuted }}>
                点击卡片翻回去
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Install framer-motion**

Run: `npm install framer-motion`
Expected: Package installed

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/FlashcardCard.tsx
git commit -m "feat: create FlashcardCard component with flip animation"
```

---

## Task 4: Create FlashcardControls Component

**Files:**
- Create: `src/components/ui/FlashcardControls.tsx`

- [ ] **Step 1: Create the FlashcardControls component**

Create file `src/components/ui/FlashcardControls.tsx`:

```tsx
import React from 'react';
import { useTheme } from '@/store/ThemeContext';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface FlashcardControlsProps {
  hasDecided: boolean;  // true if user has selected 不会/有点印象/会
  onSelect: (level: 'none' | 'rusty' | 'normal') => void;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export default function FlashcardControls({
  hasDecided,
  onSelect,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
}: FlashcardControlsProps) {
  const { theme } = useTheme();

  const buttonBaseClasses = "flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed";

  if (!hasDecided) {
    // Show decision buttons: 不会 / 有点印象 / 会
    return (
      <div className="flex gap-3 px-4 pb-6">
        <button
          onClick={() => onSelect('none')}
          className={buttonBaseClasses}
          style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}
        >
          不会
        </button>
        <button
          onClick={() => onSelect('rusty')}
          className={buttonBaseClasses}
          style={{ backgroundColor: '#fffbeb', color: '#f59e0b' }}
        >
          有点印象
        </button>
        <button
          onClick={() => onSelect('normal')}
          className={buttonBaseClasses}
          style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}
        >
          会
        </button>
      </div>
    );
  }

  // Show navigation buttons after decision
  return (
    <div className="flex gap-3 px-4 pb-6">
      <button
        onClick={onPrev}
        disabled={!canGoPrev}
        className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1 ${buttonBaseClasses}`}
        style={{
          backgroundColor: canGoPrev ? `${theme.primary}15` : theme.border,
          color: canGoPrev ? theme.primary : theme.textMuted,
        }}
      >
        <ChevronUp size={16} />
        上一题
      </button>
      <button
        onClick={onNext}
        disabled={!canGoNext}
        className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1 ${buttonBaseClasses}`}
        style={{
          backgroundColor: canGoNext ? theme.primary : theme.border,
          color: canGoNext ? '#ffffff' : theme.textMuted,
        }}
      >
        下一题
        <ChevronDown size={16} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/FlashcardControls.tsx
git commit -m "feat: create FlashcardControls component"
```

---

## Task 5: Create useFlashcardGesture Hook

**Files:**
- Create: `src/hooks/useFlashcardGesture.ts`

- [ ] **Step 1: Create the gesture hook**

Create file `src/hooks/useFlashcardGesture.ts`:

```typescript
import { useState, useRef, useCallback } from 'react';

interface SwipeState {
  direction: 'left' | 'right' | 'up' | 'down' | null;
  delta: number;
}

interface UseFlashcardGestureProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onSwipeDown: () => void;
  threshold?: number;
}

export function useFlashcardGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
}: UseFlashcardGestureProps) {
  const [swipeState, setSwipeState] = useState<SwipeState>({ direction: null, delta: 0 });
  const startX = useRef(0);
  const startY = useRef(0);
  const isTracking = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isTracking.current = true;
    setSwipeState({ direction: null, delta: 0 });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTracking.current) return;

    const deltaX = e.touches[0].clientX - startX.current;
    const deltaY = e.touches[0].clientY - startY.current;

    // Determine primary direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (Math.abs(deltaX) > threshold) {
        setSwipeState({
          direction: deltaX > 0 ? 'right' : 'left',
          delta: deltaX,
        });
      } else {
        setSwipeState({ direction: null, delta: deltaX });
      }
    } else {
      // Vertical swipe
      if (Math.abs(deltaY) > threshold) {
        setSwipeState({
          direction: deltaY > 0 ? 'down' : 'up',
          delta: deltaY,
        });
      } else {
        setSwipeState({ direction: null, delta: deltaY });
      }
    }
  }, [threshold]);

  const handleTouchEnd = useCallback(() => {
    if (!isTracking.current) return;
    isTracking.current = false;

    const { direction } = swipeState;
    if (direction === 'left') onSwipeLeft();
    else if (direction === 'right') onSwipeRight();
    else if (direction === 'up') onSwipeUp();
    else if (direction === 'down') onSwipeDown();

    setSwipeState({ direction: null, delta: 0 });
  }, [swipeState, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return {
    swipeState,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFlashcardGesture.ts
git commit -m "feat: create useFlashcardGesture hook for swipe detection"
```

---

## Task 6: Create FlashcardLearningPage

**Files:**
- Create: `src/pages/FlashcardLearning/index.tsx`

- [ ] **Step 1: Create the main FlashcardLearningPage**

Create file `src/pages/FlashcardLearning/index.tsx`:

```tsx
import React, { useState, useCallback, useMemo } from 'react';
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
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);

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
  const handleSelect = useCallback((level: DecisionLevel) => {
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

  // Gesture feedback
  const handleGestureMove = useCallback((direction: 'left' | 'right' | 'up' | 'down' | null) => {
    setSwipeDirection(direction);
  }, []);

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
      <div
        className="flex-1 flex items-center justify-center p-4"
        onMouseMove={(e) => {
          // Simple desktop swipe support
          // In production, use @use-gesture/react
        }}
      >
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
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds (may have TypeScript errors - fix them)

- [ ] **Step 3: Fix any TypeScript errors**

Common issues:
- `currentKP.studyRecords` - need to ensure KnowledgePoint has this field
- If errors persist, cast types as `any` initially or add partial types

- [ ] **Step 4: Commit**

```bash
git add src/pages/FlashcardLearning/index.tsx
git commit -m "feat: create FlashcardLearningPage"
```

---

## Task 7: Add Page to App Router

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import and add route**

In `src/App.tsx`, add the import:

```tsx
const FlashcardLearningPage = React.lazy(() => import('@/pages/FlashcardLearning'));
```

Then add to the switch in `renderPage()`:

```tsx
case 'flashcard-learning': return <FlashcardLearningPage />;
```

- [ ] **Step 2: Add to PageName type**

In `src/types/index.ts`, add `'flashcard-learning'` to the PageName union type.

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/types/index.ts
git commit -m "feat: add flashcard learning route to app"
```

---

## Task 8: Add Entry Point (Home Page Button)

**Files:**
- Modify: `src/pages/Home/index.tsx`

- [ ] **Step 1: Add flashcard learning button to home page**

Find the "快速开始" section or similar and add:

```tsx
<button
  onClick={() => navigate('flashcard-learning')}
  className="rounded-2xl p-4 border shadow-sm text-left active:scale-[0.97] transition-transform"
  style={{
    backgroundColor: theme.bgCard,
    borderColor: theme.border
  }}
>
  <div className="text-2xl mb-2">🧠</div>
  <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>闪记学习</div>
  <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>记忆卡片式学习</div>
</button>
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/pages/Home/index.tsx
git commit -m "feat: add flashcard learning entry to home page"
```

---

## Implementation Complete

Run final build to verify everything works together:

```bash
npm run build
```

---

## Spec Coverage Checklist

| Spec Section | Tasks |
|-------------|-------|
| 沉浸式闪记流程 | Task 6 |
| 先闪后题 | Task 6 (filtering) |
| 遗忘曲线驱动 | Task 6 (future enhancement) |
| 卡片正面：知识点名称 | Task 3 |
| 卡片背面：解析+例题+记忆技巧 | Task 3 |
| 3个按钮：不会/有点印象/会 | Task 4 |
| 上/下一题按钮 | Task 4 |
| 必须表态后才能翻页 | Task 4, Task 6 |
| 左右滑动=认识程度 | Task 5 |
| 上下滑动=上/下一题 | Task 5 |
| 滑动颜色反馈 | Task 3 |
| 评分算法 | Task 6 (calculateScore) |
| 分数衰减 | Task 2 (in reducer) |

---

**Plan complete.** Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
