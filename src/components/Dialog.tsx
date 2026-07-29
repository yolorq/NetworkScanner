import { Bell, Check, ChevronRight, CircleGauge, Search, Server, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CustomSelect, type SelectOption } from './CustomSelect';
import type { Device, NetworkEvent, ViewMode } from '../types';

function useEscape(onClose: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
}

export function TextDialog({
  title,
  label,
  initialValue = '',
  placeholder,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  useEscape(onClose);
  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="dialog-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <label className="setting-field">
          {label}
          <input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
          />
        </label>
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Отмена
          </button>
          <button
            className="primary-button"
            disabled={!value.trim()}
            type="submit"
          >
            <Check size={15} /> Сохранить
          </button>
        </div>
      </form>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Удалить',
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEscape(onClose);
  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="dialog-card confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <div className="dialog-heading">
          <div>
            <span className="confirm-icon">!</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <p className="confirm-message">{message}</p>
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="danger-button">
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export function SelectDialog({
  title,
  fields,
  onClose,
  onSubmit,
}: {
  title: string;
  fields: { label: string; value: string; options: SelectOption[] }[];
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((field) => [field.label, field.value])),
  );
  useEscape(onClose);
  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="dialog-card"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(values);
        }}
      >
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        {fields.map((field) => (
          <label className="setting-field" key={field.label}>
            {field.label}
            <CustomSelect
              value={values[field.label]}
              options={field.options}
              onChange={(value) => setValues((current) => ({ ...current, [field.label]: value }))}
            />
          </label>
        ))}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="primary-button">
            <Check size={15} /> Продолжить
          </button>
        </div>
      </form>
    </div>
  );
}

export function SearchDialog({
  devices,
  events,
  onClose,
  onSelectDevice,
  onView,
}: {
  devices: Device[];
  events: NetworkEvent[];
  onClose: () => void;
  onSelectDevice: (id: string) => void;
  onView: (view: ViewMode) => void;
}) {
  const [query, setQuery] = useState('');
  useEscape(onClose);
  const normalized = query.trim().toLowerCase();
  const matchingDevices = devices
    .filter((device) =>
      `${device.hostname} ${device.ip} ${device.mac ?? ''} ${device.vendor ?? ''} ${device.os ?? ''}`
        .toLowerCase()
        .includes(normalized),
    )
    .slice(0, 8);
  const matchingEvents = events
    .filter((event) => `${event.title} ${event.detail}`.toLowerCase().includes(normalized))
    .slice(0, 5);
  const sections: { label: string; view: ViewMode; icon: typeof Server }[] = [
    { label: 'Обзор сети', view: 'overview', icon: CircleGauge },
    { label: 'Топология', view: 'map', icon: CircleGauge },
    { label: 'Устройства', view: 'devices', icon: Server },
    { label: 'События', view: 'events', icon: Bell },
  ];
  const hasResults = matchingDevices.length || matchingEvents.length || sections.some((item) => item.label.toLowerCase().includes(normalized));
  return (
    <div className="dialog-overlay search-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="search-dialog" role="dialog" aria-modal="true" aria-label="Поиск по проекту">
        <div className="search-dialog-input">
          <Search size={19} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по проекту..."
          />
          <kbd>ESC</kbd>
        </div>
        <div className="search-results">
          {!normalized ? (
            <div className="search-hint">Ищите устройства, IP-адреса, события и разделы проекта</div>
          ) : !hasResults ? (
            <div className="search-empty">Ничего не найдено</div>
          ) : (
            <>
              {!!matchingDevices.length && (
                <SearchResultGroup title="Устройства">
                  {matchingDevices.map((device) => (
                    <button className="search-result" key={device.id} onClick={() => { onSelectDevice(device.id); onClose(); }}>
                      <span className="search-result-icon"><Server size={16} /></span>
                      <span><strong>{device.hostname || device.ip}</strong><small>{device.ip}{device.vendor ? ` · ${device.vendor}` : ''}</small></span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </SearchResultGroup>
              )}
              {!!matchingEvents.length && (
                <SearchResultGroup title="События">
                  {matchingEvents.map((event) => (
                    <button className="search-result" key={event.id} onClick={() => { onView('events'); onClose(); }}>
                      <span className="search-result-icon"><Bell size={16} /></span>
                      <span><strong>{event.title}</strong><small>{event.detail}</small></span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </SearchResultGroup>
              )}
              {!!sections.filter((item) => item.label.toLowerCase().includes(normalized)).length && (
                <SearchResultGroup title="Разделы">
                  {sections.filter((item) => item.label.toLowerCase().includes(normalized)).map(({ label, view, icon: Icon }) => (
                    <button className="search-result" key={view} onClick={() => { onView(view); onClose(); }}>
                      <span className="search-result-icon"><Icon size={16} /></span>
                      <span><strong>{label}</strong><small>Открыть раздел</small></span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </SearchResultGroup>
              )}
            </>
          )}
        </div>
        <div className="search-dialog-footer"><span>↑↓ Навигация</span><span>↵ Открыть</span><span>ESC Закрыть</span></div>
      </div>
    </div>
  );
}

function SearchResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="search-result-group"><span className="search-group-title">{title}</span>{children}</section>;
}
