# Phase 1 详细实施计划：游戏化Context优化

## ⚠️ 重要发现

项目中**已经存在**GameContext.tsx（4月3日），且所有游戏化组件都在使用它。

**现有API**:
```typescript
const { gameState, gameDispatch } = useGame();
```

**问题**:
1. AppContext中也保留了相同的游戏化状态（checkin, achievements, shopItems等）
2. Inventory和Mail状态在AppContext中，没有在GameContext中
3. 状态分散在两处，需要同步

## 实际目标

1. **分析** GameContext 与 AppContext 的游戏化状态重复
2. **整合** Inventory和Mail到GameContext（如果需要）
3. **删除** AppContext中的重复游戏化状态
4. **验证** 所有功能正常

## 实施步骤

### Step 1: 完整分析现状

**目标**: 确定两个Context的状态分布

需要检查：
- [ ] GameContext管理哪些状态？
- [ ] AppContext管理哪些游戏化状态？
- [ ] 哪些组件使用AppContext的游戏化状态？
- [ ] 哪些组件使用GameContext的游戏化状态？

### Step 2: 确定单一源

**目标**: 决定游戏化状态的"真相源"

选项A: GameContext为单一源
- AppContext中的游戏化状态全部删除
- AppContext需要游戏化状态时，订阅GameContext

选项B: AppContext保留游戏化状态（当前状态）
- 继续维护两处状态
- 保持同步逻辑

### Step 3: 整合Inventory和Mail（如果选择选项A）

**目标**: 将Inventory和Mail迁移到GameContext

需要迁移：
- [ ] inventory状态
- [ ] mail状态
- [ ] 相关的actions (ADD_INVENTORY_ITEM, USE_INVENTORY_ITEM, etc.)

### Step 4: 更新组件引用

**目标**: 确保所有组件从正确的Context获取状态

需要检查的组件：
- [ ] features/gamification/checkin/index.tsx
- [ ] features/gamification/achievements/index.tsx
- [ ] features/gamification/shop/index.tsx
- [ ] features/gamification/lottery/index.tsx
- [ ] features/gamification/ranking/index.tsx
- [ ] features/gamification/inventory/index.tsx
- [ ] features/gamification/mail/index.tsx
- [ ] components/ui/AchievementPopup.tsx
- [ ] components/ui/LotteryDrawModal.tsx
- [ ] pages/Profile/index.tsx

### Step 5: 测试验证

- [ ] npm run build 通过
- [ ] 签到功能正常
- [ ] 成就弹窗正常
- [ ] 抽奖功能正常
- [ ] 商店功能正常
- [ ] 背包功能正常
- [ ] 邮件功能正常

## 风险控制

- **分支管理**: refactor/gamification-context 分支
- **备份点**: 每个Step完成后提交
- **回滚方案**: git revert

## 预计工时

3-4天（分析可能需要半天）

## 进度跟踪

- [ ] Step 1: 完整分析现状
- [ ] Step 2: 确定单一源
- [ ] Step 3: 整合Inventory和Mail（如果需要）
- [ ] Step 4: 更新组件引用
- [ ] Step 5: 测试验证

---

## 📊 当前状态分析

### GameContext (已存在)

**状态**:
- checkin: CheckinState
- achievements: Achievement[]
- shopItems: ShopItem[]
- rankings: { studyTime, masterCount }
- achievementPopup
- drawBalance: DrawBalance
- upPool: UpPoolConfig
- lastCheckinReward: CheckinRewardInfo | null
- team: TeamState | null
- lotteryPopup: LotteryPopup | null
- redeemedCodes: string[]

**缺失**:
- inventory (InventoryState) - 在AppContext中
- mail (MailState) - 在AppContext中

### AppContext (游戏化相关)

**重复状态**:
- checkin (重复)
- achievements (重复)
- shopItems (重复)
- rankings (重复)
- achievementPopup (重复)
- drawBalance (重复)
- upPool (重复)
- lastCheckinReward (重复)
- team (重复)
- lotteryPopup (重复)
- redeemedCodes (重复)

**独有状态**:
- inventory (应该移到GameContext?)
- mail (应该移到GameContext?)

### 需要决策

1. GameContext是否应该是游戏化状态的唯一来源？
2. Inventory和Mail是否应该移到GameContext？
3. AppContext应该如何访问游戏化状态？（订阅GameContext？）
