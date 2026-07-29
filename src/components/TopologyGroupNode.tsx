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
  return (
    <div className="topology-group-node">
      <div className="topology-group-node-heading">
        <span className="topology-group-node-icon">
          <Boxes size={14} />
        </span>
        <strong>{group.name}</strong>
        <small>{group.deviceIds.length}</small>
      </div>
      <div className="topology-group-node-caption">ГРУППА УСТРОЙСТВ</div>
      <div className="topology-group-node-hint">
        {group.collapsed ? 'Группа свернута' : 'Устройства в этой области'}
      </div>
    </div>
  );
}
