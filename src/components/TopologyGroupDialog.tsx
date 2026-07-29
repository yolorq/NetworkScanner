import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { DeviceIcon, typeColors, typeLabels } from './DeviceIcon';
import type { Device, TopologyGroup, TopologyGroupColor } from '../types';

const groupColors: Array<{ value: TopologyGroupColor; label: string }> = [
  { value: 'violet', label: 'Фиолетовый' },
  { value: 'cyan', label: 'Бирюзовый' },
  { value: 'emerald', label: 'Зелёный' },
  { value: 'amber', label: 'Жёлтый' },
  { value: 'rose', label: 'Розовый' },
  { value: 'blue', label: 'Синий' },
];

export function TopologyGroupDialog({
  devices,
  group,
  onClose,
  onSave,
}: {
  devices: Device[];
  group?: TopologyGroup;
  onClose: () => void;
  onSave: (group: Omit<TopologyGroup, 'id' | 'collapsed'>) => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [deviceIds, setDeviceIds] = useState<string[]>(group?.deviceIds ?? []);
  const [color, setColor] = useState<TopologyGroupColor>(group?.color ?? 'violet');
  const toggleDevice = (id: string) =>
    setDeviceIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  return (
    <div className="dialog-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form
        className="dialog-card topology-group-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) onSave({ name: name.trim(), deviceIds, color });
        }}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">ТОПОЛОГИЯ</span>
            <h2>{group ? 'Изменить группу' : 'Новая группа'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <label className="setting-field">
          Название группы
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Например: Серверы" />
        </label>
        <div className="setting-field topology-group-color-field">
          <span>Цвет группы</span>
          <div className="topology-group-colors" role="radiogroup" aria-label="Цвет группы">
            {groupColors.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`topology-group-color-option topology-group-color-${item.value} ${color === item.value ? 'selected' : ''}`}
                aria-label={item.label}
                aria-pressed={color === item.value}
                onClick={() => setColor(item.value)}
              >
                <span />
              </button>
            ))}
          </div>
        </div>
        <div className="topology-group-devices-heading">
          <span>Устройства в группе</span>
          <small>{deviceIds.length} выбрано</small>
        </div>
        <div className="topology-group-devices">
          {devices.length ? devices.map((device) => (
            <label className="topology-group-device" key={device.id}>
              <input type="checkbox" checked={deviceIds.includes(device.id)} onChange={() => toggleDevice(device.id)} />
              <span className={`topology-group-device-icon ${typeColors[device.type]}`}><DeviceIcon type={device.type} size={14} /></span>
              <span><strong>{device.hostname || device.ip}</strong><small>{device.ip} · {typeLabels[device.type]}</small></span>
              <i>{deviceIds.includes(device.id) && <Check size={13} />}</i>
            </label>
          )) : <p className="empty-inline">Сначала добавьте устройства на карту.</p>}
        </div>
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Отмена</button>
          <button type="submit" className="primary-button" disabled={!name.trim()}><Check size={15} /> Сохранить</button>
        </div>
      </form>
    </div>
  );
}
