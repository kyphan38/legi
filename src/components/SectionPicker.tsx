'use client';

import { type KeyboardEvent, useState } from 'react';

import Sheet from '@/components/Sheet';
import { addSection, addSectionAfter, buildTree, flatten, setStartPage } from '@/lib/outline';
import type { Section } from '@/types/legi';

type Props = {
  open: boolean;
  onClose: () => void;
  sections: Section[];
  current: string | null;
  onPick: (id: string | null) => void;
  /** Called with the new list when a section is added; the caller writes it. */
  onAdd?: (sections: Section[], id: string) => void;
  label?: string;
};

type Place = 'same' | 'inside' | 'top';

/**
 * Pick where the next quote goes, or add a section right here.
 * A new section defaults to the SAME level, right after the current one:
 * reading goes 3.1 → 3.2 → 3.3, so that case needs no tap.
 * While a new title is typed, tapping a section moves the anchor there
 * instead of picking it, so "inside abc" works without picking abc first.
 * The sheet stays open after an add, anchored on the new section, so a run
 * of sections (with first pages) goes in one go.
 */
export default function SectionPicker({ open, onClose, sections: saved, current, onPick, onAdd, label = 'Chapter' }: Props) {
  const [title, setTitle] = useState('');
  const [page, setPage] = useState('');
  // What we last wrote, until the sheet closes: the next add must not start
  // from a list that does not have the previous one yet.
  const [mine, setMine] = useState<Section[] | null>(null);
  const sections = mine ?? saved;
  // null = the default for the current section; reset each time the sheet closes.
  const [chosen, setChosen] = useState<Place | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const nodes = flatten(buildTree(sections));
  const placing = !!onAdd && title.trim() !== '';
  const currentSection = sections.find((s) => s.id === (anchorId ?? current)) ?? null;
  const place: Place = chosen ?? (currentSection ? 'same' : 'top');

  const close = () => {
    setChosen(null);
    setAnchorId(null);
    setMine(null);
    setPage('');
    onClose();
  };

  const add = () => {
    const t = title.trim();
    if (!t || !onAdd) return;
    const res =
      place === 'same' && currentSection
        ? addSectionAfter(sections, t, currentSection.id)
        : place === 'inside' && currentSection
          ? addSection(sections, t, currentSection.id)
          : addSection(sections, t, null);
    const p = Number(page.replace(/\D/g, '').slice(0, 5));
    const next = p > 0 ? setStartPage(res.sections, res.id, p) : res.sections;
    onAdd(next, res.id);
    onPick(res.id);
    setMine(next);
    setTitle('');
    setPage('');
    setAnchorId(res.id);
    setChosen(null);
  };

  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key !== 'Enter') return;
    e.preventDefault();
    add();
    // From the page box, go back to the title for the next one.
    document.getElementById('picker-new-section')?.focus();
  };

  const places: { p: Place; label: string }[] = currentSection
    ? [
        { p: 'same', label: anchorId ? `after ${currentSection.title}` : 'same level' },
        { p: 'inside', label: `inside ${currentSection.title}` },
        ...(currentSection.parentId ? [{ p: 'top' as Place, label: 'top level' }] : []),
      ]
    : [];

  return (
    <Sheet open={open} onClose={close} label={label}>
      <ul className="text-[15px]">
        <li>
          <button
            type="button"
            onClick={() => {
              onPick(null);
              close();
            }}
            className={`w-full py-2.5 text-left ${current === null ? 'font-medium text-ink' : 'text-muted'}`}
          >
            no chapter
          </button>
        </li>
        {nodes.map((n) => (
          <li key={n.section.id}>
            <button
              type="button"
              // Keep the keyboard up: a blur would shift the sheet under the finger.
              onPointerDown={(e) => placing && e.preventDefault()}
              onClick={() => {
                if (placing) {
                  setAnchorId(n.section.id);
                  setChosen('inside');
                  return;
                }
                onPick(n.section.id);
                close();
              }}
              style={{ paddingLeft: n.depth * 16 }}
              className={`w-full py-2.5 text-left ${
                placing && n.section.id === currentSection?.id
                  ? 'text-ink underline decoration-line underline-offset-4'
                  : n.section.id === current
                    ? 'font-medium text-ink'
                    : n.depth === 0
                      ? 'text-ink'
                      : 'text-muted'
              }`}
            >
              {n.section.title}
              {n.section.startPage != null && <span className="ml-2 text-[13px] text-faint tabular-nums">p.{n.section.startPage}</span>}
            </button>
          </li>
        ))}
      </ul>

      {onAdd && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-baseline gap-2">
            <input
              id="picker-new-section"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={onEnter}
              placeholder="new section"
              aria-label="New section"
              lang="vi"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-2 text-[16px] outline-none placeholder:text-faint"
            />
            <input
              value={page}
              onChange={(e) => setPage(e.target.value.replace(/\D/g, '').slice(0, 5))}
              onKeyDown={onEnter}
              inputMode="numeric"
              enterKeyHint="done"
              placeholder="p."
              aria-label="First page"
              className="w-12 bg-transparent py-2 text-right text-[16px] text-muted tabular-nums outline-none placeholder:text-faint"
            />
          </div>
          {places.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]" role="radiogroup" aria-label="Where">
              {places.map(({ p, label }) => (
                <button key={p} type="button" role="radio" aria-checked={place === p} onClick={() => setChosen(p)} className={`min-w-0 truncate ${place === p ? 'text-ink' : 'text-faint hover:text-muted'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
