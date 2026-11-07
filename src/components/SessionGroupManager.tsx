import { useState } from 'react';
import { createId } from '../lib/id';
import type { AppData, NamedSessionGroup } from '../types';

interface Props {
  kind: 'prayer' | 'reading';
  data: AppData;
  onChange: (data: AppData) => void;
}

export default function SessionGroupManager({ kind, data, onChange }: Props) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState('');
  const field = kind === 'prayer' ? 'prayerGroups' : 'readingGroups';
  const groups: NamedSessionGroup[] = data[field];
  const title = kind === 'prayer' ? 'Sesiones de oración' : 'Sesiones de lectura';

  const isDuplicate = (value: string, exceptId?: string) => groups.some((group) => group.id !== exceptId && group.name.trim().toLocaleLowerCase('es') === value.trim().toLocaleLowerCase('es'));
  const add = () => {
    const trimmed = name.trim();
    if (!trimmed || isDuplicate(trimmed)) { setError('Escribe un nombre único para la sesión.'); return; }
    onChange({ ...data, [field]: [...groups, { id: createId(kind === 'prayer' ? 'prayer-group' : 'reading-group'), name: trimmed, createdAt: new Date().toISOString() }] });
    setName(''); setError('');
  };

  const rename = (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed || isDuplicate(trimmed, id)) { setError('Escribe un nombre único para la sesión.'); return; }
    onChange({ ...data, [field]: groups.map((group) => group.id === id ? { ...group, name: trimmed } : group) });
    setEditingId(null); setError('');
  };

  const remove = (group: NamedSessionGroup) => {
    if (groups.length < 2) return;
    const fallback = groups.find((item) => item.id !== group.id)!;
    if (!window.confirm(`¿Eliminar “${group.name}”? Los temas o peticiones se moverán a “${fallback.name}”. El historial se conservará.`)) return;
    onChange({
      ...data,
      [field]: groups.filter((item) => item.id !== group.id),
      ...(kind === 'prayer' ? {
        prayerTopics: data.prayerTopics.map((topic) => topic.groupId === group.id ? { ...topic, groupId: fallback.id } : topic),
        prayerRequests: data.prayerRequests.map((request) => request.groupId === group.id ? { ...request, groupId: fallback.id } : request),
        prayerSessions: data.prayerSessions.map((session) => session.groupId === group.id ? { ...session, groupNameSnapshot: session.groupNameSnapshot ?? group.name } : session)
      } : {
        bibleReadingSessions: data.bibleReadingSessions.map((session) => session.groupId === group.id ? { ...session, groupNameSnapshot: session.groupNameSnapshot ?? group.name } : session)
      })
    });
    setEditingId(null); setError('');
  };

  return (
    <section className="panel-section">
      <div className="section-title"><h2>{title}</h2><p>{kind === 'prayer' ? 'Organiza tus temas y peticiones sin duplicarlos.' : 'Mantén un punto de lectura independiente para cada estudio o libro.'}</p></div>
      <div className="inline-form"><input aria-label={`Nueva sesión de ${kind === 'prayer' ? 'oración' : 'lectura'}`} value={name} placeholder="Ej. Mañana, Noche o Estudio especial" onChange={(event) => { setName(event.target.value); setError(''); }} /><button className="primary-button small" type="button" onClick={add}>Crear</button></div>
      <div className="settings-list">
        {groups.map((group) => (
          <div className="group-settings-row" key={group.id}>
            {editingId === group.id ? <input aria-label="Renombrar sesión" value={editingName} onChange={(event) => setEditingName(event.target.value)} /> : <strong>{group.name}</strong>}
            <div className="group-row-actions">
              {editingId === group.id ? (
                <><button className="secondary-button small" type="button" onClick={() => rename(group.id)}>Guardar</button><button className="text-button" type="button" onClick={() => { setEditingId(null); setError(''); }}>Cancelar</button></>
              ) : (
                <><button className="text-button" type="button" onClick={() => { setEditingId(group.id); setEditingName(group.name); setError(''); }}>Renombrar</button><button className="danger-text-button" disabled={groups.length === 1} title={groups.length === 1 ? 'Debe existir al menos una sesión.' : undefined} type="button" onClick={() => remove(group)}>Eliminar</button></>
              )}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
