import { useMemo, useState, type FormEvent } from 'react';
import BibleReferencePicker from '../components/BibleReferencePicker';
import Modal from '../components/Modal';
import { createReference, formatBibleReference } from '../data/bibleBooks';
import { createId } from '../lib/id';
import {
  DEFAULT_VERSE_SEARCH_FILTERS,
  findVerseCategories,
  normalizeVerseSearch,
  type VerseSearchField,
  type VerseSearchFilters
} from '../lib/verseCategories';
import type { AppData, BibleReference, CategorizedVerse, VerseCategory } from '../types';

interface VerseCategoriesViewProps {
  data: AppData;
  onDataChange: (data: AppData) => void;
  onBack: () => void;
}

interface CategoryDraft {
  id?: string;
  name: string;
  description: string;
}

interface VerseDraft {
  id?: string;
  categoryId: string;
  reference: BibleReference;
  description: string;
  refutes: string;
}

const SEARCH_FIELDS: Array<{ key: VerseSearchField; label: string }> = [
  { key: 'categoryName', label: 'Nombre de la categoría' },
  { key: 'categoryDescription', label: 'Descripción de la categoría' },
  { key: 'verseDescription', label: 'Descripción del versículo' },
  { key: 'refutes', label: 'Qué refuta' },
  { key: 'verseReference', label: 'Versículo (referencia bíblica)' }
];

export default function VerseCategoriesView({ data, onDataChange, onBack }: VerseCategoriesViewProps) {
  const [mode, setMode] = useState<'search' | 'manage'>('search');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<VerseSearchFilters>({ ...DEFAULT_VERSE_SEARCH_FILTERS });
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [verseDraft, setVerseDraft] = useState<VerseDraft | null>(null);
  const [formError, setFormError] = useState('');

  const matches = useMemo(() => findVerseCategories(data, query, filters), [data, query, filters]);
  const categories = useMemo(
    () => [...data.verseCategories].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [data.verseCategories]
  );
  const searchActive = Boolean(query.trim());
  const selectedFields = Object.values(filters).some(Boolean);

  const beginCategory = (category?: VerseCategory) => {
    setFormError('');
    setCategoryDraft(category
      ? { id: category.id, name: category.name, description: category.description ?? '' }
      : { name: '', description: '' });
  };

  const saveCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!categoryDraft) return;
    const name = categoryDraft.name.trim();
    if (!name) return setFormError('Escribe un nombre para la categoría.');
    if (data.verseCategories.some((category) =>
      category.id !== categoryDraft.id && normalizeVerseSearch(category.name) === normalizeVerseSearch(name)
    )) return setFormError('Ya existe una categoría con ese nombre.');

    const now = new Date().toISOString();
    const description = categoryDraft.description.trim() || undefined;
    if (categoryDraft.id) {
      onDataChange({
        ...data,
        verseCategories: data.verseCategories.map((category) => category.id === categoryDraft.id
          ? { ...category, name, description, updatedAt: now }
          : category)
      });
    } else {
      onDataChange({
        ...data,
        verseCategories: [...data.verseCategories, {
          id: createId('verse-category'), name, description, createdAt: now, updatedAt: now
        }]
      });
    }
    setCategoryDraft(null);
  };

  const deleteCategory = (category: VerseCategory) => {
    const count = data.categorizedVerses.filter((verse) => verse.categoryId === category.id).length;
    if (!window.confirm(`¿Eliminar la categoría «${category.name}» y sus ${count} referencias asignadas? Las referencias de otras categorías no cambiarán.`)) return;
    onDataChange({
      ...data,
      verseCategories: data.verseCategories.filter((item) => item.id !== category.id),
      categorizedVerses: data.categorizedVerses.filter((verse) => verse.categoryId !== category.id)
    });
  };

  const beginVerse = (categoryId: string, verse?: CategorizedVerse) => {
    setFormError('');
    setVerseDraft(verse ? {
      id: verse.id,
      categoryId,
      reference: verse.reference,
      description: verse.description ?? '',
      refutes: verse.refutes ?? ''
    } : {
      categoryId,
      reference: createReference('gen', 1, 1),
      description: '',
      refutes: ''
    });
  };

  const saveVerse = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verseDraft) return;
    if (!data.verseCategories.some((category) => category.id === verseDraft.categoryId)) {
      return setFormError('Esta categoría ya no existe.');
    }
    const reference = verseDraft.reference;
    const duplicate = data.categorizedVerses.some((verse) =>
      verse.id !== verseDraft.id && verse.categoryId === verseDraft.categoryId &&
      verse.reference.bookId === reference.bookId &&
      verse.reference.chapter === reference.chapter && verse.reference.verse === reference.verse
    );
    if (duplicate) return setFormError('Ese versículo ya está asignado a esta categoría.');

    const now = new Date().toISOString();
    const values = {
      reference,
      description: verseDraft.description.trim() || undefined,
      refutes: verseDraft.refutes.trim() || undefined,
      updatedAt: now
    };
    if (verseDraft.id) {
      onDataChange({
        ...data,
        categorizedVerses: data.categorizedVerses.map((verse) => verse.id === verseDraft.id
          ? { ...verse, ...values } : verse)
      });
    } else {
      onDataChange({
        ...data,
        categorizedVerses: [...data.categorizedVerses, {
          id: createId('categorized-verse'), categoryId: verseDraft.categoryId,
          createdAt: now, ...values
        }]
      });
    }
    setVerseDraft(null);
  };

  const deleteVerse = (verse: CategorizedVerse) => {
    if (!window.confirm(`¿Quitar ${formatBibleReference(verse.reference)} de esta categoría?`)) return;
    onDataChange({
      ...data,
      categorizedVerses: data.categorizedVerses.filter((item) => item.id !== verse.id)
    });
  };

  const openCategoryInSearch = (id: string) => {
    setMode('search');
    setQuery('');
    setExpandedById({ [id]: true });
  };

  return (
    <div className="view-stack verse-library">
      <header className="page-heading verse-library-heading">
        <button type="button" className="text-button verse-library-back" onClick={onBack}>← Volver a Inicio</button>
        <p className="eyebrow">Tu biblioteca personal</p>
        <h1>Versículos por categoría</h1>
        <p>Organiza referencias de la Biblia por tema y registra lo que enseñan o refutan.</p>
      </header>

      <div className="verse-mode-switch" role="group" aria-label="Opciones de la biblioteca">
        <button type="button" className={mode === 'search' ? 'active' : ''} aria-pressed={mode === 'search'} onClick={() => setMode('search')}>🔎 Buscar</button>
        <button type="button" className={mode === 'manage' ? 'active' : ''} aria-pressed={mode === 'manage'} onClick={() => setMode('manage')}>⚙ Administrar categorías</button>
      </div>

      {mode === 'manage' ? (
        <section className="panel-section">
          <div className="verse-panel-heading">
            <div className="section-title"><h2>Categorías</h2><p>Crea, renombra, describe o elimina tus categorías.</p></div>
            <button type="button" className="primary-button small" onClick={() => beginCategory()}>+ Nueva categoría</button>
          </div>
          {categories.length === 0 ? <div className="empty-state">Todavía no hay categorías. Crea la primera para empezar.</div> : (
            <div className="verse-manager-list">
              {categories.map((category) => (
                <article className="verse-manager-row" key={category.id}>
                  <div>
                    <strong>{category.name}</strong>
                    {category.description && <p>{category.description}</p>}
                    <small>{data.categorizedVerses.filter((verse) => verse.categoryId === category.id).length} versículos</small>
                  </div>
                  <div className="verse-inline-actions">
                    <button type="button" className="secondary-button small" onClick={() => openCategoryInSearch(category.id)}>Ver versículos</button>
                    <button type="button" className="secondary-button small" onClick={() => beginCategory(category)}>Editar</button>
                    <button type="button" className="danger-text-button" onClick={() => deleteCategory(category)}>Eliminar</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="panel-section verse-search-panel">
            <label htmlFor="verse-category-search">Buscar en tu biblioteca
              <input id="verse-category-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setExpandedById({}); }} placeholder="Ej. Jesús es Dios o Juan 1:1" />
            </label>
            <fieldset className="verse-filter-fieldset">
              <legend>Buscar en:</legend>
              <div className="verse-filter-grid">
                {SEARCH_FIELDS.map((field) => (
                  <label key={field.key} className="verse-filter-check">
                    <input type="checkbox" checked={filters[field.key]} onChange={(event) => { setFilters((current) => ({ ...current, [field.key]: event.target.checked })); setExpandedById({}); }} />
                    <span>{field.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="muted verse-search-help">«Versículo» busca la referencia (por ejemplo, Juan 1:1), no el texto bíblico.</p>
          </section>

          <div className="verse-panel-heading">
            <h2 className="verse-results-title">{searchActive ? `Resultados (${matches.length} categorías)` : `Categorías (${categories.length})`}</h2>
            <button type="button" className="secondary-button small" onClick={() => { setMode('manage'); beginCategory(); }}>+ Crear categoría</button>
          </div>

          {searchActive && !selectedFields ? (
            <div className="empty-state">Selecciona al menos un campo para realizar la búsqueda.</div>
          ) : matches.length === 0 ? (
            <div className="empty-state large">
              <strong>{searchActive ? 'No se encontraron coincidencias.' : 'Aún no tienes categorías.'}</strong>
              <span>{searchActive ? 'Prueba otro término o activa más filtros.' : 'Crea una categoría para organizar tus versículos.'}</span>
            </div>
          ) : (
            <div className="verse-category-list">
              {matches.map(({ category, verses, totalVerses }) => {
                const expanded = expandedById[category.id] ?? searchActive;
                return (
                  <article className="verse-category-card" key={category.id}>
                    <button type="button" className="verse-category-toggle" aria-expanded={expanded} onClick={() => setExpandedById((current) => ({ ...current, [category.id]: !expanded }))}>
                      <span aria-hidden="true" className="verse-fold-icon">{expanded ? '▾' : '▸'}</span>
                      <span className="verse-category-summary"><strong>{category.name}</strong><small>{totalVerses} {totalVerses === 1 ? 'versículo' : 'versículos'}</small></span>
                    </button>
                    {category.description && <p className="verse-category-description">{category.description}</p>}
                    {expanded && (
                      <div className="verse-category-content">
                        <div className="verse-inline-actions">
                          <button type="button" className="primary-button small" onClick={() => beginVerse(category.id)}>+ Agregar versículo</button>
                          <button type="button" className="text-button" onClick={() => beginCategory(category)}>Editar categoría</button>
                        </div>
                        {verses.length === 0 ? (
                          <p className="muted verse-empty-copy">Esta categoría aún no tiene versículos.</p>
                        ) : (
                          <div className="verse-reference-list">
                            {verses.map((verse) => (
                              <article className="verse-reference-card" key={verse.id}>
                                <h3>📖 {formatBibleReference(verse.reference)}</h3>
                                {verse.description && <p><strong>Descripción:</strong> {verse.description}</p>}
                                {verse.refutes && <p><strong>Qué refuta:</strong> {verse.refutes}</p>}
                                {!verse.description && !verse.refutes && <p className="muted">Sin descripción ni refutación.</p>}
                                <div className="verse-inline-actions">
                                  <button type="button" className="secondary-button small" onClick={() => beginVerse(category.id, verse)}>Editar</button>
                                  <button type="button" className="danger-text-button" onClick={() => deleteVerse(verse)}>Quitar</button>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {categoryDraft && (
        <Modal title={categoryDraft.id ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setCategoryDraft(null)}>
          <form className="modal-body view-stack" onSubmit={saveCategory}>
            <label>Nombre de la categoría
              <input autoFocus maxLength={100} required value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} placeholder="Ej. Jesús es Dios" />
            </label>
            <label>Descripción <span className="optional">(opcional)</span>
              <textarea rows={4} value={categoryDraft.description} onChange={(event) => setCategoryDraft({ ...categoryDraft, description: event.target.value })} placeholder="¿Qué reúne esta categoría?" />
            </label>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="button-row">
              <button type="button" className="secondary-button" onClick={() => setCategoryDraft(null)}>Cancelar</button>
              <button type="submit" className="primary-button">Guardar categoría</button>
            </div>
          </form>
        </Modal>
      )}

      {verseDraft && (
        <Modal title={verseDraft.id ? 'Editar versículo' : 'Agregar versículo'} onClose={() => setVerseDraft(null)}>
          <form className="modal-body view-stack" onSubmit={saveVerse}>
            <p className="muted verse-editor-category">Categoría: <strong>{data.verseCategories.find((category) => category.id === verseDraft.categoryId)?.name}</strong></p>
            <BibleReferencePicker label="Selecciona el versículo" value={verseDraft.reference} onChange={(reference) => setVerseDraft((current) => current ? { ...current, reference } : current)} />
            <label>Descripción <span className="optional">(opcional)</span>
              <textarea rows={3} value={verseDraft.description} onChange={(event) => setVerseDraft({ ...verseDraft, description: event.target.value })} placeholder="¿De qué trata este versículo?" />
            </label>
            <label>Qué refuta <span className="optional">(opcional)</span>
              <textarea rows={3} value={verseDraft.refutes} onChange={(event) => setVerseDraft({ ...verseDraft, refutes: event.target.value })} placeholder="¿Qué afirmación o enseñanza refuta?" />
            </label>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="button-row">
              <button type="button" className="secondary-button" onClick={() => setVerseDraft(null)}>Cancelar</button>
              <button type="submit" className="primary-button">Guardar versículo</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
