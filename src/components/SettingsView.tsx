'use client';

import Link from 'next/link';
import { useSyncExternalStore, type ReactNode } from 'react';

import TopBar from '@/components/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { applyDisplayPrefs, sizeStore, themeStore, typewriterStore, type TextSize, type Theme } from '@/lib/prefs';
import { exportAll } from '@/lib/share-file';
import type { Store } from '@/lib/store';

function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}

/** One option row: the current choice is ink, the others faint (from hodi). */
function Choice<T extends string>({ label, options, value, onPick }: { label: string; options: readonly { value: T; label: string }[]; value: T; onPick: (v: T) => void }) {
  return (
    <Row label={label}>
      <div className="flex gap-4" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onPick(o.value)} className={o.value === value ? 'text-ink' : 'text-faint hover:text-muted'}>
            {o.label}
          </button>
        ))}
      </div>
    </Row>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3.5">
      <span className="min-w-0 truncate text-muted">{label}</span>
      {children}
    </div>
  );
}

export default function SettingsView() {
  const { user, signOut } = useAuth();
  const { books, quotes, loaded } = useLibrary();
  const theme = useStore(themeStore);
  const size = useStore(sizeStore);
  const typewriter = useStore(typewriterStore);

  const pickTheme = (t: Theme) => {
    themeStore.set(t);
    applyDisplayPrefs(t, size);
  };
  const pickSize = (s: TextSize) => {
    sizeStore.set(s);
    applyDisplayPrefs(theme, s);
  };

  return (
    <main className="paper pb-24">
      <TopBar current="settings" />

      <section className="mt-10 text-[15px]">
        <Choice
          label="Theme"
          value={theme}
          onPick={pickTheme}
          options={[
            { value: 'system', label: 'system' },
            { value: 'light', label: 'light' },
            { value: 'dark', label: 'dark' },
          ]}
        />
        <Choice
          label="Text size"
          value={size}
          onPick={pickSize}
          options={[
            { value: 's', label: 'S' },
            { value: 'm', label: 'M' },
            { value: 'l', label: 'L' },
          ]}
        />
        <Choice
          label="Typewriter"
          value={typewriter}
          onPick={(v) => typewriterStore.set(v)}
          options={[
            { value: 'on', label: 'on' },
            { value: 'off', label: 'off' },
          ]}
        />
      </section>

      <section className="mt-10 text-[15px]">
        <Row label="Export">
          <div className="flex gap-4">
            <button
              type="button"
              disabled={!loaded}
              onClick={() => void exportAll('md', [...books.values()], [...quotes.values()])}
              className="text-faint hover:text-ink disabled:opacity-40"
            >
              markdown
            </button>
            <button
              type="button"
              disabled={!loaded}
              onClick={() => void exportAll('json', [...books.values()], [...quotes.values()])}
              className="text-faint hover:text-ink disabled:opacity-40"
            >
              json
            </button>
          </div>
        </Row>
        <Row label="Trash">
          <Link href="/trash/" className="text-faint hover:text-ink">
            open
          </Link>
        </Row>
      </section>

      <section className="mt-10 text-[15px]">
        <Row label={user?.email ?? ''}>
          <button type="button" onClick={signOut} className="text-faint hover:text-ink">
            sign out
          </button>
        </Row>
      </section>
    </main>
  );
}
