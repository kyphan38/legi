'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import CropView from '@/components/CropView';
import { CameraIcon } from '@/components/Icons';
import { captureStore, type CaptureItem } from '@/lib/capture';
import type { Box } from '@/lib/crop';
import { shrinkImage } from '@/lib/image';
import { addSnap } from '@/lib/snaps';

/**
 * Photos of pages with pencil marks (camera or library). Each one is cropped
 * first, so the model only reads the part that matters.
 * Online → read now; offline → Snaps for later.
 */
export default function CameraButton({ uid, bookId, sectionId }: { uid: string; bookId: string | null; sectionId: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  // Photos waiting for a crop, and the boxes chosen so far.
  const [queue, setQueue] = useState<{ files: File[]; boxes: Box[] } | null>(null);

  const onFiles = (files: FileList | null) => {
    const list = files ? Array.from(files).slice(0, 8) : [];
    if (input.current) input.current.value = '';
    if (list.length > 0) setQueue({ files: list, boxes: [] });
  };

  const onCrop = (box: Box) => {
    if (!queue) return;
    const boxes = [...queue.boxes, box];
    if (boxes.length < queue.files.length) return setQueue({ ...queue, boxes });
    setQueue(null);
    void send(queue.files, boxes);
  };

  const send = async (files: File[], boxes: Box[]) => {
    const blobs: Blob[] = [];
    for (const [i, f] of files.entries()) {
      try {
        blobs.push(await shrinkImage(f, boxes[i]));
      } catch (err) {
        console.warn('[camera] could not read a photo', err);
      }
    }
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
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      {queue && (
        <CropView
          key={queue.boxes.length}
          file={queue.files[queue.boxes.length]}
          step={queue.files.length > 1 ? `${queue.boxes.length + 1} / ${queue.files.length}` : null}
          onUse={onCrop}
          onCancel={() => setQueue(null)}
        />
      )}
      {note && <span className="fade-in text-muted">{note}</span>}
    </>
  );
}
