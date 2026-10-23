import { useMemo, useState } from 'react';
import { formatDuration } from '../lib/format';
import { createId } from '../lib/id';
import type { ManualPracticeRecord, ManualPracticeType } from '../types';
import Modal from './Modal';

interface ManualPracticeModalProps {
  type: ManualPracticeType;
  onClose: () => void;
  onSave: (record: ManualPracticeRecord) => void;
}

function toLocalDateTimeValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const labels: Record<ManualPracticeType, { title: string; noun: string; reasonPlaceholder: string }> = {
  fasting: {
    title: 'Registrar ayuno',
    noun: 'ayuno',
    reasonPlaceholder: '¿Cuál fue la razón o propósito de este ayuno?'
  },
  cilice: {
    title: 'Registrar cilicio',
    noun: 'cilicio',
    reasonPlaceholder: '¿Cuál fue la razón o propósito de este cilicio?'
  }
};

export default function ManualPracticeModal({ type, onClose, onSave }: ManualPracticeModalProps) {
  const [startedAt, setStartedAt] = useState('');
  const [endedAt, setEndedAt] = useState(() => toLocalDateTimeValue(new Date()));
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const copy = labels[type];

  const durationSeconds = useMemo(() => {
    if (!startedAt || !endedAt) return 0;
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    return Math.floor((end - start) / 1000);
  }, [endedAt, startedAt]);

  const save = () => {
    const trimmedReason = reason.trim();
    if (!startedAt || !endedAt) {
      setError('Selecciona desde cuándo y hasta cuándo se realizó.');
      return;
    }

    const startMs = new Date(startedAt).getTime();
    const endMs = new Date(endedAt).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      setError('La fecha y hora final debe ser posterior al inicio.');
      return;
    }
    if (endMs > Date.now() + 5 * 60_000) {
      setError(`El ${copy.noun} debe haber terminado antes de registrarlo.`);
      return;
    }
    if (!trimmedReason) {
      setError('Indica la razón o propósito del registro.');
      return;
    }

    const now = new Date().toISOString();
    onSave({
      id: createId(type),
      type,
      startedAt: new Date(startMs).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      durationSeconds: Math.floor((endMs - startMs) / 1000),
      reason: trimmedReason,
      comment: comment.trim() || undefined,
      createdAt: now
    });
  };

  return (
    <Modal title={copy.title} onClose={onClose}>
      <div className="modal-body view-stack">
        <p className="muted">Este registro es manual. No inicia ningún contador ni sesión activa.</p>
        <div className="manual-practice-date-grid">
          <label>
            Desde
            <input type="datetime-local" value={startedAt} onChange={(event) => { setStartedAt(event.target.value); setError(''); }} />
          </label>
          <label>
            Hasta
            <input type="datetime-local" value={endedAt} onChange={(event) => { setEndedAt(event.target.value); setError(''); }} />
          </label>
        </div>
        {durationSeconds > 0 && <p className="manual-duration-preview">Duración: <strong>{formatDuration(durationSeconds)}</strong></p>}
        <label>
          Razón / propósito
          <textarea value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} rows={3} placeholder={copy.reasonPlaceholder} />
        </label>
        <label>
          Comentario <span className="optional">(opcional)</span>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="Detalles que quieras conservar en el historial." />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button full" type="button" onClick={save}>Guardar {copy.noun}</button>
      </div>
    </Modal>
  );
}
