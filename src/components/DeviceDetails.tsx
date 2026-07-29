import { useState } from 'react';
import {
  X,
  Pencil,
  Copy,
  Clock3,
  Globe2,
  HardDrive,
  Server,
  Tag,
  Check,
  Activity,
  Database,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { DeviceIcon, roleLabels, typeColors, typeLabels } from './DeviceIcon';
import { CustomSelect } from './CustomSelect';
import { ConfirmDialog, TextDialog } from './Dialog';
import type { Device, DeviceType } from '../types';
import { formatDateTime } from '../format';

export function DeviceDetails({
  device,
  onClose,
  onDelete,
  onEdit,
}: {
  device: Device;
  onClose: () => void;
  onDelete?: () => void;
  onEdit: (changes: Partial<Device>) => void;
}) {
  const color = typeColors[device.type];
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const copy = (value: string) => {
    void navigator.clipboard?.writeText(value);
  };
  const rename = () => setRenameOpen(true);
  return (
    <div className="details-layer">
      <button className="details-backdrop" onClick={onClose} aria-label="Закрыть детали" />
      <aside className="details-panel">
      {renameOpen && (
        <TextDialog
          title="Переименовать устройство"
          label="Название"
          initialValue={device.hostname === device.ip ? '' : device.hostname}
          onClose={() => setRenameOpen(false)}
          onSubmit={(value) => {
            onEdit({ hostname: value || device.ip });
            setRenameOpen(false);
          }}
        />
      )}
      {deleteOpen && onDelete && (
        <ConfirmDialog
          title="Удалить устройство?"
          message={`«${device.hostname || device.ip}» будет удалено из списка и с карты.`}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => {
            setDeleteOpen(false);
            onDelete();
          }}
        />
      )}
      <div className="details-top">
        <span>ДЕТАЛИ УСТРОЙСТВА</span>
        <button className="icon-button" onClick={onClose} aria-label="Закрыть">
          <X size={18} />
        </button>
      </div>
      <div className="details-identity">
        <div className={`large-device-icon ${color}`}>
          <DeviceIcon type={device.type} size={30} />
        </div>
        <div>
          <h2>{device.hostname || 'Без имени'}</h2>
          <p>{typeLabels[device.type]}{device.role ? ` · ${roleLabels[device.role] ?? device.role}` : ''}</p>
        </div>
        <span className={`status-pill ${device.status}`}>
          <i />
          {device.status === 'online'
            ? 'В сети'
            : device.status === 'warning'
              ? 'Нет ответа'
              : device.status === 'offline'
                ? 'Недоступно'
                : 'Не проверено'}
        </span>
      </div>
      <div className="details-actions">
        <button onClick={rename}>
          <Pencil size={15} /> Переименовать
        </button>
        <div className="type-editor">
          <DeviceIcon type={device.type} size={14} />
          <CustomSelect
            className="type-select"
            value={device.type}
            options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))}
            onChange={(value) => onEdit({ type: value as DeviceType })}
          />
          <Check size={13} />
        </div>
        {onDelete && (
          <button className="delete-text-button" onClick={() => setDeleteOpen(true)}>
            Удалить
          </button>
        )}
      </div>
      <section className="detail-section">
        <h3>Идентификация</h3>
        <DetailRow
          icon={<Globe2 size={15} />}
          label="IPv4"
          value={device.ip}
          copy={() => copy(device.ip)}
        />
        <DetailRow icon={<Globe2 size={15} />} label="IPv6" value={device.ipv6 ?? 'Не обнаружен'} />
        <DetailRow
          icon={<HardDrive size={15} />}
          label="MAC-адрес"
          value={device.mac ?? 'Не обнаружен'}
          copy={device.mac ? () => copy(device.mac as string) : undefined}
        />
        <DetailRow
          icon={<Tag size={15} />}
          label="Производитель"
          value={device.vendor ?? 'Не определён'}
        />
      </section>
      <section className="detail-section">
        <h3>Обнаружение и уверенность</h3>
        <DetailRow
          icon={<ShieldCheck size={15} />}
          label="Уверенность типа"
          value={`${device.confidence ?? 0}%`}
        />
        <DetailRow
          icon={<Tag size={15} />}
          label="Роль"
          value={device.role ? roleLabels[device.role] ?? device.role : 'Не определена'}
        />
        <DetailRow
          icon={<Activity size={15} />}
          label="Сервисов"
          value={String(device.servicesCount ?? device.ports.length)}
        />
        <DetailRow
          icon={<Clock3 size={15} />}
          label="Первое обнаружение"
          value={formatDate(device.firstSeen ?? device.lastSeen)}
        />
        <DetailRow
          icon={<Clock3 size={15} />}
          label="Обнаружений"
          value={String(device.discoveryCount ?? 1)}
        />
      </section>
      <section className="detail-section">
        <h3>Имена и протоколы</h3>
        <DetailRow
          icon={<Database size={15} />}
          label="DNS"
          value={device.dnsName ?? 'Не обнаружен'}
        />
        <DetailRow
          icon={<Radio size={15} />}
          label="mDNS / UPnP"
          value={device.mdnsName ?? device.upnpName ?? 'Не обнаружен'}
        />
        <DetailRow
          icon={<Server size={15} />}
          label="SNMP SysName"
          value={device.snmpSysName ?? 'Не обнаружен'}
        />
        <DetailRow
          icon={<Activity size={15} />}
          label="TTL"
          value={device.ttl == null ? 'Не обнаружен' : String(device.ttl)}
        />
      </section>
      <section className="detail-section">
        <h3>Система</h3>
        <DetailRow
          icon={<Server size={15} />}
          label="ОС / прошивка"
          value={formatOs(device.os)}
        />
        <DetailRow
          icon={<Clock3 size={15} />}
          label="Последний ответ"
          value={formatDate(device.lastSeen)}
        />
        <DetailRow
          icon={<Activity size={15} />}
          label="Задержка"
          value={device.latency === null ? 'Нет ответа' : `${device.latency} мс`}
        />
      </section>
      <section className="detail-section">
        <h3>
          Открытые порты <span>{device.ports.length}</span>
        </h3>
        <div className="port-list">
          {device.ports.length ? (
            device.ports.map((port) => <code key={port}>{port}</code>)
          ) : (
            <span className="empty-inline">Открытые порты не обнаружены</span>
          )}
        </div>
      </section>
      <section className="detail-section">
        <h3>Комментарий</h3>
        <textarea
          defaultValue={device.note ?? ''}
          placeholder="Добавьте заметку о хосте..."
          onBlur={(event) => onEdit({ note: event.target.value })}
        />
      </section>
      </aside>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  copy,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  copy?: () => void;
}) {
  return (
    <div className="detail-row">
      <span className="detail-label">
        {icon}
        {label}
      </span>
      <span className="detail-value">
        {value}
        {copy && (
          <button className="copy-button" onClick={copy} aria-label="Копировать">
            <Copy size={13} />
          </button>
        )}
      </span>
    </div>
  );
}
function formatDate(value: string) {
  return formatDateTime(value);
}

function formatOs(value: string | null) {
  if (!value) return 'Не определена';
  return (
    {
      windows: 'Windows',
      'windows-10': 'Windows 10',
      'windows-11': 'Windows 11',
      'windows-server': 'Windows Server',
      linux: 'Linux',
      routeros: 'RouterOS',
      openwrt: 'OpenWrt',
      proxmox: 'Proxmox',
      esxi: 'VMware ESXi',
      synology: 'Synology DSM',
      qnap: 'QNAP QTS',
      truenas: 'TrueNAS',
    } as Record<string, string>
  )[value] ?? value;
}
