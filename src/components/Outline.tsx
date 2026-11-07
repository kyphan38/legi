'use client';

// ============================================================
// legi - Where am I in this book
//
// Desktop (>= 1280px): a fixed rail on the left. Phone/tablet: "contents" in
// the top bar and a thin line with the current path; tap → the outline in a sheet.
// (A right-edge minimap was tried and dropped: it looked like noise.)
// "edit" turns the outline into a list of inputs: Tab / Shift+Tab indent,
// ⌥↑ / ⌥↓ move, long press or ··· for the same on phones, paste a table of
// contents, or say it (the mic): AI turns speech into sections, shown for
// review before they are added. Each section can hold its first page so quotes find it by page.
// ============================================================

import { httpsCallable } from 'firebase/functions';
import { useRef, useState } from 'react';

import Sheet from '@/components/Sheet';
import VoiceButton, { type Recording } from '@/components/VoiceButton';
import { getFunctionsClient } from '@/lib/firebase-client';
import { addSection, addSectionAfter, addTocItems, buildTree, flatten, indent, moveDown, moveUp, outdent, parseToc, removeSection, renameSection, setStartPage, type TocItem, type TreeNode } from '@/lib/outline';
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
  /** Quotes whose page points to another section. */
  misplaced: number;
  onPlaceByPage: () => void;
};

function OutlineList({ nodes, counts, activeId, onJump, showCounts = true }: Pick<Props, 'nodes' | 'counts' | 'activeId' | 'onJump'> & { showCounts?: boolean }) {
  return (
    <ul className="text-[13px]">
      {nodes.map((n) => (
        <li key={n.section.id}>
          <button
            type="button"
            onClick={() => onJump(n.section.id)}
            style={{ paddingLeft: n.depth * 12 }}
            className={`flex w-full items-baseline justify-between gap-2 py-1.5 text-left transition-colors focus-visible:text-ink focus-visible:outline-none ${n.section.id === activeId ? 'text-ink' : 'text-faint hover:text-muted'}`}
          >
            <span className="min-w-0 truncate">{n.section.title}</span>
            {showCounts && <span className="shrink-0 text-faint tabular-nums">{counts.get(n.section.id) || ''}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Sections said aloud, in reading order. Nothing is saved before `add`. */
async function tocFromVoice(rec: Recording, sections: Section[]): Promise<TocItem[]> {
  const outline = flatten(buildTree(sections)).map((n) => ({ id: n.section.id, title: n.section.title, depth: n.depth, page: n.section.startPage ?? null }));
  const call = httpsCallable<{ audio: string; mimeType: string; outline: typeof outline }, { items: TocItem[] }>(getFunctionsClient(), 'tocFromVoice', { timeout: 120_000 });
  const res = await call({ audio: rec.base64, mimeType: rec.mimeType, outline });
  return res.data.items ?? [];
}

function ReviewToc({ items, sections, onChange, onAdd, onCancel }: { items: TocItem[]; sections: Section[]; onChange: (items: TocItem[]) => void; onAdd: () => void; onCancel: () => void }) {
  const titleOf = new Map(sections.map((s) => [s.id, s.title]));
  const byKey = new Map(items.map((it) => [it.key, it]));
  const depthOf = (it: TocItem): number => {
    let d = 0;
    for (let p = it.parent; p && byKey.has(p) && d < 20; p = byKey.get(p)!.parent) d++;
    return d;
  };
  // The existing section a group of new items goes under.
  const rootOf = (it: TocItem): string | null => {
    let cur = it;
    for (let i = 0; cur.parent && byKey.has(cur.parent) && i < 20; i++) cur = byKey.get(cur.parent)!;
    return cur.parent;
  };
  const edit = (key: string, patch: Partial<TocItem>) => onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  // Its children move up to its parent.
  const drop = (gone: TocItem) => onChange(items.filter((it) => it.key !== gone.key).map((it) => (it.parent === gone.key ? { ...it, parent: gone.parent } : it)));

  return (
    <div className="fade-in mt-4">
      <ul className="text-[15px]">
        {items.map((it, i) => {
          const root = rootOf(it);
          const newGroup = i === 0 || rootOf(items[i - 1]) !== root;
          return (
            <li key={it.key}>
              {newGroup && <div className="pt-2 text-[13px] text-faint">{root ? titleOf.get(root) : 'top level'}</div>}
              <div className="flex items-baseline gap-2 border-b border-line" style={{ paddingLeft: (depthOf(it) + (root ? 1 : 0)) * 16 }}>
                <input
                  defaultValue={it.title}
                  lang="vi"
                  spellCheck={false}
                  aria-label="Section"
                  onBlur={(e) => e.target.value.trim() !== it.title && edit(it.key, { title: e.target.value.trim() })}
                  className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-ink outline-none"
                />
                <input
                  defaultValue={it.page ?? ''}
                  inputMode="numeric"
                  placeholder="p."
                  aria-label="First page"
                  onBlur={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                    edit(it.key, { page: v ? Number(v) : null });
                  }}
                  className="w-10 bg-transparent py-2 text-right text-[14px] text-muted tabular-nums outline-none placeholder:text-faint"
                />
                <button type="button" aria-label="Remove" onClick={() => drop(it)} className="px-1 text-faint hover:text-ink">
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-4 text-[13px]">
        <button type="button" onClick={onAdd} className="text-ink">
          add {items.length}
        </button>
        <button type="button" onClick={onCancel} className="text-faint hover:text-ink">
          cancel
        </button>
      </div>
    </div>
  );
}

function EditOutline({
  nodes,
  sections,
  counts,
  onChange,
  onRemove,
  misplaced,
  onPlaceByPage,
  onClose,
}: Pick<Props, 'nodes' | 'sections' | 'counts' | 'onChange' | 'onRemove' | 'misplaced' | 'onPlaceByPage'> & { onClose: () => void }) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [toc, setToc] = useState<string | null>(null);
  const [spoken, setSpoken] = useState<TocItem[] | null>(null);
  // A new section typed in place, under or after `id`; never saved with an empty title.
  const [adding, setAdding] = useState<{ id: string; inside: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fingers shake: only a real drag cancels the long press.
  const pressAt = useRef<{ x: number; y: number } | null>(null);
  const cancelPress = () => {
    if (timer.current) clearTimeout(timer.current);
    pressAt.current = null;
  };

  // Enter keeps going with a fresh input right below the new one; blur stops.
  const addNew = (title: string, more: boolean) => {
    const t = title.trim().slice(0, 200);
    if (!adding || !t) return setAdding(null);
    const res = adding.inside ? addSection(sections, t, adding.id) : addSectionAfter(sections, t, adding.id);
    setAdding(more ? { id: res.id, inside: false } : null);
    setMenuId(null);
    onChange(res.sections);
  };

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
                pressAt.current = { x: e.clientX, y: e.clientY };
                timer.current = setTimeout(() => setMenuId(n.section.id), 450);
              }}
              onPointerUp={cancelPress}
              onPointerCancel={cancelPress}
              onPointerMove={(e) => {
                const at = pressAt.current;
                if (at && Math.hypot(e.clientX - at.x, e.clientY - at.y) > 10) cancelPress();
              }}
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
              <input
                key={n.section.startPage ?? ''}
                defaultValue={n.section.startPage ?? ''}
                inputMode="numeric"
                placeholder="p."
                aria-label="First page"
                onBlur={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                  const page = v ? Number(v) : null;
                  if (page !== (n.section.startPage ?? null)) onChange(setStartPage(sections, n.section.id, page));
                  else e.target.value = v;
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className="w-10 bg-transparent py-2 text-right text-[14px] text-muted tabular-nums outline-none placeholder:text-faint"
              />
              <button type="button" aria-label="More" onClick={() => setMenuId(menuId === n.section.id ? null : n.section.id)} className="px-1 text-faint hover:text-ink">
                ···
              </button>
            </div>
            {menuId === n.section.id && (
              <div className="fade-in flex flex-wrap gap-x-4 gap-y-1 py-2 text-[13px] text-faint">
                <button type="button" onClick={() => setAdding({ id: n.section.id, inside: true })} className="hover:text-ink">
                  add inside
                </button>
                <button type="button" onClick={() => setAdding({ id: n.section.id, inside: false })} className="hover:text-ink">
                  add below
                </button>
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
            {adding?.id === n.section.id && (
              <input
                autoFocus
                placeholder="new section"
                aria-label="New section"
                lang="vi"
                spellCheck={false}
                style={{ paddingLeft: adding.inside ? 16 : 0 }}
                onBlur={(e) => e.target.dataset.done || addNew(e.target.value, false)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                  if (e.key === 'Enter') {
                    // This input unmounts; its blur must not add the title twice.
                    e.currentTarget.dataset.done = '1';
                    addNew(e.currentTarget.value, true);
                  } else if (e.key === 'Escape') setAdding(null);
                }}
                className="block w-full border-b border-line bg-transparent py-2 text-[16px] text-ink outline-none placeholder:text-faint"
              />
            )}
          </li>
        ))}
      </ul>

      {spoken ? (
        <ReviewToc
          items={spoken}
          sections={sections}
          onChange={(items) => (items.length ? setSpoken(items) : setSpoken(null))}
          onAdd={() => {
            onChange(addTocItems(sections, spoken));
            setSpoken(null);
          }}
          onCancel={() => setSpoken(null)}
        />
      ) : toc === null ? (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px] text-faint">
          <button type="button" onClick={() => setToc('')} className="hover:text-ink">
            paste contents
          </button>
          <span className="flex min-w-0 items-baseline gap-2">
            <VoiceButton
              send={async (rec) => {
                const items = await tocFromVoice(rec, sections);
                if (items.length) setSpoken(items);
                return items.length > 0;
              }}
            />
          </span>
          {misplaced > 0 && (
            <button type="button" onClick={onPlaceByPage} className="text-muted hover:text-ink">
              place {misplaced} {misplaced === 1 ? 'quote' : 'quotes'} by page
            </button>
          )}
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
    <aside className="group fixed top-[calc(env(safe-area-inset-top)+64px)] bottom-28 left-[max(24px,calc(50vw-18rem-16rem))] hidden w-56 overflow-y-auto pr-2 xl:block">
      {edit ? (
        <EditOutline {...props} onClose={() => setEdit(false)} />
      ) : (
        <>
          <OutlineList {...props} showCounts={false} />
          {/* Controls only while the pointer is on the rail. */}
          <div className="mt-3 flex gap-3 text-[12px] text-faint opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
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
          // Under the sticky TopBar text; it covers the bar's empty bottom padding.
          className="fade-in fixed inset-x-0 top-[calc(env(safe-area-inset-top)+52px)] z-10 border-b border-line bg-bg/95 backdrop-blur-sm xl:hidden"
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
