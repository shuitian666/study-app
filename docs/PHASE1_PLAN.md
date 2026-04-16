# Phase 1 详细实施计划：游戏化Context优化

## ⚠️ 重要发现 - 状态管理架构问题

### 当前状态分布

| Context | 管理的状态 | 使用者 |
|---------|-----------|--------|
| **UserContext** | user, navigation, **inventory**, **mail** | 多个组件直接使用 |
| **GameContext** | checkin, achievements, shop, lottery, team, rankings | 多个组件直接使用 |
| **AppContext** | 所有数据（学习+游戏化+重复的inventory/mail） | 似乎作为聚合层 |

### 问题

1. **状态重复**: inventory/mail在UserContext和AppContext中都有
2. **职责不清**: 哪个是"真相源"不清楚
3. **多Context订阅**: 组件可能需要多个Context

### 决策：暂缓GameContext扩展

由于inventory/mail的状态管理问题复杂（涉及UserContext和AppContext），暂时不在Phase 1处理这个迁移。

---

## 重新定义的Phase 1目标

### 目标1: 验证GameContext作为游戏化状态的唯一源

**当前状态**:
- GameContext已管理: checkin, achievements, shop, lottery, team, rankings
- 所有游戏化组件已经在使用GameContext
- AppContext中仍有重复的游戏化状态定义

**需要做**:
- [ ] 确认所有游戏化组件使用GameContext
- [ ] AppContext中的重复游戏化状态标记为"deprecated"
- [ ] 测试验证功能正常

### 目标2: 文档化当前架构

需要文档化：
- [ ] 各Context的职责
- [ ] 状态流向
- [ ] 数据真相源

---

## 实施步骤

### Step 1: 确认游戏化组件使用GameContext

检查以下组件是否使用`useGame()`:
- [x] features/gamification/checkin/index.tsx
- [x] features/gamification/achievements/index.tsx
- [x] features/gamification/shop/index.tsx
- [x] features/gamification/lottery/index.tsx
- [x] features/gamification/ranking/index.tsx
- [x] components/ui/AchievementPopup.tsx
- [x] components/ui/LotteryDrawModal.tsx

**结论**: ✅ 所有游戏化组件已在使用GameContext

### Step 2: 检查AppContext中的重复状态

AppContext中有以下游戏化状态（与GameContext重复）：
- checkin
- achievements
- shopItems
- rankings
- achievementPopup
- drawBalance
- upPool
- lastCheckinReward
- team
- lotteryPopup
- redeemedCodes
- **inventory** (这个还在UserContext)
- **mail** (这个还在UserContext)

### Step 3: 标记AppContext中的游戏化状态为deprecated

在AppContext中标记这些状态为deprecated注释，逐步迁移组件只使用GameContext。

### Step 4: 测试验证

- [ ] npm run build 通过
- [ ] 签到功能正常
- [ ] 成就弹窗正常
- [ ] 抽奖功能正常
- [ ] 商店功能正常

---

## 长期建议

### inventory/mail的归属问题

**选项A**: 移到GameContext
- 需要处理跨Context的user修改（CLAIM_MAIL_ATTACHMENT）

**选项B**: 保持在UserContext
- 接受UserContext管理这些状态
- AppContext的重复代码可以删除

**选项C**: 移到单独的InventoryContext/MailContext
- 最干净，但改动最大

**推荐**: 选项B - 保持现状，UserContext是合理的UI状态管理者

---

## 风险控制

- **分支管理**: refactor/gamification-context
- **回滚方案**: git revert

## 预计工时

1-2天（主要是测试和文档）

## 进度跟踪

- [x] Step 1: 确认游戏化组件使用GameContext
- [ ] Step 2: 检查AppContext中的重复状态
- [ ] Step 3: 标记deprecated
- [ ] Step 4: 测试验证

---

## 后续Phase 2-4

Phase 2: React Router迁移（高优先级）
Phase 3: 规则引擎（可选）
Phase 4: 持久化统一（可选）
