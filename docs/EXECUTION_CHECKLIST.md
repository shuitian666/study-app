# 行动路线图执行清单与命令参考

## 前置检查（执行前必做）

### 检查 1：验证 Undo/Redo 的实际使用

```bash
# 查找所有 undo/redo 的使用
grep -r "\.undo\|\.redo\|_canUndo\|_canRedo" src/

# 期望结果：只在以下文件出现
# ✅ src/pages/Knowledge/index.tsx (L35, L372-390)
# ✅ src/store/LearningContext.tsx (L32-36, 依赖声明)
# ✅ src/store/AppContext.tsx (L46-50, 依赖声明)
```

### 检查 2：验证 AppContext 的 Undo/Redo 未被使用

```bash
# 查找 useApp() 中对 undo/redo 的调用
grep -r "useApp()" src/ | grep -E "undo|redo"

# 期望结果：无（说明 AppContext.undo/redo 完全未被使用）
```

### 检查 3：确认项目构建无误

```bash
npm run build
# ✅ 无编译错误
```

---

## Step 1: 清理 AppContext 中的 Undo/Redo（30 分钟）

### 快速检查清单

- [ ] 已备份或提交现有代码
- [ ] 已确认 AppContext Undo/Redo 未被使用（检查2）

### 要删除的具体内容

**在 `src/store/AppContext.tsx` 中：**

#### 删除 1: AppState 接口中的字段（第 46-50 行）

```typescript
// ❌ 删除以下行
// Undo/Redo history (not persisted, in-memory only)
_history: AppState[];
_historyIndex: number;
_canUndo: boolean;
_canRedo: boolean;
```

**验证命令**：
```bash
grep -n "_history\|_historyIndex\|_canUndo\|_canRedo" src/store/AppContext.tsx
```

#### 删除 2: initialState 中的初始化（第 79-83 行）

```typescript
// ❌ 删除以下行
// Undo/Redo (not persisted)
_history: [],
_historyIndex: -1,
_canUndo: false,
_canRedo: false,
```

#### 删除 3: Action 联合类型中的 Undo/Redo 行为（第 117-120 行）

```typescript
// ❌ 删除以下行
// Undo/Redo actions
| { type: 'UNDO' }
| { type: 'REDO' }
| { type: 'RECORD_HISTORY'; payload: Partial<AppState> }
```

#### 删除 4: reducer 中的三个 case（第 288-325 行）

```typescript
// ❌ 删除整个块
// Undo/Redo actions
case 'RECORD_HISTORY': {
  // Only record certain actions for undo (not navigation, not undo/redo)
  const newHistory = state._history.slice(0, state._historyIndex + 1);
  // ... 完整逻辑 ...
}
case 'UNDO': {
  if (state._historyIndex <= 0 || state._history.length === 0) return state;
  // ... 完整逻辑 ...
}
case 'REDO': {
  if (state._historyIndex >= state._history.length - 1) return state;
  // ... 完整逻辑 ...
}
```

**精确删除范围**（使用编辑器按行号）：
```
Line 288: // Undo/Redo actions
Line 289-328: case 语句块
```

#### 删除 5: AppProvider 中的 undo/redo 函数（第 1117-1137 行）

```typescript
// ❌ 删除这些函数定义
// Undo/Redo functions
const undo = () => {
  if (state._canUndo) {
    dispatch({ type: 'UNDO' });
  }
};

const redo = () => {
  if (state._canRedo) {
    dispatch({ type: 'REDO' });
  }
};

const recordHistory = () => {
  dispatch({ type: 'RECORD_HISTORY', payload: {} });
};

// Initialize history on login
useEffect(() => {
  if (state.isLoggedIn && state._history.length === 0) {
    dispatch({ type: 'RECORD_HISTORY', payload: {} });
  }
}, [state.isLoggedIn]);
```

**精确行号**：搜索并删除 `// Undo/Redo functions` 之后的 `undo()`, `redo()`, `recordHistory()` 定义和相关 useEffect

#### 删除 6: AppContextType 接口（第 992-1005 行）

```typescript
// ❌ 删除这些类型定义
interface AppContextType {
  // ... 保留其他字段 ...
  
  // ❌ 删除以下行
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  recordHistory: () => void;
  _canUndo: boolean;
  _canRedo: boolean;
}
```

#### 删除 7: Provider 返回值中的导出

在 `AppProvider` 的返回语句中：

```typescript
// ❌ 删除这些字段
<AppContext.Provider value={{ 
  state, 
  dispatch, 
  getLearningStats, 
  getTaskCompletionRate, 
  navigate, 
  
  // ❌ 删除以下行
  undo, 
  redo, 
  recordHistory, 
  _canUndo: state._canUndo, 
  _canRedo: state._canRedo 
}}>
```

### 验证 Step 1 完成

```bash
# 1. 检查是否还有 _history 引用
grep -n "_history" src/store/AppContext.tsx
# 期望：无结果或只有注释

# 2. 检查是否编译成功
npm run build
# 期望：✅ 无错误

# 3. 检查其他文件对 AppContext undo/redo 的依赖
grep -r "useApp().*undo\|useApp().*redo" src/
# 期望：无结果

# 4. Git 提交
git add src/store/AppContext.tsx
git commit -m "refactor: remove redundant undo/redo from AppContext"
```

---

## Step 2: 冻结 Context 层（5 分钟认知）

### 创建冻结规则文档

**新建文件** `docs/CONTEXT_FREEZING_RULES.md`：

```markdown
# Context 冻结规则 (UI 重构期间)

## 生效期：[开始日期] - [UI 重构完成日期]

## 允许的改动 ✅

1. **Computed selectors（计算属性）**
   - 示例：`getLearningStats()`, `getTaskCompletionRate()`
   - 原因：这些是从现有 state 衍生的，不改变基础架构

2. **Reducer 内的逻辑优化**
   - 示例：某个 case 分支的效率优化
   - 原因：只要 action type 和 payload 不变，外部代码无感知

3. **Action payload 结构向后兼容的微调**
   - 示例：添加可选字段（非必需）
   - 原因：不破坏现有 dispatch 调用

## 禁止的改动 ❌

1. **新增/删除 State 顶级字段**
   - 反例：`state.newField = xxx`
   - 理由：会牵动所有引用该字段的 reducer case

2. **新增/删除 Action 类型**
   - 反例：`type: 'NEW_ACTION'`
   - 理由：会隐含需要新的状态，违反冻结原则

3. **改变现有 action 的 payload 结构（非向后兼容）**
   - 反例：从 `payload: string` 改为 `payload: { id: string; name: string }`
   - 理由：会破坏现有的 dispatch 调用

4. **跨 Context 数据流重构**
   - 反例：把数据从 AppContext 移到 LearningContext
   - 理由：这是架构改动，超出 UI 重构范围

5. **useXXX hook 的返回值改动**
   - 反例：删除 `learningDispatch` 或改名为 `dispatch`
   - 理由：会强制所有引用该 hook 的组件改动

## 如何执行冻结

### Pre-commit Hook 检查（可选）

创建 `.git/hooks/pre-commit`：

```bash
#!/bin/bash

# 检查是否修改了 Context 层
CHANGED_CONTEXT_FILES=$(git diff --name-only --staged | grep -E "src/store/(AppContext|LearningContext|GameContext|UserContext|AIChatContext).tsx")

if [ -n "$CHANGED_CONTEXT_FILES" ]; then
  echo "⚠️  警告：你正在修改 Context 文件！"
  echo "当前处于 Context 冻结期（UI 重构中）"
  echo -e "\n修改的文件："
  echo "$CHANGED_CONTEXT_FILES"
  echo -e "\n提交前请确认：是否真的需要改动 Context？"
  read -p "继续提交？(y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

exit 0
```

### Code Review 检查清单

当有 PR 涉及 Context 文件时，reviewer 应检查：

- [ ] 是否新增了 state 字段？
- [ ] 是否新增了 action type？
- [ ] 是否改变了 reducer 的对外 API？
- [ ] 是否有充分理由违反冻结规则？

---

## Step 3: 为 Zustand 迁移做架构预留（30 分钟）

### 3a. 重构 LearningContext（20 分钟）

**参考文档**：[STEP3_ACTIONS_TEMPLATE.md](./STEP3_ACTIONS_TEMPLATE.md)

快速检查清单：

- [ ] 定义 `LearningActions` 类型（完整列表所有 action）
- [ ] 实现 `createLearningActions` 工厂函数
- [ ] 更新 `LearningProvider` 的 `contextValue`
- [ ] 更新 `LearningContextType` 接口
- [ ] `npm run build` 验证

```bash
# 验证 LearningActions 导出
grep "export type LearningActions" src/store/LearningContext.tsx
# ✅ 应该找到导出

# 验证 createLearningActions 创建
grep "const createLearningActions" src/store/LearningContext.tsx
# ✅ 应该找到定义
```

### 3b. 重构 AppContext（10 分钟）

相同流程，参考 [STEP3_ACTIONS_TEMPLATE.md](./STEP3_ACTIONS_TEMPLATE.md) 的 "AppContext 类似处理" 部分

快速检查清单：

- [ ] 定义 `AppActions` 类型
- [ ] 实现 `createAppActions` 工厂函数
- [ ] 更新 `AppProvider` 的 `contextValue`
- [ ] 更新 `AppContextType` 接口

### 3c. 迁移组件调用（30 分钟）

**找出所有待迁移的文件**：

```bash
# 列出所有使用 learningDispatch 的文件
grep -l "learningDispatch" src/**/*.tsx | sort

# 列出所有使用 appDispatch 的文件（如果有的话）
grep -l "const { state, dispatch } = useApp()" src/**/*.tsx | sort
```

**迁移优先级**（建议顺序）：

1. **优先迁移（简单）**：单一页面组件
   ```
   src/pages/Knowledge/index.tsx
   src/pages/Knowledge/AddKnowledge.tsx
   src/pages/Knowledge/KnowledgeDetail.tsx
   ```

2. **再迁移（中等）**：有多层组件的模块
   ```
   src/pages/Quiz/
   src/pages/Review/
   src/pages/WrongBook/
   ```

3. **最后迁移（复杂）**：跨模块协调
   ```
   src/services/
   src/hooks/
   ```

**迁移脚本示例**：

```bash
# Step 1: 确定需要迁移的文件
FILES=$(grep -l "learningDispatch" src/**/*.tsx)

# Step 2: 对每个文件，手动进行以下改动：
# FROM: const { learningDispatch, learningState } = useLearning();
# TO:   const { learningActions, learningState } = useLearning();

# FROM: learningDispatch({ type: 'ACTION_NAME', payload: {...} });
# TO:   learningActions.actionName(...);

# Step 3: 每个文件改完后测试
npm run build

# Step 4: 提交本文件
git add <file>
git commit -m "refactor: migrate <module> to use actions API"
```

### 3d. 测试与验证（15 分钟）

```bash
# 完整构建
npm run build

# 运行代码检查
npm run lint

# 可选：运行单元测试（如果有）
npm run test

# 最终检查：确保没有 learningDispatch 的直接调用
grep -r "learningDispatch({" src/
# 期望：无结果

# 可选：验证 actions 对象是否完整
npm run build -- --analyze  # 如果使用了分析工具
```

**最终提交**：

```bash
git add -A
git commit -m "refactor: complete actions object pattern migration

- Refactored LearningContext to use actions API
- Refactored AppContext to use actions API
- Migrated all components to dispatch through actions
- Maintained backward compatibility with old dispatch API
- Ready for Zustand migration in next phase"
```

---

## Step 4: 开始 UI 重构

### UI 改动的定义

**允许改动** ✅：

```typescript
// ✅ JSX 结构改动
return (
  <div className="flex gap-4">
    <Component1 />
    <Component2 />  
    {/* 可以重排、添加、删除 DOM 节点 */}
  </div>
);

// ✅ Tailwind 样式改动
<button className="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-600" />

// ✅ 条件渲染逻辑
{isLoading && <Spinner />}
{!isLoading && <Content />}

// ✅ 动画/过渡
<motion.div animate={{ opacity: 1 }} transition={{ duration: 0.3 }} />

// ✅ prop 传递优化
<Child data={state.data} onUpdate={actions.update} />
```

**禁止改动** ❌：

```typescript
// ❌ 改变 dispatch 逻辑
// 这会隐含地改动 Context 层
learningDispatch({ type: 'NEW_ACTION', payload: {} });

// ❌ 新增 custom hook 读取新 state
// 这意味着需要新的状态，违反冻结
const [newState, setNewState] = useState(calculateNewData());

// ❌ 改变数据流向
// 这属于架构改动
// FROM: parent → child via props
// TO:   both use context directly

// ❌ 新增 Context 字段
const newValue = { ...contextValue, newField: xxx };
```

### UI 重构验收标准

```bash
# 每个 PR 检查清单

# 1. 没有 Context 层改动
git diff --name-only | grep -E "src/store/"
# ✅ 应该无结果

# 2. 没有新的 dispatch 调用
git diff | grep "dispatch({ type:"
# ✅ 应该无结果

# 3. 构建成功
npm run build
# ✅ 无错误

# 4. 跑过 lint
npm run lint
# ✅ 无警告

# 5. 视觉没有回归
# ✅ 用 screenshot 对比或手工验证
```

---

## 完整命令速查表

### 初始化

```bash
# 1. 创建特性分支
git checkout -b refactor/context-cleanup-and-ui

# 2. 从 main 拉最新
git fetch origin
git rebase origin/main

# 3. 查看当前状态
git status
```

### Step 1 验证

```bash
# 查现有 undo/redo 使用
grep -r "\.undo\|\.redo" src/

# 备份 AppContext（可选）
cp src/store/AppContext.tsx src/store/AppContext.tsx.bak

# 进行删除...

# 验证
npm run build
npm run lint
```

### Step 3a 验证

```bash
# 编辑 LearningContext...

# 验证 LearningActions 导出
grep "export type LearningActions" src/store/LearningContext.tsx

# 完整测试
npm run build
```

### Step 3c 迁移

```bash
# 找待迁移文件
grep -l "learningDispatch" src/**/*.tsx

# 对每个文件
# 1. 打开并手动改动
# 2. 验证构建
npm run build
# 3. 提交
git add <file>
git commit -m "refactor: migrate <file> to actions API"
```

### 最终完成

```bash
# 最终检查
npm run build
npm run lint
# npm run test （如果有）

# 提交准备
git status
git log --oneline -10  # 查看提交历史

# 推送和创建 PR
git push origin refactor/context-cleanup-and-ui
# 在 GitHub 创建 PR，描述：
# - Step 1: Removed redundant undo/redo from AppContext
# - Step 3: Refactored to actions object pattern
# - Ready for UI refactor with frozen Context layer
```

---

## 故障排除

### 问题 1：删除后编译失败，提示缺少 _canUndo 等

**解决**：
```bash
# 查找还有哪些地方引用了
grep -r "_canUndo\|_canRedo" src/

# 应该只在 AppContext 中出现
# 如果在 AppProvider 中还有引用，继续删除

# 或者检查是否在其他地方通过 useApp() 访问
grep -r "useApp()" src/ | grep "_can"
```

### 问题 2：重构 actions 后某个文件找不到 action 方法

**解决**：
```bash
# 1. 检查 LearningActions 类型定义
grep -A 50 "export type LearningActions" src/store/LearningContext.tsx

# 2. 确认 createLearningActions 中有对应的方法实现
grep -A 5 "const createLearningActions" src/store/LearningContext.tsx

# 3. 如果缺少，补充该 action
# 编辑 LearningContext.tsx，在两个地方都添加：
# - LearningActions 类型中
# - createLearningActions 工厂中
```

### 问题 3：组件迁移后 TypeScript 类型错误

**常见原因**：

```typescript
// ❌ 错误：还在用 learningDispatch
const { learningDispatch } = useLearning();
learningDispatch({ type: 'ADD_KNOWLEDGE_POINT', payload: kp });

// ✅ 正确：用 learningActions
const { learningActions } = useLearning();
learningActions.addKnowledgePoint(kp);
```

### 问题 4：不确定某个 action 在哪里调用

```bash
# 查找特定 action 的所有调用
grep -r "ADD_KNOWLEDGE_POINT\|addKnowledgePoint" src/

# 查找使用 learningDispatch 的所有地方
grep -r "learningDispatch" src/ --include="*.tsx" --include="*.ts"
```

---

## 预计时间表和里程碑

| 里程碑 | 时间 | 状态 | 备注 |
|--------|------|------|------|
| Step 1 完成 | 30 分钟 | ⚪ 待开始 | npm run build ✅ |
| Step 2 完成 | 5 分钟 | ⚪ 待开始 | 文档确认 ✅ |
| Step 3a 完成 | 20 分钟 | ⚪ 待开始 | LearningContext actions ✅ |
| Step 3b 完成 | 10 分钟 | ⚪ 待开始 | AppContext actions ✅ |
| Step 3c 完成 | 30 分钟 | ⚪ 待开始 | 所有组件迁移 ✅ |
| Step 3d 完成 | 15 分钟 | ⚪ 待开始 | 最终测试 ✅ |
| **全部完成** | **~2 小时** | ⚪ 待开始 | 冻结 Context + UI 重构可开始 |

---

## 成功标志

```bash
# 执行这个检查清单，全部 ✅ 表示完成

✅ AppContext 中无 _history 引用
✅ AppContext 中无 UNDO/REDO action type
✅ AppContext reducer 中无 undo/redo case
✅ npm run build 无错误
✅ npm run lint 无警告
✅ LearningContext 导出 LearningActions 类型
✅ LearningContext 有 createLearningActions 工厂
✅ AppContext 导出 AppActions 类型
✅ AppContext 有 createAppActions 工厂
✅ useLearning() 返回 learningActions
✅ useApp() 返回 appActions
✅ 所有组件迁移完毕（grep 无 learningDispatch 结果）
✅ Context 冻结规则文档已创建
✅ 所有改动已提交到 Git

🎉 准备好开始 UI 重构了！
```
