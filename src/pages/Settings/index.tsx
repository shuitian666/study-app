import { useEffect, useState } from 'react';
import { AlertTriangle, Bot, BookOpen, Check, CircleHelp, Cloud, KeyRound, Palette, ShieldCheck, Sparkles, Target, Trash2 } from 'lucide-react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useGame } from '@/store/GameContext';
import { useTheme } from '@/store/ThemeContext';
import { accountUpdateProfile, fetchAIConfig, saveAIConfig, type ServerAIConfigStatus } from '@/services/aiClient';
import { clearKnowledgeData } from '@/services/indexedDBService';
import { getTodayLearningProgress } from '@/utils/dailyLearningProgress';
import { applyServerAccountPayload, logoutOnUnauthorized } from '@/store/accountSync';
import { normalizeLearningProfile } from '@/utils/aiLearningContext';
import type { ExplanationStyle, LearningGoal, PreferredDifficulty, PracticePreference, UserLearningProfile } from '@/types';
import FlashcardStudyGuide from '@/components/ui/FlashcardStudyGuide';

const DEFAULT_AI_MODEL = 'deepseek-chat';
const DEFAULT_AI_BASE_URL = 'https://api.deepseek.com';
const ONBOARDING_FORCE_OPEN_KEY = 'study-app:onboarding-force-open:v1';
const LEARNING_GOAL_OPTIONS: Array<{ id: LearningGoal; label: string }> = [
  { id: 'daily_review', label: '日常复习' },
  { id: 'exam_cram', label: '考试冲刺' },
  { id: 'foundation', label: '打基础' },
  { id: 'weakness_fix', label: '查漏补缺' },
];
const EXPLANATION_STYLE_OPTIONS: Array<{ id: ExplanationStyle; label: string }> = [
  { id: 'step_by_step', label: '分步骤' },
  { id: 'concise', label: '简洁' },
  { id: 'analogy', label: '类比' },
  { id: 'exam_oriented', label: '考试导向' },
];
const DIFFICULTY_OPTIONS: Array<{ id: PreferredDifficulty; label: string }> = [
  { id: 'basic', label: '基础' },
  { id: 'standard', label: '标准' },
  { id: 'challenge', label: '挑战' },
];
const PRACTICE_OPTIONS: Array<{ id: PracticePreference; label: string }> = [
  { id: 'explain_then_practice', label: '先讲后练' },
  { id: 'quiz_then_explain', label: '先测后讲' },
  { id: 'wrong_only', label: '只看错题' },
];

export default function SettingsPage() {
  const { userState, userDispatch, navigate } = useUser();
  const { learningState, learningDispatch } = useLearning();
  const { gameDispatch } = useGame();
  const { theme } = useTheme();

  const [aiStatus, setAiStatus] = useState<ServerAIConfigStatus | null>(null);
  const [aiMode, setAiMode] = useState<'platform' | 'custom'>('platform');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState(DEFAULT_AI_MODEL);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_AI_BASE_URL);
  const [savingAI, setSavingAI] = useState(false);
  const [aiMessage, setAiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [dailyGoal, setDailyGoal] = useState(() => {
    if (userState.user?.dailyGoal) return userState.user.dailyGoal;
    const saved = localStorage.getItem('daily-goal') ?? localStorage.getItem('daily-question-goal');
    return saved ? parseInt(saved, 10) : 10;
  });
  const [goalSaved, setGoalSaved] = useState(false);
  const [themeStyle, setThemeStyle] = useState(() => userState.user?.themeStyle || 'default');
  const [learningProfile, setLearningProfile] = useState<UserLearningProfile>(() => normalizeLearningProfile(userState.user?.learningProfile));
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);
  const [destroyConfirmText, setDestroyConfirmText] = useState('');
  const [showFlashcardGuide, setShowFlashcardGuide] = useState(false);

  const todayCompleted = getTodayLearningProgress(learningState).totalCount;
  const goalAchieved = todayCompleted >= dailyGoal;

  useEffect(() => {
    fetchAIConfig()
      .then(status => {
        setAiStatus(status);
        setAiMode(status.mode);
        setBaseUrl(status.baseUrl || DEFAULT_AI_BASE_URL);
        setModelId(status.model || DEFAULT_AI_MODEL);
      })
      .catch(() => {
        setAiMessage({ type: 'error', text: '无法读取 AI 配置，请确认已登录。' });
      });
  }, []);

  const getBorderRadius = (size: 'small' | 'medium' | 'large' = 'medium') => {
    const radiusMap: Record<string, Record<string, string>> = {
      small: { sm: '12px', md: '16px', lg: '20px' },
      medium: { sm: '16px', md: '20px', lg: '24px' },
      large: { sm: '20px', md: '24px', lg: '28px' },
      cute: { sm: '20px', md: '24px', lg: '32px' },
    };
    return radiusMap[theme.borderRadius]?.[size] ?? '20px';
  };

  const cardStyle = {
    borderRadius: getBorderRadius('large'),
    backgroundColor: theme.bgCard || '#ffffff',
    border: `1px solid ${theme.border || '#e5e7eb'}`,
  };

  const saveCurrentAIConfig = async () => {
    setSavingAI(true);
    setAiMessage(null);
    try {
      const status = aiMode === 'platform'
        ? await saveAIConfig({ mode: 'platform' })
        : await saveAIConfig({
            mode: 'custom',
            baseUrl: baseUrl.trim(),
            model: modelId.trim(),
            apiKey: apiKey.trim() || undefined,
          });
      setAiStatus(status);
      setAiMode(status.mode);
      setBaseUrl(status.baseUrl || DEFAULT_AI_BASE_URL);
      setModelId(status.model || DEFAULT_AI_MODEL);
      setApiKey('');
      setAiMessage({ type: 'success', text: 'AI 配置已保存。' });
    } catch (error) {
      setAiMessage({ type: 'error', text: error instanceof Error ? error.message : '保存 AI 配置失败。' });
    } finally {
      setSavingAI(false);
    }
  };

  const handleSaveGoal = () => {
    localStorage.setItem('daily-goal', String(dailyGoal));
    localStorage.removeItem('daily-question-goal');
    userDispatch({ type: 'SET_DAILY_GOAL', payload: dailyGoal });
    setGoalSaved(true);
    setTimeout(() => setGoalSaved(false), 1600);
  };

  const handleSaveThemeStyle = (style: string) => {
    userDispatch({ type: 'UPDATE_USER', payload: { themeStyle: style } });
    setThemeStyle(style);
  };

  const patchLearningProfile = (patch: Partial<UserLearningProfile>) => {
    setLearningProfile(current => normalizeLearningProfile({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
    setProfileSaved(false);
  };

  const toggleGoal = (goal: LearningGoal) => {
    const exists = learningProfile.goals.includes(goal);
    const goals = exists
      ? learningProfile.goals.filter(item => item !== goal)
      : [...learningProfile.goals, goal].slice(0, 3);
    patchLearningProfile({ goals: goals.length > 0 ? goals : ['daily_review'] });
  };

  const saveLearningProfile = async () => {
    setSavingProfile(true);
    setProfileSaved(false);
    const nextProfile = normalizeLearningProfile({
      ...learningProfile,
      updatedAt: new Date().toISOString(),
    });
    userDispatch({ type: 'UPDATE_USER', payload: { learningProfile: nextProfile } });
    try {
      const payload = await accountUpdateProfile({ learningProfile: nextProfile });
      applyServerAccountPayload(payload, userDispatch, gameDispatch);
      setLearningProfile(nextProfile);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 1600);
    } catch (error) {
      logoutOnUnauthorized(error, userDispatch);
      console.warn('Failed to sync learning profile:', error);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleReopenGuide = () => {
    localStorage.setItem(ONBOARDING_FORCE_OPEN_KEY, '1');
    navigate('home', { showGuide: '1' });
  };

  const handleDestroyAccount = async () => {
    if (destroyConfirmText !== '确认销号') return;
    localStorage.clear();
    try {
      await clearKnowledgeData();
    } catch (error) {
      console.error('Failed to clear IndexedDB during account destroy:', error);
    }
    learningDispatch({ type: 'RESET_ALL' });
    gameDispatch({ type: 'RESET_ALL' });
    userDispatch({ type: 'RESET_ALL' });
    navigate('login');
  };

  const customMissingRequired = aiMode === 'custom'
    && (!baseUrl.trim() || !modelId.trim() || (!apiKey.trim() && !aiStatus?.customConfigured));

  return (
    <div className="page-scroll pb-6" style={{ backgroundColor: theme.bg || '#f8f9fa' }}>
      <div
        className="mb-4 rounded-b-3xl px-5 pb-4 pt-5 text-white"
        style={{ backgroundImage: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)` }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">设置</h2>
          <button onClick={() => navigate('profile')} className="rounded-full bg-white/20 px-3 py-1.5 text-sm active:bg-white/30">
            返回
          </button>
        </div>
        <p className="mt-1 text-sm text-white/85">管理账号、AI 和学习偏好</p>
      </div>

      <section className="px-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Bot size={16} className="text-primary" />
          AI 个性设置
        </h3>

        <div className="overflow-hidden shadow-sm" style={cardStyle}>
          <div className="border-b border-border p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-text-primary">
                  当前模式：{aiMode === 'custom' ? '自定义 AI' : '平台 DeepSeek'}
                </div>
                <p className="mt-1 text-xs leading-5 text-text-muted">
                  API Key 只保存在服务器端。自定义 Key 会加密入库，前端不会回显明文。
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <button
              onClick={() => setAiMode('platform')}
              className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                aiMode === 'platform' ? 'border-primary bg-primary/5' : 'border-border bg-white hover:border-primary/30'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Cloud size={20} className="text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">平台 AI</div>
                    <div className="text-xs text-text-muted">使用服务器内置 DeepSeek Key，适合普通用户直接使用。</div>
                  </div>
                </div>
                {aiMode === 'platform' && <Check size={18} className="text-primary" />}
              </div>
            </button>

            <button
              onClick={() => setAiMode('custom')}
              className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                aiMode === 'custom' ? 'border-purple-500 bg-purple-50' : 'border-border bg-white hover:border-purple-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                    <KeyRound size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">自定义 AI</div>
                    <div className="text-xs text-text-muted">填写 OpenAI-compatible 的 Base URL、Model 和 API Key。</div>
                  </div>
                </div>
                {aiMode === 'custom' && <Check size={18} className="text-purple-600" />}
              </div>
            </button>

            {aiMode === 'custom' && (
              <div className="space-y-3 rounded-2xl border border-purple-100 bg-purple-50/60 p-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs text-text-secondary">Base URL</span>
                  <input
                    value={baseUrl}
                    onChange={event => setBaseUrl(event.target.value)}
                    placeholder="https://api.deepseek.com 或 https://api.openai.com/v1"
                    className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-purple-400"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-text-secondary">模型</span>
                  <input
                    value={modelId}
                    onChange={event => setModelId(event.target.value)}
                    placeholder="deepseek-chat / gpt-4o-mini / qwen-plus"
                    className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-purple-400"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-text-secondary">API Key</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={event => setApiKey(event.target.value)}
                    placeholder={aiStatus?.customConfigured ? '留空则保留已保存的密钥' : '请输入 API Key'}
                    className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-purple-400"
                  />
                  <p className="mt-1 text-[10px] text-text-muted">
                    保存后只显示“已配置”，不会再回传明文 Key。
                  </p>
                </label>
              </div>
            )}

            {aiMessage && (
              <div className={`rounded-xl border px-3 py-2 text-xs ${
                aiMessage.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'
              }`}>
                {aiMessage.text}
              </div>
            )}

            <button
              onClick={saveCurrentAIConfig}
              disabled={savingAI || customMissingRequired}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-white active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingAI ? '保存中...' : '保存 AI 配置'}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-4 px-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Target size={16} className="text-accent" />
          学习目标
        </h3>
        <div className="p-4 shadow-sm" style={cardStyle}>
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
              <span>今日完成</span>
              <span>{todayCompleted} / {dailyGoal} 项</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (todayCompleted / dailyGoal) * 100)}%`,
                  backgroundColor: goalAchieved ? '#10b981' : theme.primary,
                }}
              />
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-text-secondary">每日目标</span>
            <span className="text-sm font-bold text-primary">{dailyGoal} 项</span>
          </div>
          <input
            type="range"
            min="10"
            max="50"
            step="5"
            value={dailyGoal}
            onChange={event => setDailyGoal(parseInt(event.target.value, 10))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary"
          />
          <div className="mt-1 flex justify-between text-[10px] text-text-muted">
            <span>10 项</span>
            <span>50 项</span>
          </div>

          <button onClick={handleSaveGoal} className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-white active:opacity-80">
            {goalSaved ? '已保存' : '保存目标'}
          </button>
        </div>
      </section>

      <section className="mt-4 px-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={16} className="text-primary" />
          AI 个性化
        </h3>
        <div className="space-y-4 p-4 shadow-sm" style={cardStyle}>
          <ProfileOptionGroup
            title="学习目标"
            options={LEARNING_GOAL_OPTIONS}
            activeIds={learningProfile.goals}
            onToggle={toggleGoal}
          />
          <ProfileOptionGroup
            title="讲解风格"
            options={EXPLANATION_STYLE_OPTIONS}
            activeIds={[learningProfile.explanationStyle]}
            onToggle={id => patchLearningProfile({ explanationStyle: id as ExplanationStyle })}
            single
          />
          <ProfileOptionGroup
            title="练习方式"
            options={PRACTICE_OPTIONS}
            activeIds={[learningProfile.practicePreference]}
            onToggle={id => patchLearningProfile({ practicePreference: id as PracticePreference })}
            single
          />
          <ProfileOptionGroup
            title="题目难度"
            options={DIFFICULTY_OPTIONS}
            activeIds={[learningProfile.preferredDifficulty]}
            onToggle={id => patchLearningProfile({ preferredDifficulty: id as PreferredDifficulty })}
            single
          />
          <button
            onClick={saveLearningProfile}
            disabled={savingProfile}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-white active:opacity-80 disabled:opacity-50"
          >
            {savingProfile ? '保存中...' : profileSaved ? '已保存' : '保存 AI 个性化'}
          </button>
        </div>
      </section>

      <section className="mt-4 px-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Palette size={16} className="text-primary" />
          主题风格
        </h3>
        <div className="space-y-2 p-4 shadow-sm" style={cardStyle}>
          <ThemeButton
            active={themeStyle === 'default'}
            title="经典风格"
            desc="多彩主题，各背景拥有独立配色。"
            preview="linear-gradient(135deg, #6366f1, #4f46e5)"
            onClick={() => handleSaveThemeStyle('default')}
          />
          <ThemeButton
            active={themeStyle === 'fluidScholar'}
            title="Fluid Scholar"
            desc="专业编辑风格，统一配色适配所有背景。"
            preview="linear-gradient(135deg, #24389c, #73008e)"
            onClick={() => handleSaveThemeStyle('fluidScholar')}
          />
        </div>
      </section>

      <section className="mt-4 px-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <BookOpen size={16} className="text-primary" />
          使用帮助
        </h3>
        <div className="space-y-4 p-4 shadow-sm" style={cardStyle}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="text-sm font-medium">新手指导</div>
              <p className="mt-1 text-xs leading-5 text-text-muted">重新查看首页、知识库、刷题、AI 助手和激励系统的功能介绍。</p>
            </div>
          </div>
          <button onClick={handleReopenGuide} className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-white active:opacity-80">
            重新查看新手指导
          </button>
          <div className="border-t pt-4" style={{ borderColor: theme.border }}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CircleHelp size={18} />
              </div>
              <div>
                <div className="text-sm font-medium">闪卡学习说明</div>
                <p className="mt-1 text-xs leading-5 text-text-muted">查看翻卡、知识解析、评分含义、学习范围和键盘操作。</p>
              </div>
            </div>
            <button
              onClick={() => setShowFlashcardGuide(true)}
              className="mt-4 w-full rounded-xl border border-primary/25 bg-primary/10 py-2.5 text-sm font-medium text-primary active:opacity-80"
            >
              查看闪卡学习说明
            </button>
          </div>
        </div>
      </section>

      <div className="mb-4 mt-6 px-4">
        <button
          onClick={() => setShowDestroyConfirm(true)}
          className="flex w-full items-center justify-center gap-2 border border-red-200 bg-red-50 py-3 text-sm font-medium text-red-600"
          style={{ borderRadius: getBorderRadius('large') }}
        >
          <Trash2 size={16} />
          注销账号
        </button>
        <p className="mt-2 text-center text-[10px] text-text-muted">注销会清除本地学习记录，此操作不可恢复。</p>
      </div>

      {showDestroyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-600">确认注销账号</h3>
                <p className="text-xs text-text-muted">此操作不可撤销</p>
              </div>
            </div>

            <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
              注销后会清除学习记录、错题、签到、背包、邮件和个人设置。
            </div>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-xs text-text-secondary">请输入“确认销号”</span>
              <input
                value={destroyConfirmText}
                onChange={event => setDestroyConfirmText(event.target.value)}
                placeholder="确认销号"
                className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-red-400"
              />
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDestroyConfirm(false);
                  setDestroyConfirmText('');
                }}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-text-secondary"
              >
                取消
              </button>
              <button
                onClick={handleDestroyAccount}
                disabled={destroyConfirmText !== '确认销号'}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                确认注销
              </button>
            </div>
          </div>
        </div>
      )}
      <FlashcardStudyGuide
        open={showFlashcardGuide}
        onClose={() => setShowFlashcardGuide(false)}
      />
    </div>
  );
}

function ThemeButton({
  active,
  title,
  desc,
  preview,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  preview: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
        active ? 'border-primary bg-primary/5' : 'border-border bg-white hover:border-primary/30'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: preview }}>
            <Palette size={18} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-medium">{title}</div>
            <div className="text-xs text-text-muted">{desc}</div>
          </div>
        </div>
        {active && <Check size={18} className="text-primary" />}
      </div>
    </button>
  );
}

function ProfileOptionGroup<T extends string>({
  title,
  options,
  activeIds,
  onToggle,
  single = false,
}: {
  title: string;
  options: Array<{ id: T; label: string }>;
  activeIds: string[];
  onToggle: (id: T) => void;
  single?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-text-secondary">{title}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const active = activeIds.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle(option.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white text-text-secondary'
              }`}
              aria-pressed={single ? active : undefined}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
