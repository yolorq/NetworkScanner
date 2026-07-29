export type DeviceStatus = 'online' | 'offline' | 'warning' | 'unknown';
export type DeviceType =
  | 'router'
  | 'server'
  | 'workstation'
  | 'printer'
  | 'switch'
  | 'camera'
  | 'nas'
  | 'virtual'
  | 'firewall'
  | 'accessPoint'
  | 'phone'
  | 'ups'
  | 'iot'
  | 'unknown';
export type ViewMode =
  'overview' | 'map' | 'devices' | 'events' | 'monitors' | 'alerts' | 'settings' | 'integrations';

export interface Device {
  id: string;
  hostname: string;
  ip: string;
  ipv6: string | null;
  mac: string | null;
  vendor: string | null;
  os: string | null;
  type: DeviceType;
  role?: string | null;
  status: DeviceStatus;
  latency: number | null;
  lastSeen: string;
  subnet: string;
  ports: number[];
  udpPorts?: number[];
  dnsName?: string | null;
  netbiosName?: string | null;
  mdnsName?: string | null;
  upnpName?: string | null;
  dhcpHostname?: string | null;
  snmpSysName?: string | null;
  snmpDescription?: string | null;
  ttl?: number | null;
  osFingerprint?: string | null;
  banners?: Record<string, string>;
  firstSeen?: string;
  lastDiscovered?: string;
  discoveryCount?: number;
  confidence?: number;
  matchedFeatures?: string[];
  alternativeTypes?: string[];
  negativeFeatures?: Array<{ label?: string; effectiveWeight?: number; source?: string; ruleId?: string }>;
  roles?: Array<{ target?: string; score?: number; confidence?: number }>;
  hierarchy?: string[];
  osConfidence?: number;
  servicesCount?: number;
  connectionCount?: number;
  position: { x: number; y: number };
  note?: string | null;
  manual?: boolean;
}

export interface NetworkEvent {
  id: string;
  title: string;
  detail: string;
  time: string;
  kind: 'online' | 'offline' | 'scan' | 'warning';
}

export interface InterfaceInfo {
  name: string;
  address: string;
  cidr: string;
  kind: 'ethernet' | 'wifi' | 'vpn' | 'other';
  active: boolean;
}

export interface ScanConfig {
  subnet: string;
  interfaceName: string;
  timeout: number;
  threads: number;
}

export interface ScanResult {
  devices: Device[];
  scanned: number;
  elapsedMs: number;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  label?: string | null;
  manual?: boolean;
  confidence?: number;
  evidence?: string[];
  active?: boolean;
}

export interface MapViewState {
  x: number;
  y: number;
  zoom: number;
}

export interface NewDeviceInput {
  hostname: string;
  ip: string;
  type: DeviceType;
  position: { x: number; y: number };
  note?: string;
}

export interface TopologyGroup {
  id: string;
  name: string;
  deviceIds: string[];
  collapsed: boolean;
  color?: TopologyGroupColor;
  position?: { x: number; y: number };
}

export type TopologyGroupColor = 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'blue';
