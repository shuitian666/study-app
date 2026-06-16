import { useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
  const { theme, isDark } = useTheme();
  const reduceMotion = useReducedMotion();
  const sanitizedExplanation = useMemo(
    () => DOMPurify.sanitize(explanation),
    [explanation],
  );
  const isDesktop = size === 'desktop';

  const swipeColor = swipeDirection === 'left'
    ? 'rgba(239, 68, 68, 0.14)'
    : swipeDirection === 'right'
      ? 'rgba(16, 185, 129, 0.14)'
      : swipeDirection
        ? 'rgba(59, 130, 246, 0.12)'
        : 'transparent';

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: 'easeOut' as const };

  return (
    <div className={`relative mx-auto h-full min-h-0 w-full ${isDesktop ? 'max-w-[1080px]' : 'max-w-[560px]'}`}>
      <motion.button
        type="button"
        onClick={onFlip}
        aria-label={isFlipped ? '翻回知识点正面' : '查看知识点解析'}
        aria-pressed={isFlipped}
        whileTap={reduceMotion ? undefined : { scale: 0.992 }}
        className="study-paper-card group relative flex h-full min-h-[220px] w-full overflow-hidden text-left focus-visible:outline-none"
        style={{
          backgroundColor: theme.surfaceContainerLowest || theme.bgCard,
          borderColor: theme.outlineVariant || theme.border,
          boxShadow: isDark
            ? '0 18px 48px rgba(0, 0, 0, 0.22)'
            : '0 18px 48px rgba(81, 68, 48, 0.09)',
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-colors duration-200"
          style={{ backgroundColor: swipeColor }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80"
          style={{ backgroundColor: theme.primaryLight }}
        />

        <AnimatePresence initial={false} mode="wait">
          {!isFlipped ? (
            <motion.span
              key="front"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={transition}
              className="flex h-full w-full flex-col items-center justify-center px-7 py-8 text-center sm:px-10"
            >
              <span
                className="mb-5 rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.16em]"
                style={{ backgroundColor: theme.primaryFixed || `${theme.primary}14`, color: theme.primary }}
              >
                知识点
              </span>
              <span
                className={`${isDesktop ? 'text-[clamp(1.75rem,3vw,2.5rem)]' : 'text-2xl'} max-w-[680px] font-extrabold leading-tight`}
                style={{ color: theme.textPrimary }}
              >
                {name}
              </span>
            </motion.span>
          ) : (
            <motion.span
              key="back"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={transition}
              className="flex h-full min-h-0 w-full"
            >
              <span className="study-card-scroll flex min-h-0 w-full flex-1 overflow-y-auto px-6 sm:px-9">
                <span className="mx-auto my-auto block w-full max-w-[680px] py-7 sm:py-9">
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.14em]"
                    style={{ backgroundColor: theme.primaryFixed || `${theme.primary}14`, color: theme.primary }}
                  >
                    知识解析
                  </span>
                  <span
                    className={`${isDesktop ? 'text-[17px] leading-8' : 'text-base leading-7'} study-explanation mt-5 block`}
                    style={{ color: theme.textPrimary }}
                    dangerouslySetInnerHTML={{ __html: sanitizedExplanation }}
                  />
                  {memoryTip && (
                    <span
                      className="mt-6 block rounded-2xl border px-4 py-3 text-sm leading-6"
                      style={{
                        backgroundColor: theme.secondaryFixed || `${theme.warning}12`,
                        borderColor: theme.outlineVariant || theme.border,
                        color: theme.textSecondary,
                      }}
                    >
                      <strong className="mb-1 block text-xs" style={{ color: theme.warning }}>记忆提示</strong>
                      {memoryTip}
                    </span>
                  )}
                </span>
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
