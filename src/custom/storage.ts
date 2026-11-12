/**
 * Safe localStorage access for lists of user content. Storage can be missing,
 * full or blocked (private windows), so every call is guarded and invalid
 * entries are dropped.
 */
export function readStoredList<T>(key: string, isValid: (value: unknown) => value is T): T[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isValid) : [];
  } catch {
    return [];
  }
}

/** A short id that is unique in practice, e.g. 'user:lx3k2a9f'. */
export function newId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
}

export function writeStoredList(key: string, list: unknown[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}
