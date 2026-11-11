import { useEffect, useMemo, useRef, useState } from 'react';
import PrayerSessionEditor from '../components/PrayerSessionEditor';
import { playChime } from '../lib/audio';
import { elapsedSeconds, formatDuration, formatTimer } from '../lib/format';
import { createId } from '../lib/id';
import type { ActivePrayerSession, AppData, PrayerSegment, PrayerSession, PrayerTargetType } from '../types';

interface PrayerSessionViewProps {
  data: AppData;
  session: ActivePrayerSession;
  onChangeSession: (session: ActivePrayerSession) => void;
  onAddPrayer: (name: string, saveRecurring: boolean) => void;
  onFinish: (session: PrayerSession) => void;
  onCancel: () => void;
}

interface PrayerTarget {
  key: string;
  type: PrayerTargetType;
  id: string;
  label: string;
  meta: string;
  groupId?: string;
}

export default function PrayerSessionView({ data, session, onChangeSession, onAddPrayer, onFinish, onCancel }: PrayerSessionViewProps) {
  const [now, setNow] = useState(Date.now());
  const [showTimer, setShowTimer] = useState(false);
  const [showAddPrayer, setShowAddPrayer] = useState(false);
  const [newPrayerName, setNewPrayerName] = useState('');
  const [saveRecurring, setSaveRecurring] = useState(false);
  const intervalSeconds = Math.max(60, data.settings.chimeIntervalMinutes * 60);
  const totalElapsed = Math.max(0, elapsedSeconds(session.startedAt, session.reviewStartedAt ? new Date(session.reviewStartedAt).getTime() : now) - (session.pausedSeconds ?? 0));
  const lastChimeBucket = useRef(Math.floor(totalElapsed / intervalSeconds));

  useEffect(() => {
    if (session.reviewStartedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session.reviewStartedAt]);

  useEffect(() => {
    if (!data.settings.chimeEnabled || session.reviewStartedAt) return;
    const bucket = Math.floor(totalElapsed / intervalSeconds);
    if (bucket > 0 && bucket > lastChimeBucket.current) void playChime();
    lastChimeBucket.current = bucket;
  }, [data.settings.chimeEnabled, session.reviewStartedAt, intervalSeconds, totalElapsed]);

  const targets = useMemo<PrayerTarget[]>(() => {
    const recurring = data.prayerTopics.filter((topic) => topic.active).map((topic) => ({
      key: `topic:${topic.id}`, type: 'topic' as const, id: topic.id, label: topic.name,
      groupId: topic.groupId, meta: 'Tema recurrente'
    }));
    const requests = data.prayerRequests.filter((request) => request.status === 'active').map((request) => ({
      key: `request:${request.id}`, type: 'request' as const, id: request.id, label: request.title,
      groupId: request.groupId, meta: 'Petición activa'
    }));
    const temporary = session.sessionTargets.map((target) => ({
      key: `session:${target.id}`, type: 'session' as const, id: target.id, label: target.label, meta: 'Solo esta oración'
    }));
    return [...requests, ...recurring, ...temporary].filter((target) => !session.completedTargetKeys.includes(target.key));
  }, [data.prayerRequests, data.prayerTopics, session.completedTargetKeys, session.sessionTargets]);

  const plannedRemaining = session.plannedDurationSeconds - totalElapsed;
  const activeElapsed = session.activeSegment ? elapsedSeconds(session.activeSegment.startedAt, now) : 0;

  const startTarget = (target: PrayerTarget) => {
    if (session.activeSegment) return;
    onChangeSession({
      ...session, activeSegment: {
        targetType: target.type, targetId: target.id, labelSnapshot: target.label,
        startedAt: new Date().toISOString()
      }
    });
  };

  const closeActiveSegment = (endedAt: string): ActivePrayerSession => {
    if (!session.activeSegment) return session;
    const segment: PrayerSegment = {
      id: createId('segment'), targetType: session.activeSegment.targetType,
      targetId: session.activeSegment.targetId, labelSnapshot: session.activeSegment.labelSnapshot,
      startedAt: session.activeSegment.startedAt, endedAt,
      durationSeconds: elapsedSeconds(session.activeSegment.startedAt, new Date(endedAt).getTime())
    };
    const key = `${session.activeSegment.targetType}:${session.activeSegment.targetId}`;
    return {
      ...session, activeSegment: undefined, segments: [...session.segments, segment],
      completedTargetKeys: [...session.completedTargetKeys, key]
    };
  };

  const stopActiveTarget = () => onChangeSession(closeActiveSegment(new Date().toISOString()));

  const addPrayer = () => {
    const name = newPrayerName.trim();
    if (!name) return;
    onAddPrayer(name, saveRecurring);
    setNewPrayerName('');
    setSaveRecurring(false);
    setShowAddPrayer(false);
  };

  const beginFinish = () => {
    const endedAt = new Date().toISOString();
    // Freeze both the overall timer and an active topic before displaying the editor.
    onChangeSession({ ...closeActiveSegment(endedAt), reviewStartedAt: endedAt });
  };

  if (session.reviewStartedAt) {
    const snapshot: PrayerSession = {
      id: session.id,
      groupId: session.groupId,
      groupNameSnapshot: data.prayerGroups.find((group) => group.id === session.groupId)?.name,
      plannedDurationSeconds: session.plannedDurationSeconds,
      startedAt: session.startedAt,
      endedAt: session.reviewStartedAt,
      durationSeconds: totalElapsed,
      segments: session.segments
    };
    return (
      <div className="focus-view view-stack">
        <section className="session-heading"><p className="eyebrow">Finalizar sesión</p><h1>Resumen de oración</h1></section>
        <PrayerSessionEditor
          key={session.id}
          session={snapshot}
          saveLabel="Guardar sesión"
          onSave={onFinish}
          onCancel={() => {
            const reviewDuration = elapsedSeconds(session.reviewStartedAt!);
            onChangeSession({
              ...session, reviewStartedAt: undefined,
              pausedSeconds: (session.pausedSeconds ?? 0) + reviewDuration
            });
            setNow(Date.now());
          }}
        />
      </div>
    );
  }

  return (
    <div className="focus-view view-stack">
      <section className="session-heading compact">
        <div>
          <p className="eyebrow">Sesión de oración · {data.prayerGroups.find((group) => group.id === session.groupId)?.name ?? 'General'}</p>
          <h1>{session.activeSegment ? session.activeSegment.labelSnapshot : '¿Por qué vas a orar ahora?'}</h1>
        </div>
        <button className="text-button" type="button" onClick={() => setShowTimer((value) => !value)}>{showTimer ? 'Ocultar tiempo' : 'Mostrar tiempo'}</button>
      </section>

      {showTimer && <section className="timer-card" aria-live="polite"><strong>{formatTimer(totalElapsed)}</strong><span>{plannedRemaining > 0 ? `${formatDuration(plannedRemaining)} para tu meta` : `Meta de ${formatDuration(session.plannedDurationSeconds)} alcanzada`}</span></section>}

      {session.activeSegment ? (
        <section className="active-prayer-card">
          <span className="pulse-dot" aria-hidden="true" /><p>Orando ahora</p>
          <h2>{session.activeSegment.labelSnapshot}</h2>
          {showTimer && <strong>{formatTimer(activeElapsed)}</strong>}
          <button className="stop-button" type="button" onClick={stopActiveTarget}>Detener este tema</button>
        </section>
      ) : (
        <>
          <section className="prayer-group-list" aria-label="Temas organizados por sesión">
            {data.prayerGroups.map((group) => {
              const items = targets.filter((target) => target.groupId === group.id);
              return (
                <details className="prayer-group" key={group.id} open={group.id === session.groupId}>
                  <summary><span>{group.name}</span><small>{items.length} {items.length === 1 ? 'tema disponible' : 'temas disponibles'}</small></summary>
                  <div className="prayer-targets">
                    {items.map((target) => <button className="prayer-target" key={target.key} type="button" onClick={() => startTarget(target)}><span>{target.label}</span><small>{target.meta}</small></button>)}
                    {items.length === 0 && <p className="muted">No hay temas pendientes en esta sesión.</p>}
                  </div>
                </details>
              );
            })}
            {targets.some((target) => !target.groupId) && (
              <details className="prayer-group" open><summary><span>Esta oración</span><small>Temas temporales</small></summary><div className="prayer-targets">
                {targets.filter((target) => !target.groupId).map((target) => <button className="prayer-target" type="button" key={target.key} onClick={() => startTarget(target)}><span>{target.label}</span><small>{target.meta}</small></button>)}
              </div></details>
            )}
          </section>

          <section className="quick-prayer-section">
            {!showAddPrayer ? <button className="secondary-button full" type="button" onClick={() => setShowAddPrayer(true)}>+ Agregar otra oración</button> : (
              <div className="quick-prayer-form">
                <label>Nueva oración<input value={newPrayerName} onChange={(event) => setNewPrayerName(event.target.value)} placeholder="Ej. Orar por una situación de hoy" autoFocus /></label>
                <label className="compact-check quick-prayer-check"><input type="checkbox" checked={saveRecurring} onChange={(event) => setSaveRecurring(event.target.checked)} /><span>Guardar también como tema recurrente en esta sesión</span></label>
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
