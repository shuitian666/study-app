import type { InventoryState, MailState, UpPoolConfig } from '@/types';

const TITLE_NAME_REPLACEMENTS: Record<string, string> = {
  初学者: '初来乍到',
  求知者: '今天也在学',
  学霸: '低调会一点',
  知识达人: '低调会一点',
  夜读人: '半夜还在看',
  坚持者: '半夜还在看',
  探索者: '风里有笔记',
  奋进者: '风里有笔记',
  学习之星: '把书读薄了',
  智慧之星: '把书读薄了',
  全能学霸: '把书读薄了',
};

export function normalizeTitleName(name: string) {
  return TITLE_NAME_REPLACEMENTS[name] ?? name;
}

export function normalizeInventoryTitles(inventory: InventoryState): InventoryState {
  return {
    ...inventory,
    items: inventory.items.map(item =>
      item.type === 'title' ? { ...item, name: normalizeTitleName(item.name) } : item
    ),
  };
}

export function normalizeMailTitles(mail: MailState): MailState {
  return {
    ...mail,
    mails: mail.mails.map(mailItem => ({
      ...mailItem,
      attachments: mailItem.attachments.map(attachment =>
        attachment.type === 'title' ? { ...attachment, name: normalizeTitleName(attachment.name) } : attachment
      ),
    })),
  };
}

export function normalizeUpPoolTitles(upPool: UpPoolConfig): UpPoolConfig {
  return {
    ...upPool,
    items: upPool.items.map(item =>
      item.type === 'title' ? { ...item, name: normalizeTitleName(item.name) } : item
    ),
  };
}
