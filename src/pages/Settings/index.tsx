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
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/ui/Common';
import type { AIConfig } from '@/types';
import { getAIConfig, setAIConfig } from '@/services/aiClient';
import { Bot, Target, Check, Sparkles, WifiOff, Cloud, Trash2, AlertTriangle } from 'lucide-react';

// 豆包默认模型
const DEFAULT_DOUBAN_MODEL = 'doubao-lite-32k';

export default function SettingsPage() {
  const { state, dispatch, navigate } = useApp();
  
  // 读取已保存配置
  const savedConfig = getAIConfig();
  
  // 当前模式: 'douban' = 云端豆包, 'offline' = 离线模式
  const [aiMode, setAiMode] = useState<'douban' | 'offline'>(() => {
    return savedConfig.provider === 'douban' ? 'douban' : 'offline';
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
  
  // 销号确认弹窗
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);
  const [destroyConfirmText, setDestroyConfirmText] = useState('');
  
  // 保存AI模式
  const saveAIMode = (mode: 'douban' | 'offline') => {
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
    } else {
      // 离线模式 - 使用本地Mock
      const newConfig: AIConfig = {
        provider: 'ollama',
        presetId: 'ollama-local',
      };
      setAIConfig(newConfig);
    }
    
    setAiMode(mode);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  
  // 学习目标状态
  const [dailyGoal, setDailyGoal] = useState(() => {
    const saved = localStorage.getItem('daily-question-goal');
    return saved ? parseInt(saved) : 15;
  });
  const [goalAchieved, setGoalAchieved] = useState(false);
  const [todayCompleted, setTodayCompleted] = useState(0);

  // 计算今日完成数量
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayResults = state.quizResults.filter(r => r.completedAt.startsWith(today));
    const total = todayResults.reduce((sum, r) => sum + r.totalQuestions, 0);
    setTodayCompleted(total);
    setGoalAchieved(total >= dailyGoal);
  }, [state.quizResults, dailyGoal]);

  // 保存学习目标
  const handleSaveGoal = () => {
    localStorage.setItem('daily-question-goal', String(dailyGoal));
    dispatch({ 
      type: 'SET_DAILY_GOAL', 
      payload: dailyGoal 
    });
  };

  // 销号处理
  const handleDestroyAccount = () => {
    if (destroyConfirmText !== '确认销号') return;
    
    // 清除所有本地存储
    localStorage.clear();
    
    // 彻底重置状态
    dispatch({ type: 'RESET_ALL' });
    navigate('login');
  };

  const isDoubanMode = aiMode === 'douban';

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="设置" onBack={() => navigate('profile')} />

      {/* AI设置 */}
      <div className="px-4 mt-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Bot size={16} className="text-primary" />
          AI配置
        </h3>

        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* 当前状态显示 */}
          <div className="p-4 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-3">
              {isDoubanMode ? (
                <Cloud size={20} className="text-purple-500" />
              ) : (
                <WifiOff size={20} className="text-gray-400" />
              )}
              <div>
                <div className="text-sm font-medium">
                  {isDoubanMode ? '豆包 AI (云端)' : '离线模式'}
                </div>
                <div className="text-xs text-text-muted">
                  {isDoubanMode 
                    ? `使用 doubao-lite-32k 模型` 
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
            
            {/* 离线模式 */}
            <button
              onClick={() => setAiMode('offline')}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                !isDoubanMode 
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
                {!isDoubanMode && <Check size={18} className="text-gray-400" />}
              </div>
            </button>

            {/* 保存按钮 */}
            <button
              onClick={() => saveAIMode(aiMode)}
              disabled={saving || (isDoubanMode && (!apiKey.trim() || !modelId.trim()))}
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

        <div className="bg-white rounded-2xl border border-border shadow-sm p-4">
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

      {/* 提示信息 */}
      <div className="px-4 mt-4">
        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
          <div className="font-medium mb-1">提示</div>
          <ul className="space-y-1 text-blue-600">
            <li>• <strong>豆包AI</strong>：需要网络，智能程度高</li>
            <li>• <strong>离线模式</strong>：无需联网，功能有限</li>
            <li>• 完成{dailyGoal}题可达成今日学习目标</li>
          </ul>
        </div>
      </div>

      {/* 销号功能 */}
      <div className="px-4 mt-6 mb-4">
        <button
          onClick={() => setShowDestroyConfirm(true)}
          className="w-full py-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl flex items-center justify-center gap-2 border border-red-200"
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
