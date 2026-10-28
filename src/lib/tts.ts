// ============================================================
// legi - Read aloud: Google Chirp 3 HD voice, device voice as fallback
//
// The `speak` function returns one MP3 per quote. MP3s are kept on this device
// (IndexedDB), so a quote heard again costs no call and plays offline.
// Playback goes through Web Audio: once resumed by a tap, iOS lets it play
// the next quotes by itself.
// ============================================================

import { httpsCallable } from 'firebase/functions';

import { getFunctionsClient } from '@/lib/firebase-client';
import { pickVoice, speechChunks, voiceLang } from '@/lib/speech';

// Chirp 3 HD voice name; changing it makes every quote fetch again.
export const VOICE = 'Charon';

const DB = 'legi-tts';
const STORE = 'audio';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const keyOf = (text: string) => `${VOICE}|${voiceLang(text)}|${text}`;
const pending = new Map<string, Promise<ArrayBuffer>>();

/** MP3 bytes for a quote: from this device, else from the cloud (then kept). */
export function loadSpeech(text: string): Promise<ArrayBuffer> {
  const key = keyOf(text);
  let p = pending.get(key);
  if (!p) {
    p = (async () => {
      const kept = await run<ArrayBuffer | undefined>('readonly', (s) => s.get(key)).catch(() => undefined);
      if (kept) return kept;
      const call = httpsCallable<{ text: string; lang: string; voice: string }, { audio: string }>(getFunctionsClient(), 'speak', { timeout: 60_000 });
      const { data } = await call({ text, lang: voiceLang(text), voice: VOICE });
      const buf = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0)).buffer;
      await run('readwrite', (s) => s.put(buf, key)).catch(() => {});
      return buf;
    })().finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}

/** Deletes every kept MP3 (sign out). */
export async function clearSpeech(): Promise<void> {
  await run('readwrite', (s) => s.clear()).catch(() => {});
}

let ctx: AudioContext | null = null;

/** Call from the tap that starts listening: iOS only unlocks audio inside a tap. */
export function unlockAudio(): void {
  // Plays through the ringer switch, like a podcast app (Safari 16.4+).
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';
  ctx ??= new AudioContext();
  void ctx.resume();
}

/** Plays MP3 bytes; returns a stop function. onEnd only fires when it played to the end. */
export async function playMp3(mp3: ArrayBuffer, onEnd: () => void): Promise<() => void> {
  ctx ??= new AudioContext();
  // decodeAudioData detaches its input: keep the cached copy whole.
  const buffer = await ctx.decodeAudioData(mp3.slice(0));
  const src = ctx.createBufferSource();
  let stopped = false;
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.onended = () => !stopped && onEnd();
  src.start();
  return () => {
    stopped = true;
    src.stop();
  };
}

/** The device's own voice, chunk by chunk (Chrome cuts long utterances). Returns a stop function. */
export function speakOnDevice(text: string, onEnd: () => void, onFail: () => void): () => void {
  const synth = speechSynthesis;
  const lang = voiceLang(text);
  const voice = pickVoice(synth.getVoices(), lang);
  const chunks = speechChunks(text);
  let live = true;
  let n = 0;
  const next = () => {
    if (!live) return;
    if (n >= chunks.length) return onEnd();
    const u = new SpeechSynthesisUtterance(chunks[n++]);
    u.lang = lang;
    if (voice) u.voice = voice;
    u.onend = next;
    u.onerror = (e) => {
      if (live && e.error !== 'interrupted' && e.error !== 'canceled') onFail();
    };
    synth.speak(u);
  };
  synth.cancel();
  next();
  return () => {
    live = false;
    synth.cancel();
  };
}
