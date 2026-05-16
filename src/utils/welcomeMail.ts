import type { MailItem } from '@/types';

export const WELCOME_MAIL_ID = 'welcome-mail-v1';

export function createWelcomeMail(now = new Date()): MailItem {
  const deadline = new Date(now);
  deadline.setFullYear(deadline.getFullYear() + 10);

  return {
    id: WELCOME_MAIL_ID,
    title: '欢迎来到智学助手',
    content: [
      '欢迎开始使用智学助手。',
      '愿你在每天的小目标里稳步前进，把知识一点点学扎实。这里准备了一份新手礼，祝你学有所获。',
    ].join('\n\n'),
    sender: '系统',
    sentAt: now.toISOString(),
    read: false,
    attachments: [
      { type: 'coin', name: '星币', quantity: 100, claimed: false },
      { type: 'experience', name: '经验', quantity: 50, claimed: false },
      {
        type: 'title',
        name: '初来乍到',
        description: '欢迎礼赠送的初始称号',
        icon: '📘',
        rarity: 'N',
        quantity: 1,
        claimed: false,
      },
    ],
    claimDeadline: deadline.toISOString(),
    systemMail: true,
    claimed: false,
    version: 1,
  };
}
