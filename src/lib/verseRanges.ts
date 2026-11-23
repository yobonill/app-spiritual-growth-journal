import { BIBLE_BOOKS, compareReferences, formatBibleRange } from '../data/bibleBooks';
import type { BibleReference, CategorizedVerse } from '../types';

export interface VerseRange { start: BibleReference; end: BibleReference }

export function verseRange(verse: CategorizedVerse): VerseRange {
  return { start: verse.reference, end: verse.endReference ?? verse.reference };
}

export function formatVerseRange(range: VerseRange): string {
  return formatBibleRange(range.start, range.end);
}

export function sameVerseRange(left: VerseRange, right: VerseRange): boolean {
  return compareReferences(left.start, right.start) === 0 && compareReferences(left.end, right.end) === 0;
}

export function rangesOverlap(left: VerseRange, right: VerseRange): boolean {
  return compareReferences(left.start, right.end) <= 0 && compareReferences(right.start, left.end) <= 0;
}

const simplify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();

/** When a complete book/chapter/verse is entered, match ranges containing it. */
export function parseReferenceQuery(query: string): BibleReference | null {
  const match = simplify(query).match(/^(.+?)\s+(\d{1,3})\s*:\s*(\d{1,3})$/);
  if (!match) return null;
  const book = BIBLE_BOOKS.find((item) => simplify(item.spanishName) === match[1]);
  if (!book) return null;
  return { bookId: book.id, bookName: book.spanishName, chapter: Number(match[2]), verse: Number(match[3]) };
}

export function rangeContains(range: VerseRange, reference: BibleReference): boolean {
  return compareReferences(range.start, reference) <= 0 && compareReferences(reference, range.end) <= 0;
}
