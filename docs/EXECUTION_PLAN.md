# 执行计划：明确Context职责与统一状态管理

## 背景

另一位AI的建议指出：
> 不是简单的"拆分GameContext"能解决的，而是需要先明确每个Context的单一职责。

## 目标

1. **理清状态归属** - 绘制完整的状态地图
2. **标记废弃状态** - 在代码中标注deprecated
3. **统一数据源** - 将inventory/mail正确迁移

---

## 任务1：绘制当前状态归属表（30分钟）

**产出**: `docs/context-responsibilities.md`

### 状态归属分析

| 字段 | UserContext | AppContext | GameContext | 应该是 | 备注 |
|------|-------------|------------|-------------|---------|------|
| user | ✅ | ❌ | ❌ | UserContext | 用户基本信息 |
| navigation | ✅ | ❌ | ❌ | UserContext | 路由导航 |
| inventory | ✅ | ✅ | ❌ | GameContext | 游戏化背包 |
| mail | ✅ | ✅ | ❌ | GameContext | 游戏化邮件 |
| checkin | ❌ | ✅ | ✅ | GameContext | 已在GameContext |
| achievements | ❌ | ✅ | ✅ | GameContext | 已在GameContext |
| shopItems | ❌ | ✅ | ✅ | GameContext | 已在GameContext |
| drawBalance | ❌ | ✅ | ✅ | GameContext | 已在GameContext |
| upPool | ❌ | ✅ | ✅ | GameContext | 已在GameContext |
| team | ❌ | ✅ | ✅ | GameContext | 已在GameContext |
| lotteryPopup | ❌ | ✅ | ✅ | GameContext | 已在GameContext |
| achievementPopup | ❌ | ✅ | ✅ | GameContext | 已在GameContext |
| redeemedCodes | ❌ | ✅ | ✅ | GameContext | 已在GameContext |
| rankings | ❌ | ✅ | ✅ | GameContext | 已在GameContext |
| subjects | ❌ | ✅ | ❌ | LearningContext | 学习数据 |
| chapters | ❌ | ✅ | ❌ | LearningContext | 学习数据 |
| knowledgePoints | ❌ | ✅ | ❌ | LearningContext | 学习数据 |
| questions | ❌ | ✅ | ❌ | LearningContext | 学习数据 |

### 执行步骤

1. 读取三个Context文件：
   - `src/store/UserContext.tsx`
   - `src/store/AppContext.tsx`
   - `src/store/GameContext.tsx`

2. 提取所有状态字段

3. 绘制归属表

4. 保存到 `docs/context-responsibilities.md`

---

## 任务2：在代码中标记 @deprecated（1小时）

### 2.1 AppContext中标记废弃

在 `src/store/AppContext.tsx` 中：

```typescript
// 在状态定义处添加废弃注释

/**
 * @deprecated 游戏化状态已迁移至 GameContext，请使用 useGame() 获取
 * 将在 Phase 2 完成后移除
 */
inventory: InventoryState;

/**
 * @deprecated 游戏化状态已迁移至 GameContext，请使用 useGame() 获取
 */
mail: MailState;

// ... 其他游戏化字段类似处理
```

### 2.2 UserContext中标记废弃

在 `src/store/UserContext.tsx` 中：

```typescript
// 标记废弃

/**
 * @deprecated 游戏化物品已迁移至 GameContext，请使用 useGame().gameState.inventory
 */
inventory: InventoryState;

/**
 * @deprecated 游戏化邮件已迁移至 GameContext，请使用 useGame().gameState.mail
 */
mail: MailState;
```

### 2.3 创建迁移提醒注释

在每个废弃字段的reducers处添加：

```typescript
case 'ADD_INVENTORY_ITEM': {
  /**
   * @deprecated 游戏化物品请使用 GameContext
   */
  console.warn('[DEPRECATED] ADD_INVENTORY_ITEM in UserContext, use GameContext instead');
  // ... 保留原有逻辑，确保向后兼容
}
```

---

## 任务3：统一 inventory/mail 到 GameContext（2小时）

### 3.1 更新 GameContext

**文件**: `src/store/GameContext.tsx`

**添加状态**:
```typescript
// GameState中添加
inventory: InventoryState;
mail: MailState;
```

**添加Actions**:
```typescript
type GameAction =
  // ... 现有actions
  | { type: 'ADD_INVENTORY_ITEM'; payload: InventoryItem }
  | { type: 'USE_INVENTORY_ITEM'; payload: string }
  | { type: 'REMOVE_INVENTORY_ITEM'; payload: string }
  | { type: 'ADD_MAIL'; payload: MailItem }
  | { type: 'SET_MAILS'; payload: MailItem[] }
  | { type: 'MARK_MAIL_READ'; payload: string }
  | { type: 'CLAIM_MAIL_ATTACHMENT'; payload: { mailId: string; attachmentIndex: number } }
  | { type: 'UPDATE_MAIL_VERSION'; payload: number }
```

**实现reducers**: 从AppContext中复制相关reducer逻辑

### 3.2 更新持久化

```typescript
// getInitialGameState 中添加
inventory: saved.inventory ?? initialGameState.inventory,
mail: saved.mail ?? initialGameState.mail,

// useEffect持久化中添加
inventory: gameState.inventory,
mail: gameState.mail,
```

### 3.3 更新使用inventory的组件

**需要更新的组件**（共8个）:

| 组件 | 当前使用 | 改为 |
|------|---------|------|
| `features/gamification/inventory/index.tsx` | `useUser().inventory` | `useGame().gameState.inventory` |
| `features/gamification/shop/index.tsx` | 部分inventory | `useGame()` |
| `features/gamification/lottery/index.tsx` | 部分inventory | `useGame()` |
| `pages/Profile/index.tsx` | `useUser().inventory` | `useGame().gameState.inventory` |
| `pages/AvatarEdit/index.tsx` | inventory | `useGame()` |
| `components/ui/LotteryDrawModal.tsx` | inventory | `useGame()` |
| `store/UserContext.tsx` | inventory actions | 删除，保留给GameContext |
| `store/AppContext.tsx` | inventory actions | 删除，保留给GameContext |

### 3.4 处理跨Context依赖

**关键问题**: `CLAIM_MAIL_ATTACHMENT` 需要修改user的totalPoints

**解决方案**: 使用回调模式

```typescript
// GameContext提供action
case 'CLAIM_MAIL_ATTACHMENT': {
  // 只处理mail和inventory
  // 返回一个包含需要更新user的action
  return {
    ...state,
    mail: ...,
    inventory: ...,
    // 但如何更新user.totalPoints？
  };
}
```

**更好的方案**: 让调用组件同时dispatch多个action

```typescript
// 在组件中
const claimAttachment = (mailId: string, attachmentIndex: number, coinsToAdd: number) => {
  gameDispatch({ type: 'CLAIM_MAIL_ATTACHMENT', payload: { mailId, attachmentIndex } });
  if (coinsToAdd > 0) {
    userDispatch({ type: 'ADD_COINS', payload: coinsToAdd });
  }
};
```

---

## 任务4：测试验证（1小时）

### 4.1 构建测试

```bash
npm run build
```

### 4.2 功能测试清单

- [ ] 签到功能正常
- [ ] 成就弹窗正常
- [ ] 抽奖功能正常
- [ ] 商店购买物品到背包
- [ ] 背包使用/查看物品
- [ ] 邮件领取附件
- [ ] 本地存储持久化正常

### 4.3 回滚方案

```bash
git revert HEAD  # 回退到上一个commit
```

---

## 执行时间表

| 任务 | 预计时间 | 累计 |
|------|---------|------|
| 任务1：绘制状态归属表 | 30分钟 | 30分钟 |
| 任务2：标记deprecated | 1小时 | 1.5小时 |
| 任务3：统一数据源 | 2小时 | 3.5小时 |
| 任务4：测试验证 | 1小时 | 4.5小时 |

**总计**: 约4-5小时（可分2天执行）

---

## 风险控制

1. **分支管理**: 保持在 `refactor/gamification-context`
2. **小步提交**: 每完成一个组件更新就提交
3. **测试驱动**: 确保每步都能build通过
4. **向后兼容**: 保留UserContext的actions直到完全迁移完成

---

## 后续

完成此Phase后，Context架构变为：

```
UserContext: user + navigation (精简!)
GameContext: 所有游戏化状态 (inventory + mail + checkin + ...)
LearningContext: 学习数据
AppContext: 仅作为状态聚合层 (逐步废弃)
```

这样Phase 2（React Router迁移）就能在清晰的状态架构下进行。
