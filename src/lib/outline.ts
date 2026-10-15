// ============================================================
// legi - Book outline (sections tree)
//
// Sections live in the book doc as a flat list with parentId + order. Every
// function here is pure and returns a NEW list, ready to write in one go.
// ============================================================

import { orderBetween } from '@/lib/order';
import type { Section } from '@/types/legi';

export type TreeNode = { section: Section; depth: number; children: TreeNode[] };

export function newId(): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += abc[Math.floor(Math.random() * abc.length)];
  return id;
}

function childrenOf(sections: Section[], parentId: string | null): Section[] {
  return sections.filter((s) => s.parentId === parentId).sort((a, b) => a.order - b.order);
}

/** Tree in reading order. A section whose parent is missing goes to the top level. */
export function buildTree(sections: Section[]): TreeNode[] {
  const ids = new Set(sections.map((s) => s.id));
  const fixed = sections.map((s) => (s.parentId && !ids.has(s.parentId) ? { ...s, parentId: null } : s));
  const walk = (parentId: string | null, depth: number, seen: Set<string>): TreeNode[] =>
    childrenOf(fixed, parentId)
      .filter((s) => !seen.has(s.id))
      .map((s) => {
        seen.add(s.id);
        return { section: s, depth, children: walk(s.id, depth + 1, seen) };
      });
  return walk(null, 0, new Set());
}

/** Depth-first list: the order sections appear on the page. */
export function flatten(tree: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const go = (nodes: TreeNode[]) =>
    nodes.forEach((n) => {
      out.push(n);
      go(n.children);
    });
  go(tree);
  return out;
}

/** From the top level down to this section. Empty if not found. */
export function pathOf(sections: Section[], id: string | null): Section[] {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const path: Section[] = [];
  let cur = id ? byId.get(id) : undefined;
  while (cur && path.length < 50) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

/** Ids of a section and everything under it. */
export function subtreeIds(sections: Section[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of sections) {
      if (s.parentId && out.has(s.parentId) && !out.has(s.id)) {
        out.add(s.id);
        grew = true;
      }
    }
  }
  return out;
}

export function addSection(
  sections: Section[],
  title: string,
  parentId: string | null,
  id: string = newId(),
): { sections: Section[]; id: string } {
  const siblings = childrenOf(sections, parentId);
  const last = siblings.at(-1)?.order ?? null;
  const section: Section = { id, title: title.trim(), parentId, order: orderBetween(last, null) };
  return { sections: [...sections, section], id };
}

/** A new sibling right after `afterId` (the next part of the book), before any later sibling. */
export function addSectionAfter(sections: Section[], title: string, afterId: string, id: string = newId()): { sections: Section[]; id: string } {
  const after = sections.find((s) => s.id === afterId);
  if (!after) return addSection(sections, title, null, id);
  const siblings = childrenOf(sections, after.parentId);
  const next = siblings[siblings.findIndex((s) => s.id === afterId) + 1]?.order ?? null;
  const section: Section = { id, title: title.trim(), parentId: after.parentId, order: orderBetween(after.order, next) };
  return { sections: [...sections, section], id };
}

export function setStartPage(sections: Section[], id: string, page: number | null): Section[] {
  return sections.map((s) => (s.id === id ? { ...s, startPage: page } : s));
}

/**
 * The section a page belongs to: the one with the highest startPage at or
 * before `page`. On a tie the deeper one wins (3.1 starts where chapter 3 does).
 * null when no section has a start page, so the sticky context stays.
 */
export function sectionForPage(sections: Section[], page: number | null): string | null {
  if (page === null) return null;
  const depth = new Map(flatten(buildTree(sections)).map((n, i) => [n.section.id, { depth: n.depth, i }]));
  let best: { id: string; page: number; depth: number; i: number } | null = null;
  for (const s of sections) {
    const p = s.startPage;
    const d = depth.get(s.id);
    if (p == null || p > page || !d) continue;
    if (!best || p > best.page || (p === best.page && (d.depth > best.depth || (d.depth === best.depth && d.i > best.i)))) {
      best = { id: s.id, page: p, ...d };
    }
  }
  return best?.id ?? null;
}

export function renameSection(sections: Section[], id: string, title: string): Section[] {
  return sections.map((s) => (s.id === id ? { ...s, title: title.trim() } : s));
}

/** Removes one section; its children move up to its parent (quotes are moved by the caller). */
export function removeSection(sections: Section[], id: string): Section[] {
  const gone = sections.find((s) => s.id === id);
  if (!gone) return sections;
  return sections.filter((s) => s.id !== id).map((s) => (s.parentId === id ? { ...s, parentId: gone.parentId } : s));
}

/** Becomes the last child of the sibling just above it. */
export function indent(sections: Section[], id: string): Section[] {
  const me = sections.find((s) => s.id === id);
  if (!me) return sections;
  const siblings = childrenOf(sections, me.parentId);
  const i = siblings.findIndex((s) => s.id === id);
  if (i <= 0) return sections;
  const newParent = siblings[i - 1];
  const last = childrenOf(sections, newParent.id).at(-1)?.order ?? null;
  return sections.map((s) => (s.id === id ? { ...s, parentId: newParent.id, order: orderBetween(last, null) } : s));
}

/** Becomes the sibling right after its parent. */
export function outdent(sections: Section[], id: string): Section[] {
  const me = sections.find((s) => s.id === id);
  if (!me || !me.parentId) return sections;
  const parent = sections.find((s) => s.id === me.parentId);
  if (!parent) return sections;
  const siblings = childrenOf(sections, parent.parentId);
  const i = siblings.findIndex((s) => s.id === parent.id);
  const next = siblings[i + 1]?.order ?? null;
  return sections.map((s) => (s.id === id ? { ...s, parentId: parent.parentId, order: orderBetween(parent.order, next) } : s));
}

function swap(sections: Section[], id: string, dir: -1 | 1): Section[] {
  const me = sections.find((s) => s.id === id);
  if (!me) return sections;
  const siblings = childrenOf(sections, me.parentId);
  const i = siblings.findIndex((s) => s.id === id);
  const other = siblings[i + dir];
  if (!other) return sections;
  return sections.map((s) => {
    if (s.id === me.id) return { ...s, order: other.order };
    if (s.id === other.id) return { ...s, order: me.order };
    return s;
  });
}

export const moveUp = (sections: Section[], id: string) => swap(sections, id, -1);
export const moveDown = (sections: Section[], id: string) => swap(sections, id, 1);

/**
 * Pasted table of contents → sections added at the end. Depth comes from
 * leading tabs / pairs of spaces, or from numbering ("3" = 1, "3.2" = 2,
 * "3.2.1" = 3). The numbering stays in the title. A page number at the end
 * becomes startPage, but only after dot leaders, a tab or 2+ spaces, so
 * "Chương 1" keeps its number.
 */
export function parseToc(text: string, sections: Section[] = []): Section[] {
  let out = sections;
  const stack: (string | null)[] = [null];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!raw.trim()) continue;
    const lead = raw.match(/^[\t ]*/)?.[0] ?? '';
    const indentDepth = (lead.match(/\t/g)?.length ?? 0) + Math.floor(lead.replace(/\t/g, '').length / 2);
    const tail = raw.trim().match(/^(.*?)(?:\s*(?:\.{2,}|…+|·{2,})\s*|\t+|\s{2,})(\d{1,4})$/);
    const title = tail ? tail[1].trim() : raw.trim();
    const startPage = tail ? Number(tail[2]) : null;
    if (!title) continue;
    const num = title.match(/^(\d+(?:\.\d+)*)\.?\s/);
    let depth = num ? num[1].split('.').length - 1 : indentDepth;
    depth = Math.min(depth, stack.length - 1);
    const parentId = stack[depth] ?? null;
    const added = addSection(out, title, parentId);
    out = startPage === null ? added.sections : setStartPage(added.sections, added.id, startPage);
    stack.length = depth + 1;
    stack.push(added.id);
  }
  return out;
}
