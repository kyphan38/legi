'use client';

import { useLibrary } from '@/contexts/LibraryContext';

/**
 * Save status, no words (from hodi): hollow dot = saved on this device, not
 * in the cloud yet; solid dot = in the cloud (lights up, then fades).
 * `inline` sits in the composer row; otherwise it is fixed bottom right.
 */
export default function StatusDot({ inline = false }: { inline?: boolean }) {
  const { pending, loaded } = useLibrary();
  if (!loaded) return null;
  return (
    <span
      aria-label={pending ? 'Saved on this device' : 'Saved'}
      role="status"
      className={inline ? 'p-1 text-faint' : 'pointer-events-none fixed right-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 p-2 text-faint'}
    >
      <span
        key={pending ? 'local' : 'synced'}
        className={`block size-[7px] rounded-full border-[1.5px] border-current ${pending ? '' : 'settle bg-current'}`}
      />
    </span>
  );
}
