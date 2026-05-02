export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

function now(): number {
  return Date.now();
}

export function getCached<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
  store.set(key, { value, expiresAt: now() + ttlMs });
}

export async function getOrSetCached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) return cached;
  const value = await loader();
  setCached(key, value, ttlMs);
  return value;
}

export function clearCacheForTests(): void {
  store.clear();
}

export const GRAPH_CACHE_TTL_MS = 5 * 60 * 1000;
export const PR_CACHE_TTL_MS = 10 * 60 * 1000;
