# 学习应用 - 代码注释标记系统

## 概述
本文档定义了项目中使用的注释标记系统，用于加快代码理解和修改速度。

---

## 标记类型

### 1. @section <区域名>
标识代码所属的功能区域

| 区域名 | 说明 | 适用文件 |
|--------|------|----------|
| ALL | 全局状态管理 | AppContext.tsx |
| QUIZ_SESSION | 答题会话 | QuizSession.tsx |
| QUIZ_RESULT | 答题结算 | QuizResult.tsx |
| AI_FEATURES | AI功能 | aiService.ts |
| LEARNING | 学习流程 | Quiz页面 |
| INCENTIVE | 激励系统 | Checkin, Shop |
| TEAM | 组队功能 | TeamPanel |

### 2. @user:<需求名>
标识该代码对应的用户原始需求

| 需求名 | 说明 |
|--------|------|
| 兑换码 | 兑换码功能（Shop页面） |
| 继续学习 | 结算后继续学习按钮 |
| 下一阶段 | 阶段切换功能 |
| AI解析 | AI生成题目解析 |
| 质疑功能 | 用户质疑修改解析 |
| 预生成 | 预生成问题和解析 |
| 队伍接口 | 组队真人接口 |

### 3. @depends <文件列表>
标识当前文件依赖的其他文件

```
@depends src/services/aiService.ts | src/store/AppContext.tsx
```

---

## 已标记文件

| 文件 | @section | @user |
|------|----------|-------|
| src/store/AppContext.tsx | ALL | 全部需求 |
| src/pages/Quiz/QuizSession.tsx | QUIZ_SESSION | AI解析, 质疑功能, 预生成, 继续学习 |
| src/pages/Quiz/QuizResult.tsx | QUIZ_RESULT | 继续学习, 下一阶段 |

---

## 扩展指南

### 添加新状态
1. 在 AppState 接口添加字段
2. 在 initialState 添加默认值
3. 在 Action 类型添加新 Action
4. 在 reducer 添加处理逻辑

### 添加新页面
1. 在 pages/ 下创建目录
2. 添加 @section 和 @user 标记
3. 添加 @depends 依赖说明

### 修改现有功能
1. 找到对应的 @section 区域
2. 检查 @user 标记确认需求
3. 检查 @depends 确认影响范围

---

## 快速定位示例

**问题**: 用户说"答题后没有立即显示AI解析"

**搜索**: `@user:AI解析`
**结果**: 
- AppContext.tsx (SAVE_QUESTION_EXPLANATION action)
- QuizSession.tsx (handleSubmitAnswer 函数)

---

## 最佳实践

1. **每次新增功能都添加标记** - 便于后续定位
2. **保持 @depends 同步更新** - 确保依赖关系准确
3. **使用标准需求名** - 便于跨文件搜索
