/**
 * 底部导航栏 - 5 个主 Tab: 首页/知识库/刷题/图谱/我的
 * hiddenPages 中的页面不显示 TabBar（如答题中、AI聊天等沉浸式页面）
 * 新增页面如需隐藏 TabBar → 在 hiddenPages 数组中添加对应 PageName
 */
import { Home, BookOpen, PenTool, Network, User } from 'lucide-react';
import { useUser } from '@/store/UserContext';
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

const hiddenPages: PageName[] = ['login', 'quiz-session', 'quiz-result', 'review-session', 'add-knowledge', 'ai-chat', 'inventory', 'mail', 'import-knowledge'];

export default function TabBar() {
  const { userState, navigate } = useUser();

  if (hiddenPages.includes(userState.currentPage)) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      {/* 苹果风格：底部半透明磨砂玻璃效果 */}
      <div className="bg-white/70 backdrop-blur-xl border-t border-white/20">
        <div className="flex items-center justify-around h-[56px]">
          {tabs.map(tab => {
            const isActive = userState.currentPage === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.key)}
                className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200 rounded-full mx-1 ${isActive ? 'bg-primary/10 scale-105' : 'active:opacity-60'}`}
              >
                <Icon
                  size={isActive ? 22 : 20}
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
    </div>
  );
}
