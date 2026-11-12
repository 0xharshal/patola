/**
 * Safe localStorage access for user content and settings. Storage can be
 * missing, full or blocked (private windows), so every call is guarded and
 * invalid entries are dropped.
 */
function readStoredJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

export function readStoredList<T>(key: string, isValid: (value: unknown) => value is T): T[] {
  const parsed = readStoredJson(key);
  return Array.isArray(parsed) ? parsed.filter(isValid) : [];
}

/** A stored object (e.g. settings), or an empty one; check its values before use. */
export function readStoredObject(key: string): Record<string, unknown> {
  const parsed = readStoredJson(key);
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

/** A short id that is unique in practice, e.g. 'user:lx3k2a9f'. */
export function newId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
}

export function writeStored(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
