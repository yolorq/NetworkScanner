import { Boxes } from 'lucide-react';
import type { NodeProps } from '@xyflow/react';
import type { TopologyGroup } from '../types';

interface TopologyGroupNodeData {
  [key: string]: unknown;
  group: TopologyGroup;
}

export function TopologyGroupNode({ data }: NodeProps) {
  const { group, devices = [] } = data as unknown as TopologyGroupNodeData & {
    devices?: Array<{ id: string; hostname: string; ip: string }>;
  };
  if (!group || typeof group.name !== 'string') return null;
  const color = group.color ?? 'violet';
  return (
    <div className={`topology-group-node topology-group-color-${color}`}>
      <div className="topology-group-node-heading">
        <div className="topology-group-node-copy">
          <strong>{group.name}</strong>
          <small>{Array.isArray(group.deviceIds) ? group.deviceIds.length : 0} устройств</small>
        </div>
        <span className="topology-group-node-icon">
          <Boxes size={14} />
        </span>
      </div>
    </div>
  );
}
