import { useState } from 'react';
import { ArrowRight, Bell, BookOpen, CheckCircle2, ChevronLeft, Download, Target } from 'lucide-react';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';
import type { KnowledgeSubject } from '@/services/ossService';

interface OnboardingGuideProps {
  open: boolean;
  onClose: () => void;
  recommendedPackage?: KnowledgeSubject | null;
  isClaimingPackage?: boolean;
  onClaimPackage?: (subjectId: string) => void | Promise<void>;
  onEnableReminder?: () => void | Promise<void>;
  onSetDailyGoal?: (goal: number) => void;
  onSetStudyDirection?: (direction: DirectionId) => void;
}

type DirectionId = 'medical' | 'pharmacy' | 'nursing' | 'english';

const STUDY_DIRECTIONS: Array<{
  id: DirectionId;
  label: string;
  description: string;
}> = [
  { id: 'medical', label: '医考', description: '执医、医学基础、微免复习' },
  { id: 'pharmacy', label: '药考', description: '药学、分析化学、仪器分析' },
  { id: 'nursing', label: '护考', description: '护理考试、基础知识巩固' },
  { id: 'english', label: '英语词汇', description: '考研、六级、固定搭配' },
];

const DAILY_GOALS = [5, 10, 20];
const ACTIVE_GREEN = '#6fa463';

export default function OnboardingGuide({ open, ...props }: OnboardingGuideProps) {
  if (!open) return null;

  return <OnboardingGuideContent {...props} />;
}

type OnboardingGuideContentProps = Omit<OnboardingGuideProps, 'open'>;

interface StepShellProps {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onBack?: () => void;
  onClose: () => void;
}

function StepShell({ step, title, description, icon, children, onBack, onClose }: StepShellProps) {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-5 py-8 backdrop-blur-sm">
      <div
        className="max-h-[min(760px,calc(100vh-48px))] w-full max-w-[398px] overflow-y-auto rounded-[24px] border shadow-[0_24px_70px_rgba(15,23,42,0.22)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ backgroundColor: theme.bgCard || '#ffffff', borderColor: theme.border || '#e5e7eb' }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="px-5 pb-5 pt-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              disabled={!onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full border transition-opacity disabled:invisible"
              style={{ borderColor: theme.border || '#e5e7eb', color: theme.textSecondary }}
              aria-label="返回上一步"
            >
              <ChevronLeft size={18} />
            </button>
            <ProgressDots current={step} />
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: `${ACTIVE_GREEN}12`, color: ACTIVE_GREEN }}
            >
              稍后再说
            </button>
          </div>

          <div className="mb-5 flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${ACTIVE_GREEN}14`, color: ACTIVE_GREEN }}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-[22px] font-extrabold leading-tight" style={{ color: theme.textPrimary }}>
                {title}
              </h2>
              <p className="mt-1 text-sm leading-6" style={{ color: theme.textSecondary }}>
                {description}
              </p>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`第 ${current + 1} 步，共 4 步`}>
      {[0, 1, 2, 3].map(index => (
        <span
          key={index}
          className="h-1.5 rounded-full transition-all"
          style={{
            width: index === current ? 24 : 7,
            backgroundColor: index <= current ? ACTIVE_GREEN : '#dbe4d5',
          }}
        />
      ))}
    </div>
  );
}

interface OptionButtonProps {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}

function OptionButton({ selected, title, description, onClick }: OptionButtonProps) {
  const { theme } = useTheme();

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[92px] items-start gap-3 rounded-2xl border p-3.5 text-left transition-transform active:scale-[0.98]"
      style={{
        borderColor: selected ? ACTIVE_GREEN : theme.border || '#e5e7eb',
        backgroundColor: selected ? `${ACTIVE_GREEN}10` : theme.bg || '#ffffff',
      }}
    >
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
        style={{
          borderColor: selected ? ACTIVE_GREEN : theme.border || '#d1d5db',
          backgroundColor: selected ? ACTIVE_GREEN : 'transparent',
          color: '#ffffff',
        }}
      >
        {selected && <CheckCircle2 size={14} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold" style={{ color: theme.textPrimary }}>
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5" style={{ color: theme.textSecondary }}>
          {description}
        </span>
      </span>
    </button>
  );
}

function OnboardingGuideContent({
  onClose,
  recommendedPackage,
  isClaimingPackage = false,
  onClaimPackage,
  onEnableReminder,
  onSetDailyGoal,
  onSetStudyDirection,
}: OnboardingGuideContentProps) {
  const { theme } = useTheme();
  const { navigate } = useUser();
  const [step, setStep] = useState(0);
  const [selectedDirection, setSelectedDirection] = useState<DirectionId>('medical');
  const [dailyGoal, setDailyGoal] = useState(10);
  const selectedDirectionLabel = STUDY_DIRECTIONS.find(item => item.id === selectedDirection)?.label || '医考';

  const applyDailyGoal = (goal: number) => {
    setDailyGoal(goal);
    onSetDailyGoal?.(goal);
  };

  const startLearning = () => {
    onSetDailyGoal?.(dailyGoal);
    if (recommendedPackage && onClaimPackage) {
      void onClaimPackage(recommendedPackage.id);
      onClose();
      return;
    }
    onClose();
    navigate('knowledge');
  };

  if (step === 0) {
    return (
      <StepShell
        step={0}
        title="先选一个方向"
        description="我们会用它帮你从推荐内容包开始，而不是让你先找导入入口。"
        icon={<BookOpen size={24} />}
        onClose={onClose}
      >
        <div className="grid grid-cols-2 gap-3">
          {STUDY_DIRECTIONS.map(direction => (
            <OptionButton
              key={direction.id}
              selected={selectedDirection === direction.id}
              title={direction.label}
              description={direction.description}
              onClick={() => setSelectedDirection(direction.id)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            onSetStudyDirection?.(selectedDirection);
            setStep(1);
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-transform active:scale-[0.98]"
          style={{ backgroundColor: ACTIVE_GREEN, boxShadow: `0 12px 28px ${ACTIVE_GREEN}33` }}
        >
          下一步
          <ArrowRight size={18} />
        </button>
      </StepShell>
    );
  }

  if (step === 1) {
    return (
      <StepShell
        step={1}
        title="设一个轻目标"
        description="先从容易坚持的数量开始，后面可以随时调整。"
        icon={<Target size={24} />}
        onBack={() => setStep(0)}
        onClose={onClose}
      >
        <div className="grid grid-cols-3 gap-3">
          {DAILY_GOALS.map(goal => {
            const selected = dailyGoal === goal;
            return (
              <button
                key={goal}
                type="button"
                onClick={() => applyDailyGoal(goal)}
                className="rounded-2xl border py-4 text-center transition-transform active:scale-[0.98]"
                style={{
                  borderColor: selected ? ACTIVE_GREEN : theme.border || '#e5e7eb',
                  backgroundColor: selected ? `${ACTIVE_GREEN}12` : theme.bg || '#ffffff',
                }}
              >
                <span className="block text-2xl font-extrabold" style={{ color: selected ? ACTIVE_GREEN : theme.textPrimary }}>
                  {goal}
                </span>
                <span className="mt-1 block text-xs" style={{ color: theme.textSecondary }}>
                  张/天
                </span>
              </button>
            );
          })}
        </div>
        <div
          className="mt-4 rounded-2xl px-4 py-3 text-sm leading-6"
          style={{ backgroundColor: `${ACTIVE_GREEN}10`, color: theme.textSecondary }}
        >
          推荐先选 10 张：足够形成节奏，也不会让第一天太重。
        </div>
        <button
          type="button"
          onClick={() => setStep(2)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-transform active:scale-[0.98]"
          style={{ backgroundColor: ACTIVE_GREEN, boxShadow: `0 12px 28px ${ACTIVE_GREEN}33` }}
        >
          继续
          <ArrowRight size={18} />
        </button>
      </StepShell>
    );
  }

  if (step === 2) {
    return (
      <StepShell
        step={2}
        title="领取推荐内容"
        description={`已按「${selectedDirectionLabel}」准备好第一组学习内容。`}
        icon={<Download size={24} />}
        onBack={() => setStep(1)}
        onClose={onClose}
      >
        <div
          className="rounded-2xl border p-4"
          style={{ borderColor: `${ACTIVE_GREEN}33`, backgroundColor: `${ACTIVE_GREEN}0f` }}
        >
          {recommendedPackage ? (
            <>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl">
                  {recommendedPackage.icon || '📚'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-extrabold" style={{ color: theme.textPrimary }}>
                    {recommendedPackage.name}
                  </p>
                  <p className="mt-1 text-xs leading-5" style={{ color: theme.textSecondary }}>
                    {recommendedPackage.description || '适合作为第一组学习内容。'}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  <p className="text-lg font-extrabold" style={{ color: ACTIVE_GREEN }}>
                    {recommendedPackage.kpCount ?? 0}
                  </p>
                  <p className="text-xs" style={{ color: theme.textSecondary }}>知识卡</p>
                </div>
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  <p className="text-lg font-extrabold" style={{ color: ACTIVE_GREEN }}>
                    {recommendedPackage.qCount ?? 0}
                  </p>
                  <p className="text-xs" style={{ color: theme.textSecondary }}>练习题</p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="mb-2 text-3xl">📚</div>
              <p className="text-base font-bold" style={{ color: theme.textPrimary }}>还没有可领取的推荐包</p>
              <p className="mt-1 text-sm leading-6" style={{ color: theme.textSecondary }}>
                可以先去知识库看看已有内容。
              </p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={startLearning}
          disabled={isClaimingPackage}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          style={{ backgroundColor: ACTIVE_GREEN, boxShadow: `0 12px 28px ${ACTIVE_GREEN}33` }}
        >
          {recommendedPackage ? '领取并开始' : '去知识库看看'}
          <ArrowRight size={18} />
        </button>
        <button
          type="button"
          onClick={() => setStep(3)}
          className="mt-3 w-full rounded-2xl py-3 text-sm font-semibold"
          style={{ color: ACTIVE_GREEN, backgroundColor: `${ACTIVE_GREEN}12` }}
        >
          先设置提醒
        </button>
      </StepShell>
    );
  }

  return (
    <StepShell
      step={3}
      title="要不要开启提醒？"
      description="轻提醒只在本机浏览器生效，后面可以在设置里改。"
      icon={<Bell size={24} />}
      onBack={() => setStep(2)}
      onClose={onClose}
    >
      <div
        className="rounded-2xl border px-4 py-4"
        style={{ borderColor: theme.border || '#e5e7eb', backgroundColor: theme.bg || '#ffffff' }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
            <Bell size={19} />
          </span>
          <div>
            <p className="text-sm font-bold" style={{ color: theme.textPrimary }}>晚上提醒你清掉到期卡片</p>
            <p className="mt-1 text-xs leading-5" style={{ color: theme.textSecondary }}>
              不做服务端推送，只用浏览器通知。
            </p>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          void onEnableReminder?.();
          setStep(2);
        }}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-transform active:scale-[0.98]"
        style={{ backgroundColor: ACTIVE_GREEN, boxShadow: `0 12px 28px ${ACTIVE_GREEN}33` }}
      >
        开启提醒
        <CheckCircle2 size={18} />
      </button>
      <button
        type="button"
        onClick={() => setStep(2)}
        className="mt-3 w-full rounded-2xl py-3 text-sm font-semibold"
        style={{ color: theme.textSecondary, backgroundColor: `${theme.border || '#e2e8f0'}66` }}
      >
        稍后再说
      </button>
    </StepShell>
  );
}
