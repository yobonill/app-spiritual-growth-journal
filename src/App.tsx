import { useEffect, useMemo, useState } from 'react';
import AppNav from './components/AppNav';
import BibleReferencePicker from './components/BibleReferencePicker';
import Modal from './components/Modal';
import { createReference, formatBibleRange, getNextReference } from './data/bibleBooks';
import { primeChime } from './lib/audio';
import { createDefaultAppData, loadAppData, saveAppData } from './lib/db';
import { elapsedSeconds, formatDateTime } from './lib/format';
import { createId } from './lib/id';
import type { ActiveBibleSession, ActivePrayerSession, AppData, AppView, BibleReference, PrayerSession } from './types';
import BibleSessionView from './views/BibleSessionView';
import HistoryView from './views/HistoryView';
import HomeView from './views/HomeView';
import PrayerSessionView from './views/PrayerSessionView';
import SettingsView from './views/SettingsView';
import StatisticsView from './views/StatisticsView';

export default function App() {
  const [data, setDataState] = useState<AppData | null>(null);
  const [view, setView] = useState<AppView>('home');
  const [showPrayerSetup, setShowPrayerSetup] = useState(false);
  const [showBibleSetup, setShowBibleSetup] = useState(false);
  const [prayerMinutes, setPrayerMinutes] = useState(30);
  const [customPrayerMinutes, setCustomPrayerMinutes] = useState('');
  const [bibleStart, setBibleStart] = useState<BibleReference>(createReference('gen', 1, 1));
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    void loadAppData().then(setDataState).catch(() => {
      setDataState(createDefaultAppData());
      setStorageError('No se pudo leer el almacenamiento local. Los cambios de esta sesión podrían no conservarse.');
    });
  }, []);

  const setData = (next: AppData | ((current: AppData) => AppData)) => {
    setDataState((current) => {
      if (!current) return current;
      const resolved = typeof next === 'function' ? next(current) : next;
      void saveAppData(resolved).catch(() => setStorageError('No se pudo guardar un cambio en el dispositivo.'));
      return resolved;
    });
  };

  const recentBibleSessions = useMemo(() => {
    if (!data) return [];
    return [...data.bibleReadingSessions].sort((a, b) => b.endedAt.localeCompare(a.endedAt)).slice(0, 3);
  }, [data]);

  if (!data) {
    return <main className="app-shell"><div className="loading-state"><span className="loading-mark">✦</span><p>Preparando tu diario…</p></div></main>;
  }

  const activeSession = data.activeSession;

  const startPrayer = async () => {
    const selectedMinutes = customPrayerMinutes ? Number(customPrayerMinutes) : prayerMinutes;
    const safeMinutes = Math.min(360, Math.max(1, selectedMinutes || 30));
    await primeChime();
    const session: ActivePrayerSession = {
      type: 'prayer', id: createId('prayer-session'), plannedDurationSeconds: safeMinutes * 60,
      startedAt: new Date().toISOString(), segments: [], completedTargetKeys: []
    };
    setData({ ...data, activeSession: session });
    setShowPrayerSetup(false);
    setCustomPrayerMinutes('');
  };

  const startBible = () => {
    const session: ActiveBibleSession = {
      type: 'bible', id: createId('bible-session'), startedAt: new Date().toISOString(), start: bibleStart
    };
    setData({ ...data, activeSession: session });
    setShowBibleSetup(false);
  };

  const finishPrayer = (comment: string) => {
    if (data.activeSession?.type !== 'prayer') return;
    const active = data.activeSession;
    const endedAt = new Date().toISOString();
    const finalSegments = [...active.segments];
    if (active.activeSegment) {
      finalSegments.push({
        id: createId('segment'), targetType: active.activeSegment.targetType, targetId: active.activeSegment.targetId,
        labelSnapshot: active.activeSegment.labelSnapshot, startedAt: active.activeSegment.startedAt, endedAt,
        durationSeconds: elapsedSeconds(active.activeSegment.startedAt, new Date(endedAt).getTime())
      });
    }
    const saved: PrayerSession = {
      id: active.id, plannedDurationSeconds: active.plannedDurationSeconds, startedAt: active.startedAt, endedAt,
      durationSeconds: elapsedSeconds(active.startedAt, new Date(endedAt).getTime()), comment: comment || undefined, segments: finalSegments
    };
    setData({ ...data, activeSession: undefined, prayerSessions: [saved, ...data.prayerSessions] });
    setView('home');
  };

  const finishBible = (end: BibleReference, comment: string) => {
    if (data.activeSession?.type !== 'bible') return;
    const active = data.activeSession;
    const endedAt = new Date().toISOString();
    setData({
      ...data,
      activeSession: undefined,
      bibleReadingSessions: [{
        id: active.id, startedAt: active.startedAt, endedAt,
        durationSeconds: elapsedSeconds(active.startedAt, new Date(endedAt).getTime()),
        start: active.start, end, comment: comment || undefined
      }, ...data.bibleReadingSessions]
    });
    const next = getNextReference(end);
    if (next) setBibleStart(next);
    setView('home');
  };

  const cancelActive = () => {
    if (!window.confirm('¿Cancelar esta sesión? El tiempo de esta sesión no se guardará.')) return;
    setData({ ...data, activeSession: undefined });
  };

  let content;
  if (activeSession?.type === 'prayer') {
    content = <PrayerSessionView data={data} session={activeSession} onChangeSession={(session) => setData({ ...data, activeSession: session })} onFinish={finishPrayer} onCancel={cancelActive} />;
  } else if (activeSession?.type === 'bible') {
    content = <BibleSessionView session={activeSession} onFinish={finishBible} onCancel={cancelActive} />;
  } else if (view === 'history') {
    content = <HistoryView data={data} />;
  } else if (view === 'statistics') {
    content = <StatisticsView data={data} />;
  } else if (view === 'settings') {
    content = <SettingsView data={data} onDataChange={setData} onImport={(imported) => { setData(imported); setView('home'); }} />;
  } else {
    content = <HomeView data={data} onStartPrayer={() => setShowPrayerSetup(true)} onStartBible={() => {
      const latest = recentBibleSessions[0];
      const next = latest ? getNextReference(latest.end) : null;
      if (next) setBibleStart(next);
      setShowBibleSetup(true);
    }} onResumeActive={() => undefined} />;
  }

  return (
    <main className="app-shell">
      {storageError && <div className="storage-warning" role="alert">{storageError}</div>}
      <div className="content-shell">{content}</div>
      {!activeSession && <AppNav activeView={view} onChange={setView} />}

      {showPrayerSetup && (
        <Modal title="Preparar sesión de oración" onClose={() => setShowPrayerSetup(false)}>
          <div className="modal-body view-stack">
            <p className="muted">¿Cuánto tiempo tienes disponible para orar?</p>
            <div className="duration-options">
              {[30, 45, 60].map((minutes) => <button type="button" key={minutes} className={!customPrayerMinutes && prayerMinutes === minutes ? 'duration-choice selected' : 'duration-choice'} onClick={() => { setPrayerMinutes(minutes); setCustomPrayerMinutes(''); }}>{minutes === 60 ? '1 hora' : `${minutes} min`}</button>)}
            </div>
            <label>Otro tiempo <span className="optional">(minutos)</span><input type="number" min="1" max="360" value={customPrayerMinutes} onChange={(event) => setCustomPrayerMinutes(event.target.value)} placeholder="Ej. 20" /></label>
            <p className="info-note">El cronómetro se mantendrá oculto durante la oración salvo que decidas mostrarlo. {data.settings.chimeEnabled ? `El aviso sonará cada ${data.settings.chimeIntervalMinutes} minutos.` : 'El aviso sonoro está desactivado.'}</p>
            <button className="primary-button full" type="button" onClick={() => void startPrayer()}>Comenzar oración</button>
          </div>
        </Modal>
      )}

      {showBibleSetup && (
        <Modal title="Iniciar lectura bíblica" onClose={() => setShowBibleSetup(false)}>
          <div className="modal-body view-stack">
            {recentBibleSessions.length > 0 && (
              <section className="recent-readings"><h3>Últimas lecturas</h3>{recentBibleSessions.map((session) => <button type="button" key={session.id} onClick={() => { const next = getNextReference(session.end); if (next) setBibleStart(next); }}><span>{formatBibleRange(session.start, session.end)}</span><small>{formatDateTime(session.endedAt)}</small></button>)}</section>
            )}
            <BibleReferencePicker value={bibleStart} onChange={setBibleStart} label="¿Dónde vas a comenzar?" />
            <p className="info-note">Solo registras el punto de inicio ahora. Cuando termines la sesión indicarás hasta dónde leíste y podrás agregar un comentario.</p>
            <button className="primary-button full" type="button" onClick={startBible}>Comenzar lectura</button>
          </div>
        </Modal>
      )}
    </main>
  );
}
