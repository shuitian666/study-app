import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleHelp,
  Keyboard,
  Layers3,
  RotateCcw,
  X,
} from 'lucide-react';
import { useTheme } from '@/store/ThemeContext';

export const FLASHCARD_GUIDE_DISMISSED_KEY = 'study-app:flashcard-guide-dismissed:v1';

interface FlashcardStudyGuideProps {
  open: boolean;
  onClose: (dismissPermanently: boolean) => void;
  allowPermanentDismiss?: boolean;
}

const GUIDE_STEPS = [
  {
    title: '先回忆，再翻卡',
    description: '看到知识点后，先在脑中组织答案。主动回忆比直接阅读更容易形成长期记忆。',
    icon: BookOpen,
    preview: 'recall',
  },
  {
    title: '查看知识解析',
    description: '点击卡片或“查看答案”即可翻面。短解析居中展示，长内容会在卡片内部滚动。',
    icon: RotateCcw,
    preview: 'explanation',
  },
  {
    title: '按真实掌握程度评分',
    description: '选择“不会、困难、一般、简单”，系统会据此安排下一次复习时间。',
    icon: Layers3,
    preview: 'ratings',
  },
  {
    title: '用顺手的方式学习',
    description: '顶部可切换学习范围；支持上一张和键盘操作，之后也能通过问号随时重看本说明。',
    icon: Keyboard,
    preview: 'shortcuts',
  },
] as const;

function StepPreview({ type }: { type: typeof GUIDE_STEPS[number]['preview'] }) {
  const { theme } = useTheme();
  const paper = theme.surfaceContainerLowest || theme.bgCard;
  const soft = theme.surfaceContainerLow || theme.bg;
  const border = theme.outlineVariant || theme.border;

  if (type === 'recall') {
    return (
      <div className="flex min-h-[190px] flex-col items-center justify-center rounded-[22px] border px-5 text-center" style={{ backgroundColor: paper, borderColor: border }}>
        <span className="rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em]" style={{ backgroundColor: theme.primaryFixed || `${theme.primary}14`, color: theme.primary }}>
          知识点
        </span>
        <strong className="mt-5 text-2xl" style={{ color: theme.textPrimary }}>有效数字</strong>
        <span className="mt-4 max-w-[220px] text-xs leading-5" style={{ color: theme.textSecondary }}>
          先尝试说出定义，再查看答案
        </span>
      </div>
    );
  }

  if (type === 'explanation') {
    return (
      <div className="flex min-h-[190px] items-center rounded-[22px] border p-5" style={{ backgroundColor: paper, borderColor: border }}>
        <div className="mx-auto w-full max-w-[300px]">
          <span className="rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em]" style={{ backgroundColor: theme.primaryFixed || `${theme.primary}14`, color: theme.primary }}>
            知识解析
          </span>
          <p className="mt-4 text-left text-sm leading-6" style={{ color: theme.textPrimary }}>
            有效数字是测量结果中能够反映精度的数字。
          </p>
        </div>
      </div>
    );
  }

  if (type === 'ratings') {
    const ratings = [
      { key: '1', label: '不会', color: '#ef4444' },
      { key: '2', label: '困难', color: '#f59e0b' },
      { key: '3', label: '一般', color: '#10b981' },
      { key: '4', label: '简单', color: '#3b82f6' },
    ];
    return (
      <div className="grid min-h-[190px] grid-cols-2 content-center gap-2.5 rounded-[22px] border p-4 sm:grid-cols-4" style={{ backgroundColor: soft, borderColor: border }}>
        {ratings.map(rating => (
          <div
            key={rating.key}
            className="flex min-h-16 items-center gap-2 rounded-2xl border px-3"
            style={{
              backgroundColor: `color-mix(in srgb, ${rating.color} 8%, ${paper})`,
              borderColor: `color-mix(in srgb, ${rating.color} 28%, ${border})`,
              color: rating.color,
            }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border text-[10px] font-extrabold">{rating.key}</span>
            <strong className="text-xs">{rating.label}</strong>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-[190px] flex-col justify-center gap-3 rounded-[22px] border p-5" style={{ backgroundColor: soft, borderColor: border }}>
      <div className="flex items-center gap-2">
        <span className="rounded-xl border px-3 py-2 text-xs font-bold" style={{ backgroundColor: paper, borderColor: border, color: theme.textPrimary }}>范围</span>
        <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: border }} />
        <CircleHelp size={20} style={{ color: theme.primary }} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs font-semibold sm:grid-cols-4">
        {['Space 翻卡', '1–4 评分', '← 上一张', 'Esc 退出'].map(item => (
          <span key={item} className="rounded-xl border px-2 py-3 text-center" style={{ backgroundColor: paper, borderColor: border, color: theme.textSecondary }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function FlashcardStudyGuide({
  open,
  onClose,
  allowPermanentDismiss = false,
}: FlashcardStudyGuideProps) {
  const { theme } = useTheme();
  const [step, setStep] = useState(0);
  const [dismissPermanently, setDismissPermanently] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setStep(0);
        setDismissPermanently(false);
        onCloseRef.current(false);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setStep(current => Math.max(0, current - 1));
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setStep(current => Math.min(GUIDE_STEPS.length - 1, current + 1));
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (document.activeElement === dialogRef.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousBodyOverflow;
      window.requestAnimationFrame(() => previousFocusRef.current?.focus());
    };
  }, [open]);

  if (!open) return null;

  const currentStep = GUIDE_STEPS[step];
  const StepIcon = currentStep.icon;
  const isLastStep = step === GUIDE_STEPS.length - 1;
  const closeGuide = () => {
    const shouldDismissPermanently = allowPermanentDismiss && dismissPermanently;
    setStep(0);
    setDismissPermanently(false);
    onClose(shouldDismissPermanently);
  };

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="flashcard-guide-title"
        aria-describedby="flashcard-guide-description"
        className="flashcard-study-guide flex max-h-[min(760px,calc(100dvh-24px))] w-full flex-col overflow-hidden rounded-t-[28px] border shadow-[0_28px_90px_rgba(15,23,42,0.24)] sm:max-w-[680px] sm:rounded-[28px]"
        style={{
          backgroundColor: theme.surfaceContainerLowest || theme.bgCard,
          borderColor: theme.outlineVariant || theme.border,
        }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6" style={{ borderColor: theme.outlineVariant || theme.border }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>Flashcard guide</p>
            <h2 id="flashcard-guide-title" className="mt-1 text-xl font-extrabold" style={{ color: theme.textPrimary }}>闪卡学习说明</h2>
          </div>
          <button
            type="button"
            onClick={closeGuide}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: theme.surfaceContainerLow || theme.bg, borderColor: theme.outlineVariant || theme.border, color: theme.textSecondary }}
            aria-label="关闭闪卡学习说明"
          >
            <X size={19} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mb-5 flex items-center gap-2" aria-label={`第 ${step + 1} 步，共 ${GUIDE_STEPS.length} 步`}>
            {GUIDE_STEPS.map((item, index) => (
              <span
                key={item.title}
                className="h-1.5 flex-1 rounded-full transition-colors duration-200"
                style={{ backgroundColor: index <= step ? theme.primary : theme.surfaceContainerHigh || theme.border }}
              />
            ))}
          </div>

          <div aria-live="polite">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: theme.primaryFixed || `${theme.primary}14`, color: theme.primary }}>
                <StepIcon size={23} />
              </span>
              <div className="min-w-0">
                <h3 className="text-xl font-extrabold" style={{ color: theme.textPrimary }}>{currentStep.title}</h3>
                <p id="flashcard-guide-description" className="mt-1 text-sm leading-6" style={{ color: theme.textSecondary }}>{currentStep.description}</p>
              </div>
            </div>
            <StepPreview type={currentStep.preview} />
          </div>

          {allowPermanentDismiss && (
            <label className="mt-5 flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-3" style={{ backgroundColor: theme.surfaceContainerLow || theme.bg }}>
              <input
                type="checkbox"
                checked={dismissPermanently}
                onChange={event => setDismissPermanently(event.target.checked)}
                className="peer sr-only"
              />
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2"
                style={{
                  backgroundColor: dismissPermanently ? theme.primary : 'transparent',
                  borderColor: dismissPermanently ? theme.primary : theme.outlineVariant || theme.border,
                  color: '#ffffff',
                }}
              >
                {dismissPermanently && <Check size={15} strokeWidth={3} />}
              </span>
              <span className="text-sm font-medium" style={{ color: theme.textSecondary }}>不再自动显示，可在帮助中重新查看</span>
            </label>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 border-t px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6" style={{ borderColor: theme.outlineVariant || theme.border }}>
          <button
            type="button"
            onClick={() => setStep(current => Math.max(0, current - 1))}
            disabled={step === 0}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: theme.surfaceContainerLow || theme.bg, borderColor: theme.outlineVariant || theme.border, color: theme.textSecondary }}
          >
            <ArrowLeft size={17} />
            上一步
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLastStep) {
                closeGuide();
              } else {
                setStep(current => current + 1);
              }
            }}
            className="flex min-h-12 min-w-[132px] items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: theme.primary }}
          >
            {isLastStep ? '开始学习' : '下一步'}
            {!isLastStep && <ArrowRight size={17} />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
