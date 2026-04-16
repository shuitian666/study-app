/**
 * 数据持久化工具 - localStorage 存储
 */

const STORAGE_KEY = 'study-app-state';
const STORAGE_VERSION = 1;

// 需要持久化的状态字段
// 注意：游戏化相关状态（checkin、achievements、shopItems等）由 GameContext 单独管理
const PERSIST_KEYS = [
  'user', 'subjects', 'chapters', 'knowledgePoints', 'questions',
  'quizResults', 'wrongRecords',
  // 【修复】添加今日复习和新学任务，防止刷新后数据丢失
  'todayReviewItems', 'todayNewItems', 'importedStudySession'
] as const;

/**
 * 保存状态到 localStorage
 * 使用深度合并，防止多 Context 保存时相互覆盖数据
 */
export function saveState(state: Record<string, unknown>): void {
  try {
    // 读取已有数据，使用深度合并
    const existing = loadState();
    const baseState = existing || {};

    const mergedState = deepMergeState(baseState, state);

    const toSave: Record<string, unknown> = {
      _version: STORAGE_VERSION,
      _savedAt: new Date().toISOString(),
      ...mergedState,
    };

    // 只保存 PERSIST_KEYS 中的字段
    const result: Record<string, unknown> = {
      _version: toSave._version,
      _savedAt: toSave._savedAt,
    };

    for (const key of PERSIST_KEYS) {
      if (toSave[key] !== undefined) {
        result[key] = toSave[key];
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  } catch (e) {
    console.warn('Failed to save state:', e);
  }
}

/**
 * 从 localStorage 加载状态
 */
export function loadState(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    
    const data = JSON.parse(raw);
    
    // 版本检查
    if (data._version !== STORAGE_VERSION) {
      console.log('State version mismatch, using defaults');
      return null;
    }
    
    // 删除元数据字段
    delete data._version;
    delete data._savedAt;
    
    return data;
  } catch (e) {
    console.warn('Failed to load state:', e);
    return null;
  }
}

/**
 * 清除持久化数据
 */
export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 深度合并两个状态对象，updates 的值会覆盖 base 的值
 * 用于防止持久化时数据被覆盖
 */
export function deepMergeState(
  base: Record<string, unknown>,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(updates)) {
    const baseValue = base[key];
    const updateValue = updates[key];

    if (
      updateValue !== null &&
      typeof updateValue === 'object' &&
      !Array.isArray(updateValue) &&
      baseValue !== null &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      // 两者都是对象，递归合并
      result[key] = deepMergeState(
        baseValue as Record<string, unknown>,
        updateValue as Record<string, unknown>
      );
    } else {
      // 否则 updates 的值覆盖 base 的值
      result[key] = updateValue;
    }
  }

  return result;
}
