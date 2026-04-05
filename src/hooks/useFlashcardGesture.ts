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
