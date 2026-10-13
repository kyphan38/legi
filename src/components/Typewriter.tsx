'use client';

// Shows text one visible character at a time (graphemes, so "ệ" never comes
// apart). ~2.5 s at most. A tap or a key shows it all. The hidden rest still
// takes its space, so nothing jumps. Off with reduced motion or the setting.

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import QuoteText from '@/components/QuoteText';
import { typewriterStore } from '@/lib/prefs';
import { graphemes } from '@/lib/vi';

export default function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const on = useSyncExternalStore(typewriterStore.subscribe, typewriterStore.get, () => 'off') === 'on';
  // Emphasis marks are not typed out: show plain text while typing, styled at the end.
  const parts = useMemo(() => graphemes(text.replace(/\*\*/g, '')), [text]);
  const [shown, setShown] = useState(0);
  const [skip, setSkip] = useState(false);
  const [reduce] = useState(() => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const instant = !on || reduce || skip;
  const done = instant || shown >= parts.length;

  useEffect(() => {
    if (instant || shown >= parts.length) return;
    const step = Math.min(35, Math.max(10, 2500 / parts.length));
    const t = setTimeout(() => setShown((n) => n + 1), step);
    return () => clearTimeout(t);
  }, [instant, shown, parts.length]);

  useEffect(() => {
    if (done) onDone?.();
  }, [done, onDone]);

  useEffect(() => {
    if (done) return;
    const finish = () => setSkip(true);
    window.addEventListener('keydown', finish, { once: true });
    window.addEventListener('pointerdown', finish, { once: true });
    return () => {
      window.removeEventListener('keydown', finish);
      window.removeEventListener('pointerdown', finish);
    };
  }, [done]);

  if (done) return <QuoteText text={text} />;
  return (
    <span aria-label={text.replace(/\*\*/g, '')}>
      <span aria-hidden>{parts.slice(0, shown).join('')}</span>
      <span aria-hidden className="invisible">
        {parts.slice(shown).join('')}
      </span>
    </span>
  );
}
