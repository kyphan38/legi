'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { CameraIcon } from '@/components/Icons';
import { captureStore, type CaptureItem } from '@/lib/capture';
import { shrinkImage } from '@/lib/image';
import { addSnap } from '@/lib/snaps';

/** Photos of pages with pencil marks (camera or library). Online → read now; offline → Snaps for later. */
export default function CameraButton({ uid, bookId, sectionId }: { uid: string; bookId: string | null; sectionId: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const blobs: Blob[] = [];
    for (const f of Array.from(files).slice(0, 8)) {
      try {
        blobs.push(await shrinkImage(f));
      } catch (err) {
        console.warn('[camera] could not read a photo', err);
      }
    }
    if (input.current) input.current.value = '';
    if (blobs.length === 0) return;
    if (!navigator.onLine) {
      for (const blob of blobs) await addSnap({ uid, bookId, sectionId, blob });
      setNote('Saved to Snaps.');
      setTimeout(() => setNote(null), 3000);
      return;
    }
    const items: CaptureItem[] = blobs.map((blob, i) => ({
      key: `${Date.now()}-${i}`,
      snapId: null,
      bookId,
      sectionId,
      blob,
      mode: 'marked',
      status: 'reading',
      pages: [],
    }));
    captureStore.set(items);
    router.push('/capture/');
  };

  return (
    <>
      <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => input.current?.click()} aria-label="Photo of a page" className="hover:text-muted">
        <CameraIcon size={15} />
      </button>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
      {note && <span className="fade-in text-muted">{note}</span>}
    </>
  );
}
