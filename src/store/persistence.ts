const STORAGE_KEY = 'study-app-state';
const STORAGE_VERSION = 1;

// localStorage is only for lightweight account/UI/game state.
// Large learning datasets are cached in IndexedDB instead.
const PERSIST_KEYS = [
  'user',
  'achievements',
  'team',
  'mail',
] as const;

export function saveState(state: Record<string, unknown>): void {
  try {
    const existing = loadState();
    const baseState = existing || {};
    const mergedState = deepMergeState(baseState, state);

    const toSave: Record<string, unknown> = {
      _version: STORAGE_VERSION,
      _savedAt: new Date().toISOString(),
      ...mergedState,
    };

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

export function loadState(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);

    if (data._version !== STORAGE_VERSION) {
      return null;
    }

    delete data._version;
    delete data._savedAt;

    return data;
  } catch (e) {
    console.warn('Failed to load state:', e);
    return null;
  }
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

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
      result[key] = deepMergeState(
        baseValue as Record<string, unknown>,
        updateValue as Record<string, unknown>
      );
    } else {
      result[key] = updateValue;
    }
  }

  return result;
}
