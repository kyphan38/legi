'use client';

// ============================================================
// legi - Where am I in this book
//
// Desktop (>= 1280px): a fixed rail on the left. Phone/tablet: a thin line
// under the top bar with the current path; tap → the same outline in a sheet.
// Plus a minimap on the right edge (phone/tablet, >= 3 sections).
// "edit" turns the outline into a list of inputs: Tab / Shift+Tab indent,
// ⌥↑ / ⌥↓ move, long press for the same on phones, paste a table of contents.
// ============================================================

import { useEffect, useRef, useState } from 'react';

import Sheet from '@/components/Sheet';
import { indent, moveDown, moveUp, outdent, parseToc, removeSection, renameSection, type TreeNode } from '@/lib/outline';
import type { Section } from '@/types/legi';

type Props = {
  nodes: TreeNode[];
  sections: Section[];
  counts: Map<string, number>;
  activeId: string | null;
  onJump: (id: string) => void;
  onChange: (sections: Section[]) => void;
  /** Section removed: its quotes go to `parentId`. */
  onRemove: (id: string, parentId: string | null) => void;
  onFoldAll: (fold: boolean) => void;
};

function OutlineList({ nodes, counts, activeId, onJump }: Pick<Props, 'nodes' | 'counts' | 'activeId' | 'onJump'>) {
  return (
    <ul className="text-[13px]">
      {nodes.map((n) => (
        <li key={n.section.id}>
          <button
            type="button"
            onClick={() => onJump(n.section.id)}
            style={{ paddingLeft: n.depth * 12 }}
            className={`flex w-full items-baseline justify-between gap-2 py-1.5 text-left transition-colors ${n.section.id === activeId ? 'font-medium text-ink' : n.depth === 0 ? 'text-muted hover:text-ink' : 'text-faint hover:text-ink'}`}
          >
            <span className="min-w-0 truncate">{n.section.title}</span>
            <span className="shrink-0 text-faint tabular-nums">{counts.get(n.section.id) || ''}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function EditOutline({ nodes, sections, counts, onChange, onRemove, onClose }: Pick<Props, 'nodes' | 'sections' | 'counts' | 'onChange' | 'onRemove'> & { onClose: () => void }) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [toc, setToc] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = (next: Section[], focusId?: string) => {
    onChange(next);
    if (focusId) requestAnimationFrame(() => document.getElementById(`sec-input-${focusId}`)?.focus());
  };

  const remove = (id: string) => {
    const s = sections.find((x) => x.id === id);
    onRemove(id, s?.parentId ?? null);
    onChange(removeSection(sections, id));
    setConfirmId(null);
    setMenuId(null);
  };

  return (
    <div>
      <ul className="text-[15px]">
        {nodes.map((n) => (
          <li key={n.section.id} style={{ paddingLeft: n.depth * 16 }}>
            <div
              className="flex items-baseline gap-2 border-b border-line"
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse') return;
                timer.current = setTimeout(() => setMenuId(n.section.id), 450);
              }}
              onPointerUp={() => timer.current && clearTimeout(timer.current)}
              onPointerMove={() => timer.current && clearTimeout(timer.current)}
            >
              <input
                id={`sec-input-${n.section.id}`}
                defaultValue={n.section.title}
                lang="vi"
                spellCheck={false}
                onBlur={(e) => {
                  const t = e.target.value.trim();
                  if (t && t !== n.section.title) onChange(renameSection(sections, n.section.id, t.slice(0, 200)));
                  else e.target.value = n.section.title;
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  const id = n.section.id;
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                    apply(e.shiftKey ? outdent(sections, id) : indent(sections, id), id);
                  } else if (e.altKey && e.key === 'ArrowUp') {
                    e.preventDefault();
                    apply(moveUp(sections, id), id);
                  } else if (e.altKey && e.key === 'ArrowDown') {
                    e.preventDefault();
                    apply(moveDown(sections, id), id);
                  } else if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-ink outline-none"
              />
              <span className="text-[12px] text-faint tabular-nums">{counts.get(n.section.id) || ''}</span>
              <button type="button" aria-label="More" onClick={() => setMenuId(menuId === n.section.id ? null : n.section.id)} className="px-1 text-faint hover:text-ink">
                ···
              </button>
            </div>
            {menuId === n.section.id && (
              <div className="fade-in flex flex-wrap gap-x-4 gap-y-1 py-2 text-[13px] text-faint">
                <button type="button" onClick={() => apply(indent(sections, n.section.id))} className="hover:text-ink">
                  indent
                </button>
                <button type="button" onClick={() => apply(outdent(sections, n.section.id))} className="hover:text-ink">
                  outdent
                </button>
                <button type="button" onClick={() => apply(moveUp(sections, n.section.id))} className="hover:text-ink">
                  up
                </button>
                <button type="button" onClick={() => apply(moveDown(sections, n.section.id))} className="hover:text-ink">
                  down
                </button>
                {confirmId === n.section.id ? (
                  <span className="flex gap-3 text-muted">
                    Move its {counts.get(n.section.id)} quotes up?
                    <button type="button" onClick={() => remove(n.section.id)} className="text-ink">
                      delete
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => ((counts.get(n.section.id) ?? 0) > 0 ? setConfirmId(n.section.id) : remove(n.section.id))} className="hover:text-ink">
                    delete
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {toc === null ? (
        <div className="mt-4 flex gap-4 text-[13px] text-faint">
          <button type="button" onClick={() => setToc('')} className="hover:text-ink">
            paste contents
          </button>
          <button type="button" onClick={onClose} className="ml-auto text-ink">
            done
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <textarea
            autoFocus
            value={toc}
            onChange={(e) => setToc(e.target.value)}
            rows={8}
            lang="vi"
            spellCheck={false}
            aria-label="Table of contents"
            placeholder={'1 Chapter\n1.1 Section\n2 Chapter'}
            className="w-full resize-y rounded-md border border-line bg-transparent p-3 text-[16px] leading-relaxed outline-none placeholder:text-faint"
          />
          <div className="mt-2 flex gap-4 text-[13px]">
            <button
              type="button"
              onClick={() => {
                if (toc.trim()) onChange(parseToc(toc, sections));
                setToc(null);
              }}
              className="text-ink"
            >
              add
            </button>
            <button type="button" onClick={() => setToc(null)} className="text-faint hover:text-ink">
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The fixed rail (desktop). */
export function OutlineRail(props: Props) {
  const [edit, setEdit] = useState(false);
  if (props.nodes.length === 0) return null;
  return (
    <aside className="fixed top-[calc(env(safe-area-inset-top)+64px)] bottom-28 left-[max(24px,calc(50vw-18rem-16rem))] hidden w-56 overflow-y-auto pr-2 xl:block">
      {edit ? (
        <EditOutline {...props} onClose={() => setEdit(false)} />
      ) : (
        <>
          <OutlineList {...props} />
          <div className="mt-3 flex gap-3 text-[12px] text-faint">
            <button type="button" onClick={() => props.onFoldAll(true)} className="hover:text-ink">
              fold all
            </button>
            <button type="button" onClick={() => props.onFoldAll(false)} className="hover:text-ink">
              unfold all
            </button>
            <button type="button" onClick={() => setEdit(true)} className="ml-auto hover:text-ink">
              edit
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

/** Thin path line (once you scroll into a section) + sheet (phone / tablet). */
export function OutlineBar(props: Props & { path: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { open, onOpenChange: setOpen } = props;
  const [edit, setEdit] = useState(false);
  if (props.nodes.length === 0) return null;
  return (
    <>
      {props.path && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fade-in fixed inset-x-0 top-0 z-10 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm xl:hidden"
        >
          <span className="mx-auto block max-w-[36rem] truncate px-5 py-2 text-left text-[12px] text-faint">{props.path}</span>
        </button>
      )}
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          setEdit(false);
        }}
        label="Contents"
      >
        {edit ? (
          <EditOutline {...props} onClose={() => setEdit(false)} />
        ) : (
          <>
            <OutlineList
              {...props}
              onJump={(id) => {
                setOpen(false);
                props.onJump(id);
              }}
            />
            <div className="mt-4 flex gap-4 text-[13px] text-faint">
              <button type="button" onClick={() => props.onFoldAll(true)} className="hover:text-ink">
                fold all
              </button>
              <button type="button" onClick={() => props.onFoldAll(false)} className="hover:text-ink">
                unfold all
              </button>
              <button type="button" onClick={() => setEdit(true)} className="ml-auto hover:text-ink">
                edit
              </button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}

/** Right-edge minimap: one tick per top-level section, a darker band for the visible part. */
export function Minimap({ topIds, onJump }: { topIds: string[]; onJump: (id: string) => void }) {
  const [ticks, setTicks] = useState<{ id: string; at: number }[]>([]);
  const [view, setView] = useState({ top: 0, size: 1 });

  useEffect(() => {
    if (topIds.length < 3) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = document.documentElement.scrollHeight || 1;
        setTicks(
          topIds
            .map((id) => {
              const el = document.getElementById(`s-${id}`);
              return el ? { id, at: (el.getBoundingClientRect().top + window.scrollY) / h } : null;
            })
            .filter((t): t is { id: string; at: number } => t !== null),
        );
        setView({ top: window.scrollY / h, size: Math.min(1, window.innerHeight / h) });
      });
    };
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [topIds]);

  if (topIds.length < 3) return null;
  return (
    <div aria-hidden className="fixed top-[calc(env(safe-area-inset-top)+48px)] right-1 bottom-32 z-10 w-4 xl:hidden">
      <div className="absolute inset-y-0 right-1.5 w-[2px] bg-line" />
      <div className="absolute right-1.5 w-[2px] bg-faint" style={{ top: `${view.top * 100}%`, height: `${Math.max(4, view.size * 100)}%` }} />
      {ticks.map((t) => (
        <button
          key={t.id}
          type="button"
          tabIndex={-1}
          onClick={() => onJump(t.id)}
          className="absolute right-0 h-3 w-4"
          style={{ top: `calc(${t.at * 100}% - 6px)` }}
        >
          <span className="absolute top-1/2 right-0 h-px w-[6px] bg-muted" />
        </button>
      ))}
    </div>
  );
}
