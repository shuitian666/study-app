/**
 * 底部导航栏 - 5 个主 Tab: 首页/知识库/刷题/图谱/我的
 * hiddenPages 中的页面不显示 TabBar（如答题中、AI聊天等沉浸式页面）
 * 新增页面如需隐藏 TabBar → 在 hiddenPages 数组中添加对应 PageName
 */
import { Home, BookOpen, PenTool, Network, User } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import type { PageName } from '@/types';

interface TabItem {
  key: PageName;
  label: string;
  icon: typeof Home;
}

const tabs: TabItem[] = [
  { key: 'home', label: '首页', icon: Home },
  { key: 'knowledge', label: '知识库', icon: BookOpen },
  { key: 'quiz', label: '刷题', icon: PenTool },
  { key: 'knowledge-map', label: '图谱', icon: Network },
  { key: 'profile', label: '我的', icon: User },
];

const hiddenPages: PageName[] = ['login', 'quiz-session', 'quiz-result', 'review-session', 'add-knowledge', 'ai-chat'];

export default function TabBar() {
  const { state, navigate } = useApp();

  if (hiddenPages.includes(state.currentPage)) {
    return null;
  }

  return (
    <div className="shrink-0 bg-white border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-[52px]">
        {tabs.map(tab => {
          const isActive = state.currentPage === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.key)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:opacity-60 transition-opacity"
            >
              <Icon
                size={20}
                className={isActive ? 'text-primary' : 'text-text-muted'}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className={`text-[10px] leading-tight ${isActive ? 'text-primary font-semibold' : 'text-text-muted'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
