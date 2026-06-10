import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { useTheme } from '@/store/ThemeContext';

interface FlashcardCardProps {
  name: string;
  explanation: string;
  memoryTip?: string;
  isFlipped: boolean;
  onFlip: () => void;
  swipeDirection?: 'left' | 'right' | 'up' | 'down' | null;
  size?: 'default' | 'desktop';
}

export default function FlashcardCard({
  name,
  explanation,
  memoryTip,
  isFlipped,
  onFlip,
  swipeDirection,
  size = 'default',
}: FlashcardCardProps) {
  const { theme } = useTheme();
  const sanitizedExplanation = useMemo(
    () => DOMPurify.sanitize(explanation),
    [explanation]
  );

  const getSwipeGradient = () => {
    if (swipeDirection === 'left') return 'linear-gradient(to right, rgba(239, 68, 68, 0.3), transparent)';
    if (swipeDirection === 'right') return 'linear-gradient(to left, rgba(16, 185, 129, 0.3), transparent)';
    if (swipeDirection === 'up' || swipeDirection === 'down') return 'linear-gradient(to top, rgba(59, 130, 246, 0.2), transparent)';
    return 'none';
  };
  const isDesktop = size === 'desktop';

  return (
    <div className={`relative mx-auto w-full ${isDesktop ? 'max-w-[760px]' : 'max-w-md'}`}>
      {/* Swipe feedback overlay */}
      {swipeDirection && (
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none z-10"
          style={{ background: getSwipeGradient() }}
        />
      )}

      {/* Card */}
      <motion.div
        className={`flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden border ${isDesktop ? 'min-h-[440px] max-h-[520px] rounded-[32px] p-8' : 'min-h-[300px] rounded-3xl p-6'}`}
        style={{
          backgroundColor: theme.bgCard,
          borderColor: isFlipped ? `${theme.primary}55` : '#c7d2fe',
          boxShadow: isFlipped
            ? `0 20px 60px rgba(15,23,42,0.10)`
            : `0 20px 60px rgba(15,23,42,0.08)`,
        }}
        onClick={onFlip}
        whileTap={{ scale: 0.98 }}
      >
        <AnimatePresence mode="wait">
          {!isFlipped ? (
            <motion.div
              key="front"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.2 }}
              className="text-center"
            >
              <div className="mb-4 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                知识点
              </div>
              <h2 className={`${isDesktop ? 'text-3xl' : 'text-2xl'} mb-4 font-extrabold`} style={{ color: theme.textPrimary }}>
                {name}
              </h2>
              <div className="flex items-center justify-center gap-2" style={{ color: theme.textSecondary }}>
                <span className="text-sm">点击翻转</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 1l4 4-4 4"/>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  <path d="M7 23l-4-4 4-4"/>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="back"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.2 }}
              className="text-center w-full"
            >
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.primary }}>
                知识解析
              </div>
              <div
                className={`${isDesktop ? 'text-lg' : 'text-base'} mb-4 leading-relaxed`}
                style={{ color: theme.textPrimary }}
                dangerouslySetInnerHTML={{ __html: sanitizedExplanation }}
              />

              {/* Memory tip if exists */}
              {memoryTip && (
                <div
                  className="mt-4 p-3 rounded-xl flex items-start gap-2 text-left"
                  style={{ backgroundColor: `${theme.warning}15` }}
                >
                  <span className="text-sm" style={{ color: theme.warning }}>💡</span>
                  <span className="text-sm" style={{ color: theme.warning }}>{memoryTip}</span>
                </div>
              )}

              <div className="mt-4 flex items-center justify-center gap-2" style={{ color: theme.textSecondary }}>
                <span className="text-sm">点击翻回</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 1l4 4-4 4"/>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  <path d="M7 23l-4-4 4-4"/>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
