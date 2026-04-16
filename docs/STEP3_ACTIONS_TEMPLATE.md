# LearningContext Actions 重构模板

这是 Step 3 的详细代码示例，展示如何将 `dispatch` 改写为 `actions` 对象模式。

## 当前代码（使用 dispatch）

```typescript
// src/pages/Knowledge/index.tsx
const { learningDispatch, learningState } = useLearning();

const handleAddKnowledge = async (kp: KnowledgePoint) => {
  learningDispatch({ type: 'ADD_KNOWLEDGE_POINT', payload: kp });
};

const handleUpdateProficiency = (id: string, prof: ProficiencyLevel) => {
  learningDispatch({ 
    type: 'UPDATE_PROFICIENCY', 
    payload: { id, proficiency: prof } 
  });
};
```

## 目标代码（使用 actions）

```typescript
// src/pages/Knowledge/index.tsx
const { learningActions } = useLearning();

const handleAddKnowledge = async (kp: KnowledgePoint) => {
  learningActions.addKnowledgePoint(kp);
};

const handleUpdateProficiency = (id: string, prof: ProficiencyLevel) => {
  learningActions.updateProficiency(id, prof);
};
```

## 实现步骤

### 步骤 1：定义 LearningActions 类型

文件：`src/store/LearningContext.tsx`

```typescript
// 在 LearningAction type 之后添加
export type LearningActions = {
  // 知识点操作
  addKnowledgePoint: (kp: KnowledgePoint) => void;
  updateKnowledgePoint: (payload: Partial<KnowledgePoint> & { id: string }) => void;
  deleteKnowledgePoint: (id: string) => void;
  updateProficiency: (id: string, proficiency: ProficiencyLevel) => void;
  
  // 测验和错题
  addQuizResult: (result: QuizResult) => void;
  addWrongRecord: (record: WrongRecord) => void;
  removeWrongRecord: (id: string) => void;
  
  // 复习项目
  setReviewItems: (review: ReviewItem[], newItems: ReviewItem[]) => void;
  completeReviewItem: (id: string) => void;
  
  // 问题解释
  saveQuestionExplanation: (explanation: QuestionExplanation) => void;
  updateQuestionExplanation: (questionId: string, explanation: string) => void;
  deleteQuestionExplanation: (questionId: string) => void;
  
  // AI 生成问题
  addGeneratedQuestion: (question: Question) => void;
  
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  recordHistory: () => void;
  
  // 其他
  setKnowledgeData: (data: { subjects: Subject[]; chapters: Chapter[]; knowledgePoints: KnowledgePoint[]; questions: Question[] }) => void;
  recordFlashcardStudy: (knowledgePointId: string, score: number) => void;
  recordQuizAnswer: (knowledgePointId: string, questionId: string, correct: boolean, score: number) => void;
  updateKnowledgePointScore: (id: string, score: number) => void;
  setMemoryTip: (knowledgePointId: string, tip: string) => void;
  updateFsrsCard: (knowledgePointId: string, updates: Partial<KnowledgePointExtended>) => void;
};
```

### 步骤 2：创建 actions 工厂函数

在 `LearningProvider` 组件之前添加：

```typescript
// 创建 actions 对象的工厂函数
const createLearningActions = (dispatch: React.Dispatch<LearningAction>): LearningActions => ({
  // 知识点操作
  addKnowledgePoint: (kp) => {
    dispatch({ type: 'ADD_KNOWLEDGE_POINT', payload: kp });
  },
  
  updateKnowledgePoint: (payload) => {
    dispatch({ type: 'UPDATE_KNOWLEDGE_POINT', payload });
  },
  
  deleteKnowledgePoint: (id) => {
    dispatch({ type: 'DELETE_KNOWLEDGE_POINT', payload: id });
  },
  
  updateProficiency: (id, proficiency) => {
    dispatch({ type: 'UPDATE_PROFICIENCY', payload: { id, proficiency } });
  },
  
  // 测验和错题
  addQuizResult: (result) => {
    dispatch({ type: 'ADD_QUIZ_RESULT', payload: result });
  },
  
  addWrongRecord: (record) => {
    dispatch({ type: 'ADD_WRONG_RECORD', payload: record });
  },
  
  removeWrongRecord: (id) => {
    dispatch({ type: 'REMOVE_WRONG_RECORD', payload: id });
  },
  
  // 复习项目
  setReviewItems: (review, newItems) => {
    dispatch({ type: 'SET_REVIEW_ITEMS', payload: { review, newItems } });
  },
  
  completeReviewItem: (id) => {
    dispatch({ type: 'COMPLETE_REVIEW_ITEM', payload: id });
  },
  
  // 问题解释
  saveQuestionExplanation: (explanation) => {
    dispatch({ type: 'SAVE_QUESTION_EXPLANATION', payload: explanation });
  },
  
  updateQuestionExplanation: (questionId, explanation) => {
    dispatch({ type: 'UPDATE_QUESTION_EXPLANATION', payload: { questionId, explanation } });
  },
  
  deleteQuestionExplanation: (questionId) => {
    dispatch({ type: 'DELETE_QUESTION_EXPLANATION', payload: questionId });
  },
  
  // AI 生成问题
  addGeneratedQuestion: (question) => {
    dispatch({ type: 'AI_ADD_GENERATED_QUESTION', payload: question });
  },
  
  // Undo/Redo
  undo: () => {
    dispatch({ type: 'UNDO' });
  },
  
  redo: () => {
    dispatch({ type: 'REDO' });
  },
  
  recordHistory: () => {
    dispatch({ type: 'RECORD_HISTORY' });
  },
  
  // 其他
  setKnowledgeData: (data) => {
    dispatch({ type: 'SET_KNOWLEDGE_DATA', payload: data });
  },
  
  recordFlashcardStudy: (knowledgePointId, score) => {
    dispatch({ type: 'RECORD_FLASHCARD_STUDY', payload: { knowledgePointId, score } });
  },
  
  recordQuizAnswer: (knowledgePointId, questionId, correct, score) => {
    dispatch({ type: 'RECORD_QUIZ_ANSWER', payload: { knowledgePointId, questionId, correct, score } });
  },
  
  updateKnowledgePointScore: (id, score) => {
    dispatch({ type: 'UPDATE_KNOWLEDGE_POINT_SCORE', payload: { id, score } });
  },
  
  setMemoryTip: (knowledgePointId, tip) => {
    dispatch({ type: 'SET_MEMORY_TIP', payload: { knowledgePointId, tip } });
  },
  
  updateFsrsCard: (knowledgePointId, updates) => {
    dispatch({ type: 'UPDATE_FSRS_CARD', payload: { knowledgePointId, updates } });
  },
});
```

### 步骤 3：修改 LearningProvider 返回值

找到 `LearningProvider` 中的 `contextValue`，改为：

```typescript
export function LearningProvider({ children }: { children: ReactNode }) {
  const [learningState, learningDispatch] = useReducer(learningReducer, initialLearningState);
  
  // ... 其他代码 ...
  
  // 创建 actions 实例
  const learningActions = useMemo(() => createLearningActions(learningDispatch), [learningDispatch]);
  
  const contextValue = useMemo(() => ({
    // 原有导出的字段（保持向后兼容）
    learningState,
    learningDispatch,
    getLearningStats,
    getTaskCompletionRate,
    
    // 新的 actions API
    learningActions,
    
    // 遗留的便利函数（可逐步移除）
    undo: learningActions.undo,
    redo: learningActions.redo,
    recordHistory: learningActions.recordHistory,
    _canUndo: learningState._canUndo,
    _canRedo: learningState._canRedo
  }), [learningState, learningDispatch, learningActions, getLearningStats, getTaskCompletionRate]);
  
  return (
    <LearningContext.Provider value={contextValue}>
      {children}
    </LearningContext.Provider>
  );
}
```

### 步骤 4：更新 useLearning() hook 返回类型

```typescript
interface LearningContextType {
  learningState: LearningState;
  learningDispatch: React.Dispatch<LearningAction>;
  learningActions: LearningActions;  // ← 新增
  getLearningStats: () => LearningStats;
  getTaskCompletionRate: () => { done: number; total: number; rate: number };
  
  // 遗留（向后兼容）
  undo: () => void;
  redo: () => void;
  recordHistory: () => void;
  _canUndo: boolean;
  _canRedo: boolean;
}

const LearningContext = createContext<LearningContextType | null>(null);

export function useLearning() {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error('useLearning must be used within LearningProvider');
  return ctx;
}
```

## 迁移检查清单

### Phase 1: 基础设施（此次重构）
- [ ] 定义 `LearningActions` 类型
- [ ] 创建 `createLearningActions` 工厂函数
- [ ] 更新 `LearningProvider` 返回值
- [ ] 更新 `useLearning()` 类型定义
- [ ] `npm run build` 验证无错误
- [ ] 运行现有单元测试（如果有）

### Phase 2: 组件迁移（建议）
```bash
# 找出所有使用 learningDispatch 的文件
grep -r "learningDispatch" src/

# 逐文件迁移，先易后难
# 易：单个页面（Knowledge、AddKnowledge 等）
# 难：多层组件树的中间协调
```

迁移示例：

**FROM:**
```typescript
const handleDelete = (id: string) => {
  learningDispatch({ type: 'DELETE_KNOWLEDGE_POINT', payload: id });
};
```

**TO:**
```typescript
const handleDelete = (id: string) => {
  learningActions.deleteKnowledgePoint(id);
};
```

### Phase 3: 清理（迁移完成后）
- [ ] 删除 `learningDispatch` 从导出
- [ ] 删除遗留的便利函数（undo, redo, recordHistory）
- [ ] 简化 `useLearning()` 返回类型
- [ ] 最终 `npm run build && npm run lint`

## AppContext 类似处理

相同的流程应用于 `AppContext`：

1. 定义 `AppActions` 类型（包含所有 action）
2. 创建 `createAppActions` 工厂
3. 更新 `AppProvider` 和 `useApp()` hook
4. 逐步迁移组件

**AppActions 应包含的主要操作：**
```typescript
export type AppActions = {
  // 用户相关
  login: (user: User) => void;
  logout: () => void;
  updateUser: (payload: Partial<User>) => void;
  
  // 导航
  navigate: (page: PageName, params?: Record<string, string>) => void;
  
  // 学科、章节、知识点（暂时保留，因为可能需要与 LearningContext 同步）
  addSubject: (subject: Subject) => void;
  addChapter: (chapter: Chapter) => void;
  
  // 游戏化相关（检查是否应该迁移到 GameContext）
  unlockhievement: (id: string) => void;
  
  // 邮件系统
  addMail: (mail: MailItem) => void;
  setMails: (mails: MailItem[]) => void;
  markMailRead: (id: string) => void;
  claimMailAttachment: (mailId: string, attachmentIndex: number) => void;
  
  // 背包/库存
  addInventoryItem: (item: InventoryItem) => void;
  useInventoryItem: (id: string) => void;
  removeInventoryItem: (id: string) => void;
  
  // 其他...
};
```

## 预期收益

| 方面 | 现在 | 迁移后 |
|------|------|--------|
| **代码可读性** | `dispatch({ type: '...', payload: {} })` | `actions.addKnowledgePoint(kp)` |
| **类型安全** | 需要查看 Action 联合类型 | IDE 自动补全 action 参数 |
| **Zustand 迁移成本** | 高（需要重写组件调用） | 低（组件代码 0 改） |
| **维护 reducer 逻辑** | 分散在 dispatch 调用处 | 集中在 actions 工厂 |
| **测试** | 测试 reducer 逻辑 | 测试 actions + reducer 分离 |

## 进度跟踪

```bash
# 完成 Phase 1 后验证
npm run build

# 查看待迁移的 dispatch 调用数量
grep -r "learningDispatch({" src/ | wc -l

# 完成迁移后删除 dispatch 引用
grep -r "learningDispatch" src/ | grep -v "useCallback\|useMemo"
```

---

**预计执行时间**：
- Phase 1（基础设施）：20 分钟
- Phase 2（组件迁移）：30 分钟
- Phase 3（清理）：10 分钟
- **总计**：60 分钟（LearningContext 部分）

对 AppContext 应用相同流程后，总计约 **2 小时**。
