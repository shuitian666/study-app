# 状态管理重构执行指令书（完整版 v1.1）

> **目标**：将 `inventory` 和 `mail` 状态从 `UserContext` 和 `AppContext` 迁移到 `GameContext`，消除重复，明确归属。同时标记 AppContext 中所有已在 GameContext 的游戏化字段为废弃。
>
> **前置条件**：项目位于 `E:/Projects/TRAE_project`，分支为 `refactor/gamification-context`。
>
> **原则**：严格按照步骤执行，每完成一个任务需验证 TypeScript 编译无误后再进行下一任务。遇到任何与指令不符的情况，立即停止并报告。

---

## 任务依赖关系图

```
任务0（探查） → 任务1（文档） → 任务2（GameContext准备） → 任务3（标记废弃）
                                                                        ↓
                                                            任务4（组件迁移，循环）
                                                                        ↓
                                                            任务6（测试验证）
                                                                        ↓
                                                            任务5（删除废弃字段）
```

**重要**：
- **任务5必须最后执行**，且仅在任务4全部完成、测试通过后进行
- 任务4涉及文件过多时，可分批提交，但务必保证每批修改后编译通过

---

## 【新增】任务 0：环境探查（执行前必须完成）

### 0.1 确认 inventory 和 mail 的实际类型名

1. 打开 `src/types/index.ts`，搜索 `Inventory`、`Mail` 相关类型定义
2. 确认 `GameState` 中 `inventory` 字段的类型名（例如 `InventoryState` 或 `InventoryItem[]`）
3. 确认 `GameState` 中 `mail` 字段的类型名（例如 `MailState` 或 `MailItem[]`）

**回报格式**：
```
inventory类型: [实际类型名]
mail类型: [实际类型名]
```

### 0.2 搜索所有使用 inventory/mail 的组件文件

在项目根目录执行（或使用IDE全局搜索）：

```bash
# 搜索所有包含 "inventory" 或 "mail" 的 .tsx/.ts 文件
grep -r -l -E "inventory|mail" src/ --include="*.tsx" --include="*.ts"
```

将输出结果保存，作为任务4的文件列表。

**回报格式**：
```
涉及文件列表：
- src/features/gamification/inventory/index.tsx
- src/features/gamification/mail/index.tsx
- ...
```

---

## 任务 1：创建状态归属文档（可选，但建议执行）

**目的**：记录迁移前后的状态归属，便于后续维护。

### 1.1 创建文件 `docs/state-ownership.md`

```markdown
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

迁移完成后，UserContext 和 AppContext 中不再包含 inventory 和 mail 字段。
```

### 1.2 提交

```bash
git add docs/ && git commit -m "docs: add state ownership document"
```

---

## 任务 2：在 GameContext 中添加 inventory 和 mail 状态

**目的**：让 GameContext 具备管理背包和邮件的能力。

### 2.1 打开文件 `src/store/GameContext.tsx`

### 2.2 确认导入类型

确认文件顶部已导入 `InventoryState`、`MailState`、`InventoryItem`、`MailItem` 等类型。

### 2.3 在 `GameState` 接口中添加字段

找到 `interface GameState { ... }`，使用任务0探查得到的实际类型添加：

```typescript
interface GameState {
  // ... 现有字段
  inventory: InventoryState;          // 使用任务0确认的实际类型
  mail: MailState;                    // 使用任务0确认的实际类型
  // ...
}
```

### 2.4 在初始状态中添加默认值

找到 `initialGameState` 对象，添加：

```typescript
const initialGameState: GameState = {
  // ... 现有字段
  inventory: { items: [] },          // 如果是 InventoryState 对象
  mail: { mails: [], currentVersion: 1 },  // 如果是 MailState 对象
  // ...
};
```

### 2.5 添加 Action Types

在 `GameAction` 联合类型中添加以下类型：

```typescript
type GameAction =
  // ... 现有类型
  | { type: 'SET_INVENTORY'; payload: InventoryItem[] }
  | { type: 'ADD_INVENTORY_ITEM'; payload: InventoryItem }
  | { type: 'UPDATE_INVENTORY_ITEM'; payload: { id: string; changes: Partial<InventoryItem> } }
  | { type: 'REMOVE_INVENTORY_ITEM'; payload: string }
  | { type: 'SET_MAIL'; payload: MailItem[] }
  | { type: 'ADD_MAIL'; payload: MailItem }
  | { type: 'UPDATE_MAIL'; payload: { id: string; changes: Partial<MailItem> } }
  | { type: 'DELETE_MAIL'; payload: string }
  | { type: 'MARK_MAIL_READ'; payload: string }
  | { type: 'CLAIM_MAIL_ATTACHMENT'; payload: { mailId: string; attachments: MailAttachment[] } };
```

### 2.6 在 reducer 中添加处理逻辑

找到 `gameReducer` 函数，在 `switch` 语句末尾（default之前）添加：

```typescript
case 'SET_INVENTORY':
  return { ...state, inventory: { items: action.payload } };

case 'ADD_INVENTORY_ITEM':
  const existingItem = state.inventory.items.find(item => item.id === action.payload.id);
  if (existingItem) {
    return {
      ...state,
      inventory: {
        items: state.inventory.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item
        ),
      },
    };
  }
  return { ...state, inventory: { items: [...state.inventory.items, action.payload] } };

case 'UPDATE_INVENTORY_ITEM':
  return {
    ...state,
    inventory: {
      items: state.inventory.items.map(item =>
        item.id === action.payload.id ? { ...item, ...action.payload.changes } : item
      ),
    },
  };

case 'REMOVE_INVENTORY_ITEM':
  return { ...state, inventory: { items: state.inventory.items.filter(item => item.id !== action.payload) } };

case 'SET_MAIL':
  return { ...state, mail: { mails: action.payload, currentVersion: state.mail.currentVersion } };

case 'ADD_MAIL':
  return { ...state, mail: { mails: [...state.mail.mails, action.payload], currentVersion: state.mail.currentVersion } };

case 'UPDATE_MAIL':
  return {
    ...state,
    mail: {
      mails: state.mail.mails.map(mail =>
        mail.id === action.payload.id ? { ...mail, ...action.payload.changes } : mail
      ),
      currentVersion: state.mail.currentVersion,
    },
  };

case 'DELETE_MAIL':
  return { ...state, mail: { mails: state.mail.mails.filter(mail => mail.id !== action.payload), currentVersion: state.mail.currentVersion } };

case 'MARK_MAIL_READ':
  return {
    ...state,
    mail: {
      mails: state.mail.mails.map(mail =>
        mail.id === action.payload ? { ...mail, read: true } : mail
      ),
      currentVersion: state.mail.currentVersion,
    },
  };

case 'CLAIM_MAIL_ATTACHMENT':
  // ⚠️ 此 action 只负责将邮件标记为已领取，不自动添加物品到 inventory
  // 物品添加由组件协调，通过额外的 gameDispatch({ type: 'ADD_INVENTORY_ITEM' }) 完成
  return {
    ...state,
    mail: {
      mails: state.mail.mails.map(mail =>
        mail.id === action.payload.mailId ? { ...mail, claimed: true } : mail
      ),
      currentVersion: state.mail.currentVersion,
    },
  };
```

### 2.7 更新持久化

找到 `getInitialGameState` 函数和 `useEffect` 持久化代码，添加 inventory 和 mail 的恢复和保存。

### 2.8 编译验证

```bash
npm run build
```

### 2.9 提交更改

```bash
git add src/store/GameContext.tsx
git commit -m "feat(game): add inventory and mail state to GameContext"
```

---

## 任务 3：标记 UserContext 和 AppContext 中的 inventory/mail 及游戏化字段为废弃

**目的**：引导开发者使用 GameContext，并为后续清理做准备。

### 3.1 修改 `src/store/UserContext.tsx`

找到 `UserState` 接口中的 `inventory` 和 `mail` 字段，添加 JSDoc `@deprecated` 注释：

```typescript
interface UserState {
  // ... 其他字段
  /**
   * @deprecated 背包数据已迁移至 GameContext，请使用 useGame().gameState.inventory
   */
  inventory: InventoryState;
  /**
   * @deprecated 邮件数据已迁移至 GameContext，请使用 useGame().gameState.mail
   */
  mail: MailState;
}
```

同样，相关的 actions 添加注释，**但不删除任何代码**。

### 3.2 修改 `src/store/AppContext.tsx`

找到 `AppState` 接口中的字段，添加 `@deprecated` 注释：

```typescript
interface AppState {
  // ... 其他字段

  // ===== 游戏化字段（已迁移至 GameContext）=====
  /**
   * @deprecated 已迁移至 GameContext，请使用 useGame().gameState.checkin
   */
  checkin: CheckinState;
  /**
   * @deprecated 已迁移至 GameContext，请使用 useGame().gameState.achievements
   */
  achievements: Achievement[];
  /**
   * @deprecated 已迁移至 GameContext，请使用 useGame().gameState.drawBalance
   */
  drawBalance: DrawBalance;
  /**
   * @deprecated 已迁移至 GameContext，请使用 useGame().gameState.lotteryPity
   */
  lotteryPity: LotteryPityState;
  /**
   * @deprecated 已迁移至 GameContext，请使用 useGame().gameState.shopItems
   */
  shopItems: ShopItem[];
  /**
   * @deprecated 已迁移至 GameContext，请使用 useGame().gameState.team
   */
  team: TeamState | null;
  /**
   * @deprecated 已迁移至 GameContext，请使用 useGame().gameState.lotteryPopup
   */
  lotteryPopup: LotteryPopup | null;
  /**
   * @deprecated 已迁移至 GameContext，请使用 useGame().gameState.achievementPopup
   */
  achievementPopup: AchievementPopup | null;
  /**
   * @deprecated 已迁移至 GameContext，请使用 useGame().gameState.rankings
   */
  rankings: { studyTime: RankEntry[]; masterCount: RankEntry[] };
  /**
   * @deprecated 已迁移至 GameContext，请使用 useGame().gameState.redeemedCodes
   */
  redeemedCodes: string[];

  // ===== inventory/mail（已迁移至 GameContext）=====
  /**
   * @deprecated 已迁移至 GameContext，请使用 useGame().gameState.inventory
   */
  inventory: InventoryState;
  /**
   * @deprecated 已迁移至 GameContext，请使用 useGame().gameState.mail
   */
  mail: MailState;
}
```

同样，相关的 actions 添加注释，**但不删除任何代码**。

### 3.3 提交更改

```bash
git add src/store/UserContext.tsx src/store/AppContext.tsx
git commit -m "chore: mark gamification fields as deprecated in UserContext and AppContext"
```

---

## 任务 4：更新所有使用 inventory/mail 的组件

**目的**：将所有对 inventory/mail 的读写操作从旧 Context 切换到 GameContext。

### 4.1 根据任务0.2的文件列表逐文件修改

对每个文件执行以下修改：

**修改前**（假设使用 UserContext）：
```typescript
import { useUser } from '../../store/UserContext';

const Component = () => {
  const { userState, userDispatch } = useUser();
  const inventory = userState.inventory;
  const mail = userState.mail;

  // 派发动作
  userDispatch({ type: 'ADD_INVENTORY_ITEM', payload: newItem });
};
```

**修改后**：
```typescript
import { useGame } from '../../store/GameContext';

const Component = () => {
  const { gameState, gameDispatch } = useGame();
  const inventory = gameState.inventory;
  const mail = gameState.mail;

  // 派发动作
  gameDispatch({ type: 'ADD_INVENTORY_ITEM', payload: newItem });
};
```

### 4.2 特殊处理：跨 Context 的 action 协调

当需要同时修改 GameContext 和 UserContext 时（例如领取邮件附件中的星币），按以下模式处理：

```typescript
import { useGame } from '../../store/GameContext';
import { useUser } from '../../store/UserContext';

const handleClaimAttachment = (mailId: string, attachments: MailAttachment[]) => {
  // 1. 更新 GameContext：标记邮件已领取
  gameDispatch({ type: 'CLAIM_MAIL_ATTACHMENT', payload: { mailId, attachments } });

  // 2. 提取物品奖励，添加到背包
  const itemAttachments = attachments.filter(a => a.type !== 'coins');
  itemAttachments.forEach(attachment => {
    gameDispatch({
      type: 'ADD_INVENTORY_ITEM',
      payload: { id: `inv-${Date.now()}`, name: attachment.name, quantity: 1, ... }
    });
  });

  // 3. 提取星币奖励，更新 UserContext
  const coinAttachment = attachments.find(a => a.type === 'coins');
  if (coinAttachment) {
    userDispatch({ type: 'ADD_COINS', payload: coinAttachment.quantity });
  }
};
```

### 4.3 编译验证

每修改完一个文件，立即运行：

```bash
npm run build
```

如编译错误，修复后再继续。

### 4.4 逐个文件提交

每修改完一个文件并验证通过后：

```bash
git add <modified-file>
git commit -m "refactor: migrate inventory/mail usage to GameContext in <component-name>"
```

---

## 任务 5：从 UserContext 和 AppContext 中删除废弃字段（最后执行）

**目的**：彻底移除冗余状态，完成迁移。

### 5.1 删除 UserContext 中的 inventory 和 mail

打开 `src/store/UserContext.tsx`：
1. 从 `UserState` 接口中删除 `inventory` 和 `mail` 字段及其注释
2. 从 `initialUserState` 中删除对应初始化值
3. 从 `UserAction` 联合类型中删除相关的 action types
4. 从 `userReducer` 中删除对应的 case 分支
5. 清理未使用的 import

### 5.2 删除 AppContext 中的 inventory 和 mail

打开 `src/store/AppContext.tsx`，执行与 5.1 完全相同的操作。

### 5.3 编译验证

```bash
npm run build
```

### 5.4 提交更改

```bash
git add src/store/UserContext.tsx src/store/AppContext.tsx
git commit -m "refactor: remove deprecated inventory and mail from UserContext and AppContext"
```

---

## 任务 6：测试验证

**目的**：确保功能正常，无运行时错误。

### 6.1 启动开发服务器

```bash
npm run dev
```

### 6.2 手动测试核心路径

| 测试项 | 操作步骤 | 预期结果 |
|--------|----------|----------|
| 查看背包 | 进入"我的" → "背包" | 显示已有物品，无报错 |
| 商店购买 | 进入商店，购买一个物品 | 扣减星币，物品添加到背包 |
| 查看邮件 | 进入邮件页面 | 显示邮件列表，可标记已读 |
| 领取邮件附件 | 点击邮件的"领取"按钮 | 附件内容到账（星币/物品），邮件标记已领取 |
| 抽奖获得物品 | 进行抽奖 | 抽到的物品正确添加到背包 |
| 签到奖励 | 完成签到条件并签到 | 奖励正确发放到背包/邮件 |

### 6.3 检查控制台

打开浏览器开发者工具，确认无红色报错，无 `@deprecated` 相关的警告。

### 6.4 最终提交

```bash
git add .
git commit -m "test: manual verification of inventory/mail migration passed"
```

---

## 后续清理任务清单（不在本次范围）

完成本次 inventory/mail 迁移后，建议在后续阶段清理以下已标记废弃的字段：

| 字段 | 当前所在 | 清理方式 |
|------|----------|----------|
| checkin | AppContext | 确认组件已使用 GameContext 后删除 |
| achievements | AppContext | 同上 |
| drawBalance | AppContext | 同上 |
| lotteryPity | AppContext | 同上 |
| shopItems | AppContext | 同上 |
| team | AppContext | 同上 |
| lotteryPopup | AppContext | 同上 |
| achievementPopup | AppContext | 同上 |
| rankings | AppContext | 同上 |
| redeemedCodes | AppContext | 同上 |

---

## 异常处理

如果执行过程中遇到以下情况，**立即停止**并报告问题描述、文件路径和行号：

1. TypeScript 编译错误，且无法通过简单类型调整解决
2. 组件中使用了非标准的状态读取方式（如直接从 localStorage 读取）
3. 遇到未在本文档中列出的使用 inventory/mail 的文件
4. 修改后页面白屏或核心功能异常

---

## 完成标志

- [ ] GameContext 包含完整的 inventory/mail 状态管理
- [ ] 所有组件从 GameContext 获取 inventory/mail
- [ ] UserContext 和 AppContext 中不再包含 inventory/mail 相关代码（仅删除后）
- [ ] AppContext 中所有游戏化字段已标记 @deprecated
- [ ] 项目可正常编译运行，核心功能测试通过
- [ ] 分支 `refactor/gamification-context` 已包含所有提交

---

## 执行确认点

请在完成每个任务后，在以下方框打勾：

- [ ] 任务0 完成，类型和文件列表已回报
- [ ] 任务1 完成（可选）
- [ ] 任务2 完成，GameContext 已具备 inventory/mail 管理能力，编译通过
- [ ] 任务3 完成，废弃标记已添加
- [ ] 任务4 完成，所有组件已切换数据源，编译通过
- [ ] 任务6 完成，手动测试通过
- [ ] 任务5 完成，废弃字段已删除，最终编译通过

---

*指令书版本: v1.1*
*制定者: 上下文AI + 参谋AI*
*执行者: 操作AI*
*最后更新: 2026-04-12*
