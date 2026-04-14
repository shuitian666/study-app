/**
 * @section SETTINGS - 简化版
 * 
 * 设置页面功能:
 * 1. AI模式选择（豆包云端 / 离线模式）
 * 2. 学习目标设置
 * 
 * 豆包API配置:
 * - API Key: 用户提供的密钥
 * - 模型: doubao-lite-32k (最轻量)
 */

import { useState, useEffect } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import type { AIConfig } from '@/types';
import { DOUBAN_API_URL, fetchModels, getAIConfig, resetBackendCache, setAIConfig } from '@/services/aiClient';
import { Bot, Target, Check, Sparkles, WifiOff, Cloud, Trash2, AlertTriangle, Palette } from 'lucide-react';

// 豆包默认模型
const DEFAULT_DOUBAN_MODEL = 'doubao-lite-32k';

export default function SettingsPage() {
  const { userState, userDispatch, navigate } = useUser();
  const { learningState } = useLearning();
  const { theme } = useTheme();
  
  // 读取已保存配置
  const savedConfig = getAIConfig();
  
  // 当前模式: 'douban' = 云端豆包, 'offline' = 离线模式, 'openclaw' = 本地 OpenClaw
  const [aiMode, setAiMode] = useState<'douban' | 'offline' | 'openclaw'>(() => {
    if (savedConfig.provider === 'douban') return 'douban';
    if (savedConfig.provider === 'openclaw') return 'openclaw';
    return 'offline';
  });
  
  // API Key 输入框
  const [apiKey, setApiKey] = useState(() => {
    return savedConfig.apiKey || '';
  });
  const [modelId, setModelId] = useState(() => {
    return savedConfig.modelId || DEFAULT_DOUBAN_MODEL;
  });
  
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checkingConn, setCheckingConn] = useState(false);
  const [connState, setConnState] = useState<'unknown' | 'ok' | 'fail'>('unknown');
  const [connMessage, setConnMessage] = useState('尚未检测');
  
  // 销号确认弹窗
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);
  const [destroyConfirmText, setDestroyConfirmText] = useState('');
  
  // 保存AI模式
  const saveAIMode = (mode: 'douban' | 'offline' | 'openclaw') => {
    setSaving(true);
    
    if (mode === 'douban') {
      // 配置豆包云端API - 使用用户输入的 API Key 和模型 ID
      const newConfig: AIConfig = {
        provider: 'douban',
        presetId: 'douban',
        apiKey: apiKey.trim(),
        modelId: modelId.trim(),
      };
      setAIConfig(newConfig);
    } else if (mode === 'openclaw') {
      // OpenClaw 本地接入 - 手动选择接入，使用本地 OpenClaw 服务
      const newConfig: AIConfig = {
        provider: 'openclaw',
        presetId: 'openclaw-local',
      };
      setAIConfig(newConfig);
    } else {
      // 离线模式 - 使用本地Mock
      const newConfig: AIConfig = {
        provider: 'ollama',
        presetId: 'ollama-local',
      };
      setAIConfig(newConfig);
    }
    
    setAiMode(mode);
    resetBackendCache();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const runConnectionCheck = async () => {
    setCheckingConn(true);
    setConnState('unknown');
    setConnMessage('检测中...');

    try {
      if (aiMode === 'offline') {
        setConnState('ok');
        setConnMessage('离线模式无需连接，可直接使用预设流程');
        return;
      }

      if (aiMode === 'openclaw') {
        const providers = await fetchModels();
        const openclaw = providers.find(p => p.name === 'openclaw');
        if (openclaw?.available) {
          setConnState('ok');
          setConnMessage('OpenClaw 连接正常');
        } else {
          setConnState('fail');
          setConnMessage('OpenClaw 未连接，请检查本地服务与端口');
        }
        return;
      }

      if (!apiKey.trim() || !modelId.trim()) {
        setConnState('fail');
        setConnMessage('请先填写豆包 API Key 和模型 ID');
        return;
      }

      const res = await fetch(`${DOUBAN_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: modelId.trim(),
          messages: [{ role: 'user', content: 'ping' }],
          stream: false,
          max_tokens: 1,
        }),
      });

      if (res.ok) {
        setConnState('ok');
        setConnMessage('豆包连接正常，模型可用');
      } else {
        setConnState('fail');
        setConnMessage(`豆包连接失败（HTTP ${res.status}）`);
      }
    } catch (error) {
      setConnState('fail');
      setConnMessage(`检测失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setCheckingConn(false);
    }
  };
  
  // 学习目标状态
  const [dailyGoal, setDailyGoal] = useState(() => {
    const saved = localStorage.getItem('daily-question-goal');
    return saved ? parseInt(saved) : 15;
  });
  const [goalAchieved, setGoalAchieved] = useState(false);
  const [todayCompleted, setTodayCompleted] = useState(0);
  
  // 主界面动画效果状态（首页、知识库、图谱、我的、刷题中心）
  const [mainAnimationEffect, setMainAnimationEffect] = useState(() => {
    const saved = localStorage.getItem('main-animation-effect');
    return saved || 'slide-up';
  });

  // 次级界面动画效果状态（学习、复习、导入等内页）
  const [subAnimationEffect, setSubAnimationEffect] = useState(() => {
    const saved = localStorage.getItem('sub-animation-effect');
    return saved || 'fade-in';
  });

  // 主题风格状态 ('default' | 'fluidScholar')
  const [themeStyle, setThemeStyle] = useState(() => {
    return userState.user?.themeStyle || 'default';
  });

  // 计算今日完成数量
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayResults = learningState.quizResults.filter(r => r.completedAt.startsWith(today));
    const total = todayResults.reduce((sum, r) => sum + r.totalQuestions, 0);
    setTodayCompleted(total);
    setGoalAchieved(total >= dailyGoal);
  }, [learningState.quizResults, dailyGoal]);

  // 保存学习目标
  const handleSaveGoal = () => {
    localStorage.setItem('daily-question-goal', String(dailyGoal));
    userDispatch({ 
      type: 'SET_DAILY_GOAL', 
      payload: dailyGoal 
    });
  };
  
  // 保存主界面动画效果
  const handleSaveMainAnimationEffect = (effect: string) => {
    localStorage.setItem('main-animation-effect', effect);
    setMainAnimationEffect(effect);
  };

  // 保存次级界面动画效果
  const handleSaveSubAnimationEffect = (effect: string) => {
    localStorage.setItem('sub-animation-effect', effect);
    setSubAnimationEffect(effect);
  };

  // 保存主题风格
  const handleSaveThemeStyle = (style: string) => {
    userDispatch({
      type: 'UPDATE_USER',
      payload: { themeStyle: style }
    });
    setThemeStyle(style);
  };

  // 销号处理
  const handleDestroyAccount = () => {
    if (destroyConfirmText !== '确认销号') return;
    
    // 清除所有本地存储
    localStorage.clear();
    
    // 彻底重置状态
    userDispatch({ type: 'RESET_ALL' });
    navigate('login');
  };

  const isDoubanMode = aiMode === 'douban';

  // 根据主题获取圆角大小
  const getBorderRadius = (size: 'small' | 'medium' | 'large' = 'medium') => {
    const radiusMap: Record<string, Record<string, string>> = {
      small: { sm: '12px', md: '16px', lg: '20px' },
      medium: { sm: '16px', md: '20px', lg: '24px' },
      large: { sm: '20px', md: '24px', lg: '28px' },
      cute: { sm: '20px', md: '24px', lg: '32px' }
    };
    return radiusMap[theme.borderRadius][size];
  };

  return (
    <div className="page-scroll pb-4">
      {/* 渐变头部背景 */}
      <div 
        className="text-white px-5 pt-16 pb-6 rounded-b-[40px] mb-4 overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">设置</h2>
          <button
            onClick={() => navigate('profile')}
            className="p-2 bg-white/20 rounded-full active:bg-white/30 transition-colors"
          >
            <span className="text-sm" style={{ color: '#ffffff' }}>返回</span>
          </button>
        </div>
        <p className="text-sm mt-1" style={{ color: '#ffffff' }}>个性化您的学习体验</p>
      </div>

      {/* AI设置 */}
      <div className="px-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Bot size={16} className="text-primary" />
          AI配置
        </h3>

        <div className="bg-white border border-border shadow-sm overflow-hidden" style={{ borderRadius: getBorderRadius('large') }}>
          {/* 当前状态显示 */}
          <div className="p-4 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-3">
              {aiMode === 'douban' ? (
                <Cloud size={20} className="text-purple-500" />
              ) : aiMode === 'openclaw' ? (
                <Sparkles size={20} className="text-green-500" />
              ) : (
                <WifiOff size={20} className="text-gray-400" />
              )}
              <div>
                <div className="text-sm font-medium">
                  {aiMode === 'douban' ? '豆包 AI (云端)' : 
                   aiMode === 'openclaw' ? 'OpenClaw (本地)' : '离线模式'}
                </div>
                <div className="text-xs text-text-muted">
                  {aiMode === 'douban' 
                    ? `使用 ${modelId || DEFAULT_DOUBAN_MODEL} 模型`
                    : aiMode === 'openclaw'
                    ? '连接本地 OpenClaw 服务，使用本地知识库'
                    : '使用预设任务流，无AI能力'}
                </div>
              </div>
            </div>
            {saved && (
              <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full flex items-center gap-1">
                <Check size={12} />
                已保存
              </span>
            )}
          </div>
          
          {/* 模式选择 */}
          <div className="p-4 space-y-3">
            <div className="text-xs text-text-muted mb-2">选择AI模式</div>
            
            {/* 豆包云端 */}
            <button
              onClick={() => setAiMode('douban')}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                isDoubanMode 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-border bg-white hover:border-purple-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Sparkles size={20} className="text-purple-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">豆包 AI (云端)</div>
                    <div className="text-xs text-text-muted">智能出题、聊天辅导、错题解析</div>
                  </div>
                </div>
                {isDoubanMode && <Check size={18} className="text-purple-500" />}
              </div>
            </button>
            
            {/* 豆包配置 */}
            {isDoubanMode && (
              <div className="mt-3 space-y-3">
                {/* API Key */}
                <div>
                  <label className="text-xs text-text-secondary mb-1.5 block">
                    豆包 API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="请输入你的火山方舟 API Key"
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-400 transition-colors"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    在 <a href="https://console.volcengine.com/ark" target="_blank" rel="noopener noreferrer" className="text-purple-500 underline">火山方舟控制台</a> 获取 API Key
                  </p>
                </div>

                {/* 模型 ID / 推理接入点 ID */}
                <div>
                  <label className="text-xs text-text-secondary mb-1.5 block">
                    推理接入点 ID (模型 ID)
                  </label>
                  <input
                    type="text"
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    placeholder="例如: doubao-lite-32k 或 ep-xxxxxx-xxxxxx"
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-400 transition-colors"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    在火山方舟创建推理接入点后复制，通常是 ep- 开头或直接用 doubao-lite-32k
                  </p>
                </div>
              </div>
            )}

            {/* OpenClaw 本地接入 - 用户要求手动选择接入 ✅ */}
            <button
              onClick={() => setAiMode('openclaw')}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                aiMode === 'openclaw'
                  ? 'border-green-500 bg-green-50'
                  : 'border-border bg-white hover:border-green-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Sparkles size={20} className="text-green-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">OpenClaw (本地)</div>
                    <div className="text-xs text-text-muted">接入本地 OpenClaw，使用本地知识库</div>
                  </div>
                </div>
                {aiMode === 'openclaw' && <Check size={18} className="text-green-500" />}
              </div>
            </button>

            {/* 离线模式 */}
            <button
              onClick={() => setAiMode('offline')}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                aiMode === 'offline'
                  ? 'border-gray-400 bg-gray-50'
                  : 'border-border bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <WifiOff size={20} className="text-gray-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">离线模式</div>
                    <div className="text-xs text-text-muted">无需联网，使用预设任务流</div>
                  </div>
                </div>
                {aiMode === 'offline' && <Check size={18} className="text-gray-400" />}
              </div>
            </button>

            <div
              className="rounded-xl px-3 py-2 text-xs"
              style={{
                backgroundColor:
                  connState === 'ok' ? '#ecfdf5' : connState === 'fail' ? '#fef2f2' : '#f5f5f5',
                color:
                  connState === 'ok' ? '#166534' : connState === 'fail' ? '#991b1b' : '#4b5563',
              }}
            >
              连接状态：{connMessage}
            </div>

            <button
              onClick={runConnectionCheck}
              disabled={checkingConn}
              className="w-full py-2.5 bg-white border border-border text-sm rounded-xl font-medium active:opacity-80 disabled:opacity-50"
            >
              {checkingConn ? '检测中...' : '检测 AI 连接'}
            </button>

            {/* 保存按钮 */}
            <button
              onClick={() => saveAIMode(aiMode)}
              disabled={saving || (aiMode === 'douban' && (!apiKey.trim() || !modelId.trim()))}
              className="w-full mt-2 py-2.5 bg-purple-500 text-white text-sm rounded-xl font-medium active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '保存 AI 配置'}
            </button>
          </div>
        </div>
      </div>

      {/* 学习目标设置 */}
      <div className="px-4 mt-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Target size={16} className="text-accent" />
          学习目标
        </h3>

        <div className="bg-white border border-border shadow-sm p-4" style={{ borderRadius: getBorderRadius('large') }}>
          {/* 当前进度 */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-text-muted mb-2">
              <span>今日完成</span>
              <span>{todayCompleted} / {dailyGoal} 题</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, (todayCompleted / dailyGoal) * 100)}%`,
                  backgroundColor: goalAchieved ? '#10b981' : '#f59e0b'
                }}
              />
            </div>
            {goalAchieved && (
              <p className="text-xs text-accent mt-2 flex items-center gap-1">
                <Check size={12} />
                今日目标已达成！
              </p>
            )}
          </div>

          {/* 目标设置 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-secondary">每日目标（题目数）</span>
              <span className="text-sm font-bold text-primary">{dailyGoal} 题</span>
            </div>
            
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={dailyGoal}
              onChange={e => setDailyGoal(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            
            <div className="flex justify-between text-[10px] text-text-muted mt-1">
              <span>10题</span>
              <span>50题</span>
            </div>
          </div>

          <button
            onClick={handleSaveGoal}
            className="w-full mt-4 py-2.5 bg-primary text-white text-sm rounded-xl font-medium active:opacity-80"
          >
            保存目标
          </button>
        </div>
      </div>

      {/* 动画效果设置 - 主界面 */}
      <div className="px-4 mt-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-secondary" />
          主界面动画效果
        </h3>

        <div className="bg-white border border-border shadow-sm p-4" style={{ borderRadius: getBorderRadius('large') }}>
          <div className="text-xs text-text-muted mb-3">应用于：首页、知识库、图谱、我的、刷题中心</div>

          <div className="space-y-2">
            {[
              { value: 'slide-up', label: '向上滑动', desc: '经典的向上滑入效果' },
              { value: 'fade-in', label: '淡入', desc: '简单的透明度变化' },
              { value: 'scale-in', label: '缩放', desc: '从小到大的缩放效果' },
              { value: 'rotate-in', label: '旋转', desc: '带旋转的滑入效果' },
              { value: 'bounce-in', label: '弹跳', desc: '带有弹跳效果的滑入' },
              { value: 'slide-left', label: '从左滑入', desc: '从左侧滑入' },
              { value: 'slide-right', label: '从右滑入', desc: '从右侧滑入' }
            ].map((effect) => (
              <button
                key={effect.value}
                onClick={() => handleSaveMainAnimationEffect(effect.value)}
                className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                  mainAnimationEffect === effect.value
                    ? 'border-secondary bg-secondary/5'
                    : 'border-border bg-white hover:border-secondary/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{effect.label}</div>
                    <div className="text-xs text-text-muted">{effect.desc}</div>
                  </div>
                  {mainAnimationEffect === effect.value && <Check size={18} className="text-secondary" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 动画效果设置 - 次级界面 */}
      <div className="px-4 mt-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          学习界面动画效果
        </h3>

        <div className="bg-white border border-border shadow-sm p-4" style={{ borderRadius: getBorderRadius('large') }}>
          <div className="text-xs text-text-muted mb-3">应用于：学习、复习、导入、错题本等内页</div>

          <div className="space-y-2">
            {[
              { value: 'slide-up', label: '向上滑动', desc: '经典的向上滑入效果' },
              { value: 'fade-in', label: '淡入', desc: '简单的透明度变化' },
              { value: 'scale-in', label: '缩放', desc: '从小到大的缩放效果' },
              { value: 'rotate-in', label: '旋转', desc: '带旋转的滑入效果' },
              { value: 'bounce-in', label: '弹跳', desc: '带有弹跳效果的滑入' },
              { value: 'slide-left', label: '从左滑入', desc: '从左侧滑入' },
              { value: 'slide-right', label: '从右滑入', desc: '从右侧滑入' }
            ].map((effect) => (
              <button
                key={effect.value}
                onClick={() => handleSaveSubAnimationEffect(effect.value)}
                className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                  subAnimationEffect === effect.value
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-white hover:border-accent/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{effect.label}</div>
                    <div className="text-xs text-text-muted">{effect.desc}</div>
                  </div>
                  {subAnimationEffect === effect.value && <Check size={18} className="text-accent" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 主题风格设置 */}
      <div className="px-4 mt-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Palette size={16} className="text-primary" />
          主题风格
        </h3>

        <div className="bg-white border border-border shadow-sm p-4" style={{ borderRadius: getBorderRadius('large') }}>
          <div className="text-xs text-text-muted mb-3">选择主题风格后，将统一应用于所有背景</div>

          <div className="space-y-2">
            {/* 经典风格 */}
            <button
              onClick={() => handleSaveThemeStyle('default')}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                themeStyle === 'default'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-white hover:border-primary/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                  >
                    <span className="text-white text-lg">🎨</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium">经典风格</div>
                    <div className="text-xs text-text-muted">多彩主题，各背景有独立配色</div>
                  </div>
                </div>
                {themeStyle === 'default' && <Check size={18} className="text-primary" />}
              </div>
            </button>

            {/* Fluid Scholar 风格 */}
            <button
              onClick={() => handleSaveThemeStyle('fluidScholar')}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                themeStyle === 'fluidScholar'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-white hover:border-primary/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #24389c, #73008e)' }}
                  >
                    <span className="text-white text-lg">✨</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Fluid Scholar</div>
                    <div className="text-xs text-text-muted">专业编辑风格，统一配色适配所有背景</div>
                  </div>
                </div>
                {themeStyle === 'fluidScholar' && <Check size={18} className="text-primary" />}
              </div>
              {/* 风格预览 */}
              <div className="mt-3 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#24389c' }} />
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#4355b9' }} />
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#73008e' }} />
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#9026ac' }} />
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#ffdfa0' }} />
                </div>
                <span className="text-[10px] text-text-muted">深靛蓝 + 紫色 + 琥珀色</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="px-4 mt-4">
        <div className="bg-blue-50 p-3 text-xs text-blue-700" style={{ borderRadius: getBorderRadius('medium') }}>
          <div className="font-medium mb-1">提示</div>
          <ul className="space-y-1 text-blue-600">
            <li>• <strong>豆包AI</strong>：需要网络，智能程度高</li>
            <li>• <strong>离线模式</strong>：无需联网，功能有限</li>
            <li>• 完成{dailyGoal}题可达成今日学习目标</li>
            <li>• 主界面和学习界面可分别设置不同的动画效果</li>
            <li>• Fluid Scholar 风格将统一配色，适配所有背景</li>
          </ul>
        </div>
      </div>

      {/* 销号功能 */}
      <div className="px-4 mt-6 mb-4">
        <button
          onClick={() => setShowDestroyConfirm(true)}
          className="w-full py-3 bg-red-50 text-red-600 text-sm font-medium flex items-center justify-center gap-2 border border-red-200"
          style={{ borderRadius: getBorderRadius('large') }}
        >
          <Trash2 size={16} />
          注销账号
        </button>
        <p className="text-[10px] text-text-muted text-center mt-2">
          注销后将清除所有学习记录，此操作不可恢复
        </p>
      </div>

      {/* 销号确认弹窗 */}
      {showDestroyConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-600">确认注销账号</h3>
                <p className="text-xs text-text-muted">此操作不可撤销</p>
              </div>
            </div>

            <div className="bg-red-50 rounded-xl p-3 mb-4 text-xs text-red-700">
              <p className="font-medium mb-2">注销后将清除以下数据：</p>
              <ul className="space-y-1">
                <li>• 所有学习记录和进度</li>
                <li>• 错题本和收藏</li>
                <li>• 签到记录和成就</li>
                <li>• 背包物品和邮件</li>
                <li>• 个人设置和目标</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="text-xs text-text-secondary mb-1.5 block">
                请输入 <span className="font-bold text-red-600">确认销号</span> 以确认
              </label>
              <input
                type="text"
                value={destroyConfirmText}
                onChange={(e) => setDestroyConfirmText(e.target.value)}
                placeholder="确认销号"
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red-400 transition-colors"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDestroyConfirm(false);
                  setDestroyConfirmText('');
                }}
                className="flex-1 py-2.5 bg-gray-100 text-text-secondary text-sm font-medium rounded-xl"
              >
                取消
              </button>
              <button
                onClick={handleDestroyAccount}
                disabled={destroyConfirmText !== '确认销号'}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认注销
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
