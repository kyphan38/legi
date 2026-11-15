'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
  type TextareaHTMLAttributes,
} from 'react';

import { markInput, typingStore } from '@/lib/activity';

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'defaultValue'> & {
  value: string;
  onChange: (next: string) => void;
  label: string;
  textareaRef?: Ref<HTMLTextAreaElement>;
  /** Content is Vietnamese: lang="vi", no red spellcheck lines. */
  vi?: boolean;
  wrapClassName?: string;
};

/** While focused, how often to look for text that changed without an input event. */
const WATCH_MS = 250;

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

/**
 * Plain textarea that grows with its content (from hodi). ::after of .grow
 * holds the same content and pushes the box taller - no JS measuring.
 *
 * Uncontrolled on purpose (same fix as hodi, 2026-11-15). iPhone dictation in
 * Vietnamese edits the text as "marked text", sometimes with no input event.
 * A controlled textarea kept a stale value: the box stayed one line tall and
 * the next re-render wrote the stale text back over the spoken words. Now the
 * DOM owns the text, the grow mirror reads the DOM, and `value` is written in
 * only when it really changed from outside (a draft restore, clearing after save).
 */
export default function GrowText({
  value,
  onChange,
  label,
  textareaRef,
  vi = true,
  wrapClassName,
  placeholder,
  onBlur,
  onInput,
  onFocus,
  onCompositionStart,
  onCompositionEnd,
  ...rest
}: Props) {
  const elRef = useRef<HTMLTextAreaElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  /** The last text this field reported or was given: what `value` should be. */
  const known = useRef(value);
  const composing = useRef(false);
  const [focused, setFocused] = useState(false);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

  const attach = useCallback(
    (el: HTMLTextAreaElement | null) => {
      elRef.current = el;
      setRef(textareaRef, el);
    },
    [textareaRef],
  );

  const mirror = useCallback(
    (text: string) => {
      if (wrapRef.current) wrapRef.current.dataset.value = text || placeholder || '';
    },
    [placeholder],
  );

  /** Reads the DOM text; grows the box and reports it if it is new. */
  const pull = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    mirror(el.value);
    if (el.value === known.current) return;
    known.current = el.value;
    onChangeRef.current(el.value);
  }, [mirror]);

  // Text from outside: write it in, but never over words being dictated or composed.
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (value !== known.current && !composing.current) {
      known.current = value;
      if (el.value !== value) el.value = value;
    }
    mirror(el.value);
  }, [value, mirror]);

  // Dictation can change the text with no event at all: look while focused.
  useEffect(() => {
    if (!focused) return;
    const t = setInterval(pull, WATCH_MS);
    return () => clearInterval(t);
  }, [focused, pull]);

  return (
    <div ref={wrapRef} className={`grow ${wrapClassName ?? ''}`} data-value={value || placeholder || ''}>
      <textarea
        ref={attach}
        defaultValue={value}
        onInput={(e) => {
          markInput();
          pull();
          onInput?.(e);
        }}
        onCompositionStart={(e) => {
          composing.current = true;
          onCompositionStart?.(e);
        }}
        onCompositionEnd={(e) => {
          composing.current = false;
          pull();
          onCompositionEnd?.(e);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          composing.current = false;
          pull();
          typingStore.set(false);
          onBlur?.(e);
        }}
        placeholder={placeholder}
        aria-label={label}
        rows={1}
        lang={vi ? 'vi' : undefined}
        spellCheck={false}
        autoCapitalize="sentences"
        autoComplete="off"
        {...rest}
      />
    </div>
  );
}

/** True while an IME (Telex, VNI) is still composing a letter: shortcuts must wait. */
export function isComposing(e: { nativeEvent: KeyboardEvent; keyCode: number }): boolean {
  return e.nativeEvent.isComposing || e.keyCode === 229;
}
