import { useState } from 'react';
import { formatBibleRange } from '../data/bibleBooks';
import { formatDateTime, formatDuration } from '../lib/format';
import type { AppData, ManualPracticeType } from '../types';

interface HistoryViewProps { data: AppData; }

type HistoryFilter = 'all' | 'prayer' | 'bible' | ManualPracticeType;

type HistoryItem =
  | { type: 'prayer'; endedAt: string; data: AppData['prayerSessions'][number] }
  | { type: 'bible'; endedAt: string; data: AppData['bibleReadingSessions'][number] }
  | { type: ManualPracticeType; endedAt: string; data: AppData['practiceRecords'][number] };

const filterLabels: Array<{ value: HistoryFilter; label: string }> = [
  { value: 'all', label: 'Todo' },
  { value: 'prayer', label: 'Oración' },
  { value: 'bible', label: 'Lectura' },
  { value: 'fasting', label: 'Ayuno' },
  { value: 'cilice', label: 'Cilicio' }
];

export default function HistoryView({ data }: HistoryViewProps) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const items: HistoryItem[] = [
    ...data.prayerSessions.map((session) => ({ type: 'prayer' as const, endedAt: session.endedAt, data: session })),
    ...data.bibleReadingSessions.map((session) => ({ type: 'bible' as const, endedAt: session.endedAt, data: session })),
    ...data.practiceRecords.map((record) => ({ type: record.type, endedAt: record.endedAt, data: record }))
  ].sort((a, b) => b.endedAt.localeCompare(a.endedAt));

  const visibleItems = filter === 'all' ? items : items.filter((item) => item.type === filter);

  return (
    <div className="view-stack">
      <section className="page-heading">
        <p className="eyebrow">Tu recorrido</p>
        <h1>Historial</h1>
        <p>Oración, lectura bíblica, ayuno y cilicio guardados en este dispositivo.</p>
      </section>

      <div className="history-filters" aria-label="Filtrar historial">
        {filterLabels.map((option) => (
          <button
            key={option.value}
            type="button"
            className={filter === option.value ? 'history-filter active' : 'history-filter'}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <div className="empty-state large"><strong>Aún no hay registros en esta categoría.</strong><span>Los nuevos registros aparecerán aquí.</span></div>
      ) : (
        <div className="history-list">
          {visibleItems.map((item) => {
            if (item.type === 'prayer') {
              return (
                <article className="history-card" key={`prayer-${item.data.id}`}>
                  <div className="history-card-head"><span className="history-icon">🙏</span><div><strong>Oración</strong><small>{formatDateTime(item.data.endedAt)}</small></div><b>{formatDuration(item.data.durationSeconds)}</b></div>
                  {item.data.segments.length > 0 && (
                    <div className="history-tags">
                      {item.data.segments.map((segment) => <span key={segment.id}>{segment.labelSnapshot} · {formatDuration(segment.durationSeconds)}</span>)}
                    </div>
                  )}
                  {item.data.comment && <p className="history-comment">“{item.data.comment}”</p>}
                </article>
              );
            }

            if (item.type === 'bible') {
              return (
                <article className="history-card" key={`bible-${item.data.id}`}>
                  <div className="history-card-head"><span className="history-icon">📖</span><div><strong>{formatBibleRange(item.data.start, item.data.end)}</strong><small>{formatDateTime(item.data.endedAt)}</small></div><b>{formatDuration(item.data.durationSeconds)}</b></div>
                  {item.data.comment && <p className="history-comment">“{item.data.comment}”</p>}
                </article>
              );
            }

            const isFasting = item.type === 'fasting';
            return (
              <article className="history-card" key={`${item.type}-${item.data.id}`}>
                <div className="history-card-head">
                  <span className="history-icon">{isFasting ? '⏳' : '✝️'}</span>
                  <div>
                    <strong>{isFasting ? 'Ayuno' : 'Cilicio'}</strong>
                    <small>{formatDateTime(item.data.startedAt)} → {formatDateTime(item.data.endedAt)}</small>
                  </div>
                  <b>{formatDuration(item.data.durationSeconds)}</b>
                </div>
                <div className="manual-history-reason"><span>Razón</span><p>{item.data.reason}</p></div>
                {item.data.comment && <p className="history-comment">“{item.data.comment}”</p>}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
