import { useState } from 'react';
import { formatDuration } from '../lib/format';
import type { PrayerSession } from '../types';

interface Props {
  session: PrayerSession;
  onSave: (session: PrayerSession) => void;
  onCancel: () => void;
  saveLabel?: string;
}

function toLocalDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function DurationFields({ seconds, onChange, label }: { seconds: number; onChange: (seconds: number) => void; label: string }) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return (
    <div className="duration-editor" role="group" aria-label={label}>
      <label>Horas<input aria-label={`${label}: horas`} type="number" min="0" max="9999" value={hours} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0) * 3600 + minutes * 60 + remainder)} /></label>
      <label>Minutos<input aria-label={`${label}: minutos`} type="number" min="0" max="59" value={minutes} onChange={(event) => onChange(hours * 3600 + Math.max(0, Math.min(59, Number(event.target.value) || 0)) * 60 + remainder)} /></label>
      <label>Segundos<input aria-label={`${label}: segundos`} type="number" min="0" max="59" value={remainder} onChange={(event) => onChange(hours * 3600 + minutes * 60 + Math.max(0, Math.min(59, Number(event.target.value) || 0)))} /></label>
    </div>
  );
}

export default function PrayerSessionEditor({ session, onSave, onCancel, saveLabel = 'Guardar cambios' }: Props) {
  const [duration, setDuration] = useState(session.durationSeconds);
  const [endLocal, setEndLocal] = useState(toLocalDateTime(session.endedAt));
  const [segments, setSegments] = useState(session.segments);
  const [comment, setComment] = useState(session.comment ?? '');
  const [error, setError] = useState('');
  // Preserve review pauses (or any previously edited gap between timestamps and total).
  const offsetSeconds = Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000) - session.durationSeconds;
  const segmentTotal = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0);

  const updateDuration = (value: number) => {
    const safe = Math.max(0, Math.floor(value));
    setDuration(safe);
    setEndLocal(toLocalDateTime(new Date(new Date(session.startedAt).getTime() + (safe + offsetSeconds) * 1000).toISOString()));
    setError('');
  };

  const updateEnd = (value: string) => {
    setEndLocal(value);
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp)) {
      setDuration(Math.max(0, Math.floor((timestamp - new Date(session.startedAt).getTime()) / 1000 - offsetSeconds)));
    }
    setError('');
  };

  const save = () => {
    const endTimestamp = new Date(endLocal).getTime();
    const startedTimestamp = new Date(session.startedAt).getTime();
    if (!Number.isFinite(endTimestamp) || endTimestamp < startedTimestamp || endTimestamp > Date.now() + 1000) {
      setError('La fecha final debe ser válida, posterior al inicio y no puede estar en el futuro.');
      return;
    }
    if (duration < 0 || !Number.isFinite(duration) || segmentTotal > duration) {
      setError('La suma de los temas no puede superar el tiempo total de oración.');
      return;
    }
    onSave({
      ...session,
      endedAt: new Date(endTimestamp).toISOString(),
      durationSeconds: duration,
      segments: segments.map((segment) => ({
        ...segment,
        endedAt: new Date(new Date(segment.startedAt).getTime() + segment.durationSeconds * 1000).toISOString()
      })),
      comment: comment.trim() || undefined
    });
  };

  return (
    <div className="view-stack prayer-time-editor">
      <p className="muted">Inició: <strong>{new Date(session.startedAt).toLocaleString('es-DO')}</strong>. Ajusta la hora final o la duración total; el otro valor se actualizará automáticamente.</p>
      <label>Fecha y hora de finalización
        <input type="datetime-local" step="1" value={endLocal} onChange={(event) => updateEnd(event.target.value)} />
      </label>
      <div className="time-edit-card">
        <strong>Tiempo total de oración</strong>
        <DurationFields label="Tiempo total" seconds={duration} onChange={updateDuration} />
      </div>
      <div className="time-edit-card">
        <strong>Tiempo por tema</strong>
        {segments.length === 0 && <p className="muted">No se cronometraron temas individuales.</p>}
        {segments.map((segment) => (
          <div className="time-edit-segment" key={segment.id}>
            <span>{segment.labelSnapshot}</span>
            <DurationFields label={segment.labelSnapshot} seconds={segment.durationSeconds} onChange={(seconds) => {
              setSegments((previous) => previous.map((item) => item.id === segment.id ? { ...item, durationSeconds: seconds } : item));
              setError('');
            }} />
          </div>
        ))}
        <p className={segmentTotal > duration ? 'form-error' : 'muted'}>
          Temas: {formatDuration(segmentTotal)} · Tiempo sin tema: {formatDuration(Math.max(0, duration - segmentTotal))}
        </p>
      </div>
      <label>Comentario <span className="optional">(opcional)</span>
        <textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} />
      </label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="button-row">
        <button className="secondary-button" type="button" onClick={onCancel}>Volver</button>
        <button className="primary-button" type="button" onClick={save} disabled={segmentTotal > duration}>{saveLabel}</button>
      </div>
    </div>
  );
}
