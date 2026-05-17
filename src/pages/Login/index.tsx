import { useState } from 'react';
import { BookOpen, Lock, Phone, Sparkles } from 'lucide-react';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';
import { useGame } from '@/store/GameContext';
import { getAdaptiveButton, getAdaptivePageBackground, getAdaptiveSurface, isDarkTheme } from '@/utils/adaptiveTheme';
import { loginWithPassword, registerWithPassword, sendEmailCode } from '@/services/aiClient';
import { applyServerAccountPayload } from '@/store/accountSync';

export default function LoginPage() {
  const { userDispatch } = useUser();
  const { gameDispatch } = useGame();
  const { theme } = useTheme();
  const dark = isDarkTheme(theme);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('请输入有效邮箱');
      return;
    }
    if (password.length < 8) {
      setError('密码至少 8 位');
      return;
    }

    setLoading(true);
    try {
      const payload = mode === 'login'
        ? await loginWithPassword(email.trim(), password)
        : await registerWithPassword(email.trim(), password, code.trim());
      applyServerAccountPayload(payload, userDispatch, gameDispatch);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('请输入有效邮箱');
      return;
    }
    setSendingCode(true);
    try {
      await sendEmailCode(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSendingCode(false);
    }
  };

  const features = [
    { icon: 'AI', text: '服务端 AI 代理，平台密钥不进前端' },
    { icon: 'KEY', text: '支持用户自定义 OpenAI 兼容 API' },
    { icon: 'DB', text: '账号、资产和 AI 配置存服务器' },
  ];

  return (
    <div className="min-h-screen overflow-y-auto px-6 py-10" style={getAdaptivePageBackground(theme)}>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-sm flex-col justify-center">
        <div className="mb-8 flex flex-col items-center">
          <div
            className="mb-6 flex h-24 w-24 items-center justify-center rounded-[28px] shadow-xl"
            style={{
              background: dark
                ? `linear-gradient(135deg, ${theme.surfaceContainerHigh || '#263652'} 0%, ${theme.primaryFixed || '#254a74'} 100%)`
                : `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryLight} 52%, ${theme.accent} 100%)`,
              boxShadow: dark ? '0 24px 60px rgba(0,0,0,0.32)' : `0 18px 38px ${theme.primary}24`,
            }}
          >
            <BookOpen size={50} style={{ color: dark ? theme.primaryLight : '#ffffff' }} />
          </div>
          <h1 className="mb-2 text-3xl font-bold" style={{ color: theme.textPrimary }}>智学助手</h1>
          <p className="flex items-center gap-1.5 text-base" style={{ color: theme.textSecondary }}>
            <Sparkles size={16} style={{ color: theme.primary }} />
            <span>登录后同步你的账号资产和 AI 配置</span>
          </p>
        </div>

        <div className="mb-6 w-full space-y-3">
          {features.map(feature => (
            <div key={feature.text} className="flex items-center gap-4 rounded-2xl border px-5 py-4 backdrop-blur-xl" style={getAdaptiveSurface(theme, 'raised')}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold" style={{ backgroundColor: `${theme.primary}18`, color: theme.primary }}>
                {feature.icon}
              </div>
              <span className="text-sm font-semibold" style={{ color: theme.textSecondary }}>{feature.text}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border p-4 space-y-3" style={getAdaptiveSurface(theme, 'raised')}>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/5 p-1">
            <button
              onClick={() => setMode('login')}
              className={`rounded-lg py-2 text-sm font-semibold ${mode === 'login' ? 'bg-white shadow-sm' : ''}`}
              style={{ color: theme.textPrimary }}
            >
              登录
            </button>
            <button
              onClick={() => setMode('register')}
              className={`rounded-lg py-2 text-sm font-semibold ${mode === 'register' ? 'bg-white shadow-sm' : ''}`}
              style={{ color: theme.textPrimary }}
            >
              注册
            </button>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs" style={{ color: theme.textMuted }}>邮箱</span>
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: theme.border }}>
              <Phone size={16} style={{ color: theme.textMuted }} />
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                inputMode="email"
                placeholder="your@email.com"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                style={{ color: theme.textPrimary }}
              />
            </div>
          </label>

          {mode === 'register' && (
            <label className="block">
              <span className="mb-1 block text-xs" style={{ color: theme.textMuted }}>邮箱验证码</span>
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: theme.border }}>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  inputMode="numeric"
                  placeholder="6 位验证码"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  style={{ color: theme.textPrimary }}
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sendingCode}
                  className="text-xs font-semibold disabled:opacity-50"
                  style={{ color: theme.primary }}
                >
                  {sendingCode ? '发送中' : '发送验证码'}
                </button>
              </div>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs" style={{ color: theme.textMuted }}>密码</span>
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: theme.border }}>
              <Lock size={16} style={{ color: theme.textMuted }} />
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                placeholder="至少 8 位"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                style={{ color: theme.textPrimary }}
                onKeyDown={e => { if (e.key === 'Enter') void handleSubmit(); }}
              />
            </div>
          </label>

          {error && <div className="text-xs text-red-600">{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-2xl py-3 text-base font-bold transition-all active:scale-[0.98] disabled:opacity-60"
            style={getAdaptiveButton(theme, 'primary')}
          >
            {loading ? '处理中...' : mode === 'login' ? '登录' : '创建账号'}
          </button>
        </div>
      </div>
    </div>
  );
}
