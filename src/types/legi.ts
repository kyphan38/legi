// Data model. Mirrors firestore.rules.template: change both together.

export type BookStatus = 'reading' | 'finished' | 'later';
/** video / web / person: a source outside books (a channel, a site, a friend). Not on the shelf. */
export type BookFormat = 'paper' | 'pdf' | 'video' | 'web' | 'person';
/** 'question' only gets UI in P5. */
export type QuoteKind = 'quote' | 'thought' | 'question';
export type QuoteSource = 'typed' | 'paste' | 'ocr';

export type Section = {
  /** 8 random chars [a-z0-9]. */
  id: string;
  title: string;
  parentId: string | null;
  /** Order among siblings; a float so an insert in between needs no renumbering. */
  order: number;
  /** First printed page; quotes with a page at or after it belong here. Missing on old data. */
  startPage?: number | null;
};

/** users/{uid}/books/{bookId} */
export type Book = {
  title: string;
  author: string;
  status: BookStatus;
  format: BookFormat;
  totalPages: number | null;
  currentPage: number | null;
  /** Only a link, the file is never stored. Sources keep their link here too. */
  pdfUrl: string | null;
  /** Answer to "What stays with you?" when the book is finished. */
  takeaway: string | null;
  /** Kept inside the book doc, so a reorder or indent is one write. */
  sections: Section[];
  startedAt: number;
  finishedAt: number | null;
  lastOpenedAt: number;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

/** users/{uid}/quotes/{quoteId} - top level, not nested in a book. */
export type Quote = {
  /** null = Inbox. */
  bookId: string | null;
  /** null = top of the book, no chapter. */
  sectionId: string | null;
  kind: QuoteKind;
  /** NFC; may hold **emphasis**. */
  text: string;
  note: string;
  page: number | null;
  favorite: boolean;
  source: QuoteSource;
  /** kind 'question' only: the quote that answers it. */
  answeredBy: string | null;
  shownCount: number;
  lastShownAt: number | null;
  /** In Trash because its whole book was deleted. */
  trashedWithBook: boolean;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

/** users/{uid}/daily/{YYYY-MM-DD} - first device to pick wins. */
export type DailyPick = { quoteId: string; createdAt: number };

export type BookRow = Book & { id: string };
export type QuoteRow = Quote & { id: string };

/** idle: nothing to save · local: on this device only · synced: in the cloud. */
export type SaveStatus = 'idle' | 'local' | 'synced';
