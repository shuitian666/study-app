import { useState } from 'react';
import { ArrowRight, BookOpen, CalendarCheck, CheckCircle2, ChevronLeft, Medal, Trophy } from 'lucide-react';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';

interface OnboardingGuideProps {
  open: boolean;
  onClose: () => void;
}

const STUDY_GOALS = [
  { id: 'medical', emoji: '🩺', label: '医学考试', sub: '执医 · 护士 · 药师' },
  { id: 'english', emoji: '📖', label: '语言学习', sub: '四六级 · 雅思 · 托福' },
  { id: 'tech', emoji: '💻', label: '技术学习', sub: 'JS · Python · 算法' },
  { id: 'exam', emoji: '🎓', label: '升学考试', sub: '考研 · 高考 · 公考' },
  { id: 'other', emoji: '✨', label: '自由学习', sub: '什么都能学' },
];

const STEP_ACCENTS = ['#4f46e5', '#4338ca', '#0891b2', '#7c3aed', '#059669'];

// 悬浮球菜单项（模拟展示用，角度从右侧扇形展开）
// 角度从 180°~270° 之间，cos 为负（向左偏），sin 从 0 到 -1（向上偏），结果始终在容器内
const FAB_MENU_ITEMS = [
  { id: 'checkin', Icon: CalendarCheck, color: '#10b981', label: '签到', angleDeg: 180 },
  { id: 'achievement', Icon: Trophy, color: '#f59e0b', label: '成就', angleDeg: 225 },
  { id: 'ranking', Icon: Medal, color: '#ef4444', label: '排行', angleDeg: 270 },
] as const;

export default function OnboardingGuide({ open, onClose }: OnboardingGuideProps) {
  if (!open) return null;

  return <OnboardingGuideContent onClose={onClose} />;
}

type OnboardingGuideContentProps = Pick<OnboardingGuideProps, 'onClose'>;

function OnboardingGuideContent({ onClose }: OnboardingGuideContentProps) {
  const { theme } = useTheme();
  const { navigate } = useUser();
  const [step, setStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [cardRated, setCardRated] = useState(false);
  const [fabMode, setFabMode] = useState<'idle' | 'tap' | 'hold'>('idle');

  const goalObj = STUDY_GOALS.find(g => g.id === selectedGoal);

  const stepDots = (current: number) => (
    <div className="flex items-center justify-center gap-1.5 py-4">
      {STEP_ACCENTS.map((accent, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            backgroundColor: i === current ? accent : (theme.border || '#e2e8f0'),
          }}
        />
      ))}
    </div>
  );

  // Step 0: 欢迎
  if (step === 0) {
    return (
      <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/70 backdrop-blur-md">
        <div
          className="w-full max-w-[430px] overflow-hidden rounded-t-[32px]"
          style={{ background: 'linear-gradient(160deg, #4f46e5 0%, #7c3aed 100%)' }}
        >
          <div className="flex justify-end px-5 pt-5">
            <button
              onClick={onClose}
              className="rounded-full px-3 py-1 text-sm font-medium text-white/60 transition-colors hover:bg-white/10"
            >
              跳过
            </button>
          </div>
          <div className="flex flex-col items-center px-6 pb-8 pt-2">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[28px] bg-white/15 text-6xl shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
              📚
            </div>
            <h1 className="text-center text-[32px] font-extrabold leading-tight text-white">
              嗨，欢迎来到<br />智学助手！
            </h1>
            <p className="mt-3 text-center text-base leading-7 text-white/75">
              用科学方法帮你记得更牢<br />花 30 秒亲自试一试
            </p>
            <button
              onClick={() => setStep(1)}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-base font-bold transition-transform active:scale-[0.98]"
              style={{ color: '#4f46e5', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
            >
              先认识悬浮球
              <ArrowRight size={18} />
            </button>
            <button
              onClick={onClose}
              className="mt-3 w-full py-3.5 text-sm font-medium text-white/50"
            >
              我已经熟悉了，直接进入
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: 悬浮球 demo
  if (step === 1) {
    const showMenu = fabMode === 'hold';
    // 半径 72px，菜单从右侧向左扇形展开（180°~270°）
    const radius = 72;
    return (
      <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/70 backdrop-blur-md">
        <div
          className="w-full max-w-[430px] overflow-hidden rounded-t-[32px]"
          style={{ backgroundColor: theme.bgCard || '#ffffff' }}
        >
          <div
            className="px-5 pb-5 pt-6"
            style={{ background: 'linear-gradient(160deg, #4338ca 0%, #6366f1 100%)' }}
          >
            <button
              onClick={() => setStep(0)}
              className="mb-4 flex items-center gap-1 text-sm text-white/70"
            >
              <ChevronLeft size={16} />返回
            </button>
            <h2 className="text-2xl font-extrabold text-white">先认识悬浮球</h2>
            <p className="mt-1 text-sm text-white/75">右下角那个圆按钮，有两个玩法</p>
          </div>
          <div className="px-5 pb-6">
            {stepDots(1)}

            {/* Demo 区域：固定高度，FAB 锚定在右下角，菜单项在其左上方扇出 */}
            <div
              className="relative mb-4 overflow-hidden rounded-[24px]"
              style={{
                height: 200,
                background: 'linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%)',
                border: `1.5px solid ${theme.border || '#e2e8f0'}`,
              }}
            >
              {/* 说明文字 */}
              <div className="absolute left-4 top-4 right-20">
                <p className="text-xs font-bold" style={{ color: theme.textPrimary }}>
                  {fabMode === 'idle' && '点下方按钮体验两种操作'}
                  {fabMode === 'tap' && '轻点 → 直接开始学习'}
                  {fabMode === 'hold' && '长按 → 展开快捷菜单'}
                </p>
                {fabMode !== 'idle' && (
                  <p className="mt-1 text-xs leading-5" style={{ color: theme.textSecondary }}>
                    {fabMode === 'tap' && '最快进入今天的学习主流程。'}
                    {fabMode === 'hold' && '从菜单里去签到、成就和排行。'}
                  </p>
                )}
              </div>

              {/* 菜单项：从 FAB 右下角（bottom:16 right:16）向左上扇出 */}
              {showMenu && FAB_MENU_ITEMS.map(item => {
                const rad = (item.angleDeg * Math.PI) / 180;
                // cos(180~270) 均为负（向左），sin(180~270) 均为负（向上），结果始终在 FAB 的左上方
                const dx = Math.cos(rad) * radius; // 负值 → 向左
                const dy = Math.sin(rad) * radius; // 负值 → 向上
                return (
                  <div
                    key={item.id}
                    className="absolute flex flex-col items-center gap-0.5 transition-all duration-300"
                    style={{
                      // FAB 中心在 bottom:16+32=48, right:16+32=48
                      right: 16 + 32 - dx - 20, // 减去icon宽度的一半(20)以居中
                      bottom: 16 + 32 - dy - 20,
                    }}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg"
                      style={{ color: item.color }}
                    >
                      <item.Icon size={18} />
                    </div>
                    <span className="text-[10px] font-medium" style={{ color: theme.textSecondary }}>
                      {item.label}
                    </span>
                  </div>
                );
              })}

              {/* FAB 本体 */}
              <div
                className="absolute bottom-4 right-4 flex h-16 w-16 items-center justify-center rounded-full text-white transition-all duration-300"
                style={{
                  background: '#4f46e5',
                  transform: fabMode === 'tap' ? 'scale(0.92)' : fabMode === 'hold' ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: fabMode === 'hold'
                    ? '0 16px 36px rgba(79,70,229,0.4), 0 0 0 12px rgba(79,70,229,0.12)'
                    : '0 12px 28px rgba(79,70,229,0.35)',
                }}
              >
                <BookOpen size={26} strokeWidth={2.2} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFabMode('tap')}
                className="rounded-2xl py-3 text-sm font-bold text-white transition-transform active:scale-[0.98]"
                style={{ backgroundColor: fabMode === 'tap' ? '#4f46e5' : '#4f46e520', color: fabMode === 'tap' ? '#fff' : '#4f46e5' }}
              >
                轻点
              </button>
              <button
                onClick={() => setFabMode('hold')}
                className="rounded-2xl py-3 text-sm font-bold transition-transform active:scale-[0.98]"
                style={{ backgroundColor: fabMode === 'hold' ? '#4338ca' : '#4338ca15', color: fabMode === 'hold' ? '#fff' : '#4338ca' }}
              >
                长按
              </button>
            </div>

            <button
              onClick={() => { setFabMode('idle'); setStep(2); }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-transform active:scale-[0.98]"
              style={{ backgroundColor: '#4338ca' }}
            >
              看懂了，继续
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: 互动闪卡 demo
  if (step === 2) {
    return (
      <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/70 backdrop-blur-md">
        <div
          className="w-full max-w-[430px] overflow-hidden rounded-t-[32px]"
          style={{ backgroundColor: theme.bgCard || '#ffffff' }}
        >
          <div
            className="px-5 pb-5 pt-6"
            style={{ background: 'linear-gradient(160deg, #0891b2 0%, #0369a1 100%)' }}
          >
            <button
              onClick={() => setStep(1)}
              className="mb-4 flex items-center gap-1 text-sm text-white/70"
            >
              <ChevronLeft size={16} />返回
            </button>
            <h2 className="text-2xl font-extrabold text-white">来，亲自试一次</h2>
            <p className="mt-1 text-sm text-white/75">这就是你每天会做的事</p>
          </div>
          <div className="px-5 pb-6">
            {stepDots(2)}

            <div
              className="mb-4 flex min-h-[130px] flex-col items-center justify-center rounded-3xl p-5 text-center transition-all duration-300"
              style={{
                background: cardFlipped
                  ? 'linear-gradient(135deg, #0891b208, #0891b215)'
                  : 'linear-gradient(135deg, #4f46e508, #7c3aed15)',
                border: `2px solid ${cardFlipped ? '#0891b230' : '#7c3aed30'}`,
              }}
            >
              {!cardFlipped ? (
                <>
                  <div className="mb-3 text-3xl">🤔</div>
                  <p className="text-base font-bold" style={{ color: theme.textPrimary }}>
                    间隔重复是什么？
                  </p>
                  <p className="mt-2 text-xs" style={{ color: theme.textSecondary }}>点下方查看答案</p>
                </>
              ) : (
                <>
                  <div className="mb-3 text-3xl">💡</div>
                  <p className="text-base font-bold" style={{ color: theme.textPrimary }}>
                    在快要忘记之前复习
                  </p>
                  <p className="mt-1.5 text-sm leading-6" style={{ color: theme.textSecondary }}>
                    间隔越来越长，记忆越来越牢
                  </p>
                </>
              )}
            </div>

            {!cardFlipped ? (
              <button
                onClick={() => setCardFlipped(true)}
                className="w-full rounded-2xl py-3.5 text-base font-bold text-white transition-transform active:scale-[0.98]"
                style={{ backgroundColor: '#7c3aed' }}
              >
                查看答案
              </button>
            ) : !cardRated ? (
              <>
                <p className="mb-3 text-center text-sm font-medium" style={{ color: theme.textSecondary }}>
                  你记住了多少？
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '忘了', color: '#ef4444', bg: '#ef444410' },
                    { label: '模糊', color: '#f97316', bg: '#f9731610' },
                    { label: '记得', color: '#0891b2', bg: '#0891b210' },
                    { label: '很熟', color: '#059669', bg: '#05966910' },
                  ].map(btn => (
                    <button
                      key={btn.label}
                      onClick={() => setCardRated(true)}
                      className="rounded-2xl py-3 text-sm font-bold transition-transform active:scale-[0.97]"
                      style={{ color: btn.color, backgroundColor: btn.bg, border: `1.5px solid ${btn.color}40` }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="mb-2 text-4xl">✅</div>
                <p className="text-base font-bold" style={{ color: theme.textPrimary }}>就是这么简单！</p>
                <p className="mb-5 mt-1 text-sm leading-6" style={{ color: theme.textSecondary }}>
                  系统会根据你的评分，自动安排下次复习
                </p>
                <button
                  onClick={() => {
                    setCardFlipped(false);
                    setCardRated(false);
                    setStep(3);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-transform active:scale-[0.98]"
                  style={{ backgroundColor: '#0891b2' }}
                >
                  明白了，继续
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 3: 选择方向
  if (step === 3) {
    return (
      <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/70 backdrop-blur-md">
        <div
          className="w-full max-w-[430px] overflow-hidden rounded-t-[32px]"
          style={{ backgroundColor: theme.bgCard || '#ffffff' }}
        >
          <div
            className="px-5 pb-5 pt-6"
            style={{ background: 'linear-gradient(160deg, #7c3aed 0%, #6d28d9 100%)' }}
          >
            <button
              onClick={() => setStep(2)}
              className="mb-4 flex items-center gap-1 text-sm text-white/70"
            >
              <ChevronLeft size={16} />返回
            </button>
            <div className="mb-3 text-4xl">🎯</div>
            <h2 className="text-2xl font-extrabold text-white">你主要想学什么？</h2>
            <p className="mt-1 text-sm text-white/75">帮助我们给你更合适的建议</p>
          </div>
          <div className="px-5 pb-6">
            {stepDots(3)}
            <div className="grid grid-cols-2 gap-3">
              {STUDY_GOALS.slice(0, 4).map(goal => {
                const isSelected = selectedGoal === goal.id;
                return (
                  <button
                    key={goal.id}
                    onClick={() => setSelectedGoal(isSelected ? null : goal.id)}
                    className="rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.97]"
                    style={{
                      borderColor: isSelected ? '#7c3aed' : (theme.border || '#e2e8f0'),
                      backgroundColor: isSelected ? '#7c3aed10' : 'transparent',
                    }}
                  >
                    <div className="text-2xl">{goal.emoji}</div>
                    <div className="mt-2 text-sm font-bold" style={{ color: theme.textPrimary }}>{goal.label}</div>
                    <div className="mt-0.5 text-xs" style={{ color: theme.textSecondary }}>{goal.sub}</div>
                    {isSelected && (
                      <div className="mt-2">
                        <CheckCircle2 size={16} style={{ color: '#7c3aed' }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {(() => {
              const last = STUDY_GOALS[4];
              const isSelected = selectedGoal === last.id;
              return (
                <button
                  onClick={() => setSelectedGoal(isSelected ? null : last.id)}
                  className="mt-3 flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98]"
                  style={{
                    borderColor: isSelected ? '#7c3aed' : (theme.border || '#e2e8f0'),
                    backgroundColor: isSelected ? '#7c3aed10' : 'transparent',
                  }}
                >
                  <span className="text-2xl">{last.emoji}</span>
                  <div className="flex-1">
                    <div className="text-sm font-bold" style={{ color: theme.textPrimary }}>{last.label}</div>
                    <div className="text-xs" style={{ color: theme.textSecondary }}>{last.sub}</div>
                  </div>
                  {isSelected && <CheckCircle2 size={16} style={{ color: '#7c3aed' }} />}
                </button>
              );
            })()}
            <button
              onClick={() => setStep(4)}
              disabled={!selectedGoal}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: '#7c3aed' }}
            >
              选好了！
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: 出发
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/70 backdrop-blur-md">
      <div
        className="w-full max-w-[430px] overflow-hidden rounded-t-[32px]"
        style={{ backgroundColor: theme.bgCard || '#ffffff' }}
      >
        <div
          className="px-5 pb-6 pt-6 text-center"
          style={{ background: 'linear-gradient(160deg, #059669 0%, #0891b2 100%)' }}
        >
          <div className="mb-4 text-5xl">🎉</div>
          <h2 className="text-2xl font-extrabold text-white">准备好了！</h2>
          <p className="mt-2 text-sm leading-6 text-white/80">
            {goalObj ? `你选择了「${goalObj.label}」方向` : '你的学习空间已就绪'}
            <br />先去添加你的第一条知识吧
          </p>
        </div>
        <div className="px-5 pb-8">
          {stepDots(4)}
          <div className="space-y-3">
            {[
              { emoji: '📥', title: '添加知识', sub: '知识库手动录入，或直接导入文件' },
              { emoji: '🃏', title: '每天刷卡', sub: '首页点「开始学习」，几分钟搞定' },
              { emoji: '⏰', title: '坚持打开', sub: '系统会在最佳时机提醒你复习' },
            ].map(tip => (
              <div
                key={tip.title}
                className="flex items-center gap-4 rounded-2xl p-4"
                style={{ backgroundColor: '#05966910', border: '1px solid #05966925' }}
              >
                <span className="shrink-0 text-2xl">{tip.emoji}</span>
                <div>
                  <p className="text-sm font-bold" style={{ color: theme.textPrimary }}>{tip.title}</p>
                  <p className="mt-0.5 text-xs leading-5" style={{ color: theme.textSecondary }}>{tip.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { onClose(); navigate('knowledge'); }}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-transform active:scale-[0.98]"
            style={{ backgroundColor: '#059669', boxShadow: '0 8px 24px rgba(5,150,105,0.3)' }}
          >
            去添加第一条知识
            <ArrowRight size={18} />
          </button>
          <button
            onClick={onClose}
            className="mt-3 w-full rounded-2xl py-3.5 text-sm font-medium"
            style={{ color: theme.textSecondary, backgroundColor: `${theme.border || '#e2e8f0'}66` }}
          >
            先逛一逛
          </button>
        </div>
      </div>
    </div>
  );
}
