'use client';

// Tap to start, tap again to stop (hands are busy holding the book, so no
// hold-to-talk like logi). The recording goes to the `transcribe` function and
// the text lands in the composer. The audio is never kept.

import { httpsCallable } from 'firebase/functions';
import { useEffect, useRef, useState } from 'react';

import { MicIcon } from '@/components/Icons';
import { useRecorder } from '@/hooks/useRecorder';
import { getFunctionsClient } from '@/lib/firebase-client';

export default function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const { state, start, stop, cancel, error, supported } = useRecorder();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const wasRecording = useRef(false);
  const stopping = useRef(false);

  const recording = state === 'recording';

  useEffect(() => {
    if (!recording) return;
    const t0 = Date.now();
    const id = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => clearInterval(id);
  }, [recording]);

  const say = (text: string) => {
    setNote(text);
    setTimeout(() => setNote(null), 3000);
  };

  const finish = async () => {
    stopping.current = true;
    const rec = await stop();
    stopping.current = false;
    if (!rec) return;
    setBusy(true);
    try {
      const call = httpsCallable<{ audio: string; mimeType: string }, { text: string }>(getFunctionsClient(), 'transcribe', { timeout: 120_000 });
      const res = await call({ audio: rec.base64, mimeType: rec.mimeType });
      if (res.data.text) onText(res.data.text);
      else say('Nothing heard.');
    } catch (err) {
      console.warn('[voice] transcribe failed', err);
      say('Could not read that.');
    } finally {
      setBusy(false);
    }
  };

  // The recorder stopped by itself at its limit: still send what was said.
  useEffect(() => {
    if (wasRecording.current && state === 'idle' && !stopping.current) void finish();
    wasRecording.current = state === 'recording';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!supported) return null;

  const toggle = () => {
    if (busy || state === 'requesting' || state === 'processing') return;
    if (recording) {
      void finish();
      return;
    }
    if (!navigator.onLine) {
      say('Voice needs a connection.');
      return;
    }
    setSecs(0);
    // No await before start(): Safari needs getUserMedia in the same tap.
    void start();
  };

  return (
    <>
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={toggle}
        aria-label={recording ? 'Stop and write it down' : 'Say it'}
        aria-pressed={recording}
        className={`shrink-0 ${recording ? 'text-ink' : 'hover:text-muted'}`}
      >
        {recording || busy ? <span className="block size-2 animate-pulse rounded-full bg-current" aria-hidden /> : <MicIcon size={15} />}
      </button>
      {recording && (
        <span className="fade-in flex shrink-0 items-baseline gap-2 tabular-nums">
          <span className="text-ink">
            {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
          </span>
          <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={cancel} aria-label="Cancel" className="hover:text-ink">
            ×
          </button>
        </span>
      )}
      {busy && <span className="shrink-0 text-muted">…</span>}
      {(note || error) && !recording && <span className="fade-in min-w-0 truncate text-muted">{note ?? error}</span>}
    </>
  );
}
