// ============================================================
// legi - Small stores for useSyncExternalStore
//
// Same approach as fina/src/lib/prefs.ts: reading localStorage in useEffect
// causes a hydration mismatch, and React 19 forbids setState directly in an
// effect. With useSyncExternalStore the server uses the default and the
// client reads the real value right after hydration.
//
// Every storage access is wrapped in try/catch: Safari private mode throws.
// ============================================================

type Listener = () => void;

export type Store<T> = {
  subscribe(fn: Listener): () => void;
  get(): T;
  getServer(): T;
  set(next: T): void;
};

/** A value that lives only in RAM (e.g. typing or not). */
export function memoryStore<T>(initial: T): Store<T> {
  const listeners = new Set<Listener>();
  let value = initial;
  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get: () => value,
    getServer: () => initial,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((fn) => fn());
    },
  };
}

/** A string in localStorage (per device) or sessionStorage (per session). */
export function stringStore<T extends string>(
  key: string,
  fallback: T,
  parse: (raw: string) => T | null,
  kind: 'local' | 'session' = 'local',
): Store<T> {
  const listeners = new Set<Listener>();
  let cache: T | undefined;
  const storage = () => (kind === 'local' ? localStorage : sessionStorage);

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get() {
      if (cache !== undefined) return cache;
      try {
        const raw = storage().getItem(key);
        cache = (raw !== null ? parse(raw) : null) ?? fallback;
      } catch {
        cache = fallback;
      }
      return cache;
    },
    getServer: () => fallback,
    set(next) {
      cache = next;
      try {
        storage().setItem(key, next);
      } catch {
        // ignore
      }
      listeners.forEach((fn) => fn());
    },
  };
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/** Removes every legi key (on sign out). */
export function clearLegiStorage(): void {
  for (const storage of [() => localStorage, () => sessionStorage]) {
    try {
      const s = storage();
      Object.keys(s)
        .filter((k) => k.startsWith('legi.'))
        .forEach((k) => s.removeItem(k));
    } catch {
      // ignore
    }
  }
}
