import { formatBibleRange, getNextReference } from '../data/bibleBooks';
import { formatDateTime, formatDuration } from '../lib/format';
import type { AppData } from '../types';

interface HomeViewProps {
  data: AppData;
  onStartPrayer: () => void;
  onStartBible: () => void;
  onResumeActive: () => void;
}

export default function HomeView({ data, onStartPrayer, onStartBible, onResumeActive }: HomeViewProps) {
  const latestBible = [...data.bibleReadingSessions].sort((a, b) => b.endedAt.localeCompare(a.endedAt))[0];
  const latestPrayer = [...data.prayerSessions].sort((a, b) => b.endedAt.localeCompare(a.endedAt))[0];
  const nextReference = latestBible ? getNextReference(latestBible.end) : null;

  return (
    <div className="view-stack home-view">
      <section className="hero-copy">
        <p className="eyebrow">Tu espacio personal</p>
        <h1>Diario de Crecimiento Espiritual</h1>
        <p>Separa este tiempo para orar, leer la Palabra y conservar un registro de tu caminar.</p>
      </section>

      {data.activeSession && (
        <button className="resume-card" type="button" onClick={onResumeActive}>
          <span className="resume-icon">▶</span>
          <span>
            <strong>Hay una sesión en curso</strong>
            <small>{data.activeSession.type === 'prayer' ? 'Sesión de oración' : 'Lectura bíblica'} · Toca para continuar</small>
          </span>
        </button>
      )}

      <section className="primary-actions">
        <button className="session-button prayer" type="button" onClick={onStartPrayer} disabled={Boolean(data.activeSession)}>
          <span className="session-symbol">🙏</span>
          <span>
            <strong>Iniciar sesión de oración</strong>
            <small>Ora por tus temas y peticiones</small>
          </span>
        </button>
        <button className="session-button bible" type="button" onClick={onStartBible} disabled={Boolean(data.activeSession)}>
          <span className="session-symbol">📖</span>
          <span>
            <strong>Iniciar sesión de lectura</strong>
            <small>{nextReference ? `Sugerencia: continuar en ${nextReference.bookName} ${nextReference.chapter}:${nextReference.verse}` : 'Registra dónde comienzas y dónde terminas'}</small>
          </span>
        </button>
      </section>

      <section className="snapshot-grid">
        <article className="snapshot-card">
          <span className="snapshot-label">Última oración</span>
          {latestPrayer ? (
            <>
              <strong>{formatDuration(latestPrayer.durationSeconds)}</strong>
              <small>{formatDateTime(latestPrayer.endedAt)}</small>
            </>
          ) : <p>Aún no hay sesiones.</p>}
        </article>
        <article className="snapshot-card">
          <span className="snapshot-label">Última lectura</span>
          {latestBible ? (
            <>
              <strong>{formatBibleRange(latestBible.start, latestBible.end)}</strong>
              <small>{formatDateTime(latestBible.endedAt)}</small>
            </>
          ) : <p>Aún no hay lecturas.</p>}
        </article>
      </section>
    </div>
  );
}
