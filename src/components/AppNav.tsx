import type { AppView } from '../types';

interface AppNavProps {
  activeView: AppView;
  onChange: (view: AppView) => void;
  disabled?: boolean;
}

const items: Array<{ view: AppView; icon: string; label: string }> = [
  { view: 'home', icon: '⌂', label: 'Inicio' },
  { view: 'history', icon: '◷', label: 'Historial' },
  { view: 'statistics', icon: '▥', label: 'Estadísticas' },
  { view: 'settings', icon: '⚙', label: 'Configuración' }
];

export default function AppNav({ activeView, onChange, disabled = false }: AppNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {items.map((item) => (
        <button
          key={item.view}
          type="button"
          className={activeView === item.view ? 'nav-item active' : 'nav-item'}
          onClick={() => onChange(item.view)}
          disabled={disabled}
        >
          <span className="nav-icon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
