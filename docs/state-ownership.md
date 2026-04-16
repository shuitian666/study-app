# 状态归属定义（单一真相源）

## Context 职责总览

| Context | 唯一职责 |
|---------|----------|
| AppContext | 全局应用级状态（用户会话、临时UI状态） |
| LearningContext | 学习数据（学科、章节、知识点、题目、答题记录、错题本） |
| GameContext | 游戏化系统（签到、成就、抽奖、商店、背包、邮件、组队） |
| UserContext | 用户身份与偏好（登录信息、主题偏好、导航参数） |
| ThemeContext | 主题样式配置 |

## inventory / mail 迁移后归属

- **inventory**：唯一真相源 → `GameContext`
- **mail**：唯一真相源 → `GameContext`

## AppContext 中已废弃字段（待后续清理）

以下字段已标记 @deprecated，应在后续清理中从 AppContext 删除：
- checkin
- achievements
- shopItems
- drawBalance
- lotteryPity
- team
- lotteryPopup
- achievementPopup
- rankings
- redeemedCodes
- inventory
- mail

## UserContext 中已废弃字段（待后续清理）

以下字段已标记 @deprecated，应在后续清理中从 UserContext 删除：
- inventory
- mail

迁移完成后，UserContext 和 AppContext 中不再包含 inventory 和 mail 字段。

## 迁移进度

| 状态 | 位置 | 迁移到 | 完成 |
|------|------|--------|------|
| inventory | UserContext | GameContext | ✅ 完成 |
| mail | UserContext | GameContext | ✅ 完成 |
| inventory | AppContext | GameContext | ✅ 完成 |
| mail | AppContext | GameContext | ✅ 完成 |

---

*最后更新: 2026-04-12*
