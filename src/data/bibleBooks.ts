import chapterAndVerse from 'chapter-and-verse/index.js';
import type { BibleReference } from '../types';

export interface BibleBookDefinition {
  id: string;
  spanishName: string;
  englishName: string;
  order: number;
}

const bookData: Array<[string, string, string]> = [
  ['gen', 'Génesis', 'Genesis'], ['exo', 'Éxodo', 'Exodus'], ['lev', 'Levítico', 'Leviticus'],
  ['num', 'Números', 'Numbers'], ['deu', 'Deuteronomio', 'Deuteronomy'], ['jos', 'Josué', 'Joshua'],
  ['jdg', 'Jueces', 'Judges'], ['rut', 'Rut', 'Ruth'], ['1sa', '1 Samuel', '1 Samuel'],
  ['2sa', '2 Samuel', '2 Samuel'], ['1ki', '1 Reyes', '1 Kings'], ['2ki', '2 Reyes', '2 Kings'],
  ['1ch', '1 Crónicas', '1 Chronicles'], ['2ch', '2 Crónicas', '2 Chronicles'], ['ezr', 'Esdras', 'Ezra'],
  ['neh', 'Nehemías', 'Nehemiah'], ['est', 'Ester', 'Esther'], ['job', 'Job', 'Job'],
  ['psa', 'Salmos', 'Psalms'], ['pro', 'Proverbios', 'Proverbs'], ['ecc', 'Eclesiastés', 'Ecclesiastes'],
  ['sng', 'Cantares', 'Song of Solomon'], ['isa', 'Isaías', 'Isaiah'], ['jer', 'Jeremías', 'Jeremiah'],
  ['lam', 'Lamentaciones', 'Lamentations'], ['ezk', 'Ezequiel', 'Ezekiel'], ['dan', 'Daniel', 'Daniel'],
  ['hos', 'Oseas', 'Hosea'], ['jol', 'Joel', 'Joel'], ['amo', 'Amós', 'Amos'],
  ['oba', 'Abdías', 'Obadiah'], ['jon', 'Jonás', 'Jonah'], ['mic', 'Miqueas', 'Micah'],
  ['nam', 'Nahúm', 'Nahum'], ['hab', 'Habacuc', 'Habakkuk'], ['zep', 'Sofonías', 'Zephaniah'],
  ['hag', 'Hageo', 'Haggai'], ['zec', 'Zacarías', 'Zechariah'], ['mal', 'Malaquías', 'Malachi'],
  ['mat', 'Mateo', 'Matthew'], ['mrk', 'Marcos', 'Mark'], ['luk', 'Lucas', 'Luke'],
  ['jhn', 'Juan', 'John'], ['act', 'Hechos', 'Acts'], ['rom', 'Romanos', 'Romans'],
  ['1co', '1 Corintios', '1 Corinthians'], ['2co', '2 Corintios', '2 Corinthians'], ['gal', 'Gálatas', 'Galatians'],
  ['eph', 'Efesios', 'Ephesians'], ['php', 'Filipenses', 'Philippians'], ['col', 'Colosenses', 'Colossians'],
  ['1th', '1 Tesalonicenses', '1 Thessalonians'], ['2th', '2 Tesalonicenses', '2 Thessalonians'], ['1ti', '1 Timoteo', '1 Timothy'],
  ['2ti', '2 Timoteo', '2 Timothy'], ['tit', 'Tito', 'Titus'], ['phm', 'Filemón', 'Philemon'],
  ['heb', 'Hebreos', 'Hebrews'], ['jas', 'Santiago', 'James'], ['1pe', '1 Pedro', '1 Peter'],
  ['2pe', '2 Pedro', '2 Peter'], ['1jn', '1 Juan', '1 John'], ['2jn', '2 Juan', '2 John'],
  ['3jn', '3 Juan', '3 John'], ['jud', 'Judas', 'Jude'], ['rev', 'Apocalipsis', 'Revelation']
];

export const BIBLE_BOOKS: BibleBookDefinition[] = bookData.map(([id, spanishName, englishName], index) => ({
  id,
  spanishName,
  englishName,
  order: index
}));

export function getBibleBook(bookId: string): BibleBookDefinition {
  return BIBLE_BOOKS.find((book) => book.id === bookId) ?? BIBLE_BOOKS[0];
}

export function getVerseCounts(bookId: string): number[] {
  const book = getBibleBook(bookId);
  const parsed = chapterAndVerse(book.englishName);
  if (!parsed.success || !parsed.book) return [];
  return parsed.book.versesPerChapter;
}

export function getChapterCount(bookId: string): number {
  return getVerseCounts(bookId).length;
}

export function getVerseCount(bookId: string, chapter: number): number {
  return getVerseCounts(bookId)[chapter - 1] ?? 1;
}

export function createReference(bookId: string, chapter: number, verse: number): BibleReference {
  const book = getBibleBook(bookId);
  const safeChapter = Math.min(Math.max(1, chapter), Math.max(1, getChapterCount(bookId)));
  const safeVerse = Math.min(Math.max(1, verse), getVerseCount(bookId, safeChapter));
  return { bookId: book.id, bookName: book.spanishName, chapter: safeChapter, verse: safeVerse };
}

export function compareReferences(left: BibleReference, right: BibleReference): number {
  const leftBook = getBibleBook(left.bookId).order;
  const rightBook = getBibleBook(right.bookId).order;
  if (leftBook !== rightBook) return leftBook - rightBook;
  if (left.chapter !== right.chapter) return left.chapter - right.chapter;
  return left.verse - right.verse;
}

export function getNextReference(reference: BibleReference): BibleReference | null {
  const book = getBibleBook(reference.bookId);
  const verseCount = getVerseCount(book.id, reference.chapter);
  if (reference.verse < verseCount) return createReference(book.id, reference.chapter, reference.verse + 1);
  const chapterCount = getChapterCount(book.id);
  if (reference.chapter < chapterCount) return createReference(book.id, reference.chapter + 1, 1);
  const nextBook = BIBLE_BOOKS[book.order + 1];
  return nextBook ? createReference(nextBook.id, 1, 1) : null;
}

export function formatBibleReference(reference: BibleReference): string {
  return `${reference.bookName} ${reference.chapter}:${reference.verse}`;
}

export function formatBibleRange(start: BibleReference, end: BibleReference): string {
  if (start.bookId === end.bookId && start.chapter === end.chapter) {
    return `${start.bookName} ${start.chapter}:${start.verse}–${end.verse}`;
  }
  if (start.bookId === end.bookId) {
    return `${start.bookName} ${start.chapter}:${start.verse} → ${end.chapter}:${end.verse}`;
  }
  return `${formatBibleReference(start)} → ${formatBibleReference(end)}`;
}
