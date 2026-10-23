import { useMemo, useState } from 'react';
import { formatDuration } from '../lib/format';
import type { AppData } from '../types';

interface StatisticsViewProps { data: AppData; }

type PeriodKey = '7' | '30' | '90' | 'all';

interface DailyActivity {
  day: string;
  prayerSeconds: number;
  bibleSeconds: number;
}

const periodOptions: Array<{ value: PeriodKey; label: string }> = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: 'all', label: 'Todo' }
];

function sum(values: number[]): number { return values.reduce((total, value) => total + value, 0); }

function getDayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function keyToUtcMs(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function utcMsToKey(value: number): string {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function shiftDayKey(key: string, amount: number): string {
  return utcMsToKey(keyToUtcMs(key) + amount * 86_400_000);
}

function enumerateDayKeys(start: string, end: string): string[] {
  const startMs = keyToUtcMs(start);
  const endMs = keyToUtcMs(end);
  if (startMs > endMs) return [];
  const result: string[] = [];
  for (let cursor = startMs; cursor <= endMs; cursor += 86_400_000) result.push(utcMsToKey(cursor));
  return result;
}

function calculateCurrentStreak(dates: string[]): number {
  const set = new Set(dates);
  if (set.size === 0) return 0;
  const today = getTodayKey();
  const yesterday = shiftDayKey(today, -1);
  let cursor = set.has(today) ? today : set.has(yesterday) ? yesterday : '';
  if (!cursor) return 0;

  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

function calculateBestStreak(dates: string[]): number {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] === shiftDayKey(sorted[index - 1], 1)) current += 1;
    else current = 1;
    best = Math.max(best, current);
  }
  return best;
}

function formatDayLabel(day: string): string {
  return new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(keyToUtcMs(day)));
}

function average(total: number, count: number): number {
  return count > 0 ? Math.round(total / count) : 0;
}

export default function StatisticsView({ data }: StatisticsViewProps) {
  const [period, setPeriod] = useState<PeriodKey>('30');
  const [includeZeroDays, setIncludeZeroDays] = useState(true);
  const today = getTodayKey();

  const statistics = useMemo(() => {
    const allGrowthDates = [
      ...data.prayerSessions.map((session) => getDayKey(session.endedAt)),
      ...data.bibleReadingSessions.map((session) => getDayKey(session.endedAt))
    ];
    const firstGrowthDay = [...allGrowthDates].sort()[0] ?? today;
    const periodStart = period === 'all' ? firstGrowthDay : shiftDayKey(today, -(Number(period) - 1));
    const periodDays = enumerateDayKeys(periodStart, today);
    const periodDaySet = new Set(periodDays);

    const prayerSessions = data.prayerSessions.filter((session) => periodDaySet.has(getDayKey(session.endedAt)));
    const bibleSessions = data.bibleReadingSessions.filter((session) => periodDaySet.has(getDayKey(session.endedAt)));
    const practiceRecords = data.practiceRecords.filter((record) => period === 'all' || periodDaySet.has(getDayKey(record.endedAt)));

    const dailyMap = new Map<string, DailyActivity>();
    for (const day of periodDays) dailyMap.set(day, { day, prayerSeconds: 0, bibleSeconds: 0 });
    for (const session of prayerSessions) {
      const day = getDayKey(session.endedAt);
      const entry = dailyMap.get(day);
      if (entry) entry.prayerSeconds += session.durationSeconds;
    }
    for (const session of bibleSessions) {
      const day = getDayKey(session.endedAt);
      const entry = dailyMap.get(day);
      if (entry) entry.bibleSeconds += session.durationSeconds;
    }

    const dailyActivity = [...dailyMap.values()];
    const activeDaily = dailyActivity.filter((entry) => entry.prayerSeconds + entry.bibleSeconds > 0);
    const prayerActiveDays = dailyActivity.filter((entry) => entry.prayerSeconds > 0).length;
    const bibleActiveDays = dailyActivity.filter((entry) => entry.bibleSeconds > 0).length;
    const activeDays = activeDaily.length;
    const prayerSeconds = sum(prayerSessions.map((session) => session.durationSeconds));
    const bibleSeconds = sum(bibleSessions.map((session) => session.durationSeconds));
    const spiritualSeconds = prayerSeconds + bibleSeconds;

    const bestDay = activeDaily.reduce<DailyActivity | null>((best, entry) => {
      if (!best) return entry;
      return entry.prayerSeconds + entry.bibleSeconds > best.prayerSeconds + best.bibleSeconds ? entry : best;
    }, null);

    const targetTotals = new Map<string, number>();
    for (const session of prayerSessions) {
      for (const segment of session.segments) {
        targetTotals.set(segment.labelSnapshot, (targetTotals.get(segment.labelSnapshot) ?? 0) + segment.durationSeconds);
      }
    }

    const fastingRecords = practiceRecords.filter((record) => record.type === 'fasting');
    const ciliceRecords = practiceRecords.filter((record) => record.type === 'cilice');

    return {
      periodDays,
      dailyActivity,
      activeDays,
      spiritualSeconds,
      prayerSeconds,
      bibleSeconds,
      averageSpiritualSeconds: average(spiritualSeconds, includeZeroDays ? periodDays.length : activeDays),
      averagePrayerSeconds: average(prayerSeconds, includeZeroDays ? periodDays.length : prayerActiveDays),
      averageBibleSeconds: average(bibleSeconds, includeZeroDays ? periodDays.length : bibleActiveDays),
      prayerActiveDays,
      bibleActiveDays,
      prayerSessions,
      bibleSessions,
      bestDay,
      topTargets: [...targetTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      fastingRecords,
      ciliceRecords,
      fastingSeconds: sum(fastingRecords.map((record) => record.durationSeconds)),
      ciliceSeconds: sum(ciliceRecords.map((record) => record.durationSeconds))
    };
  }, [data.bibleReadingSessions, data.prayerSessions, data.practiceRecords, includeZeroDays, period, today]);

  const allPrayerDays = data.prayerSessions.map((session) => getDayKey(session.endedAt));
  const allBibleDays = data.bibleReadingSessions.map((session) => getDayKey(session.endedAt));
  const allGrowthDays = [...new Set([...allPrayerDays, ...allBibleDays])];
  const activeRequests = data.prayerRequests.filter((request) => request.status === 'active').length;
  const fulfilledRequests = data.prayerRequests.filter((request) => request.status === 'fulfilled').length;
  const consistency = statistics.periodDays.length > 0 ? Math.round((statistics.activeDays / statistics.periodDays.length) * 100) : 0;
  const chartRows = statistics.dailyActivity.length > 90 ? statistics.dailyActivity.slice(-90) : statistics.dailyActivity;
  const chartMax = Math.max(1, ...chartRows.map((entry) => entry.prayerSeconds + entry.bibleSeconds));
  const chartLabelStep = Math.max(1, Math.ceil(chartRows.length / 8));
  const chartIsTruncated = chartRows.length < statistics.dailyActivity.length;

  return (
    <div className="view-stack statistics-view">
      <section className="page-heading">
        <p className="eyebrow">Una mirada al tiempo</p>
        <h1>Estadísticas</h1>
        <p>Las métricas son un registro personal para observar tus hábitos y constancia.</p>
      </section>

      <div className="period-selector" aria-label="Período de estadísticas">
        {periodOptions.map((option) => (
          <button key={option.value} type="button" className={period === option.value ? 'active' : ''} onClick={() => setPeriod(option.value)}>{option.label}</button>
        ))}
      </div>

      <label className="zero-days-toggle">
        <input type="checkbox" checked={includeZeroDays} onChange={(event) => setIncludeZeroDays(event.target.checked)} />
        <span>
          <strong>Incluir días en 0</strong>
          <small>Cada día del período cuenta; si una categoría no tuvo actividad ese día, aporta 0 a su promedio.</small>
        </span>
      </label>

      <section className="daily-average-panel">
        <div className="daily-average-main">
          <span>Promedio diario de crecimiento espiritual</span>
          <strong>{formatDuration(statistics.averageSpiritualSeconds)}</strong>
          <small>{includeZeroDays ? `Promedio entre los ${statistics.periodDays.length} días del período, incluyendo días en 0.` : `Promedio solo entre los ${statistics.activeDays} días con actividad.`}</small>
        </div>
        <div className="daily-average-breakdown">
          <div><span>Oración</span><strong>{formatDuration(statistics.averagePrayerSeconds)}</strong><small>{includeZeroDays ? `${statistics.periodDays.length} días` : `${statistics.prayerActiveDays} días con oración`}</small></div>
          <div><span>Lectura</span><strong>{formatDuration(statistics.averageBibleSeconds)}</strong><small>{includeZeroDays ? `${statistics.periodDays.length} días` : `${statistics.bibleActiveDays} días con lectura`}</small></div>
          <div><span>Consistencia</span><strong>{consistency}%</strong><small>{statistics.activeDays}/{statistics.periodDays.length} días</small></div>
        </div>
      </section>

      <section className="metrics-grid compact-metrics four-columns">
        <article className="metric-card"><span>Tiempo total</span><strong>{formatDuration(statistics.spiritualSeconds)}</strong><small>Oración + lectura</small></article>
        <article className="metric-card"><span>Oración</span><strong>{formatDuration(statistics.prayerSeconds)}</strong><small>{statistics.prayerSessions.length} sesiones</small></article>
        <article className="metric-card"><span>Lectura</span><strong>{formatDuration(statistics.bibleSeconds)}</strong><small>{statistics.bibleSessions.length} sesiones</small></article>
        <article className="metric-card"><span>Días activos</span><strong>{statistics.activeDays}</strong><small>de {statistics.periodDays.length} días</small></article>
      </section>

      <section className="panel-section">
        <div className="section-title"><h2>Rachas</h2><p>La racha actual se conserva si registraste actividad hoy o ayer.</p></div>
        <div className="streak-grid">
          <div><span>Actual general</span><strong>{calculateCurrentStreak(allGrowthDays)} días</strong></div>
          <div><span>Mejor general</span><strong>{calculateBestStreak(allGrowthDays)} días</strong></div>
          <div><span>Oración</span><strong>{calculateCurrentStreak(allPrayerDays)} días</strong></div>
          <div><span>Lectura</span><strong>{calculateCurrentStreak(allBibleDays)} días</strong></div>
        </div>
      </section>

      <section className="panel-section activity-chart-panel">
        <div className="section-title">
          <h2>Actividad diaria</h2>
          <p>Oración + lectura por día. {chartIsTruncated ? 'Para “Todo”, la gráfica muestra los 90 días más recientes.' : 'Los días sin registro permanecen en cero.'}</p>
        </div>
        <div className="activity-legend"><span><i className="prayer-dot" />Oración</span><span><i className="bible-dot" />Lectura</span></div>
        <div className="activity-chart-scroll">
          <div className="activity-chart" style={{ minWidth: `${Math.max(320, chartRows.length * 28)}px` }}>
            {chartRows.map((entry, index) => {
              const total = entry.prayerSeconds + entry.bibleSeconds;
              const fillHeight = total > 0 ? Math.max(3, (total / chartMax) * 100) : 0;
              const prayerShare = total > 0 ? (entry.prayerSeconds / total) * 100 : 0;
              const bibleShare = total > 0 ? (entry.bibleSeconds / total) * 100 : 0;
              const showLabel = index % chartLabelStep === 0 || index === chartRows.length - 1;
              return (
                <div className="activity-day" key={entry.day} title={`${formatDayLabel(entry.day)} · Oración ${formatDuration(entry.prayerSeconds)} · Lectura ${formatDuration(entry.bibleSeconds)}`}>
                  <div className="activity-bar-track">
                    <div className="activity-bar-fill" style={{ height: `${fillHeight}%` }}>
                      {entry.prayerSeconds > 0 && <span className="activity-prayer-segment" style={{ height: `${prayerShare}%` }} />}
                      {entry.bibleSeconds > 0 && <span className="activity-bible-segment" style={{ height: `${bibleShare}%` }} />}
                    </div>
                  </div>
                  <small>{showLabel ? formatDayLabel(entry.day) : ''}</small>
                </div>
              );
            })}
          </div>
        </div>
      </section>


      <section className="metrics-grid compact-metrics four-columns">
        <article className="metric-card"><span>Prom. sesión oración</span><strong>{formatDuration(average(statistics.prayerSeconds, statistics.prayerSessions.length))}</strong><small>Por sesión</small></article>
        <article className="metric-card"><span>Prom. sesión lectura</span><strong>{formatDuration(average(statistics.bibleSeconds, statistics.bibleSessions.length))}</strong><small>Por sesión</small></article>
        <article className="metric-card"><span>Mejor día</span><strong>{statistics.bestDay ? formatDuration(statistics.bestDay.prayerSeconds + statistics.bestDay.bibleSeconds) : '0 s'}</strong><small>{statistics.bestDay ? formatDayLabel(statistics.bestDay.day) : 'Sin registros'}</small></article>
        <article className="metric-card"><span>Constancia</span><strong>{consistency}%</strong><small>Días con actividad</small></article>
      </section>

      <section className="panel-section">
        <div className="section-title"><h2>Ayuno y cilicio</h2><p>Se muestran aparte y no se suman al promedio diario para evitar doble conteo.</p></div>
        <div className="manual-practice-metrics">
          <div><span>Ayuno</span><strong>{formatDuration(statistics.fastingSeconds)}</strong><small>{statistics.fastingRecords.length} registros · Prom. {formatDuration(average(statistics.fastingSeconds, statistics.fastingRecords.length))}</small></div>
          <div><span>Cilicio</span><strong>{formatDuration(statistics.ciliceSeconds)}</strong><small>{statistics.ciliceRecords.length} registros · Prom. {formatDuration(average(statistics.ciliceSeconds, statistics.ciliceRecords.length))}</small></div>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-title"><h2>Temas con más tiempo</h2><p>Basado en las sesiones de oración del período seleccionado.</p></div>
        {statistics.topTargets.length === 0 ? <p className="muted">Aún no hay tiempos por tema.</p> : statistics.topTargets.map(([label, seconds], index) => (
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
