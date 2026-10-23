import { useEffect, useRef, useState } from 'react';
import BibleReferencePicker from '../components/BibleReferencePicker';
import { compareReferences, formatBibleReference, formatBibleRange } from '../data/bibleBooks';
import { playChime } from '../lib/audio';
import { elapsedSeconds, formatDuration, formatTimer } from '../lib/format';
import type { ActiveBibleSession, AppSettings, BibleReference } from '../types';

interface BibleSessionViewProps {
  session: ActiveBibleSession;
  settings: AppSettings;
  onFinish: (end: BibleReference, comment: string) => void;
  onCancel: () => void;
}

export default function BibleSessionView({ session, settings, onFinish, onCancel }: BibleSessionViewProps) {
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(false);
  const [endReference, setEndReference] = useState<BibleReference>(session.start);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const intervalSeconds = Math.max(60, settings.chimeIntervalMinutes * 60);
  const initialBucket = Math.floor(elapsedSeconds(session.startedAt) / intervalSeconds);
  const lastChimeBucket = useRef(initialBucket);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed = elapsedSeconds(session.startedAt, now);

  useEffect(() => {
    if (!settings.chimeEnabled || intervalSeconds <= 0) return;
    const bucket = Math.floor(elapsed / intervalSeconds);
    if (bucket > 0 && bucket > lastChimeBucket.current) {
      lastChimeBucket.current = bucket;
      void playChime();
    }
  }, [elapsed, intervalSeconds, settings.chimeEnabled]);

  const save = () => {
    if (compareReferences(endReference, session.start) < 0) {
      setError('El punto final no puede estar antes del lugar donde comenzaste.');
      return;
    }
    onFinish(endReference, comment.trim());
  };

  if (ending) {
    return (
      <div className="focus-view view-stack">
        <section className="session-heading">
          <p className="eyebrow">Finalizar lectura</p>
          <h1>¿Hasta dónde leíste?</h1>
          <p>Comenzaste en <strong>{formatBibleReference(session.start)}</strong>.</p>
        </section>
        <BibleReferencePicker value={endReference} onChange={(reference) => { setEndReference(reference); setError(''); }} label="Punto final" />
        {error && <p className="form-error" role="alert">{error}</p>}
        <label>
          Comentario de la sesión <span className="optional">(opcional)</span>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} placeholder="¿Qué aprendiste, qué te llamó la atención o qué quieres recordar?" />
        </label>
        <section className="reading-summary-preview">
          <span>Lectura</span>
          <strong>{formatBibleRange(session.start, endReference)}</strong>
          <small>{formatDuration(elapsed)}</small>
        </section>
        <div className="button-row">
          <button className="secondary-button" type="button" onClick={() => setEnding(false)}>Seguir leyendo</button>
          <button className="primary-button" type="button" onClick={save}>Guardar lectura</button>
        </div>
      </div>
    );
  }

  return (
    <div className="focus-view bible-focus view-stack">
      <section className="reading-focus-card">
        <span className="session-symbol">📖</span>
        <p>Leyendo desde</p>
        <h1>{formatBibleReference(session.start)}</h1>
        <strong>{formatTimer(elapsed)}</strong>
        <small>El tiempo es orientativo; la sesión se guarda cuando tú la terminas.</small>
      </section>
      <div className="session-footer-actions">
        <button className="danger-text-button" type="button" onClick={onCancel}>Cancelar sesión</button>
        <button className="primary-button" type="button" onClick={() => setEnding(true)}>Terminar lectura</button>
      </div>
    </div>
  );
}
