// A source is a "book" that is not a book: a channel, a site, a person.
// Same quotes, Daily, search and export; it only skips the shelf and pages.

import type { Book, BookFormat } from '@/types/legi';

export const BOOK_FORMATS: BookFormat[] = ['paper', 'pdf'];
export const SOURCE_FORMATS: BookFormat[] = ['video', 'web', 'person'];

export const isSource = (book: Pick<Book, 'format'>): boolean => SOURCE_FORMATS.includes(book.format);
