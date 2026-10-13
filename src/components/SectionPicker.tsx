'use client';

import { useState } from 'react';

import Sheet from '@/components/Sheet';
import { addSection, addSectionAfter, buildTree, flatten } from '@/lib/outline';
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
 */
export default function SectionPicker({ open, onClose, sections, current, onPick, onAdd, label = 'Chapter' }: Props) {
  const [title, setTitle] = useState('');
  // null = the default for the current section; reset each time the sheet closes.
  const [chosen, setChosen] = useState<Place | null>(null);
  const nodes = flatten(buildTree(sections));
  const currentSection = sections.find((s) => s.id === current) ?? null;
  const place: Place = chosen ?? (currentSection ? 'same' : 'top');

  const close = () => {
    setChosen(null);
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
    onAdd(res.sections, res.id);
    setTitle('');
    onPick(res.id);
    close();
  };

  const places: { p: Place; label: string }[] = currentSection
    ? [
        { p: 'same', label: 'same level' },
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
              onClick={() => {
                onPick(n.section.id);
                close();
              }}
              style={{ paddingLeft: n.depth * 16 }}
              className={`w-full py-2.5 text-left ${n.section.id === current ? 'font-medium text-ink' : n.depth === 0 ? 'text-ink' : 'text-muted'}`}
            >
              {n.section.title}
            </button>
          </li>
        ))}
      </ul>

      {onAdd && (
        <div className="mt-4 border-t border-line pt-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="new section"
            aria-label="New section"
            lang="vi"
            spellCheck={false}
            className="w-full bg-transparent py-2 text-[16px] outline-none placeholder:text-faint"
          />
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
