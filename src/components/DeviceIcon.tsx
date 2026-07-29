import {
  Camera,
  CircleHelp,
  Database,
  HardDrive,
  Laptop,
  Monitor,
  Network,
  Printer,
  Router,
  Server,
  Shield,
  Smartphone,
  Box,
  Radio,
  Battery,
  Cpu,
} from 'lucide-react';
import type { DeviceType } from '../types';

const icons: Record<DeviceType, typeof Monitor> = {
  router: Router,
  server: Server,
  workstation: Monitor,
  printer: Printer,
  switch: Network,
  camera: Camera,
  nas: Database,
  virtual: Box,
  firewall: Shield,
  accessPoint: Radio,
  phone: Smartphone,
  ups: Battery,
  iot: Cpu,
  unknown: CircleHelp,
};

export function DeviceIcon({ type, size = 20 }: { type: DeviceType; size?: number }) {
  const Icon = icons[type] ?? HardDrive;
  return <Icon size={size} strokeWidth={1.8} />;
}

export const typeLabels: Record<DeviceType, string> = {
  router: 'Маршрутизатор',
  server: 'Сервер',
  workstation: 'Рабочая станция',
  printer: 'Принтер',
  switch: 'Коммутатор',
  camera: 'Камера',
  nas: 'NAS',
  virtual: 'Виртуальная машина',
  firewall: 'Межсетевой экран',
  accessPoint: 'Точка доступа',
  phone: 'Телефон',
  ups: 'ИБП',
  iot: 'IoT-устройство',
  unknown: 'Неизвестное устройство',
};

export const roleLabels: Record<string, string> = {
  router: 'Маршрутизатор',
  switch: 'Коммутатор',
  nas: 'NAS / хранилище',
  hypervisor: 'Гипервизор',
  dns: 'DNS-сервер',
  dhcp: 'DHCP-сервер',
  firewall: 'Межсетевой экран',
  accessPoint: 'Точка доступа',
  printer: 'Принтер',
  camera: 'Камера',
};

export const typeColors: Record<DeviceType, string> = {
  router: 'cyan',
  server: 'teal',
  workstation: 'blue',
  printer: 'amber',
  switch: 'emerald',
  camera: 'rose',
  nas: 'indigo',
  virtual: 'orange',
  firewall: 'red',
  accessPoint: 'teal',
  phone: 'pink',
  ups: 'yellow',
  iot: 'lime',
  unknown: 'slate',
};
