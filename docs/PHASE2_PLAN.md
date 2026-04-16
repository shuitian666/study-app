# Phase 2 详细实施计划：迁移到React Router v6

## 目标

将自建路由系统迁移到React Router v6，实现URL支持和浏览器历史。

## 当前状态

- 自建路由: `navigate('page', { params })` → `AppState.currentPage`
- 无URL支持
- 刷新丢失状态

## 目标状态

- React Router v6: `navigate('/page/:id')` → URL变化
- 支持浏览器后退/前进
- 可分享链接和书签
- 刷新保持状态

## 实施步骤

### Step 1: 安装依赖

```bash
npm install react-router-dom@6
```

### Step 2: 定义路由表

**目标文件**: `src/router/routes.tsx`

```typescript
// 定义所有路由
const routes = [
  { path: '/', element: <HomePage /> },
  { path: '/knowledge', element: <KnowledgePage /> },
  { path: '/knowledge/:kpId', element: <KnowledgeDetailPage /> },
  { path: '/quiz', element: <QuizPage /> },
  { path: '/quiz/session', element: <QuizSessionPage /> },
  { path: '/quiz/result', element: <QuizResultPage /> },
  // ...
];
```

### Step 3: 创建路由布局组件

**目标文件**: `src/router/AppLayout.tsx`

```typescript
// AppLayout 包含:
// - TabBar 底部导航
// - AchievementPopup
// - LotteryDrawModal
// - 全屏页面排除TabBar的逻辑
```

### Step 4: 更新App.tsx

```typescript
// Before: switch(userState.currentPage)
// After: <Routes><Route ... /></Routes>
```

### Step 5: 创建NavigateContext包装

保留navigate函数，但内部实现跳转到URL：

```typescript
const navigate = (page: PageName, params?: Record<string, string>) => {
  const path = pageToPath(page, params);
  router.navigate(path);
};
```

### Step 6: 迁移所有页面组件

逐个迁移，每个页面添加正确的路由参数获取：

```typescript
// Before: userState.pageParams.subjectId
// After: useParams().subjectId
```

### Step 7: 处理全屏页面

```typescript
// 需要全屏的页面（无TabBar）
const fullScreenRoutes = ['/quiz/session', '/quiz/result', '/ai-chat', ...];

// AppLayout 根据路由判断是否显示TabBar
```

### Step 8: 处理页面滚动位置

```typescript
// 切换页面时滚动到顶部
useEffect(() => {
  window.scrollTo(0, 0);
}, [location.pathname]);
```

## 风险控制

- **向后兼容**: 保留旧的navigate函数作为包装
- **渐进迁移**: 可以先迁移部分页面
- **测试重点**: 浏览器前进/后退/刷新

## 预计工时

5-6天

## 进度跟踪

- [ ] Step 1: 安装react-router-dom
- [ ] Step 2: 定义路由表
- [ ] Step 3: 创建AppLayout
- [ ] Step 4: 更新App.tsx
- [ ] Step 5: 创建NavigateContext包装
- [ ] Step 6: 迁移首页和知识库
- [ ] Step 6: 迁移Quiz相关
- [ ] Step 6: 迁移游戏化页面
- [ ] Step 6: 迁移其他页面
- [ ] Step 7: 处理全屏页面
- [ ] Step 8: 测试浏览器历史
