import { create } from 'zustand';
import {
  addDevice as persistNewDevice,
  deleteDevice as persistDeleteDevice,
  deleteDevices as persistDeleteDevices,
  deleteEdge as persistDeleteEdge,
  getInterfaces,
  loadDevices,
  loadEdges,
  loadEvents,
  loadMapView,
  saveEdge as persistEdge,
  saveMapView,
  scanSubnet,
  stopScan,
  tauriAvailable,
  updateDevice as persistDevice,
} from './api';
import type {
  Device,
  InterfaceInfo,
  MapViewState,
  NetworkEdge,
  NetworkEvent,
  NewDeviceInput,
  ScanConfig,
  ViewMode,
} from './types';

interface AppState {
  devices: Device[];
  events: NetworkEvent[];
  edges: NetworkEdge[];
  mapView: MapViewState;
  interfaces: InterfaceInfo[];
  selectedDeviceId: string | null;
  view: ViewMode;
  scan: ScanConfig;
  isScanning: boolean;
  scanMessage: string | null;
  error: string | null;
  search: string;
  load: () => Promise<void>;
  setView: (view: ViewMode) => void;
  selectDevice: (id: string | null) => void;
  setSearch: (value: string) => void;
  updateDevice: (id: string, changes: Partial<Device>) => Promise<void>;
  addDevice: (input: NewDeviceInput) => Promise<Device | null>;
  deleteDevice: (id: string) => Promise<boolean>;
  deleteDevices: (ids: string[]) => Promise<boolean>;
  saveEdge: (edge: NetworkEdge) => Promise<void>;
  deleteEdge: (id: string) => Promise<void>;
  saveMapView: (view: MapViewState) => Promise<void>;
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  setScanConfig: (config: Partial<ScanConfig>) => void;
}

function readScanSettings(): Partial<ScanConfig> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const saved = JSON.parse(localStorage.getItem('netscope-scan-settings') ?? '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

const defaultScan: ScanConfig = {
  subnet: '',
  interfaceName: '',
  timeout: 600,
  threads: 128,
  ...readScanSettings(),
};

export const useAppStore = create<AppState>((set, get) => ({
  devices: [],
  events: [],
  edges: [],
  mapView: { x: 0, y: 0, zoom: 1 },
  interfaces: [],
  selectedDeviceId: null,
  view: 'overview',
  scan: defaultScan,
  isScanning: false,
  scanMessage: null,
  error: null,
  search: '',
  load: async () => {
    try {
      const [networkInterfaces, devices, events, edges, mapView] = await Promise.all([
        getInterfaces(),
        loadDevices(),
        loadEvents(),
        loadEdges(),
        loadMapView(),
      ]);
      const first = networkInterfaces.find((item) => item.active) ?? networkInterfaces[0];
      // A scan creates fresh device ids. Rebind saved lines by IP where possible
      // so links do not multiply after the next scan.
      const currentDevices = get().devices;
      const oldIdToIp = new Map(currentDevices.map((device) => [device.id, device.ip]));
      const newIpToId = new Map(devices.map((device) => [device.ip, device.id]));
      const normalizedEdges = edges
        .map((edge) => ({
          ...edge,
          source:
            devices.find((device) => device.id === edge.source)?.id ??
            newIpToId.get(oldIdToIp.get(edge.source) ?? '') ??
            edge.source,
          target:
            devices.find((device) => device.id === edge.target)?.id ??
            newIpToId.get(oldIdToIp.get(edge.target) ?? '') ??
            edge.target,
        }))
        .filter(
          (edge, index, all) =>
            all.findIndex(
              (item) =>
                [item.source, item.target].sort().join('::') ===
                [edge.source, edge.target].sort().join('::'),
            ) === index,
        );
      set({
        interfaces: networkInterfaces,
        devices,
        events,
        edges: normalizedEdges,
        mapView,
        scan: {
          ...get().scan,
          subnet: get().scan.subnet || first?.cidr || '',
          interfaceName: get().scan.interfaceName || first?.name || '',
        },
        error: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Не удалось загрузить данные приложения.',
      });
    }
  },
  setView: (view) => set({ view }),
  selectDevice: (selectedDeviceId) => set({ selectedDeviceId }),
  setSearch: (search) => set({ search }),
  updateDevice: async (id, changes) => {
    try {
      const device = await persistDevice(id, changes);
      set((state) => ({ devices: state.devices.map((item) => (item.id === id ? device : item)) }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось сохранить устройство.' });
    }
  },
  addDevice: async (input) => {
    try {
      const device = await persistNewDevice(input);
      set((state) => ({ devices: [...state.devices, device] }));
      return device;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось добавить устройство.' });
      return null;
    }
  },
  deleteDevice: async (id) => {
    try {
      await persistDeleteDevice(id);
      set((state) => ({
        devices: state.devices.filter((device) => device.id !== id),
        edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
        selectedDeviceId: state.selectedDeviceId === id ? null : state.selectedDeviceId,
      }));
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось удалить устройство.' });
      return false;
    }
  },
  deleteDevices: async (ids) => {
    if (!ids.length) return true;
    try {
      await persistDeleteDevices(ids);
      set((state) => ({
        devices: state.devices.filter((device) => !ids.includes(device.id)),
        edges: state.edges.filter(
          (edge) => !ids.includes(edge.source) && !ids.includes(edge.target),
        ),
        selectedDeviceId:
          state.selectedDeviceId && ids.includes(state.selectedDeviceId)
            ? null
            : state.selectedDeviceId,
      }));
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Не удалось удалить выбранные устройства.',
      });
      return false;
    }
  },
  saveEdge: async (edge) => {
    try {
      const saved = await persistEdge(edge);
      set((state) => ({ edges: [...state.edges.filter((item) => item.id !== saved.id), saved] }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось сохранить связь.' });
    }
  },
  deleteEdge: async (id) => {
    try {
      await persistDeleteEdge(id);
      set((state) => ({ edges: state.edges.filter((edge) => edge.id !== id) }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось удалить связь.' });
    }
  },
  saveMapView: async (mapView) => {
    set({ mapView });
    try {
      await saveMapView(mapView);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось сохранить вид карты.' });
    }
  },
  setScanConfig: (config) =>
    set((state) => {
      const scan = { ...state.scan, ...config };
      if (typeof localStorage !== 'undefined')
        localStorage.setItem('netscope-scan-settings', JSON.stringify(scan));
      return { scan };
    }),
  startScan: async () => {
    const config = get().scan;
    if (!config.subnet) {
      set({ error: 'Укажите подсеть или выберите сетевой интерфейс.' });
      return;
    }
    set({ isScanning: true, error: null, scanMessage: `Сканирование ${config.subnet}...` });
    try {
      const result = await scanSubnet(config);
      console.info(`[scan] backend returned ${result.devices.length} device(s), scanned=${result.scanned}`);
      const [devices, events, edges] = await Promise.all([
        loadDevices(),
        loadEvents(),
        loadEdges(),
      ]);
      set({
        devices,
        edges,
        events,
        isScanning: false,
        scanMessage: `Проверено ${result.scanned} адресов за ${(result.elapsedMs / 1000).toFixed(1)} с`,
      });
    } catch (error) {
      console.error('[scan] failed', error);
      set({
        isScanning: false,
        error: error instanceof Error ? error.message : 'Сканирование завершилось с ошибкой.',
        scanMessage: null,
      });
    }
  },
  stopScan: async () => {
    try {
      await stopScan();
      set({ isScanning: false, scanMessage: 'Сканирование остановлено.' });
    } catch (error) {
      console.error('[scan] stop failed', error);
      set({ error: error instanceof Error ? error.message : 'Не удалось остановить сканирование.' });
    }
  },
}));

export { tauriAvailable };
