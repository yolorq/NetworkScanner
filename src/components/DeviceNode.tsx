import { Handle, Position, type NodeProps } from '@xyflow/react';
import { DeviceIcon, typeColors, typeLabels } from './DeviceIcon';
import type { Device } from '../types';

interface DeviceNodeData {
  [key: string]: unknown;
  device: Device;
}

export function DeviceNode({ data, selected }: NodeProps) {
  const device = (data as unknown as DeviceNodeData).device;
  const color = typeColors[device.type];
  return (
    <div className={`device-node device-node-${color} ${selected ? 'is-selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Left}
        className="node-handle node-target"
        style={{ left: -8, top: '50%', right: 'auto', bottom: 'auto', transform: 'translateY(-50%)' }}
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
      <Handle
        type="source"
        position={Position.Right}
        className="node-handle node-source"
        style={{ right: -8, top: '50%', left: 'auto', bottom: 'auto', transform: 'translateY(-50%)' }}
      />
    </div>
  );
}
