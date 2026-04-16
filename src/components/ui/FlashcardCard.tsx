import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/store/ThemeContext';

interface FlashcardCardProps {
  name: string;
  explanation: string;
  memoryTip?: string;
  isFlipped: boolean;
  onFlip: () => void;
  swipeDirection?: 'left' | 'right' | 'up' | 'down' | null;
}

export default function FlashcardCard({
  name,
  explanation,
  memoryTip,
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
    <div className="relative w-full max-w-[540px] mx-auto">
      {/* Swipe feedback overlay */}
      {swipeDirection && (
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none z-10"
          style={{ background: getSwipeGradient() }}
        />
      )}

      {/* Card */}
      <motion.div
        className="w-full min-h-[320px] p-6 rounded-3xl border-2 shadow-lg cursor-pointer flex flex-col items-center justify-center overflow-hidden"
        style={{
          backgroundColor: theme.bgCard,
          borderColor: isFlipped ? theme.primary : theme.border,
          boxShadow: isFlipped
            ? `0 20px 40px -12px ${theme.primary}30`
            : `0 10px 30px -5px rgba(0,0,0,0.1)`,
        }}
        onClick={onFlip}
        whileTap={{ scale: 0.98 }}
        layout
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
              <div className="text-xs uppercase tracking-wider mb-4" style={{ color: theme.textMuted }}>
                知识点
              </div>
              <h2 className="text-2xl font-bold mb-4" style={{ color: theme.textPrimary }}>
                {name}
              </h2>
              <div className="flex items-center justify-center gap-2" style={{ color: theme.textMuted }}>
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
              <div className="text-xs uppercase tracking-wider mb-3" style={{ color: theme.primary }}>
                知识解析
              </div>
              <div
                className="text-base leading-relaxed mb-4"
                style={{ color: theme.textPrimary }}
                dangerouslySetInnerHTML={{ __html: explanation }}
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

              <div className="flex items-center justify-center gap-2 mt-4" style={{ color: theme.textMuted }}>
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
