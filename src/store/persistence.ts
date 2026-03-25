/**
 * 数据持久化工具 - localStorage 存储
 */

const STORAGE_KEY = 'study-app-state';
const STORAGE_VERSION = 1;

// 需要持久化的状态字段
const PERSIST_KEYS = [
  'user', 'subjects', 'chapters', 'knowledgePoints', 'questions',
  'quizResults', 'wrongRecords', 'checkin', 'achievements', 'shopItems',
  'drawBalance', 'upPool', 'team', 'redeemedCodes'
] as const;

/**
 * 保存状态到 localStorage
 */
export function saveState(state: Record<string, unknown>): void {
  try {
    const toSave: Record<string, unknown> = {
      _version: STORAGE_VERSION,
      _savedAt: new Date().toISOString(),
    };
    
    for (const key of PERSIST_KEYS) {
      if (state[key] !== undefined) {
        toSave[key] = state[key];
      }
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
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
