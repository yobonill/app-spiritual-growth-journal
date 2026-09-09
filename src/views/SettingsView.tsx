import { useRef, useState } from 'react';
import { playChime, primeChime } from '../lib/audio';
import { downloadBackup, parseBackup } from '../lib/backup';
import { formatDate, formatDateTime } from '../lib/format';
import { createId } from '../lib/id';
import type { AppData, PrayerRequestStatus } from '../types';

interface SettingsViewProps {
  data: AppData;
  onDataChange: (data: AppData) => void;
  onImport: (data: AppData) => void;
}

const statusLabels: Record<PrayerRequestStatus, string> = {
  active: 'Activa',
  fulfilled: 'Cumplida',
  not_granted: 'No concedida',
  closed: 'Cerrada / ya no aplica'
};

export default function SettingsView({ data, onDataChange, onImport }: SettingsViewProps) {
  const [topicName, setTopicName] = useState('');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestInitialComment, setRequestInitialComment] = useState('');
  const [updateDrafts, setUpdateDrafts] = useState<Record<string, string>>({});
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, { status: PrayerRequestStatus; comment: string }>>({});
  const [backupMessage, setBackupMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const updateSettings = (changes: Partial<AppData['settings']>) => onDataChange({ ...data, settings: { ...data.settings, ...changes } });

  const addTopic = () => {
    const name = topicName.trim();
    if (!name) return;
    onDataChange({
      ...data,
      prayerTopics: [...data.prayerTopics, { id: createId('topic'), name, active: true, createdAt: new Date().toISOString() }]
    });
    setTopicName('');
  };

  const addRequest = () => {
    const title = requestTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    onDataChange({
      ...data,
      prayerRequests: [{
        id: createId('request'), title, status: 'active', startedAt: now,
        initialComment: requestInitialComment.trim() || undefined,
        updates: [], createdAt: now, updatedAt: now
      }, ...data.prayerRequests]
    });
    setRequestTitle('');
    setRequestInitialComment('');
  };

  const addRequestUpdate = (requestId: string) => {
    const comment = (updateDrafts[requestId] ?? '').trim();
    if (!comment) return;
    const now = new Date().toISOString();
    onDataChange({
      ...data,
      prayerRequests: data.prayerRequests.map((request) => request.id === requestId ? {
        ...request,
        updatedAt: now,
        updates: [...request.updates, { id: createId('request-update'), createdAt: now, comment }]
      } : request)
    });
    setUpdateDrafts((drafts) => ({ ...drafts, [requestId]: '' }));
  };

  const resolveRequest = (requestId: string) => {
    const draft = resolutionDrafts[requestId] ?? { status: 'fulfilled' as const, comment: '' };
    const now = new Date().toISOString();
    onDataChange({
      ...data,
      prayerRequests: data.prayerRequests.map((request) => request.id === requestId ? {
        ...request,
        status: draft.status,
        resolvedAt: draft.status === 'active' ? undefined : now,
        finalComment: draft.status === 'active' ? undefined : draft.comment.trim() || undefined,
        updatedAt: now
      } : request)
    });
  };

  const reactivateRequest = (requestId: string) => {
    const now = new Date().toISOString();
    onDataChange({
      ...data,
      prayerRequests: data.prayerRequests.map((request) => request.id === requestId ? {
        ...request, status: 'active', resolvedAt: undefined, finalComment: undefined, updatedAt: now
      } : request)
    });
  };

  const exportData = () => {
    const exportedAt = new Date().toISOString();
    downloadBackup({ ...data, settings: { ...data.settings, lastBackupAt: exportedAt } });
    updateSettings({ lastBackupAt: exportedAt });
    setBackupMessage('Respaldo exportado correctamente.');
  };

  const importFile = async (file: File) => {
    try {
      const imported = parseBackup(await file.text());
      if (!window.confirm('Esto reemplazará los datos locales actuales por los del respaldo. ¿Deseas continuar?')) return;
      onImport(imported);
      setBackupMessage('Respaldo importado correctamente.');
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'No se pudo importar el respaldo.');
    }
  };

  return (
    <div className="view-stack">
      <section className="page-heading">
        <p className="eyebrow">Personaliza tu diario</p>
        <h1>Configuración</h1>
      </section>

      <section className="panel-section">
        <div className="section-title"><div><h2>Aviso durante la oración</h2><p>Un “tin” discreto te ayuda a notar el paso del tiempo sin mirar el reloj.</p></div></div>
        <label className="switch-row">
          <span><strong>Aviso sonoro</strong><small>{data.settings.chimeEnabled ? 'Activado' : 'Desactivado'}</small></span>
          <input type="checkbox" checked={data.settings.chimeEnabled} onChange={(event) => updateSettings({ chimeEnabled: event.target.checked })} />
        </label>
        <label>
          Sonar cada
          <div className="input-with-suffix">
            <input type="number" min="1" max="180" value={data.settings.chimeIntervalMinutes} onChange={(event) => updateSettings({ chimeIntervalMinutes: Math.min(180, Math.max(1, Number(event.target.value) || 10)) })} disabled={!data.settings.chimeEnabled} />
            <span>minutos</span>
          </div>
        </label>
        <button className="secondary-button" type="button" disabled={!data.settings.chimeEnabled} onClick={async () => { await primeChime(); await playChime(); }}>Probar sonido</button>
      </section>

      <section className="panel-section">
        <div className="section-title"><div><h2>Temas recurrentes de oración</h2><p>Aparecen como opciones cada vez que inicias una sesión.</p></div></div>
        <div className="inline-form"><input value={topicName} onChange={(event) => setTopicName(event.target.value)} placeholder="Ej. Mi matrimonio" /><button className="primary-button small" type="button" onClick={addTopic}>Agregar</button></div>
        <div className="settings-list">
          {data.prayerTopics.map((topic) => (
            <div className="settings-row" key={topic.id}>
              <label className="compact-check"><input type="checkbox" checked={topic.active} onChange={(event) => onDataChange({ ...data, prayerTopics: data.prayerTopics.map((item) => item.id === topic.id ? { ...item, active: event.target.checked } : item) })} /><span>{topic.name}</span></label>
              <button className="danger-text-button" type="button" onClick={() => { if (window.confirm(`¿Eliminar “${topic.name}”? El historial anterior se conservará.`)) onDataChange({ ...data, prayerTopics: data.prayerTopics.filter((item) => item.id !== topic.id) }); }}>Eliminar</button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-title"><div><h2>Peticiones de oración</h2><p>Registra cuándo comenzaron, su evolución y cómo terminaron.</p></div></div>
        <div className="request-create-form">
          <label>Título<input value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} placeholder="Ej. Sanidad de Martha" /></label>
          <label>Comentario inicial <span className="optional">(opcional)</span><textarea rows={3} value={requestInitialComment} onChange={(event) => setRequestInitialComment(event.target.value)} placeholder="Contexto inicial de la petición" /></label>
          <button className="primary-button" type="button" onClick={addRequest}>Crear petición</button>
        </div>

        <div className="request-list">
          {data.prayerRequests.length === 0 && <p className="muted">No has registrado peticiones todavía.</p>}
          {data.prayerRequests.map((request) => {
            const resolution = resolutionDrafts[request.id] ?? { status: 'fulfilled' as PrayerRequestStatus, comment: '' };
            return (
              <article className="request-card" key={request.id}>
                <header><div><span className={`status-pill ${request.status}`}>{statusLabels[request.status]}</span><h3>{request.title}</h3><small>Desde {formatDate(request.startedAt)}</small></div></header>
                {request.initialComment && <p className="request-note"><strong>Inicio:</strong> {request.initialComment}</p>}
                {request.updates.length > 0 && <div className="request-timeline">{request.updates.map((update) => <div key={update.id}><small>{formatDateTime(update.createdAt)}</small><p>{update.comment}</p></div>)}</div>}
                {request.status === 'active' ? (
                  <>
                    <div className="inline-form"><input value={updateDrafts[request.id] ?? ''} onChange={(event) => setUpdateDrafts((drafts) => ({ ...drafts, [request.id]: event.target.value }))} placeholder="Agregar actualización o comentario" /><button className="secondary-button small" type="button" onClick={() => addRequestUpdate(request.id)}>Agregar</button></div>
                    <details className="resolution-box"><summary>Cerrar petición</summary><label>Resultado<select value={resolution.status} onChange={(event) => setResolutionDrafts((drafts) => ({ ...drafts, [request.id]: { ...resolution, status: event.target.value as PrayerRequestStatus } }))}><option value="fulfilled">Cumplida</option><option value="not_granted">No concedida</option><option value="closed">Cerrada / ya no aplica</option></select></label><label>Comentario final <span className="optional">(opcional)</span><textarea rows={3} value={resolution.comment} onChange={(event) => setResolutionDrafts((drafts) => ({ ...drafts, [request.id]: { ...resolution, comment: event.target.value } }))} /></label><button className="primary-button" type="button" onClick={() => resolveRequest(request.id)}>Guardar resultado</button></details>
                  </>
                ) : (
                  <div className="resolved-box"><p><strong>Finalizada:</strong> {request.resolvedAt ? formatDate(request.resolvedAt) : '—'}</p>{request.finalComment && <p>{request.finalComment}</p>}<button className="secondary-button small" type="button" onClick={() => reactivateRequest(request.id)}>Reactivar petición</button></div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-title"><div><h2>Respaldo local</h2><p>Tus datos no salen del dispositivo. Exporta un archivo JSON periódicamente para conservar una copia.</p></div></div>
        {data.settings.lastBackupAt && <p className="backup-date">Último respaldo: {formatDateTime(data.settings.lastBackupAt)}</p>}
        <div className="button-row left"><button className="primary-button" type="button" onClick={exportData}>Exportar JSON</button><button className="secondary-button" type="button" onClick={() => fileInput.current?.click()}>Importar JSON</button></div>
        <input ref={fileInput} className="hidden-input" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ''; }} />
        {backupMessage && <p className="backup-message" role="status">{backupMessage}</p>}
      </section>
    </div>
  );
}
