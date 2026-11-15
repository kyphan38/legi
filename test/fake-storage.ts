/**
 * A tiny localStorage for node tests. Items are own enumerable keys, like the
 * browser's, because the app lists them with Object.keys(localStorage).
 */
export function installFakeStorage(): Record<string, string> {
  const store: Record<string, string> = {};
  const methods = {
    getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
  for (const [name, fn] of Object.entries(methods)) Object.defineProperty(store, name, { value: fn, enumerable: false });
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(globalThis, name, { value: name === 'localStorage' ? store : installSession(), configurable: true, writable: true });
  }
  return store;
}

function installSession(): Record<string, string> {
  const s: Record<string, string> = {};
  Object.defineProperty(s, 'getItem', { value: (k: string) => s[k] ?? null, enumerable: false });
  Object.defineProperty(s, 'setItem', { value: (k: string, v: string) => (s[k] = String(v)), enumerable: false });
  Object.defineProperty(s, 'removeItem', { value: (k: string) => delete s[k], enumerable: false });
  return s;
}
