// ============================================================
// legi - Search by meaning: users/{uid}/vectors/{quoteId} holds one
// `embedding` per quote. Built lazily: each search first indexes quotes
// changed since the last run (meta/search.indexedAt = newest updatedAt done).
// Vectors are derived data, so they are replaced or removed freely. The
// client never reads them (no rule matches the collection).
// ============================================================

import type { GoogleGenAI } from '@google/genai';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';

import { EMBED_DIM, embedText, scoreOf, textHash, type QuoteForIndex } from './vectors.ts';

const EMBED_MODEL = 'gemini-embedding-2';
const BATCH = 100;
/** Quotes per round: one embedding call and one write batch per round. */
const ROUND = 100;

export type Hit = { id: string; score: number };

/** One vector per text, same order. */
export async function embedTexts(ai: GoogleGenAI, texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let s = 0; s < texts.length; s += BATCH) {
    const part = texts.slice(s, s + BATCH);
    const res = await ai.models.embedContent({
      model: EMBED_MODEL,
      // One Content per text: a plain string list would be merged into one vector.
      contents: part.map((text) => ({ parts: [{ text }] })),
      config: { outputDimensionality: EMBED_DIM, httpOptions: { timeout: 30_000 } },
    });
    const vectors = (res.embeddings ?? []).map((e) => e.values ?? []);
    if (vectors.length !== part.length || vectors.some((v) => v.length !== EMBED_DIM)) throw new Error('Bad embedding answer');
    out.push(...vectors);
  }
  return out;
}

/** Indexes changed quotes, oldest change first, until `budgetMs` runs out. True when nothing is left. */
export async function syncIndex(user: DocumentReference, ai: GoogleGenAI, budgetMs: number): Promise<boolean> {
  const start = Date.now();
  const metaRef = user.collection('meta').doc('search');
  let indexedAt = Number(((await metaRef.get()).data() ?? {}).indexedAt ?? 0);
  const vectors = user.collection('vectors');
  while (Date.now() - start < budgetMs) {
    const snap = await user.collection('quotes').where('updatedAt', '>', indexedAt).orderBy('updatedAt').limit(ROUND).get();
    if (snap.empty) return true;

    const old = await Promise.all(snap.docs.map((d) => vectors.doc(d.id).get()));
    const oldHash = new Map(old.map((o) => [o.id, o.exists ? String(o.data()?.hash ?? '') : null]));
    const plans = snap.docs.map((d) => {
      const text = embedText(d.data() as QuoteForIndex);
      return { id: d.id, bookId: (d.data().bookId as string | null) ?? null, text, hash: text ? textHash(text) : null };
    });
    const fresh = plans.filter((p) => p.text !== null && oldHash.get(p.id) !== p.hash);
    const gone = plans.filter((p) => p.text === null && oldHash.get(p.id) !== null);
    const embedded = fresh.length ? await embedTexts(ai, fresh.map((p) => p.text!)) : [];

    const batch = user.firestore.batch();
    gone.forEach((p) => batch.delete(vectors.doc(p.id)));
    fresh.forEach((p, k) =>
      batch.set(vectors.doc(p.id), { bookId: p.bookId, hash: p.hash, embedding: FieldValue.vector(embedded[k]), updatedAt: Date.now() }),
    );
    // A bookId change (a move) needs no new vector, only the field.
    plans
      .filter((p) => p.text !== null && oldHash.get(p.id) === p.hash)
      .forEach((p) => batch.set(vectors.doc(p.id), { bookId: p.bookId }, { merge: true }));
    await batch.commit();

    indexedAt = Math.max(...snap.docs.map((d) => Number(d.data().updatedAt ?? 0)));
    // Saved per round, so a timeout keeps the work already done.
    await metaRef.set({ indexedAt }, { merge: true });
    if (snap.size < ROUND) return true;
  }
  return false;
}

/** Nearest quotes to a vector, best first. */
export async function nearest(user: DocumentReference, vector: number[], limit: number): Promise<Hit[]> {
  const snap = await user
    .collection('vectors')
    .findNearest({ vectorField: 'embedding', queryVector: vector, limit, distanceMeasure: 'COSINE', distanceResultField: 'distance' })
    .get();
  return snap.docs.map((d) => ({ id: d.id, score: scoreOf(Number(d.data().distance ?? 1)) }));
}
