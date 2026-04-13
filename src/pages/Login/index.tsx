import { useState } from 'react';
import { useUser } from '@/store/UserContext';

export default function LoginPage() {
  const { userDispatch, navigate } = useUser();
  const [loading, setLoading] = useState(false);

  const handleGuestLogin = () => {
    userDispatch({ type: 'LOGIN', payload: { id: 'guest', nickname: '游客' } });
    navigate('home');
  };

  const handleWechatLogin = () => {
    setLoading(true);
    setTimeout(() => {
      handleGuestLogin();
      setLoading(false);
    }, 800);
  };

  return (
    <div
      className="min-h-screen flex flex-col overflow-y-auto"
      style={{ backgroundColor: '#f8f9fa', fontFamily: 'Inter, "PingFang SC", "Noto Sans SC", sans-serif' }}
    >
      {/* Top Branding */}
      <div className="px-8 pt-16 pb-8">
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: '#24389c' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#24389c', fontFamily: '"Plus Jakarta Sans", "Noto Sans SC", sans-serif', lineHeight: 1.2 }}>
              The Fluid Scholar
            </h1>
            <p style={{ fontSize: '0.75rem', color: '#757684', marginTop: '2px' }}>AI 驱动的知识管理平台</p>
          </div>
        </div>

        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#191c1d', fontFamily: '"Plus Jakarta Sans", "Noto Sans SC", sans-serif', lineHeight: 1.2, marginBottom: '8px' }}>
          开启你的<br />学习之旅
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#454652', lineHeight: 1.6 }}>
          科学记忆，智能复习，AI 辅导随时可用
        </p>
      </div>

      {/* Feature Cards */}
      <div className="px-6 space-y-3 flex-1">
        {[
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#24389c" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ),
            bg: '#dee0ff',
            title: '智能复习计划',
            desc: '艾宾浩斯遗忘曲线，科学安排复习',
          },
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#73008e" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            ),
            bg: '#fdd6ff',
            title: 'AI 智能辅导',
            desc: '随问随答，深度解析知识点',
          },
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#795900" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            ),
            bg: '#ffdfa0',
            title: '可视化知识图谱',
            desc: '清晰展示掌握度，一目了然',
          },
        ].map((f, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-4"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: f.bg }}
            >
              {f.icon}
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#191c1d' }}>{f.title}</div>
              <div style={{ fontSize: '0.75rem', color: '#454652', marginTop: '2px' }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Login Buttons */}
      <div className="px-6 pb-12 pt-8 space-y-3">
        <button
          onClick={handleWechatLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
          style={{
            backgroundColor: '#07c160',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '1rem',
            padding: '16px',
            borderRadius: '3rem',
          }}
        >
          {loading ? (
            <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.134 0 .24-.11.24-.245 0-.06-.024-.12-.04-.178l-.325-1.233a.492.492 0 0 1 .177-.554C23.028 18.48 24 16.81 24 14.943c0-3.024-2.81-5.746-6.062-6.085z"/>
              </svg>
              微信一键登录
            </>
          )}
        </button>

        <button
          onClick={handleGuestLogin}
          className="w-full active:scale-[0.98] transition-all"
          style={{
            backgroundColor: '#ffffff',
            color: '#454652',
            fontWeight: 500,
            fontSize: '0.9375rem',
            padding: '16px',
            borderRadius: '3rem',
            border: '1px solid rgba(197, 197, 212, 0.5)',
          }}
        >
          游客体验 / 立即开始
        </button>
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#757684', paddingBottom: '24px', paddingLeft: '24px', paddingRight: '24px' }}>
        登录即表示同意《用户协议》和《隐私政策》
      </p>
    </div>
  );
}
