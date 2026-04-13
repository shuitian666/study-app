import { useState } from 'react';
import { ArrowRight, BrainCircuit, LibraryBig, ShieldCheck, Sparkles } from 'lucide-react';
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
      className="min-h-screen relative overflow-y-auto"
      style={{
        background: 'linear-gradient(180deg, #f5f7fb 0%, #eef2f8 52%, #f8fafc 100%)',
        fontFamily: '"Sora", "Plus Jakarta Sans", "PingFang SC", "Noto Sans SC", sans-serif',
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-12 top-12 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(222, 224, 255, 0.9)' }} />
        <div className="absolute right-[-32px] top-28 h-44 w-44 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(255, 223, 160, 0.65)' }} />
        <div className="absolute left-1/3 bottom-28 h-36 w-36 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(253, 214, 255, 0.55)' }} />
      </div>

      <div className="relative px-6 pt-8 pb-10 flex min-h-screen flex-col">
        <div
          className="rounded-[32px] border px-6 pb-6 pt-7"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.84))',
            borderColor: 'rgba(255,255,255,0.75)',
            boxShadow: '0 24px 60px -38px rgba(15, 23, 42, 0.35)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-[18px] flex items-center justify-center shadow-[0_12px_30px_-16px_rgba(36,56,156,0.65)]"
              style={{ background: 'linear-gradient(135deg, #24389c, #4f46e5)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#24389c', fontFamily: '"Plus Jakarta Sans", "Noto Sans SC", sans-serif', lineHeight: 1.15 }}>
                The Fluid Scholar
              </h1>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                focused learning workspace
              </p>
            </div>
          </div>

          <div className="mt-8">
            <span
              className="inline-flex rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em]"
              style={{ backgroundColor: '#eef2ff', color: '#3748b3' }}
            >
              scholar mode
            </span>
            <h2 style={{ fontSize: '2.35rem', fontWeight: 800, color: '#111827', fontFamily: '"Plus Jakarta Sans", "Noto Sans SC", sans-serif', lineHeight: 1.05, marginTop: '14px' }}>
              把学习空间
              <br />
              收拾得更聪明一点
            </h2>
            <p style={{ fontSize: '0.95rem', color: '#4b5563', lineHeight: 1.75, marginTop: '14px', maxWidth: '26rem' }}>
              用更安静、更清晰的界面管理知识点、安排复习节奏，再让 AI 在你卡住的时候补上解释和练习。
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: '#f8fafc', border: '1px solid rgba(226,232,240,0.8)' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>节奏</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', marginTop: '2px' }}>间隔复习</div>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: '#f8fafc', border: '1px solid rgba(226,232,240,0.8)' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>方式</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', marginTop: '2px' }}>AI 陪练</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
        {[
          {
            icon: <BrainCircuit size={20} strokeWidth={2.1} color="#24389c" />,
            bg: '#e8edff',
            title: '智能复习计划',
            desc: '把“该学什么、什么时候复习”提前排好。',
          },
          {
            icon: <Sparkles size={20} strokeWidth={2.1} color="#7a2bbf" />,
            bg: '#f7e8ff',
            title: 'AI 智能辅导',
            desc: '问答、解释、出题放在一个连续的学习流程里。',
          },
          {
            icon: <LibraryBig size={20} strokeWidth={2.1} color="#8a5a00" />,
            bg: '#fff1cc',
            title: '知识库整理',
            desc: '把零散知识点收成清楚、能回看的结构。',
          },
          {
            icon: <ShieldCheck size={20} strokeWidth={2.1} color="#0f766e" />,
            bg: '#dff7f4',
            title: '轻量开始',
            desc: '先游客体验，确认顺手再决定怎么用。',
          },
        ].map((f, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-4 rounded-[24px] border"
            style={{
              backgroundColor: 'rgba(255,255,255,0.74)',
              borderColor: 'rgba(255,255,255,0.85)',
              boxShadow: '0 18px 35px -28px rgba(15, 23, 42, 0.28)',
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

        <div className="mt-auto pt-8 space-y-3">
        <button
          onClick={handleWechatLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 active:scale-[0.985] transition-all disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #07c160, #06a653)',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '1rem',
            padding: '16px',
            borderRadius: '3rem',
            boxShadow: '0 18px 36px -22px rgba(7, 193, 96, 0.6)',
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
              <ArrowRight size={18} />
            </>
          )}
        </button>

        <button
          onClick={handleGuestLogin}
          className="w-full active:scale-[0.98] transition-all"
          style={{
            backgroundColor: 'rgba(255,255,255,0.72)',
            color: '#374151',
            fontWeight: 500,
            fontSize: '0.9375rem',
            padding: '16px',
            borderRadius: '3rem',
            border: '1px solid rgba(255,255,255,0.9)',
          }}
        >
          游客体验 / 立即开始
        </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#6b7280', paddingTop: '18px', paddingBottom: '10px' }}>
          登录即表示同意《用户协议》和《隐私政策》
        </p>
      </div>
    </div>
  );
}
