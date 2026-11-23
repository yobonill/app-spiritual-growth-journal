import { compareReferences, formatBibleReference } from '../data/bibleBooks';
import type { AppData, CategorizedVerse, VerseCategory } from '../types';

export type VerseSearchField = 'categoryName' | 'categoryDescription' | 'verseDescription' | 'refutes' | 'verseReference';
export type VerseSearchFilters = Record<VerseSearchField, boolean>;

export const DEFAULT_VERSE_SEARCH_FILTERS: VerseSearchFilters = {
  categoryName: true,
  categoryDescription: false,
  verseDescription: false,
  refutes: false,
  verseReference: false
};

export interface VerseCategoryResult {
  category: VerseCategory;
  verses: CategorizedVerse[];
  totalVerses: number;
}

export function normalizeVerseSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
}

export function findVerseCategories(data: AppData, text: string, filters: VerseSearchFilters): VerseCategoryResult[] {
  const query = normalizeVerseSearch(text);
  if (query && !Object.values(filters).some(Boolean)) return [];

  const groupedVerses = new Map<string, CategorizedVerse[]>();
  for (const verse of data.categorizedVerses) {
    const list = groupedVerses.get(verse.categoryId) ?? [];
    list.push(verse);
    groupedVerses.set(verse.categoryId, list);
  }

  return [...data.verseCategories]
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .flatMap((category): VerseCategoryResult[] => {
      const allVerses = (groupedVerses.get(category.id) ?? [])
        .sort((a, b) => compareReferences(a.reference, b.reference));
      const categoryMatches = !query || (
        (filters.categoryName && normalizeVerseSearch(category.name).includes(query)) ||
        (filters.categoryDescription && normalizeVerseSearch(category.description ?? '').includes(query))
      );
      const verses = categoryMatches ? allVerses : allVerses.filter((verse) =>
        (filters.verseDescription && normalizeVerseSearch(verse.description ?? '').includes(query)) ||
        (filters.refutes && normalizeVerseSearch(verse.refutes ?? '').includes(query)) ||
        (filters.verseReference && normalizeVerseSearch(formatBibleReference(verse.reference)).includes(query))
      );
      return categoryMatches || verses.length > 0
        ? [{ category, verses, totalVerses: allVerses.length }]
        : [];
    });
}
