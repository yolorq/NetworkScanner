import { Handle, Position, type NodeProps } from '@xyflow/react';
import { DeviceIcon, typeColors, typeLabels } from './DeviceIcon';
import type { Device } from '../types';
import { formatDateTime } from '../format';

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
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className="node-handle node-point node-point-top"
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className="node-handle node-point node-point-left"
      />
      <div className="node-copy">
        <strong>{device.hostname || device.ip}</strong>
        <span>{device.ip}</span>
        <small>{typeLabels[device.type]}</small>
      </div>
      <div className="node-icon">
        <DeviceIcon type={device.type} size={22} />
      </div>
      <span className={`status-dot status-${device.status}`} />
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
          <b>Последний ответ:</b> {formatDateTime(device.lastSeen)}
        </span>
        <span>
          <b>Uptime:</b> {(device as Device & { uptime?: string | number | null }).uptime || '—'}
        </span>
      </div>
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="node-handle node-point node-point-right"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="node-handle node-point node-point-bottom"
      />
    </div>
  );
}
