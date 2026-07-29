import { invoke } from '@tauri-apps/api/core';
import type {
  Device,
  InterfaceInfo,
  MapViewState,
  NetworkEdge,
  NewDeviceInput,
  ScanConfig,
  ScanResult,
} from './types';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const tauriAvailable = isTauri;

async function invokeLogged<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const started = performance.now();
  try {
    const result = await invoke<T>(command, args);
    console.info(`[Tauri] ${command} completed in ${(performance.now() - started).toFixed(0)}ms`);
    return result;
  } catch (error) {
    console.error(`[Tauri] ${command} failed after ${(performance.now() - started).toFixed(0)}ms`, { args, error });
    throw error;
  }
}

export async function getInterfaces(): Promise<InterfaceInfo[]> {
  if (!isTauri) return [];
  return invokeLogged<InterfaceInfo[]>('get_network_interfaces');
}

export async function loadDevices(): Promise<Device[]> {
  if (!isTauri) return [];
  return invokeLogged<Device[]>('list_devices');
}

export async function loadEvents() {
  if (!isTauri) return [];
  return invokeLogged<import('./types').NetworkEvent[]>('list_events');
}

export async function loadEdges(): Promise<NetworkEdge[]> {
  if (!isTauri) return [];
  return invokeLogged<NetworkEdge[]>('list_edges');
}

export async function loadMapView(): Promise<MapViewState> {
  if (!isTauri) return { x: 0, y: 0, zoom: 1 };
  return invokeLogged<MapViewState>('get_map_view');
}

export async function saveMapView(view: MapViewState): Promise<void> {
  if (isTauri) await invokeLogged('save_map_view', { view });
}

export async function addDevice(input: NewDeviceInput): Promise<Device> {
  if (!isTauri) throw new Error('Добавление устройств доступно в приложении Tauri.');
  return invokeLogged<Device>('add_device', { input });
}

export async function saveEdge(edge: NetworkEdge): Promise<NetworkEdge> {
  if (!isTauri) throw new Error('Редактирование карты доступно в приложении Tauri.');
  return invokeLogged<NetworkEdge>('save_edge', { edge });
}

export async function deleteEdge(id: string): Promise<void> {
  if (isTauri) await invokeLogged('delete_edge', { id });
}

export async function deleteDevice(id: string): Promise<void> {
  if (isTauri) await invokeLogged('delete_device', { id });
}

export async function deleteDevices(ids: string[]): Promise<void> {
  if (isTauri) await invokeLogged('delete_devices', { ids });
}

export async function scanSubnet(config: ScanConfig): Promise<ScanResult> {
  if (!isTauri)
    throw new Error('Приложение должно быть запущено через Tauri для сканирования сети.');
  return invokeLogged<ScanResult>('scan_subnet', { config });
}

export async function stopScan(): Promise<void> {
  if (isTauri) await invokeLogged('stop_scan');
}

export async function updateDevice(id: string, changes: Partial<Device>): Promise<Device> {
  if (!isTauri) throw new Error('Редактирование доступно в приложении Tauri.');
  return invokeLogged<Device>('update_device', { id, changes });
}
