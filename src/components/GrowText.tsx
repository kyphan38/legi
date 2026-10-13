'use client';

import type { Ref, TextareaHTMLAttributes } from 'react';

import { markInput, typingStore } from '@/lib/activity';

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onChange: (next: string) => void;
  label: string;
  textareaRef?: Ref<HTMLTextAreaElement>;
  /** Content is Vietnamese: lang="vi", no red spellcheck lines. */
  vi?: boolean;
  wrapClassName?: string;
};

/**
 * Plain textarea that grows with its content (from hodi). ::after of .grow
 * holds the same content and pushes the box taller - no JS measuring.
 */
export default function GrowText({ value, onChange, label, textareaRef, vi = true, wrapClassName, placeholder, onBlur, onInput, ...rest }: Props) {
  return (
    <div className={`grow ${wrapClassName ?? ''}`} data-value={value || placeholder || ''}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onInput={(e) => {
          markInput();
          onInput?.(e);
        }}
        onBlur={(e) => {
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
