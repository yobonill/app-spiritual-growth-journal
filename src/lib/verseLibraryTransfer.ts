import { compareReferences, createReference, getChapterCount, getVerseCount } from '../data/bibleBooks';
import type { AppData, BibleReference, CategorizedVerse, VerseCategory } from '../types';
import { createId } from './id';
import { normalizeVerseSearch } from './verseCategories';
import { rangesOverlap, sameVerseRange, verseRange, type VerseRange } from './verseRanges';

const APP_IDENTIFIER = 'spiritual-growth-journal-verse-categories';
const MAX_CATEGORIES = 500;
const MAX_VERSES = 5000;
export const MAX_VERSE_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

export interface SharedVerse extends VerseRange {
  description?: string;
  refutes?: string;
}

export interface SharedCategory {
  name: string;
  description?: string;
  verses: SharedVerse[];
}

export interface VerseLibraryExport {
  app: typeof APP_IDENTIFIER;
  formatVersion: 1;
  exportedAt: string;
  categories: SharedCategory[];
}

export interface IncomingVerse extends SharedVerse { draftId: string }
export interface IncomingCategory extends Omit<SharedCategory, 'verses'> {
  draftId: string;
  verses: IncomingVerse[];
}
export interface PreparedVerseImport { categories: IncomingCategory[]; importedAt: string }

function optionalNote(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 10000) throw new Error(`${label} contiene un valor no válido.`);
  return value.trim() || undefined;
}

function parseReference(value: unknown): BibleReference {
  if (typeof value !== 'object' || !value || Array.isArray(value)) {
    throw new Error('El archivo contiene una referencia bíblica inválida.');
  }
  const ref = value as Partial<BibleReference>;
  if (typeof ref.bookId !== 'string' ||
      !Number.isInteger(ref.chapter) || !Number.isInteger(ref.verse) ||
      getChapterCount(ref.bookId) < 1 ||
      ref.chapter! < 1 || ref.chapter! > getChapterCount(ref.bookId) ||
      ref.verse! < 1 || ref.verse! > getVerseCount(ref.bookId, ref.chapter!)) {
    throw new Error('El archivo contiene un libro, capítulo o versículo fuera de rango.');
  }
  const canonical = createReference(ref.bookId, ref.chapter!, ref.verse!);
  if (canonical.bookId !== ref.bookId) throw new Error('El archivo contiene un libro bíblico desconocido.');
  return canonical;
}

export function createVerseLibraryExport(data: AppData, selectedCategoryIds: string[]): VerseLibraryExport {
  const selected = new Set(selectedCategoryIds);
  return {
    app: APP_IDENTIFIER,
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    categories: data.verseCategories.filter((category) => selected.has(category.id)).map((category) => ({
      name: category.name,
      description: category.description,
      verses: data.categorizedVerses.filter((verse) => verse.categoryId === category.id)
        .sort((a, b) => compareReferences(a.reference, b.reference))
        .map((verse) => ({ ...verseRange(verse), description: verse.description, refutes: verse.refutes }))
    }))
  };
}

export function parseVerseLibraryImport(content: string): PreparedVerseImport {
  if (new Blob([content]).size > MAX_VERSE_IMPORT_FILE_BYTES) throw new Error('El archivo excede el límite de 10 MB.');
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw new Error('El archivo JSON no se puede leer.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('El archivo no contiene una biblioteca válida.');
  const payload = parsed as Partial<VerseLibraryExport>;
  if (payload.app !== APP_IDENTIFIER || payload.formatVersion !== 1 || !Array.isArray(payload.categories) || payload.categories.length > MAX_CATEGORIES) {
    throw new Error('Formato de biblioteca no reconocido. Exporta las categorías desde esta misma sección.');
  }

  const names = new Set<string>();
  let count = 0;
  const categories: IncomingCategory[] = payload.categories.map((raw) => {
    if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' ||
        !raw.name.trim() || raw.name.length > 100 || !Array.isArray(raw.verses)) {
      throw new Error('Una categoría del archivo no es válida.');
    }
    const name = raw.name.trim();
    const normalized = normalizeVerseSearch(name);
    if (names.has(normalized)) throw new Error(`La categoría «${name}» aparece repetida en el archivo.`);
    names.add(normalized);
    count += raw.verses.length;
    if (count > MAX_VERSES) throw new Error('El archivo contiene demasiadas referencias bíblicas.');
    const ranges = new Set<string>();
    const verses = raw.verses.map((entry): IncomingVerse => {
      if (!entry || typeof entry !== 'object') throw new Error('Un versículo importado es inválido.');
      const start = parseReference(entry.start);
      const end = parseReference(entry.end ?? entry.start);
      if (compareReferences(start, end) > 0) throw new Error(`La categoría «${name}» contiene un rango invertido.`);
      const key = `${start.bookId}:${start.chapter}:${start.verse}|${end.bookId}:${end.chapter}:${end.verse}`;
      if (ranges.has(key)) throw new Error(`La categoría «${name}» contiene un rango repetido.`);
      ranges.add(key);
      return {
        draftId: createId('import-verse'), start, end,
        description: optionalNote(entry.description, 'La descripción del versículo'),
        refutes: optionalNote(entry.refutes, 'El campo «Qué refuta»')
      };
    });
    return {
      draftId: createId('import-category'), name,
      description: optionalNote(raw.description, 'La descripción de la categoría'), verses
    };
  });
  if (categories.length === 0) throw new Error('El archivo no contiene categorías para importar.');
  return { categories, importedAt: new Date().toISOString() };
}

export type ImportChoice =
  | { kind: 'existing' }
  | { kind: 'imported' }
  | { kind: 'custom'; description?: string; refutes?: string; rangeSource?: string };
export type ImportDecisions = Record<string, ImportChoice>;

export interface CategoryConflict {
  kind: 'category'; key: string; categoryName: string; existing: VerseCategory; imported: IncomingCategory;
}
export interface VerseConflict {
  kind: 'verse'; key: string; categoryName: string; existing: CategorizedVerse[]; imported: IncomingVerse;
}
export type ImportConflict = CategoryConflict | VerseConflict;

export interface ImportStats {
  newCategories: number;
  mergedCategories: number;
  newVerses: number;
  identicalVerses: number;
  keptVerses: number;
  replacedVerses: number;
  customVerses: number;
  categoryDescriptionsChanged: number;
}
export interface VerseImportPlan { conflict?: ImportConflict; result?: AppData; stats: ImportStats }

function sameNotes(left: { description?: string; refutes?: string }, right: { description?: string; refutes?: string }): boolean {
  return (left.description?.trim() ?? '') === (right.description?.trim() ?? '') &&
    (left.refutes?.trim() ?? '') === (right.refutes?.trim() ?? '');
}

/** Pure preview: no changes to persisted application state until confirmation. */
export function planVerseLibraryImport(
  data: AppData,
  incoming: PreparedVerseImport,
  decisions: ImportDecisions
): VerseImportPlan {
  let categories = [...data.verseCategories];
  let verses = [...data.categorizedVerses];
  const stats: ImportStats = {
    newCategories: 0, mergedCategories: 0, newVerses: 0,
    identicalVerses: 0, keptVerses: 0, replacedVerses: 0,
    customVerses: 0, categoryDescriptionsChanged: 0
  };
  const mapping = new Map<string, string>();
  const now = incoming.importedAt;

  for (const imported of incoming.categories) {
    const existing = categories.find((item) => normalizeVerseSearch(item.name) === normalizeVerseSearch(imported.name));
    if (!existing) {
      categories.push({ id: imported.draftId, name: imported.name, description: imported.description, createdAt: now, updatedAt: now });
      mapping.set(imported.draftId, imported.draftId);
      stats.newCategories++;
      continue;
    }
    mapping.set(imported.draftId, existing.id);
    stats.mergedCategories++;
    if ((existing.description?.trim() ?? '') === (imported.description?.trim() ?? '')) continue;
    const key = `category:${imported.draftId}`;
    const decision = decisions[key];
    if (!decision) return { conflict: { kind: 'category', key, categoryName: existing.name, existing, imported }, stats };
    const description = decision.kind === 'existing' ? existing.description
      : decision.kind === 'custom' ? decision.description?.trim() || undefined
        : imported.description;
    if ((description ?? '') !== (existing.description ?? '')) {
      categories = categories.map((item) => item.id === existing.id ? { ...item, description, updatedAt: now } : item);
      stats.categoryDescriptionsChanged++;
    }
  }

  for (const importedCategory of incoming.categories) {
    const categoryId = mapping.get(importedCategory.draftId)!;
    for (const imported of importedCategory.verses) {
      const incomingRange: VerseRange = { start: imported.start, end: imported.end };
      const matching = verses.filter((verse) => verse.categoryId === categoryId && rangesOverlap(verseRange(verse), incomingRange));
      if (matching.length === 0) {
        verses.push({
          id: imported.draftId, categoryId, reference: imported.start, endReference: imported.end,
          description: imported.description, refutes: imported.refutes, createdAt: now, updatedAt: now
        });
        stats.newVerses++;
        continue;
      }
      if (matching.length === 1 && sameVerseRange(verseRange(matching[0]), incomingRange) && sameNotes(matching[0], imported)) {
        stats.identicalVerses++;
        continue;
      }
      const key = `verse:${imported.draftId}`;
      const decision = decisions[key];
      if (!decision) return {
        conflict: {
          kind: 'verse', key, categoryName: categories.find((c) => c.id === categoryId)?.name ?? importedCategory.name,
          existing: matching, imported
        }, stats
      };
      if (decision.kind === 'existing') { stats.keptVerses++; continue; }
      if (decision.kind === 'custom' && decision.rangeSource?.startsWith('existing:')) {
        const existingId = decision.rangeSource.slice('existing:'.length);
        if (!matching.some((verse) => verse.id === existingId)) {
          return { conflict: { kind: 'verse', key, categoryName: importedCategory.name, existing: matching, imported }, stats };
        }
        verses = verses.map((verse) => verse.id === existingId
          ? { ...verse, description: decision.description?.trim() || undefined, refutes: decision.refutes?.trim() || undefined, updatedAt: now }
          : verse);
        stats.customVerses++;
        continue;
      }
      const deletedIds = new Set(matching.map((item) => item.id));
      verses = verses.filter((verse) => !deletedIds.has(verse.id));
      const useImportedNotes = decision.kind === 'imported';
      const primary = matching.length === 1 ? matching[0] : undefined;
      verses.push({
        id: primary?.id ?? imported.draftId,
        categoryId, reference: imported.start, endReference: imported.end,
        description: useImportedNotes ? imported.description : decision.description?.trim() || undefined,
        refutes: useImportedNotes ? imported.refutes : decision.refutes?.trim() || undefined,
        createdAt: primary?.createdAt ?? now, updatedAt: now
      });
      if (decision.kind === 'custom') stats.customVerses++;
      else stats.replacedVerses += matching.length;
    }
  }
  return { result: { ...data, verseCategories: categories, categorizedVerses: verses }, stats };
}
