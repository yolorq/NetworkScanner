import { Handle, Position, type NodeProps } from '@xyflow/react';
import { DeviceIcon, typeColors, typeLabels } from './DeviceIcon';
import type { Device } from '../types';

interface DeviceNodeData {
  [key: string]: unknown;
  device: Device;
  groupName?: string;
  isConnected?: boolean;
}

export function DeviceNode({ data, selected }: NodeProps) {
  const { device, groupName, isConnected } = data as unknown as DeviceNodeData;
  const color = typeColors[device.type];
  return (
    <div
      className={`device-node device-node-${color} status-node-${device.status} ${selected ? 'is-selected' : ''} ${isConnected ? 'is-connected' : ''}`}
      title={`${device.hostname || device.ip} · ${device.ip}`}
    >
      <Handle type="target" position={Position.Top} className="node-handle node-target" />
      <div className="node-copy">
        <strong>{device.hostname || device.ip}</strong>
        <span>{device.ip}</span>
        <small>{typeLabels[device.type]}</small>
      </div>
      <div className="node-icon">
        <DeviceIcon type={device.type} size={22} />
      </div>
      <span className={`status-dot status-${device.status}`} />
      {groupName && (
        <span className="node-group-label" title={`Группа: ${groupName}`}>
          {groupName}
        </span>
      )}
      <div className="device-node-tooltip" role="tooltip">
        <strong>{device.hostname || device.ip}</strong>
        <span>
          <b>IP:</b> {device.ip}
        </span>
        <span>
          <b>MAC:</b> {device.mac || '—'}
        </span>
        <span>
          <b>Производитель:</b> {device.vendor || '—'}
        </span>
        <span>
          <b>ОС:</b> {device.os || '—'}
        </span>
        <span>
          <b>Группа:</b> {groupName || '—'}
        </span>
        <span>
          <b>Посл��дний ответ:</b> {device.lastSeen || '—'}
        </span>
        <span>
          <b>Uptime:</b> {(device as Device & { uptime?: string | number | null }).uptime || '—'}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="node-handle node-source" />
    </div>
  );
}
