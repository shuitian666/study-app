# Context 层冻结规则

## 冻结期
2026-04-13 起，至 UI 重构完成。

## 目的
在 UI 重构期间保持状态层稳定，避免改一行 UI 引发连锁反应。

## 允许的操作
- 修复 Context 相关 P0 bug（如登录状态丢失）
- 临时开发代码（如 devUser 强制登录）
- 渐进迁移到 actions 模式（不改状态结构）

## 禁止的操作
- 新增 state 字段
- 删除 state 字段
- 重命名 state 字段
- 新增 action type
- 删除 action type

## 例外情况
以下不受限制：
- P0 bug 修复
- 临时开发代码
- LearningContext actions 模式迁移（Step 3，待 UI 重构后评估）

如需破例，必须在 commit message 中说明原因。

## 冻结范围
- AppContext
- LearningContext
- GameContext
- UserContext
- AIChatContext
- ThemeContext

## 认知
UI 可以乱改，状态不能乱动。
