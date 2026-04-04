import { useState } from 'react';
import { useUser } from '@/store/UserContext';
import { Sparkles } from 'lucide-react';
import type { User } from '@/types';

export default function LoginPage() {
  const { userDispatch } = useUser();
  const [loading, setLoading] = useState(false);

  const handleWechatLogin = () => {
    setLoading(true);
    // Simulate WeChat login
    setTimeout(() => {
      const mockUser: User = {
        id: 'user-1',
        nickname: '学习达人',
        avatar: '👤',
        learningDays: 15,
        totalPoints: 320,
        createdAt: new Date().toISOString(),
        dailyGoal: 10,
        dailyNewGoal: 15,
        todayQuestions: 0,
        goalAchievedToday: false,
        // 形象相关
        avatarFrame: null,
        aiSkin: null,
        background: null,
        unlockedAvatars: ['👤', '🦊', '🐰', '🐼'],
        unlockedFrames: ['⬜', '🧊'],
        unlockedAiSkins: ['🤖'],
        unlockedBackgrounds: [],
      };
      userDispatch({ type: 'LOGIN', payload: mockUser });
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-primary/10 overflow-y-auto py-12">
      {/* Logo */}
      <div className="mb-10 flex flex-col items-center">
        <div className="w-28 h-28 bg-gradient-to-br from-primary via-primary-light to-accent rounded-[32px] flex items-center justify-center mb-6 shadow-xl shadow-primary/20">
          <span className="text-6xl">📖</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">智学助手</h1>
        <p className="text-base text-gray-500 flex items-center gap-1.5">
          <Sparkles size={16} className="text-primary" />
          <span>AI驱动的自适应学习平台</span>
        </p>
      </div>

      {/* Features */}
      <div className="w-full max-w-sm space-y-3 mb-10">
        {[
          { icon: '🧠', text: '智能复习计划，科学记忆' },
          { icon: '📊', text: '知识图谱，可视化掌握度' },
          { icon: '✍️', text: '题库练习，自动判分解析' },
          { icon: '🤖', text: 'AI问答，随时随地解惑' },
        ].map((f, i) => (
          <div
            key={i}
            className="flex items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-sm border border-white/60"
          >
            <div className="w-8 h-8 flex items-center justify-center text-2xl shrink-0">{f.icon}</div>
            <span className="text-sm text-gray-600 font-medium">{f.text}</span>
          </div>
        ))}
      </div>

      {/* Login Button */}
      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={handleWechatLogin}
          disabled={loading}
          className="w-full bg-[#07c160] hover:bg-[#06ae56] text-white font-semibold py-4 rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 active:scale-[0.98] disabled:opacity-60 transition-all"
        >
          {loading ? (
            <span className="inline-block w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.134 0 .24-.11.24-.245 0-.06-.024-.12-.04-.178l-.325-1.233a.492.492 0 0 1 .177-.554C23.028 18.48 24 16.81 24 14.943c0-3.024-2.81-5.746-6.062-6.085z"/>
              </svg>
              微信一键登录
            </>
          )}
        </button>

        <button
          onClick={handleWechatLogin}
          className="w-full bg-white text-text-secondary font-medium py-4 rounded-2xl text-base border border-gray-200 shadow-lg active:scale-[0.98] transition-all"
        >
          游客体验
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-8 text-center px-4">
        登录即表示同意《用户协议》和《隐私政策》
      </p>
    </div>
  );
}
