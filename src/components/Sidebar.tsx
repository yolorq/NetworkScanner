import {
  Activity,
  Bell,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  List,
  Map,
  Settings2,
  SlidersHorizontal,
  Wifi,
} from 'lucide-react';
import type { ViewMode } from '../types';

interface SidebarProps {
  view: ViewMode;
  onView: (view: ViewMode) => void;
  deviceCount: number;
  onlineCount: number;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ view, onView, deviceCount, onlineCount, collapsed, onToggle }: SidebarProps) {
  const items: { id: ViewMode; label: string; icon: typeof Map }[] = [
    { id: 'overview', label: 'Обзор сети', icon: LayoutDashboard },
    { id: 'map', label: 'Топология', icon: Map },
    { id: 'devices', label: 'Устройства', icon: List },
    { id: 'events', label: 'События', icon: Bell },
    { id: 'monitors', label: 'Мониторы', icon: Activity },
  ];
  return (
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="brand">
        <img className="brand-logo" src="/logo.png" alt="NetScope" />
        <div className="brand-copy">
          <b>
            net<span>scope</span>
          </b>
          <small>NETWORK OBSERVER</small>
        </div>
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
          title={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <div className="sidebar-section">
        <span className="section-caption">Рабочая область</span>
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${view === id ? 'active' : ''}`}
            onClick={() => onView(id)}
          >
            <Icon size={18} />
            <span className="nav-label">{label}</span>
            {id === 'devices' && deviceCount > 0 && <em>{deviceCount}</em>}
          </button>
        ))}
      </div>
      <div className="sidebar-section">
        <span className="section-caption">Мониторинг</span>
        <button
          className={`nav-item ${view === 'alerts' ? 'active' : ''}`}
          onClick={() => onView('alerts')}
        >
          <Bell size={18} />
          <span className="nav-label">Оповещения</span>
        </button>
      </div>
      <div className="network-health">
        <div className="health-heading">
          <span>
            <Wifi size={15} /> Состояние сети
          </span>
          <span className="live-indicator">LIVE</span>
        </div>
        <strong>{deviceCount ? `${onlineCount} из ${deviceCount}` : 'Нет данных'}</strong>
        <span>устройств в сети</span>
        {deviceCount > 0 && (
          <div className="health-bar">
            <i style={{ width: `${(onlineCount / deviceCount) * 100}%` }} />
          </div>
        )}
      </div>
      <div className="sidebar-bottom">
        <button
          className={`nav-item ${view === 'settings' ? 'active' : ''}`}
          onClick={() => onView('settings')}
        >
          <SlidersHorizontal size={18} />
          <span className="nav-label">Настройки</span>
        </button>
        <button
          className={`nav-item ${view === 'integrations' ? 'active' : ''}`}
          onClick={() => onView('integrations')}
        >
          <Settings2 size={18} />
          <span className="nav-label">Интеграции</span>
          <ChevronRight size={14} className="nav-arrow" />
        </button>
      </div>
    </aside>
  );
}
