'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';

import { dragBox, FULL, type Box, type Handle } from '@/lib/crop';
import { reducedMotion } from '@/lib/motion';

type Props = {
  file: Blob;
  /** "2 / 3" when several photos are cropped in a row. */
  step: string | null;
  onUse: (box: Box) => void;
  onCancel: () => void;
};

const CORNERS: { h: Handle; pos: string; edge: string }[] = [
  { h: 'nw', pos: '-left-5 -top-5', edge: 'left-5 top-5 border-l-[3px] border-t-[3px]' },
  { h: 'ne', pos: '-right-5 -top-5', edge: 'right-5 top-5 border-r-[3px] border-t-[3px]' },
  { h: 'sw', pos: '-bottom-5 -left-5', edge: 'bottom-5 left-5 border-b-[3px] border-l-[3px]' },
  { h: 'se', pos: '-right-5 -bottom-5', edge: 'right-5 bottom-5 border-r-[3px] border-b-[3px]' },
];

/**
 * Full-screen crop right after a photo is taken: drag a corner, or the
 * middle to move. Untouched = the whole photo. Own pointer code, no library.
 */
export default function CropView({ file, step, onUse, onCancel }: Props) {
  // The parent keys this view by photo, so the box starts fresh for each one.
  const [box, setBox] = useState<Box>(FULL);
  const frame = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ handle: Handle; x: number; y: number; box: Box } | null>(null);
  // Cancel fades the view out first. "use" closes it at once: the next photo or the read follows.
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const cancel = () => {
    if (leaving) return;
    if (reducedMotion()) {
      onCancel();
      return;
    }
    setLeaving(true);
    timer.current = setTimeout(onCancel, 200);
  };

  useEffect(() => {
    const u = URL.createObjectURL(file);
    if (img.current) img.current.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (leaving) return;
      if (e.key === 'Escape') cancel();
      else if (e.key === 'Enter') onUse(box);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `cancel` only reads `leaving` and `onCancel`
  }, [box, onUse, onCancel, leaving]);

  const start = (handle: Handle, e: PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { handle, x: e.clientX, y: e.clientY, box };
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const rect = frame.current?.getBoundingClientRect();
    if (!d || !rect?.width || !rect.height) return;
    setBox(dragBox(d.box, d.handle, (e.clientX - d.x) / rect.width, (e.clientY - d.y) / rect.height));
  };
  const end = () => {
    drag.current = null;
  };

  return createPortal(
    <div
      className={`${leaving ? 'fade-out pointer-events-none' : 'fade-in'} fixed inset-0 z-50 flex flex-col bg-black text-[15px] text-white/80`}
      role="dialog"
      aria-modal="true"
      aria-label="Crop"
    >
      {/* Above the shade, which spills over the whole screen. */}
      <div className="relative z-10 flex items-center justify-between bg-black px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <button type="button" onClick={cancel} className="py-2 hover:text-white">
          cancel
        </button>
        <span className="text-white/50 tabular-nums">{step}</span>
        <button type="button" onClick={() => onUse(box)} className="py-2 font-medium text-white">
          use
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <div ref={frame} className="relative touch-none select-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob, next/image adds nothing */}
          <img ref={img} alt="" draggable={false} className="block max-h-[calc(100dvh-140px)] max-w-full" />
          <div
            onPointerDown={(e) => start('move', e)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className="absolute cursor-move shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] outline outline-1 outline-white/70"
            style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
          >
            {CORNERS.map(({ h, pos, edge }) => (
              <div key={h} onPointerDown={(e) => start(h, e)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-hidden className={`absolute size-14 ${pos}`}>
                <span className={`absolute size-5 border-white drop-shadow-[0_0_2px_rgb(0_0_0/0.6)] ${edge}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
