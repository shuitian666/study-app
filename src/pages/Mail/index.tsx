import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/ui/Common';
import { Mail as MailIcon, Gift, Coins, Ticket, Crown, CircleDot, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

const attachmentIcons: Record<string, React.ReactNode> = {
  makeup_card: <Ticket size={14} className="text-blue-500" />,
  avatar_frame: <Crown size={14} className="text-purple-500" />,
  coin: <Coins size={14} className="text-amber-500" />,
  vip: <Crown size={14} className="text-yellow-500" />,
};

export default function MailPage() {
  const { state, dispatch, navigate } = useApp();
  const [selectedMail, setSelectedMail] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'claimable'>('all');

  const mails = state.mail.mails;
  const currentVersion = state.mail.currentVersion;

  const filteredMails = mails.filter(mail => {
    if (filter === 'unread') return !mail.read;
    if (filter === 'claimable') return !mail.claimed && mail.attachments.some(a => !a.claimed);
    return true;
  });

  const unreadCount = mails.filter(m => !m.read).length;
  const claimableCount = mails.filter(m => !m.claimed && m.attachments.some(a => !a.claimed)).length;

  const handleOpenMail = (mailId: string) => {
    if (!mails.find(m => m.id === mailId)?.read) {
      dispatch({ type: 'MARK_MAIL_READ', payload: mailId });
    }
    setSelectedMail(mailId);
  };

  const handleClaimAttachment = (mailId: string, attachmentIndex: number) => {
    dispatch({ type: 'CLAIM_MAIL_ATTACHMENT', payload: { mailId, attachmentIndex } });
  };

  const isExpired = (deadline: string) => new Date(deadline) < new Date();

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

  return (
    <div className="page-scroll pb-4">
      <PageHeader
        title="邮件"
        onBack={() => navigate('home')}
      />

      <div className="px-4 pt-3 space-y-4">
        {/* Stats Banner */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <MailIcon size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold">系统邮件</h2>
              <p className="text-sm text-white/80">管理员发放的奖励邮件</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/10 rounded-lg p-2 text-center flex items-center justify-center gap-1">
              <CircleDot size={14} />
              <span className="text-sm">{unreadCount} 未读</span>
            </div>
            <div className="bg-white/10 rounded-lg p-2 text-center flex items-center justify-center gap-1">
              <Gift size={14} />
              <span className="text-sm">{claimableCount} 可领取</span>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: '全部', count: mails.length },
            { key: 'unread', label: '未读', count: unreadCount },
            { key: 'claimable', label: '可领取', count: claimableCount },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                filter === tab.key ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  filter === tab.key ? 'bg-white/20' : 'bg-primary/10 text-primary'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Mail List */}
        {filteredMails.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MailIcon size={40} className="text-gray-400" />
            </div>
            <p className="text-text-secondary font-medium mb-1">
              {filter === 'all' ? '暂无邮件' : filter === 'unread' ? '没有未读邮件' : '没有可领取的邮件'}
            </p>
            <p className="text-text-muted text-sm">关注后续活动，获取更多奖励</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMails.map(mail => {
              const expired = isExpired(mail.claimDeadline);
              
              return (
                <div
                  key={mail.id}
                  onClick={() => handleOpenMail(mail.id)}
                  className={`bg-white rounded-xl p-4 border ${
                    !mail.read ? 'border-primary/50 shadow-sm' : 'border-gray-100'
                  } ${expired? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      !mail.read ? 'bg-primary/10' : 'bg-gray-100'
                    }`}>
                      {mail.systemMail ? (
                        <span className="text-lg">📢</span>
                      ) : (
                        <span className="text-lg">✉️</span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className={`text-sm font-medium truncate ${!mail.read ? 'text-gray-900' : 'text-gray-600'}`}>
                          {mail.title}
                        </h4>
                        {!mail.read && (
                          <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-400 mb-2">{mail.sender} · {formatDate(mail.sentAt)}</p>
                      
                      <div className="flex items-center gap-2">
                        {/* Attachment indicators */}
                        {mail.attachments.length > 0 && (
                          <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            mail.claimed ? 'bg-gray-100 text-gray-500' : 
                            expired ? 'bg-red-50 text-red-500' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {mail.claimed ? (
                              <><CheckCircle size={12} /> 已领取</>
                            ) : expired ? (
                              <><AlertTriangle size={12} /> 已过期</>
                            ) : (
                              <><Gift size={12} /> {mail.attachments.length}个附件</>
                            )}
                          </span>
                        )}
                        
                        {/* Deadline */}
                        {expired && (
                          <span className="text-xs text-red-500 flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(mail.claimDeadline).toLocaleDateString('zh-CN')} 到期
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Version info */}
        <div className="text-center text-xs text-text-muted py-2">
          当前版本: v{currentVersion} · 更新后邮件附件将无法领取
        </div>
      </div>

      {/* Mail Detail Modal */}
      {selectedMail && (() => {
        const mail = mails.find(m => m.id === selectedMail);
        if (!mail) return null;
        const expired = isExpired(mail.claimDeadline);
        
        return (
          <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
            onClick={() => setSelectedMail(null)}
          >
            <div 
              className="bg-white rounded-t-3xl w-full max-w-lg max-h-[80vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold">邮件详情</h3>
                <button 
                  onClick={() => setSelectedMail(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
                >
                  ✕
                </button>
              </div>
              
              {/* Content */}
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📢</span>
                  <div>
                    <h4 className="font-medium">{mail.title}</h4>
                    <p className="text-xs text-gray-400">{mail.sender} · {new Date(mail.sentAt).toLocaleString('zh-CN')}</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-3 mb-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{mail.content}</p>
                </div>
                
                {/* Attachments */}
                {mail.attachments.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-medium text-text-secondary flex items-center gap-1">
                      <Gift size={12} /> 附件
                    </h5>
                    
                    {mail.attachments.map((att, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-xl border ${
                          att.claimed ? 'border-gray-200 bg-gray-50' : 
                          expired ? 'border-red-200 bg-red-50' :
                          'border-amber-200 bg-amber-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {attachmentIcons[att.type] || <Gift size={14} />}
                          <div>
                            <p className="text-sm font-medium">{att.name}</p>
                            <p className="text-xs text-gray-500">x{att.quantity}</p>
                          </div>
                        </div>
                        
                        {att.claimed ? (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <CheckCircle size={12} /> 已领取
                          </span>
                        ) : expired ? (
                          <span className="text-xs text-red-500 flex items-center gap-1">
                            <AlertTriangle size={12} /> 已过期
                          </span>
                        ) : (
                          <button
                            onClick={() => handleClaimAttachment(mail.id, idx)}
                            className="px-3 py-1.5 bg-primary text-white text-xs rounded-lg font-medium"
                          >
                            领取
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Deadline notice */}
                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <Clock size={12} />
                    领取截止日期: {new Date(mail.claimDeadline).toLocaleDateString('zh-CN')}
                  </p>
                  <p className="text-[10px] text-amber-600 mt-1">
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
