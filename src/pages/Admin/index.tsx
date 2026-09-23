import { useEffect, useState } from 'react';
import { Mail, Search, ShieldCheck, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/ui/Common';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';
import {
  adaptiveAlpha,
  getAdaptiveBadge,
  getAdaptiveButton,
  getAdaptiveInput,
  getAdaptivePageBackground,
  getAdaptiveSoftSurface,
  getAdaptiveSurface,
} from '@/utils/adaptiveTheme';
import {
  adminGrantRole,
  adminRevokeRole,
  adminSearchUsers,
  adminSendMail,
  fetchAdminStatus,
  type AdminStatus,
  type AdminUserSummary,
} from '@/services/aiClient';
import type { MailAttachment, MailAttachmentType, UserRole } from '@/types';

const roleLabels: Record<UserRole, string> = {
  user: '普通用户',
  sub_admin: '次级管理员',
  admin: '管理员',
  super_admin: '超级管理员',
};

const rewardTypeLabels: Record<MailAttachmentType, string> = {
  coin: '星币',
  experience: '经验',
  regular_ticket: '普通抽奖券',
  up_ticket: 'UP 抽奖券',
  makeup_card: '补签卡',
  title: '称号',
  avatar_frame: '头像框',
  background: '背景',
  theme: '主题',
  vip: 'VIP 卡',
};

export default function AdminPage() {
  const { userState, navigate } = useUser();
  const { theme } = useTheme();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mailTitle, setMailTitle] = useState('');
  const [mailContent, setMailContent] = useState('');
  const [includeReward, setIncludeReward] = useState(false);
  const [rewardType, setRewardType] = useState<MailAttachmentType>('coin');
  const [rewardName, setRewardName] = useState('');
  const [rewardQuantity, setRewardQuantity] = useState('');
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);

  const permissions = adminStatus?.permissions ?? [];
  const currentRole = adminStatus?.role ?? userState.user?.role ?? 'user';
  const canManageRoles = permissions.includes('admin.roles.manage');
  const canSendMail = permissions.includes('mail.send');
  const canGrantReward = permissions.includes('reward.grant');

  const pageStyle = getAdaptivePageBackground(theme);
  const cardStyle = getAdaptiveSurface(theme, 'raised');
  const strongCardStyle = getAdaptiveSurface(theme, 'strong');
  const softStyle = getAdaptiveSoftSurface(theme);
  const inputStyle = getAdaptiveInput(theme);
  const primaryButtonStyle = getAdaptiveButton(theme, 'primary');
  const ghostButtonStyle = getAdaptiveButton(theme, 'ghost');
  const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2';

  useEffect(() => {
    let cancelled = false;
    fetchAdminStatus()
      .then(status => {
        if (cancelled) return;
        setAdminStatus(status);
        if (status.permissions.length === 0) navigate('home');
      })
      .catch(() => navigate('home'));
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const search = async () => {
    if (!canManageRoles) return;
    setLoading(true);
    setError('');
    try {
      const response = await adminSearchUsers(query);
      setUsers(response.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : '用户搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const setRole = async (userId: string, role: UserRole) => {
    setError('');
    try {
      const response = role === 'user'
        ? await adminRevokeRole(userId)
        : await adminGrantRole(userId, role);
      setUsers(current => current.map(user => user.id === response.user.id ? response.user : user));
      setMessage('角色已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '角色更新失败');
    }
  };

  const sendMail = async () => {
    if (!canSendMail) return;
    setError('');
    setMessage('');
    const attachments: MailAttachment[] = canGrantReward && includeReward
      ? [{
          type: rewardType,
          name: rewardName.trim() || rewardTypeLabels[rewardType],
          quantity: Math.max(1, Math.round(Number(rewardQuantity) || 1)),
          claimed: false,
        }]
      : [];
    try {
      const response = await adminSendMail({
        title: mailTitle,
        content: mailContent,
        audience: { type: 'all' },
        attachments,
      });
      setMessage(`邮件已发送给 ${response.recipientCount} 个用户`);
      setMailTitle('');
      setMailContent('');
      setIncludeReward(false);
      setRewardName('');
      setRewardQuantity('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '邮件发送失败');
    }
  };

  return (
    <div className="min-h-full" style={pageStyle}>
      <PageHeader title="管理员中心" onBack={() => navigate('profile')} />
      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-4 p-4 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <section className="rounded-2xl border p-4 shadow-sm" style={strongCardStyle}>
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
              style={{ ...getAdaptiveBadge(theme, 'primary'), color: theme.primary }}
            >
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold" style={{ color: theme.textPrimary }}>当前权限</h2>
              <p className="text-xs" style={{ color: theme.textMuted }}>{roleLabels[currentRole]}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {permissions.map(permission => (
              <span key={permission} className="rounded-full border px-2 py-1 text-[11px] font-semibold" style={getAdaptiveBadge(theme, 'primary')}>
                {permission}
              </span>
            ))}
            {permissions.length === 0 && (
              <span className="text-xs" style={{ color: theme.textMuted }}>暂无管理权限</span>
            )}
          </div>
        </section>

        {canManageRoles && (
          <section className="rounded-2xl border p-4 shadow-sm lg:row-span-2" style={cardStyle}>
            <div className="flex items-center gap-2">
              <UserCog size={20} style={{ color: theme.primary }} />
              <h2 className="text-base font-bold" style={{ color: theme.textPrimary }}>角色管理</h2>
            </div>
            <div className="mt-3 flex gap-2 max-[360px]:flex-col">
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm placeholder:text-text-muted ${focusClass}`}
                style={inputStyle}
                placeholder="搜索邮箱或昵称"
              />
              <button
                type="button"
                onClick={() => void search()}
                disabled={loading}
                className={`inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}
                style={primaryButtonStyle}
              >
                <Search size={16} />
                {loading ? '搜索中' : '搜索'}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {users.map(user => (
                <article key={user.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3" style={softStyle}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold" style={{ color: theme.textPrimary }}>{user.nickname}</p>
                    <p className="truncate text-xs" style={{ color: theme.textMuted }}>{user.phone} · {roleLabels[user.role ?? 'user']}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['user', 'sub_admin', 'admin'] as UserRole[]).map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => void setRole(user.id, role)}
                        disabled={user.role === 'super_admin'}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${focusClass}`}
                        style={(user.role ?? 'user') === role ? primaryButtonStyle : ghostButtonStyle}
                      >
                        {roleLabels[role]}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
              {!loading && users.length === 0 && (
                <div className="rounded-xl border px-3 py-4 text-center text-sm" style={{ ...softStyle, color: theme.textMuted }}>
                  输入邮箱或昵称后搜索用户
                </div>
              )}
            </div>
          </section>
        )}

        {canSendMail && (
          <section className="rounded-2xl border p-4 shadow-sm" style={cardStyle}>
            <div className="flex items-center gap-2">
              <Mail size={20} style={{ color: theme.accent || theme.primary }} />
              <h2 className="text-base font-bold" style={{ color: theme.textPrimary }}>全站系统邮件</h2>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <input
                value={mailTitle}
                onChange={event => setMailTitle(event.target.value)}
                className={`rounded-xl border px-3 py-2 text-sm placeholder:text-text-muted ${focusClass}`}
                style={inputStyle}
                placeholder="邮件标题"
              />
              <textarea
                value={mailContent}
                onChange={event => setMailContent(event.target.value)}
                rows={5}
                className={`rounded-xl border px-3 py-2 text-sm placeholder:text-text-muted ${focusClass}`}
                style={inputStyle}
                placeholder="邮件正文"
              />
              {canGrantReward && (
                <div className="space-y-2 rounded-xl border p-3" style={softStyle}>
                  <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: theme.textSecondary }}>
                    <input
                      type="checkbox"
                      checked={includeReward}
                      onChange={event => setIncludeReward(event.target.checked)}
                      className={`h-4 w-4 rounded ${focusClass}`}
                      style={{ accentColor: theme.primary }}
                    />
                    附带奖励
                  </label>
                  <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-[minmax(120px,180px)_minmax(0,1fr)_minmax(88px,120px)]">
                    <select
                      value={rewardType}
                      onChange={event => setRewardType(event.target.value as MailAttachmentType)}
                      disabled={!includeReward}
                      className={`min-w-0 rounded-xl border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}
                      style={inputStyle}
                    >
                      {Object.entries(rewardTypeLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                    </select>
                    <input
                      value={rewardName}
                      onChange={event => setRewardName(event.target.value)}
                      disabled={!includeReward}
                      className={`min-w-0 rounded-xl border px-3 py-2 text-sm placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}
                      style={inputStyle}
                      placeholder="附件名称，可留空"
                    />
                    <input
                      type="number"
                      min="1"
                      value={rewardQuantity}
                      onChange={event => setRewardQuantity(event.target.value)}
                      disabled={!includeReward}
                      className={`min-w-0 rounded-xl border px-3 py-2 text-sm placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}
                      style={inputStyle}
                      placeholder="数量"
                    />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => void sendMail()}
                disabled={!mailTitle.trim() || !mailContent.trim()}
                className={`rounded-xl border px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}
                style={primaryButtonStyle}
              >
                发送给全体用户
              </button>
            </div>
          </section>
        )}

        {(message || error) && (
          <div className="space-y-2 lg:col-span-2">
            {message && (
              <p className="rounded-xl border px-3 py-2 text-sm font-semibold" style={getAdaptiveBadge(theme, 'success')}>
                {message}
              </p>
            )}
            {error && (
              <p className="rounded-xl border px-3 py-2 text-sm font-semibold" style={getAdaptiveBadge(theme, 'danger')}>
                {error}
              </p>
            )}
          </div>
        )}
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 h-20"
          style={{ background: `linear-gradient(180deg, transparent, ${adaptiveAlpha(theme.bg, 0.56, 'rgba(0,0,0,0.18)')})` }}
        />
      </main>
    </div>
  );
}
