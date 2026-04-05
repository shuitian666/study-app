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
