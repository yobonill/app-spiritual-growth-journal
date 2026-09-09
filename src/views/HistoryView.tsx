import { formatBibleRange } from '../data/bibleBooks';
import { formatDateTime, formatDuration } from '../lib/format';
import type { AppData } from '../types';

interface HistoryViewProps { data: AppData; }

type HistoryItem =
  | { type: 'prayer'; endedAt: string; data: AppData['prayerSessions'][number] }
  | { type: 'bible'; endedAt: string; data: AppData['bibleReadingSessions'][number] };

export default function HistoryView({ data }: HistoryViewProps) {
  const items: HistoryItem[] = [
    ...data.prayerSessions.map((session) => ({ type: 'prayer' as const, endedAt: session.endedAt, data: session })),
    ...data.bibleReadingSessions.map((session) => ({ type: 'bible' as const, endedAt: session.endedAt, data: session }))
  ].sort((a, b) => b.endedAt.localeCompare(a.endedAt));

  return (
    <div className="view-stack">
      <section className="page-heading">
        <p className="eyebrow">Tu recorrido</p>
        <h1>Historial</h1>
        <p>Sesiones de oración y lectura guardadas en este dispositivo.</p>
      </section>

      {items.length === 0 ? (
        <div className="empty-state large"><strong>Aún no hay registros.</strong><span>Tu primera sesión aparecerá aquí.</span></div>
      ) : (
        <div className="history-list">
          {items.map((item) => item.type === 'prayer' ? (
            <article className="history-card" key={`prayer-${item.data.id}`}>
              <div className="history-card-head"><span className="history-icon">🙏</span><div><strong>Oración</strong><small>{formatDateTime(item.data.endedAt)}</small></div><b>{formatDuration(item.data.durationSeconds)}</b></div>
              {item.data.segments.length > 0 && (
                <div className="history-tags">
                  {item.data.segments.map((segment) => <span key={segment.id}>{segment.labelSnapshot} · {formatDuration(segment.durationSeconds)}</span>)}
                </div>
              )}
              {item.data.comment && <p className="history-comment">“{item.data.comment}”</p>}
            </article>
          ) : (
            <article className="history-card" key={`bible-${item.data.id}`}>
              <div className="history-card-head"><span className="history-icon">📖</span><div><strong>{formatBibleRange(item.data.start, item.data.end)}</strong><small>{formatDateTime(item.data.endedAt)}</small></div><b>{formatDuration(item.data.durationSeconds)}</b></div>
              {item.data.comment && <p className="history-comment">“{item.data.comment}”</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
