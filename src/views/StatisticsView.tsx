import { formatDuration } from '../lib/format';
import type { AppData } from '../types';

interface StatisticsViewProps { data: AppData; }

function sum(values: number[]): number { return values.reduce((total, value) => total + value, 0); }

function getDayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calculateStreak(dates: string[]): number {
  const set = new Set(dates);
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;
  while (set.has(getDayKey(cursor.toISOString()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function StatisticsView({ data }: StatisticsViewProps) {
  const prayerSeconds = sum(data.prayerSessions.map((session) => session.durationSeconds));
  const bibleSeconds = sum(data.bibleReadingSessions.map((session) => session.durationSeconds));
  const prayerDays = data.prayerSessions.map((session) => getDayKey(session.endedAt));
  const bibleDays = data.bibleReadingSessions.map((session) => getDayKey(session.endedAt));

  const targetTotals = new Map<string, number>();
  for (const session of data.prayerSessions) {
    for (const segment of session.segments) {
      targetTotals.set(segment.labelSnapshot, (targetTotals.get(segment.labelSnapshot) ?? 0) + segment.durationSeconds);
    }
  }
  const topTargets = [...targetTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const activeRequests = data.prayerRequests.filter((request) => request.status === 'active').length;
  const fulfilledRequests = data.prayerRequests.filter((request) => request.status === 'fulfilled').length;

  return (
    <div className="view-stack">
      <section className="page-heading">
        <p className="eyebrow">Una mirada al tiempo</p>
        <h1>Estadísticas</h1>
        <p>Las métricas son un registro personal, no una medida de tu valor espiritual.</p>
      </section>

      <section className="metrics-grid">
        <article className="metric-card"><span>Tiempo en oración</span><strong>{formatDuration(prayerSeconds)}</strong><small>{data.prayerSessions.length} sesiones</small></article>
        <article className="metric-card"><span>Lectura bíblica</span><strong>{formatDuration(bibleSeconds)}</strong><small>{data.bibleReadingSessions.length} sesiones</small></article>
        <article className="metric-card"><span>Racha de oración</span><strong>{calculateStreak(prayerDays)} días</strong><small>Con al menos una sesión diaria</small></article>
        <article className="metric-card"><span>Racha de lectura</span><strong>{calculateStreak(bibleDays)} días</strong><small>Con al menos una lectura diaria</small></article>
      </section>

      <section className="panel-section">
        <div className="section-title"><h2>Temas con más tiempo</h2></div>
        {topTargets.length === 0 ? <p className="muted">Aún no hay tiempos por tema.</p> : topTargets.map(([label, seconds], index) => (
          <div className="ranking-row" key={label}><span>{index + 1}. {label}</span><strong>{formatDuration(seconds)}</strong></div>
        ))}
      </section>

      <section className="panel-section request-metrics">
        <div><span>Peticiones activas</span><strong>{activeRequests}</strong></div>
        <div><span>Peticiones cumplidas</span><strong>{fulfilledRequests}</strong></div>
      </section>
    </div>
  );
}
