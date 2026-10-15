import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * JSON state persisted in localStorage, shared by every component that
 * uses the same key (and kept in sync with other tabs).
 *
 * An in-memory copy is the source of truth for this page session, so
 * edits still work when localStorage is full or blocked; writing through
 * to localStorage is best-effort. All writes must go through this module
 * (useStoredState or writeStored) so the in-memory copy never goes stale.
 */

const memory = new Map<string, string | null>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null) memory.clear();
    else memory.delete(e.key);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function readRaw(key: string): string | null {
  if (!memory.has(key)) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {}
    memory.set(key, raw);
  }
  return memory.get(key)!;
}

function parse<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readStored<T>(key: string, fallback: T): T {
  return parse(readRaw(key), fallback);
}

export function writeStored<T>(key: string, value: T): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    localStorage.setItem(key, raw);
  } catch {}
  notify();
}

/**
 * useState backed by localStorage. The server render and hydration pass
 * see `fallback`; the stored value arrives on the next client render.
 * `fallback` must be referentially stable (a module-level constant).
 */
export function useStoredState<T>(
  key: string,
  fallback: T
): [T, (update: T | ((prev: T) => T)) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null
  );
  const value = useMemo(() => parse(raw, fallback), [raw, fallback]);
  const setValue = useCallback(
    (update: T | ((prev: T) => T)) => {
      const prev = readStored(key, fallback);
      const next =
        typeof update === "function" ? (update as (prev: T) => T)(prev) : update;
      writeStored(key, next);
    },
    [key, fallback]
  );
  return [value, setValue];
}
