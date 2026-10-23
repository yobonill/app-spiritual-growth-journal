import { useEffect, useMemo, useRef, useState } from 'react';
import { playChime } from '../lib/audio';
import { elapsedSeconds, formatDuration, formatTimer } from '../lib/format';
import { createId } from '../lib/id';
import type { ActivePrayerSession, AppData, PrayerSegment, PrayerTargetType } from '../types';

interface PrayerSessionViewProps {
  data: AppData;
  session: ActivePrayerSession;
  onChangeSession: (session: ActivePrayerSession) => void;
  onAddPrayer: (name: string, saveRecurring: boolean) => void;
  onFinish: (comment: string) => void;
  onCancel: () => void;
}

interface PrayerTarget {
  key: string;
  type: PrayerTargetType;
  id: string;
  label: string;
  meta?: string;
}

export default function PrayerSessionView({ data, session, onChangeSession, onAddPrayer, onFinish, onCancel }: PrayerSessionViewProps) {
  const [now, setNow] = useState(Date.now());
  const [showTimer, setShowTimer] = useState(false);
  const [ending, setEnding] = useState(false);
  const [comment, setComment] = useState('');
  const [showAddPrayer, setShowAddPrayer] = useState(false);
  const [newPrayerName, setNewPrayerName] = useState('');
  const [saveRecurring, setSaveRecurring] = useState(false);
  const intervalSeconds = Math.max(60, data.settings.chimeIntervalMinutes * 60);
  const initialBucket = Math.floor(elapsedSeconds(session.startedAt) / intervalSeconds);
  const lastChimeBucket = useRef(initialBucket);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const totalElapsed = elapsedSeconds(session.startedAt, now);
  const plannedRemaining = session.plannedDurationSeconds - totalElapsed;

  useEffect(() => {
    if (!data.settings.chimeEnabled || intervalSeconds <= 0) return;
    const bucket = Math.floor(totalElapsed / intervalSeconds);
    if (bucket > 0 && bucket > lastChimeBucket.current) {
      lastChimeBucket.current = bucket;
      void playChime();
    }
  }, [data.settings.chimeEnabled, intervalSeconds, totalElapsed]);

  const targets = useMemo<PrayerTarget[]>(() => {
    const recurring: PrayerTarget[] = data.prayerTopics
      .filter((topic) => topic.active)
      .map((topic) => ({ key: `topic:${topic.id}`, type: 'topic', id: topic.id, label: topic.name, meta: 'Tema recurrente' }));
    const requests: PrayerTarget[] = data.prayerRequests
      .filter((request) => request.status === 'active')
      .map((request) => ({ key: `request:${request.id}`, type: 'request', id: request.id, label: request.title, meta: 'Petición activa' }));
    const temporary: PrayerTarget[] = session.sessionTargets
      .map((target) => ({ key: `session:${target.id}`, type: 'session', id: target.id, label: target.label, meta: 'Solo esta sesión' }));
    return [...requests, ...recurring, ...temporary].filter((target) => !session.completedTargetKeys.includes(target.key));
  }, [data.prayerRequests, data.prayerTopics, session.completedTargetKeys, session.sessionTargets]);

  const activeElapsed = session.activeSegment ? elapsedSeconds(session.activeSegment.startedAt, now) : 0;

  const startTarget = (target: PrayerTarget) => {
    if (session.activeSegment) return;
    onChangeSession({
      ...session,
      activeSegment: {
        targetType: target.type,
        targetId: target.id,
        labelSnapshot: target.label,
        startedAt: new Date().toISOString()
      }
    });
  };

  const stopActiveTarget = () => {
    if (!session.activeSegment) return;
    const endedAt = new Date().toISOString();
    const segment: PrayerSegment = {
      id: createId('segment'),
      targetType: session.activeSegment.targetType,
      targetId: session.activeSegment.targetId,
      labelSnapshot: session.activeSegment.labelSnapshot,
      startedAt: session.activeSegment.startedAt,
      endedAt,
      durationSeconds: elapsedSeconds(session.activeSegment.startedAt, new Date(endedAt).getTime())
    };
    const key = `${session.activeSegment.targetType}:${session.activeSegment.targetId}`;
    onChangeSession({
      ...session,
      activeSegment: undefined,
      segments: [...session.segments, segment],
      completedTargetKeys: [...session.completedTargetKeys, key]
    });
  };


  const addPrayer = () => {
    const name = newPrayerName.trim();
    if (!name) return;
    onAddPrayer(name, saveRecurring);
    setNewPrayerName('');
    setSaveRecurring(false);
    setShowAddPrayer(false);
  };

  const beginFinish = () => {
    if (session.activeSegment) stopActiveTarget();
    setEnding(true);
  };

  if (ending) {
    const recordedSeconds = session.segments.reduce((sum, segment) => sum + segment.durationSeconds, 0) +
      (session.activeSegment ? activeElapsed : 0);
    return (
      <div className="focus-view view-stack">
        <section className="session-heading">
          <p className="eyebrow">Finalizar sesión</p>
          <h1>Resumen de oración</h1>
          <p>Tiempo transcurrido: <strong>{formatDuration(totalElapsed)}</strong></p>
        </section>
        <div className="summary-list">
          {session.segments.map((segment) => (
            <div className="summary-row" key={segment.id}>
              <span>{segment.labelSnapshot}</span>
              <strong>{formatDuration(segment.durationSeconds)}</strong>
            </div>
          ))}
          {session.activeSegment && (
            <div className="summary-row">
              <span>{session.activeSegment.labelSnapshot}</span>
              <strong>{formatDuration(activeElapsed)}</strong>
            </div>
          )}
          {recordedSeconds === 0 && <p className="muted">No se cronometró un tema específico, pero la sesión completa se conservará.</p>}
        </div>
        <label>
          Comentario de la sesión <span className="optional">(opcional)</span>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} placeholder="¿Hay algo que quieras recordar de esta oración?" />
        </label>
        <div className="button-row">
          <button className="secondary-button" type="button" onClick={() => setEnding(false)}>Seguir orando</button>
          <button className="primary-button" type="button" onClick={() => onFinish(comment.trim())}>Guardar sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div className="focus-view view-stack">
      <section className="session-heading compact">
        <div>
          <p className="eyebrow">Sesión de oración</p>
          <h1>{session.activeSegment ? session.activeSegment.labelSnapshot : '¿Por qué vas a orar ahora?'}</h1>
        </div>
        <button className="text-button" type="button" onClick={() => setShowTimer((value) => !value)}>
          {showTimer ? 'Ocultar tiempo' : 'Mostrar tiempo'}
        </button>
      </section>

      {showTimer && (
        <section className="timer-card" aria-live="polite">
          <strong>{formatTimer(totalElapsed)}</strong>
          <span>{plannedRemaining > 0 ? `${formatDuration(plannedRemaining)} para tu meta` : `Meta de ${formatDuration(session.plannedDurationSeconds)} alcanzada`}</span>
        </section>
      )}

      {session.activeSegment ? (
        <section className="active-prayer-card">
          <span className="pulse-dot" aria-hidden="true" />
          <p>Orando ahora</p>
          <h2>{session.activeSegment.labelSnapshot}</h2>
          {showTimer && <strong>{formatTimer(activeElapsed)}</strong>}
          <button className="stop-button" type="button" onClick={stopActiveTarget}>Detener este tema</button>
        </section>
      ) : (
        <>
          <section className="prayer-targets">
            {targets.length > 0 ? targets.map((target) => (
              <button className="prayer-target" type="button" key={target.key} onClick={() => startTarget(target)}>
                <span>{target.label}</span>
                <small>{target.meta}</small>
              </button>
            )) : (
              <div className="empty-state">
                <strong>Completaste todos los temas de esta sesión.</strong>
                <span>Puedes agregar otra oración o finalizar.</span>
              </div>
            )}
          </section>

          <section className="quick-prayer-section">
            {!showAddPrayer ? (
              <button className="secondary-button full" type="button" onClick={() => setShowAddPrayer(true)}>+ Agregar otra oración</button>
            ) : (
              <div className="quick-prayer-form">
                <label>
                  Nueva oración
                  <input value={newPrayerName} onChange={(event) => setNewPrayerName(event.target.value)} placeholder="Ej. Orar por una situación que surgió hoy" autoFocus />
                </label>
                <label className="compact-check quick-prayer-check">
                  <input type="checkbox" checked={saveRecurring} onChange={(event) => setSaveRecurring(event.target.checked)} />
                  <span>Guardar también como tema recurrente</span>
                </label>
                <div className="button-row">
                  <button className="secondary-button small" type="button" onClick={() => { setShowAddPrayer(false); setNewPrayerName(''); setSaveRecurring(false); }}>Cancelar</button>
                  <button className="primary-button small" type="button" onClick={addPrayer} disabled={!newPrayerName.trim()}>Agregar</button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <div className="session-footer-actions">
        <button className="danger-text-button" type="button" onClick={onCancel}>Cancelar sesión</button>
        <button className="primary-button" type="button" onClick={beginFinish}>Terminar oración</button>
      </div>
    </div>
  );
}
