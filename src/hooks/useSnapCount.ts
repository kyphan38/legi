'use client';

import { useEffect, useState } from 'react';

import { listSnaps, SNAPS_EVENT } from '@/lib/snaps';

/** How many page photos wait on this device (0 when IndexedDB is not there). */
export function useSnapCount(uid: string): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => void listSnaps(uid).then((s) => alive && setN(s.length));
    load();
    window.addEventListener(SNAPS_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(SNAPS_EVENT, load);
    };
  }, [uid]);
  return n;
}
