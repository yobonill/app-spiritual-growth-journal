import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import Modal from './Modal';
import { formatVerseRange, verseRange } from '../lib/verseRanges';
import {
  MAX_VERSE_IMPORT_FILE_BYTES, createVerseLibraryExport, parseVerseLibraryImport,
  planVerseLibraryImport, type ImportChoice, type ImportDecisions,
  type PreparedVerseImport, type VerseConflict
} from '../lib/verseLibraryTransfer';
import type { AppData } from '../types';

interface Props {
  data: AppData;
  onDataChange: (next: AppData) => void;
  onClose: () => void;
}

interface ImportReview {
  content: PreparedVerseImport;
  originalSnapshot: string;
  decisions: ImportDecisions;
}

interface CustomDraft {
  key: string;
  rangeSource: string;
  description: string;
  refutes: string;
}

function saveJsonFile(content: unknown): void {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `versiculos-por-categoria-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function VerseLibraryTransferModal({ data, onDataChange, onClose }: Props) {
  const [mode, setMode] = useState<'menu' | 'export' | 'import'>('menu');
  const [selectedIds, setSelectedIds] = useState<string[]>(() => data.verseCategories.map((category) => category.id));
  const [review, setReview] = useState<ImportReview | null>(null);
  const [customDraft, setCustomDraft] = useState<CustomDraft | null>(null);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => review
    ? planVerseLibraryImport(data, review.content, review.decisions) : null, [data, review]);
  const conflict = preview?.conflict;

  const openImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (file.size > MAX_VERSE_IMPORT_FILE_BYTES) {
      setError('El archivo excede el límite de 10 MB.');
      return;
    }
    try {
      const content = parseVerseLibraryImport(await file.text());
      setReview({ content, originalSnapshot: JSON.stringify(data), decisions: {} });
      setCustomDraft(null);
      setMode('import');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo leer la biblioteca compartida.');
    }
  };

  const choose = (key: string, decision: ImportChoice) => {
    setReview((current) => current ? {
      ...current, decisions: { ...current.decisions, [key]: decision }
    } : current);
    setCustomDraft(null);
    setError('');
  };

  const previousChoice = () => {
    if (!review) return;
    const keys = Object.keys(review.decisions);
    const previous = keys[keys.length - 1];
    if (!previous) return;
    setReview((current) => {
      if (!current) return current;
      const decisions = { ...current.decisions };
      delete decisions[previous];
      return { ...current, decisions };
    });
    setCustomDraft(null);
  };

  const startCustom = (verseConflict: VerseConflict) => {
    setCustomDraft({
      key: verseConflict.key,
      rangeSource: 'imported',
      description: verseConflict.imported.description ?? '',
      refutes: verseConflict.imported.refutes ?? ''
    });
  };

  const changeCustomRange = (verseConflict: VerseConflict, rangeSource: string) => {
    const source = rangeSource === 'imported'
      ? verseConflict.imported
      : verseConflict.existing.find((verse) => verse.id === rangeSource.slice('existing:'.length));
    setCustomDraft((current) => current ? {
      ...current, rangeSource,
      description: source?.description ?? '', refutes: source?.refutes ?? ''
    } : current);
  };

  const confirmImport = () => {
    if (!review || !preview?.result || preview.conflict) return;
    if (JSON.stringify(data) !== review.originalSnapshot) {
      setError('La biblioteca cambió durante la revisión. Cancela e importa nuevamente para evitar sobrescribir cambios.');
      return;
    }
    onDataChange(preview.result);
    onClose();
  };

  const totalIncoming = review?.content.categories.reduce((sum, category) => sum + category.verses.length, 0) ?? 0;
  const selectionCount = selectedIds.length;

  return (
    <Modal title="Compartir biblioteca de versículos" onClose={onClose}>
      <div className="modal-body view-stack verse-transfer">
        {mode === 'menu' && <>
          <p className="muted">Comparte tus categorías y referencias bíblicas sin compartir tus oraciones, lecturas ni otros datos personales.</p>
          <button type="button" className="primary-button" onClick={() => { setError(''); setMode('export'); }}>📤 Exportar categorías</button>
          <button type="button" className="secondary-button" onClick={() => fileInput.current?.click()}>📥 Importar y unificar</button>
          <p className="muted">La importación no modificará tu biblioteca hasta que revises los conflictos y confirmes los cambios.</p>
        </>}

        {mode === 'export' && <>
          <p className="muted">Selecciona las categorías que deseas incluir en el archivo JSON.</p>
          <div className="verse-inline-actions">
            <button type="button" className="text-button" onClick={() => setSelectedIds(data.verseCategories.map((category) => category.id))}>Seleccionar todas</button>
            <button type="button" className="text-button" onClick={() => setSelectedIds([])}>Ninguna</button>
          </div>
          {data.verseCategories.length === 0 ? <p className="empty-state">Todavía no tienes categorías para compartir.</p> : (
            <div className="verse-transfer-select-list">
              {data.verseCategories.map((category) => (
                <label key={category.id} className="verse-transfer-category-option">
                  <input type="checkbox" checked={selectedIds.includes(category.id)} onChange={(event) =>
                    setSelectedIds((current) => event.target.checked ? [...current, category.id] : current.filter((id) => id !== category.id))} />
                  <span><strong>{category.name}</strong><small>{data.categorizedVerses.filter((verse) => verse.categoryId === category.id).length} referencias</small></span>
                </label>
              ))}
            </div>
          )}
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => setMode('menu')}>Volver</button>
            <button type="button" className="primary-button" disabled={selectionCount === 0}
              onClick={() => saveJsonFile(createVerseLibraryExport(data, selectedIds))}>Exportar {selectionCount} {selectionCount === 1 ? 'categoría' : 'categorías'}</button>
          </div>
        </>}

        {mode === 'import' && review && preview && <>
          <div className="verse-transfer-overview">
            <strong>Archivo seleccionado</strong>
            <span>{review.content.categories.length} categorías · {totalIncoming} referencias</span>
            <small>Los versículos nuevos se agregarán; los repetidos o superpuestos se revisarán individualmente.</small>
          </div>

          {conflict?.kind === 'category' && <>
            <p className="verse-transfer-counter">Conflicto {Object.keys(review.decisions).length + 1} · Descripción de categoría</p>
            <h3 className="verse-transfer-title">{conflict.categoryName}</h3>
            <div className="verse-transfer-comparison">
              <div className="verse-transfer-version"><strong>Existente</strong><p>{conflict.existing.description || 'Sin descripción.'}</p></div>
              <div className="verse-transfer-version"><strong>Archivo compartido</strong><p>{conflict.imported.description || 'Sin descripción.'}</p></div>
            </div>
            <div className="verse-transfer-choices">
              <button type="button" className="secondary-button" onClick={() => choose(conflict.key, { kind: 'existing' })}>Conservar existente</button>
              <button type="button" className="secondary-button" onClick={() => choose(conflict.key, { kind: 'imported' })}>Usar archivo compartido</button>
            </div>
            <label>O escribir una descripción personalizada
              <textarea rows={3} value={customDraft?.key === conflict.key ? customDraft.description : ''}
                onChange={(event) => setCustomDraft({ key: conflict.key, rangeSource: '', description: event.target.value, refutes: '' })}
                placeholder="Combina ambas descripciones si lo deseas" />
            </label>
            <button type="button" className="primary-button" onClick={() => choose(conflict.key, { kind: 'custom', description: customDraft?.key === conflict.key ? customDraft.description : '' })}>Guardar descripción personalizada</button>
          </>}

          {conflict?.kind === 'verse' && <>
            <p className="verse-transfer-counter">Conflicto {Object.keys(review.decisions).length + 1} · Referencia repetida o superpuesta</p>
            <h3 className="verse-transfer-title">{conflict.categoryName}</h3>
            <div className="verse-transfer-comparison">
              {conflict.existing.map((verse) => (
                <div className="verse-transfer-version" key={verse.id}>
                  <strong>Existente · {formatVerseRange(verseRange(verse))}</strong>
                  <p><b>Descripción:</b> {verse.description || 'Sin descripción.'}</p>
                  <p><b>Qué refuta:</b> {verse.refutes || 'Sin registrar.'}</p>
                </div>
              ))}
              <div className="verse-transfer-version imported">
                <strong>Archivo · {formatVerseRange(conflict.imported)}</strong>
                <p><b>Descripción:</b> {conflict.imported.description || 'Sin descripción.'}</p>
                <p><b>Qué refuta:</b> {conflict.imported.refutes || 'Sin registrar.'}</p>
              </div>
            </div>
            {conflict.existing.length > 1 && (
              <p className="form-error">Este rango se superpone con {conflict.existing.length} registros existentes. «Usar archivo» reemplazará todos ellos. «Conservar» los mantendrá todos.</p>
            )}
            {conflict.existing.length === 1 && !(
              conflict.existing[0].reference.bookId === conflict.imported.start.bookId &&
              conflict.existing[0].reference.chapter === conflict.imported.start.chapter &&
              conflict.existing[0].reference.verse === conflict.imported.start.verse &&
              (conflict.existing[0].endReference ?? conflict.existing[0].reference).bookId === conflict.imported.end.bookId &&
              (conflict.existing[0].endReference ?? conflict.existing[0].reference).chapter === conflict.imported.end.chapter &&
              (conflict.existing[0].endReference ?? conflict.existing[0].reference).verse === conflict.imported.end.verse
            ) && <p className="muted">Los rangos no son iguales, pero comparten al menos un versículo. Elige qué rango deseas conservar.</p>}
            <div className="verse-transfer-choices">
              <button type="button" className="secondary-button" onClick={() => choose(conflict.key, { kind: 'existing' })}>Conservar existente</button>
              <button type="button" className="secondary-button" onClick={() => choose(conflict.key, { kind: 'imported' })}>Usar archivo compartido</button>
              <button type="button" className="secondary-button" onClick={() => startCustom(conflict)}>Personalizar</button>
            </div>
            {customDraft?.key === conflict.key && <div className="verse-transfer-custom">
              <label>Referencia que deseas conservar
                <select value={customDraft.rangeSource} onChange={(event) => changeCustomRange(conflict, event.target.value)}>
                  <option value="imported">Archivo: {formatVerseRange(conflict.imported)}</option>
                  {conflict.existing.map((verse) => <option key={verse.id} value={`existing:${verse.id}`}>Existente: {formatVerseRange(verseRange(verse))}</option>)}
                </select>
              </label>
              <label>Descripción personalizada
                <textarea rows={3} value={customDraft.description} onChange={(event) => setCustomDraft({ ...customDraft, description: event.target.value })} />
              </label>
              <label>Qué refuta
                <textarea rows={3} value={customDraft.refutes} onChange={(event) => setCustomDraft({ ...customDraft, refutes: event.target.value })} />
              </label>
              <p className="muted">Si eliges el rango importado, sustituirá los registros superpuestos. Si eliges uno existente, se editarán sus notas y se conservarán los demás.</p>
              <button type="button" className="primary-button" onClick={() => choose(conflict.key, {
                kind: 'custom', rangeSource: customDraft.rangeSource,
                description: customDraft.description, refutes: customDraft.refutes
              })}>Guardar versión personalizada</button>
            </div>}
          </>}

          {!conflict && preview.result && <>
            <h3 className="verse-transfer-title">Revisión terminada</h3>
            <p className="muted">Este es el resultado que se aplicará al confirmar. No se ha guardado ningún cambio todavía.</p>
            <div className="verse-transfer-stats">
              <span>Categorías nuevas <b>{preview.stats.newCategories}</b></span>
              <span>Categorías unificadas <b>{preview.stats.mergedCategories}</b></span>
              <span>Descripciones de categoría modificadas <b>{preview.stats.categoryDescriptionsChanged}</b></span>
              <span>Versículos nuevos <b>{preview.stats.newVerses}</b></span>
              <span>Versículos idénticos (omitidos) <b>{preview.stats.identicalVerses}</b></span>
              <span>Referencias existentes conservadas <b>{preview.stats.keptVerses}</b></span>
              <span>Referencias reemplazadas <b>{preview.stats.replacedVerses}</b></span>
              <span>Versiones personalizadas <b>{preview.stats.customVerses}</b></span>
            </div>
            <button type="button" className="primary-button" onClick={confirmImport}>✅ Confirmar importación</button>
          </>}
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => { setReview(null); setCustomDraft(null); setError(''); setMode('menu'); }}>Cancelar importación</button>
            {Object.keys(review.decisions).length > 0 && <button type="button" className="text-button" onClick={previousChoice}>← Revisar decisión anterior</button>}
          </div>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <input ref={fileInput} className="verse-transfer-file-input" type="file" accept=".json,application/json" onChange={(event) => void openImportFile(event)} aria-label="Seleccionar archivo de categorías" />
      </div>
    </Modal>
  );
}
