import { useEffect, useState } from 'react';
import { Mail, Search, ShieldCheck, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/ui/Common';
import { useUser } from '@/store/UserContext';
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
    <div className="min-h-full bg-slate-50">
      <PageHeader title="管理员中心" onBack={() => navigate('profile')} />
      <main className="mx-auto max-w-5xl space-y-4 p-4 pb-24">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-cyan-700" />
            <div>
              <h2 className="font-bold text-slate-950">当前权限</h2>
              <p className="text-xs text-slate-500">{roleLabels[currentRole]}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {permissions.map(permission => (
              <span key={permission} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{permission}</span>
            ))}
          </div>
        </section>

        {canManageRoles && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <UserCog size={20} className="text-indigo-700" />
              <h2 className="font-bold text-slate-950">角色管理</h2>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="搜索邮箱或昵称"
              />
              <button type="button" onClick={() => void search()} disabled={loading} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                <Search size={16} />
                搜索
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {users.map(user => (
                <article key={user.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{user.nickname}</p>
                    <p className="text-xs text-slate-500">{user.phone} · {roleLabels[user.role ?? 'user']}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['user', 'sub_admin', 'admin'] as UserRole[]).map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => void setRole(user.id, role)}
                        disabled={user.role === 'super_admin'}
                        className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
                      >
                        {roleLabels[role]}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {canSendMail && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Mail size={20} className="text-emerald-700" />
              <h2 className="font-bold text-slate-950">全站系统邮件</h2>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <input value={mailTitle} onChange={event => setMailTitle(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="邮件标题" />
              <textarea value={mailContent} onChange={event => setMailContent(event.target.value)} rows={5} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="邮件正文" />
              {canGrantReward && (
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeReward}
                      onChange={event => setIncludeReward(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    附带奖励
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr_120px]">
                    <select
                      value={rewardType}
                      onChange={event => setRewardType(event.target.value as MailAttachmentType)}
                      disabled={!includeReward}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      {Object.entries(rewardTypeLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                    </select>
                    <input
                      value={rewardName}
                      onChange={event => setRewardName(event.target.value)}
                      disabled={!includeReward}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                      placeholder="附件名称，可留空"
                    />
                    <input
                      type="number"
                      min="1"
                      value={rewardQuantity}
                      onChange={event => setRewardQuantity(event.target.value)}
                      disabled={!includeReward}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                      placeholder="数量"
                    />
                  </div>
                </div>
              )}
              <button type="button" onClick={() => void sendMail()} disabled={!mailTitle.trim() || !mailContent.trim()} className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                发送给全体用户
              </button>
            </div>
          </section>
        )}

        {message && <p className="text-sm font-semibold text-emerald-700">{message}</p>}
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      </main>
    </div>
  );
}
