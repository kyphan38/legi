// ============================================================
// legi - Snap for later: page photos waiting to be read (IndexedDB, plain API)
//
// Photos stay on this device only, never in the cloud. A snap is deleted as
// soon as its quotes are saved or it is dismissed. Sign out deletes them all.
// ============================================================

export type Snap = { id: string; uid: string; bookId: string | null; sectionId: string | null; blob: Blob; createdAt: number };

const DB = 'legi-snaps';
const STORE = 'snaps';
export const SNAPS_EVENT = 'legi-snaps';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function changed() {
  window.dispatchEvent(new Event(SNAPS_EVENT));
}

export async function addSnap(snap: Omit<Snap, 'id' | 'createdAt'>): Promise<string> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await run('readwrite', (s) => s.put({ ...snap, id, createdAt: Date.now() }));
  changed();
  return id;
}

export async function listSnaps(uid: string): Promise<Snap[]> {
  try {
    const all = await run<Snap[]>('readonly', (s) => s.getAll() as IDBRequest<Snap[]>);
    return all.filter((x) => x.uid === uid).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function deleteSnap(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
  changed();
}

export function clearSnaps(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(DB);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
