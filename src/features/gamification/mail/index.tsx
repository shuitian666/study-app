import { useState } from 'react';
import { useUser } from '@/store/UserContext';
import { useGame } from '@/store/GameContext';
import { useTheme } from '@/store/ThemeContext';
import { PageHeader } from '@/components/ui/Common';
import {
  Mail as MailIcon,
  Gift,
  Coins,
  Ticket,
  Crown,
  CircleDot,
  CheckCircle,
  Clock,
  AlertTriangle,
  Sparkles,
  X,
} from 'lucide-react';
import { accountClaimMailAttachment, accountMarkMailRead } from '@/services/aiClient';
import { applyServerAccountPayload, isUnauthorizedError, logoutOnUnauthorized } from '@/store/accountSync';
import {
  adaptiveAlpha,
  getAdaptiveBadge,
  getAdaptiveButton,
  getAdaptivePageBackground,
  getAdaptiveSoftSurface,
  getAdaptiveSurface,
} from '@/utils/adaptiveTheme';

type MailFilter = 'all' | 'unread' | 'claimable';

export default function MailPage() {
  const { userState, userDispatch, navigate } = useUser();
  const { gameDispatch } = useGame();
  const { theme } = useTheme();
  const [selectedMail, setSelectedMail] = useState<string | null>(null);
  const [filter, setFilter] = useState<MailFilter>('all');
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [claimError, setClaimError] = useState('');

  const mails = userState.mail.mails;
  const currentVersion = userState.mail.currentVersion;
  const pageStyle = getAdaptivePageBackground(theme);
  const cardStyle = getAdaptiveSurface(theme, 'raised');
  const strongCardStyle = getAdaptiveSurface(theme, 'strong');
  const softStyle = getAdaptiveSoftSurface(theme);
  const primaryButtonStyle = getAdaptiveButton(theme, 'primary');
  const ghostButtonStyle = getAdaptiveButton(theme, 'ghost');
  const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2';

  const isExpired = (deadline: string) => new Date(deadline) < new Date();
  const isClaimable = (mail: typeof mails[number]) => (
    !isExpired(mail.claimDeadline) && !mail.claimed && mail.attachments.some(attachment => !attachment.claimed)
  );

  const filteredMails = mails.filter(mail => {
    if (filter === 'unread') return !mail.read;
    if (filter === 'claimable') return isClaimable(mail);
    return true;
  });

  const unreadCount = mails.filter(m => !m.read).length;
  const claimableCount = mails.filter(isClaimable).length;

  const handleOpenMail = async (mailId: string) => {
    setClaimError('');
    if (!mails.find(m => m.id === mailId)?.read) {
      userDispatch({ type: 'MARK_MAIL_READ', payload: mailId });
      try {
        const response = await accountMarkMailRead(mailId);
        userDispatch({ type: 'SET_MAILS', payload: response.mail.mails });
      } catch (err) {
        logoutOnUnauthorized(err, userDispatch);
      }
    }
    setSelectedMail(mailId);
  };

  const handleClaimAttachment = async (mailId: string, attachmentIndex: number) => {
    if (claimingKey) return;
    const mail = mails.find(item => item.id === mailId);
    const attachment = mail?.attachments[attachmentIndex];
    const attachmentKey = attachment?.id ?? attachmentIndex;
    setClaimingKey(`${mailId}:${attachmentKey}`);
    setClaimError('');
    try {
      const payload = await accountClaimMailAttachment(mailId, attachmentKey);
      applyServerAccountPayload(payload, userDispatch, gameDispatch);
    } catch (err) {
      logoutOnUnauthorized(err, userDispatch);
      if (!isUnauthorizedError(err)) {
        setClaimError(err instanceof Error ? err.message : '领取失败，请稍后重试');
      }
    } finally {
      setClaimingKey(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const getAttachmentIcon = (type: string) => {
    const iconStyle = { color: theme.primary };
    switch (type) {
      case 'makeup_card':
      case 'regular_ticket':
      case 'up_ticket':
        return <Ticket size={14} style={iconStyle} />;
      case 'avatar_frame':
      case 'vip':
        return <Crown size={14} style={iconStyle} />;
      case 'coin':
        return <Coins size={14} style={{ color: theme.warning }} />;
      case 'experience':
        return <Sparkles size={14} style={{ color: theme.accent }} />;
      default:
        return <Gift size={14} style={iconStyle} />;
    }
  };

  const attachmentBadgeStyle = (claimed: boolean, expired: boolean) => (
    claimed ? getAdaptiveBadge(theme, 'success') : expired ? getAdaptiveBadge(theme, 'danger') : getAdaptiveBadge(theme, 'warning')
  );

  return (
    <div className="page-scroll min-h-full pb-4" style={pageStyle}>
      <PageHeader
        title="邮件"
        onBack={() => navigate('home')}
      />

      <div className="space-y-4 px-4 pt-3">
        <section className="rounded-2xl border p-4 shadow-sm" style={strongCardStyle}>
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
              style={{ ...getAdaptiveBadge(theme, 'primary'), color: theme.primary }}
            >
              <MailIcon size={24} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold" style={{ color: theme.textPrimary }}>系统邮件</h2>
              <p className="text-sm" style={{ color: theme.textSecondary }}>管理员发放的奖励邮件</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-center gap-1 rounded-xl border p-2 text-center" style={softStyle}>
              <CircleDot size={14} style={{ color: theme.primary }} />
              <span className="text-sm font-semibold" style={{ color: theme.textPrimary }}>{unreadCount} 未读</span>
            </div>
            <div className="flex items-center justify-center gap-1 rounded-xl border p-2 text-center" style={softStyle}>
              <Gift size={14} style={{ color: theme.warning }} />
              <span className="text-sm font-semibold" style={{ color: theme.textPrimary }}>{claimableCount} 可领取</span>
            </div>
          </div>
        </section>

        <div className="flex gap-2 rounded-2xl border p-1" style={cardStyle}>
          {[
            { key: 'all', label: '全部', count: mails.length },
            { key: 'unread', label: '未读', count: unreadCount },
            { key: 'claimable', label: '可领取', count: claimableCount },
          ].map(tab => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key as MailFilter)}
                className={`flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition ${focusClass}`}
                style={active ? primaryButtonStyle : ghostButtonStyle}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px]"
                    style={active
                      ? { backgroundColor: 'rgba(255,255,255,0.20)', color: 'inherit' }
                      : getAdaptiveBadge(theme, 'primary')}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {filteredMails.length === 0 ? (
          <div className="rounded-2xl border px-6 py-12 text-center" style={cardStyle}>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border" style={softStyle}>
              <MailIcon size={40} style={{ color: theme.textMuted }} />
            </div>
            <p className="mb-1 font-medium" style={{ color: theme.textSecondary }}>
              {filter === 'all' ? '暂无邮件' : filter === 'unread' ? '没有未读邮件' : '没有可领取的邮件'}
            </p>
            <p className="text-sm" style={{ color: theme.textMuted }}>关注后续活动，获取更多奖励</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMails.map(mail => {
              const expired = isExpired(mail.claimDeadline);
              const claimable = isClaimable(mail);

              return (
                <button
                  key={mail.id}
                  type="button"
                  onClick={() => void handleOpenMail(mail.id)}
                  className={`w-full rounded-2xl border p-4 text-left shadow-sm transition active:scale-[0.99] ${focusClass} ${expired ? 'opacity-70' : ''}`}
                  style={{
                    ...cardStyle,
                    borderColor: !mail.read ? adaptiveAlpha(theme.primary, 0.54, String(cardStyle.borderColor)) : cardStyle.borderColor,
                    boxShadow: !mail.read ? `0 14px 32px ${adaptiveAlpha(theme.primary, 0.12, 'rgba(15,23,42,0.12)')}` : undefined,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                      style={mail.read ? softStyle : getAdaptiveBadge(theme, 'primary')}
                    >
                      <MailIcon size={18} style={{ color: mail.read ? theme.textMuted : theme.primary }} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <h4 className="truncate text-sm font-semibold" style={{ color: mail.read ? theme.textSecondary : theme.textPrimary }}>
                          {mail.title}
                        </h4>
                        {!mail.read && (
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: theme.primary }} />
                        )}
                      </div>

                      <p className="mb-2 text-xs" style={{ color: theme.textMuted }}>{mail.sender} · {formatDate(mail.sentAt)}</p>

                      <div className="flex flex-wrap items-center gap-2">
                        {mail.attachments.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold" style={attachmentBadgeStyle(mail.claimed, expired)}>
                            {mail.claimed ? (
                              <><CheckCircle size={12} /> 已领取</>
                            ) : expired ? (
                              <><AlertTriangle size={12} /> 已过期</>
                            ) : (
                              <><Gift size={12} /> {mail.attachments.length}个附件</>
                            )}
                          </span>
                        )}

                        {expired && (
                          <span className="inline-flex items-center gap-1 text-xs" style={{ color: theme.danger }}>
                            <Clock size={12} />
                            {new Date(mail.claimDeadline).toLocaleDateString('zh-CN')} 到期
                          </span>
                        )}
                        {claimable && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: theme.warning }}>
                            <Sparkles size={12} />
                            待领取
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="rounded-xl border px-3 py-2 text-center text-xs" style={{ ...softStyle, color: theme.textMuted }}>
          当前版本: v{currentVersion} · 更新后邮件附件将无法领取
        </div>
      </div>

      {selectedMail && (() => {
        const mail = mails.find(m => m.id === selectedMail);
        if (!mail) return null;
        const expired = isExpired(mail.claimDeadline);

        return (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedMail(null)}
          >
            <div
              className="w-full max-w-lg overflow-hidden rounded-t-3xl border shadow-2xl"
              style={{
                ...getAdaptiveSurface(theme, 'strong'),
                maxHeight: '80vh',
              }}
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b p-4" style={{ borderColor: cardStyle.borderColor }}>
                <h3 className="font-bold" style={{ color: theme.textPrimary }}>邮件详情</h3>
                <button
                  type="button"
                  onClick={() => setSelectedMail(null)}
                  aria-label="关闭邮件详情"
                  className={`flex h-9 w-9 items-center justify-center rounded-full border ${focusClass}`}
                  style={ghostButtonStyle}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border" style={getAdaptiveBadge(theme, 'primary')}>
                    <MailIcon size={17} style={{ color: theme.primary }} />
                  </span>
                  <div className="min-w-0">
                    <h4 className="truncate font-medium" style={{ color: theme.textPrimary }}>{mail.title}</h4>
                    <p className="text-xs" style={{ color: theme.textMuted }}>{mail.sender} · {new Date(mail.sentAt).toLocaleString('zh-CN')}</p>
                  </div>
                </div>

                <div className="mb-4 rounded-xl border p-3" style={softStyle}>
                  <p className="whitespace-pre-wrap text-sm leading-6" style={{ color: theme.textPrimary }}>{mail.content}</p>
                </div>
                {claimError && (
                  <p className="mb-3 rounded-lg border px-3 py-2 text-xs font-medium" style={getAdaptiveBadge(theme, 'danger')}>{claimError}</p>
                )}

                {mail.attachments.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="flex items-center gap-1 text-xs font-medium" style={{ color: theme.textSecondary }}>
                      <Gift size={12} /> 附件
                    </h5>

                    {mail.attachments.map((att, idx) => {
                      const attachmentKey = att.id ?? idx;
                      const itemClaimingKey = `${mail.id}:${attachmentKey}`;
                      const isClaiming = claimingKey === itemClaimingKey;

                      return (
                        <div
                          key={attachmentKey}
                          className="flex items-center justify-between gap-3 rounded-xl border p-3"
                          style={attachmentBadgeStyle(Boolean(att.claimed), expired)}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {getAttachmentIcon(att.type)}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium" style={{ color: theme.textPrimary }}>{att.name}</p>
                              <p className="text-xs" style={{ color: theme.textMuted }}>x{att.quantity}</p>
                            </div>
                          </div>

                          {att.claimed ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold" style={{ color: theme.success }}>
                              <CheckCircle size={12} /> 已领取
                            </span>
                          ) : expired ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold" style={{ color: theme.danger }}>
                              <AlertTriangle size={12} /> 已过期
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleClaimAttachment(mail.id, idx)}
                              disabled={claimingKey !== null}
                              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}
                              style={primaryButtonStyle}
                            >
                              {isClaiming ? '领取中' : '领取'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 rounded-xl border p-3" style={getAdaptiveBadge(theme, expired ? 'danger' : 'warning')}>
                  <p className="flex items-center gap-1 text-xs font-semibold">
                    <Clock size={12} />
                    领取截止日期: {new Date(mail.claimDeadline).toLocaleDateString('zh-CN')}
                  </p>
                  <p className="mt-1 text-[10px]" style={{ color: theme.textSecondary }}>
                    版本更新后，未领取的附件将自动失效，请及时领取
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
