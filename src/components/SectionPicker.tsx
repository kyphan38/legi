'use client';

import { useState } from 'react';

import Sheet from '@/components/Sheet';
import { addSection, buildTree, flatten, pathOf } from '@/lib/outline';
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

/** Pick where the next quote goes, or add a section right here. */
export default function SectionPicker({ open, onClose, sections, current, onPick, onAdd, label = 'Chapter' }: Props) {
  const [title, setTitle] = useState('');
  const [inside, setInside] = useState(false);
  const nodes = flatten(buildTree(sections));
  const currentTitle = pathOf(sections, current).at(-1)?.title;

  const add = () => {
    const t = title.trim();
    if (!t || !onAdd) return;
    const parent = inside && current ? current : null;
    const res = addSection(sections, t, parent);
    onAdd(res.sections, res.id);
    setTitle('');
    onPick(res.id);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} label={label}>
      <ul className="text-[15px]">
        <li>
          <button
            type="button"
            onClick={() => {
              onPick(null);
              onClose();
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
                onClose();
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
          {current && (
            <div className="mt-2 flex gap-4 text-[13px]" role="radiogroup" aria-label="Where">
              <button type="button" role="radio" aria-checked={!inside} onClick={() => setInside(false)} className={inside ? 'text-faint' : 'text-ink'}>
                top level
              </button>
              <button type="button" role="radio" aria-checked={inside} onClick={() => setInside(true)} className={`min-w-0 truncate ${inside ? 'text-ink' : 'text-faint'}`}>
                inside {currentTitle}
              </button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
