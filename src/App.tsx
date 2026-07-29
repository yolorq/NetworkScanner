import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDownUp,
  Bell,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleGauge,
  Clock3,
  Download,
  Filter,
  Gauge,
  LoaderCircle,
  Map as MapIcon,
  MoreHorizontal,
  Maximize,
  Minus,
  Network,
  Play,
  PlugZap,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Server,
  Settings2,
  Square,
  Trash2,
  Upload,
  Wifi,
  X,
  Link2,
} from 'lucide-react';
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppStore } from './store';
import { DeviceDetails } from './components/DeviceDetails';
import { CustomSelect } from './components/CustomSelect';
import { ConfirmDialog, SearchDialog, SelectDialog, TextDialog } from './components/Dialog';
import { DeviceIcon, typeColors, typeLabels } from './components/DeviceIcon';
import { DeviceNode } from './components/DeviceNode';
import { Sidebar } from './components/Sidebar';
import { StatCard } from './components/StatCard';
import { TopologyGroupDialog } from './components/TopologyGroupDialog';
import { TopologyGroupNode } from './components/TopologyGroupNode';
import type {
  Device,
  DeviceStatus,
  DeviceType,
  MapViewState,
  NetworkEdge,
  NewDeviceInput,
  ViewMode,
  TopologyGroup,
} from './types';

const nodeTypes = { device: DeviceNode, topologyGroup: TopologyGroupNode };

export default function App() {
  const {
    devices,
    events,
    edges,
    interfaces,
    mapView,
    selectedDeviceId,
    view,
    scan,
    isScanning,
    scanMessage,
    error,
    search,
    load,
    setView,
    selectDevice,
    setSearch,
    updateDevice,
    addDevice,
    deleteDevice,
    deleteDevices,
    saveEdge,
    deleteEdge,
    saveMapView,
    startScan,
    stopScan,
    setScanConfig,
  } = useAppStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('netscope-sidebar-collapsed') === 'true';
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<DeviceType | 'all'>(() => {
    if (typeof localStorage === 'undefined') return 'all';
    const saved = localStorage.getItem('netscope-device-filter');
    return saved === 'all' || (saved && Object.hasOwn(typeLabels, saved))
      ? (saved as DeviceType | 'all')
      : 'all';
  });
  const [showScanner, setShowScanner] = useState(false);
  const [dialog, setDialog] = useState<React.ReactNode>(null);
  const selected = devices.find((device) => device.id === selectedDeviceId) ?? null;
  const online = devices.filter((device) => device.status === 'online').length;
  const visibleDevices = useMemo(
    () =>
      devices
        .filter((device) => filter === 'all' || device.type === filter)
        .filter((device) =>
          `${device.hostname} ${device.ip} ${device.mac ?? ''} ${device.vendor ?? ''} ${typeLabels[device.type]}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        ),
    [devices, filter, search],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem('netscope-sidebar-collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        onView={setView}
        deviceCount={devices.length}
        onlineCount={online}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Сеть</span>
            <span>/</span>
            <strong>
              {view === 'overview'
                ? 'Обзор сети'
                : view === 'map'
                  ? 'Топология'
                  : view === 'devices'
                    ? 'Устройства'
                    : view === 'events'
                      ? 'События'
                      : view === 'monitors'
                        ? 'Мониторы'
                        : view === 'alerts'
                          ? 'Оповещения'
                          : view === 'settings'
                            ? 'Настройки'
                            : 'Интеграции'}
            </strong>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск устройств..."
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') setSearchOpen(true);
                }}
              />
              <kbd>CTRL K</kbd>
            </div>
            <button className="top-icon" aria-label="Обновить" onClick={() => void load()}>
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        {error && (
          <div className="error-banner">
            <AlertCircle size={17} />
            <span>{error}</span>
            <button onClick={() => useAppStore.setState({ error: null })}>
              <X size={15} />
            </button>
          </div>
        )}
        <div className={`page-content ${view === 'map' ? 'page-content-map' : ''}`}>
          {view === 'overview' && (
            <Overview
              devices={devices}
              events={events}
              onView={setView}
              onScan={() => setShowScanner(true)}
            />
          )}
          {view === 'map' && (
            <MapView
              devices={visibleDevices}
              edges={edges}
              mapView={mapView}
              onSelect={selectDevice}
              onPosition={updateDevice}
              onDeleteDevice={deleteDevice}
              onAddDevice={addDevice}
              onSaveEdge={saveEdge}
              onDeleteEdge={deleteEdge}
              onSaveMapView={saveMapView}
            />
          )}
          {view === 'devices' && (
            <DevicesView
              devices={visibleDevices}
              filter={filter}
              onSelect={selectDevice}
              onDelete={deleteDevice}
              onDeleteMany={deleteDevices}
              onFilterChange={(value) => {
                setFilter(value);
                localStorage.setItem('netscope-device-filter', value);
              }}
            />
          )}
          {view === 'events' && <EventsView events={events} />}
          {view === 'monitors' && <MonitorsView devices={devices} />}
          {view === 'alerts' && <AlertsView />}
          {view === 'settings' && <SettingsView scan={scan} onConfig={setScanConfig} />}
          {view === 'integrations' && <IntegrationsView />}
        </div>
      </main>
      {selected && (
        <DeviceDetails
          device={selected}
          onClose={() => selectDevice(null)}
          onDelete={async () => {
            if (await deleteDevice(selected.id)) selectDevice(null);
          }}
          onEdit={(changes) => void updateDevice(selected.id, changes)}
        />
      )}
      {showScanner && (
        <ScannerPanel
          scan={scan}
          interfaces={interfaces}
          isScanning={isScanning}
          scanMessage={scanMessage}
          onClose={() => setShowScanner(false)}
          onConfig={setScanConfig}
          onStart={() => void startScan()}
          onStop={() => void stopScan()}
        />
      )}
      {dialog}
      {searchOpen && (
        <SearchDialog
          devices={devices}
          events={events}
          onClose={() => setSearchOpen(false)}
          onSelectDevice={(id) => {
            setView('devices');
            selectDevice(id);
          }}
          onView={setView}
        />
      )}
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      {action}
    </div>
  );
}

function Overview({
  devices,
  events,
  onView,
  onScan,
}: {
  devices: Device[];
  events: import('./types').NetworkEvent[];
  onView: (view: ViewMode) => void;
  onScan: () => void;
}) {
  const online = devices.filter((device) => device.status === 'online').length;
  const avg =
    devices
      .filter((device) => device.latency !== null)
      .reduce((sum, device) => sum + (device.latency ?? 0), 0) /
    Math.max(1, devices.filter((device) => device.latency !== null).length);
  const groups = Object.entries(
    devices.reduce<Record<string, number>>((acc, device) => {
      acc[device.type] = (acc[device.type] ?? 0) + 1;
      return acc;
    }, {}),
  );
  return (
    <>
      <PageTitle
        eyebrow="СИСТЕМА НАБЛЮДЕНИЯ"
        title="Обзор сети"
        detail={
          devices.length
            ? `Последнее обнаружение · ${devices.length} устройств в локальной сети`
            : 'Сканирование ещё не выполнялось'
        }
        action={
          <button className="primary-button" onClick={onScan}>
            <Radar size={16} /> Новое сканирование
          </button>
        }
      />
      <div className="stat-grid">
        <StatCard
          label="Всего устройств"
          value={devices.length}
          meta={devices.length ? 'обнаружено в сети' : 'данные отсутствуют'}
          icon={<Boxes size={19} />}
          tone="violet"
        />
        <StatCard
          label="В сети"
          value={online}
          meta={
            devices.length
              ? `${Math.round((online / devices.length) * 100)}% доступно`
              : 'ожидание сканирования'
          }
          icon={<CheckCircle2 size={19} />}
          tone="green"
        />
        <StatCard
          label="Не в сети"
          value={devices.filter((device) => device.status === 'offline').length}
          meta="за текущий период"
          icon={<Wifi size={19} />}
          tone="red"
        />
        <StatCard
          label="Средний ping"
          value={devices.length ? `${Math.round(avg)} мс` : '—'}
          meta="по доступным хостам"
          icon={<Gauge size={19} />}
          tone="amber"
        />
      </div>
      <div className="overview-grid">
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">АКТИВНОСТЬ</span>
              <h2>События сети</h2>
            </div>
            <button className="text-button" onClick={() => onView('events')}>
              Все события <ArrowDownUp size={14} />
            </button>
          </div>
          {events.length ? (
            events.slice(0, 5).map((event) => <EventRow key={event.id} event={event} />)
          ) : (
            <EmptyState
              icon={<Clock3 size={22} />}
              title="Событий пока нет"
              detail="Запустите сканирование, чтобы получить первые данные."
            />
          )}
        </section>
        <section className="panel distribution-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">РАСПРЕДЕЛЕНИЕ</span>
              <h2>Типы устройств</h2>
            </div>
            <button className="text-button" onClick={() => onView('devices')}>
              Список <ArrowDownUp size={14} />
            </button>
          </div>
          {groups.length ? (
            <div className="type-distribution">
              {groups.map(([type, count]) => (
                <div className="type-row" key={type}>
                  <span className={`type-square ${typeColors[type as DeviceType]}`}>
                    <DeviceIcon type={type as DeviceType} size={15} />
                  </span>
                  <span>{typeLabels[type as DeviceType]}</span>
                  <strong>{count}</strong>
                  <i>
                    <b style={{ width: `${(count / devices.length) * 100}%` }} />
                  </i>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CircleGauge size={22} />}
              title="Нет распределения"
              detail="Типы появятся после обнаружения устройств."
            />
          )}
        </section>
      </div>
      <section className="panel quick-panel">
        <div className="quick-copy">
          <div className="quick-icon">
            <Radar size={21} />
          </div>
          <div>
            <h2>Сканирование локальной сети</h2>
            <p>Проверьте подсеть и обновите карту топологии актуальными данными.</p>
          </div>
        </div>
        <button className="secondary-button" onClick={onScan}>
          Открыть сканер <ChevronDown size={15} />
        </button>
      </section>
    </>
  );
}

function MapView({
  devices, edges, mapView, onSelect, onPosition, onDeleteDevice, onAddDevice, onSaveEdge, onDeleteEdge, onSaveMapView,
}: {
  devices: Device[]; edges: NetworkEdge[]; mapView: MapViewState; onSelect: (id: string) => void;
  onPosition: (id: string, changes: Partial<Device>) => Promise<void>; onDeleteDevice: (id: string) => Promise<boolean>;
  onAddDevice: (input: NewDeviceInput) => Promise<Device | null>; onSaveEdge: (edge: NetworkEdge) => Promise<void>;
  onDeleteEdge: (id: string) => Promise<void>; onSaveMapView: (view: MapViewState) => Promise<void>;
}) {
  type FlowData = { [key: string]: unknown; device?: Device; group?: TopologyGroup };
  type FlowNode = Node<FlowData> & { type: 'device' | 'topologyGroup' };
  const makeNodes = (items: Device[]): FlowNode[] => items.map((device, index) => ({ id: device.id, type: 'device', position: device.position ?? { x: (index % 4) * 260 + 80, y: Math.floor(index / 4) * 160 + 80 }, data: { device } }));
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(makeNodes(devices));
  const edgeKey = (source: string, target: string) => [source, target].sort().join('::');
  const toFlowEdges = (items: NetworkEdge[]): Edge[] => { const seen = new Set<string>(); return items.filter((edge) => { const key=edgeKey(edge.source,edge.target); if(seen.has(key)) return false; seen.add(key); return true; }).map((edge) => ({ id:edge.id, source:edge.source, target:edge.target, className:edge.active===false?'map-edge-inactive':'map-edge-active', style:edge.active===false?{stroke:'#8793a7',strokeWidth:2,strokeDasharray:'7 6'}:{stroke:'#65748a',strokeWidth:2}, selectable:true, type:'smoothstep' })); };
  const [lineMode,setLineMode]=useState<'all'|'active'|'hidden'>('all');
  const visibleEdges=useMemo(()=>edges.filter((edge)=>lineMode!=='hidden'&&(lineMode==='all'||(edge.active??true))),[edges,lineMode]);
  const [flowEdges,setFlowEdges]=useEdgesState<Edge>(toFlowEdges(visibleEdges));
  const [selectedEdgeId,setSelectedEdgeId]=useState<string|null>(null); const [deleteEdgeOpen,setDeleteEdgeOpen]=useState(false);
  const [viewport,setViewport]=useState<Viewport>({x:mapView.x,y:mapView.y,zoom:mapView.zoom}); const [dialog,setDialog]=useState<React.ReactNode>(null); const mapCanvasRef=useRef<HTMLDivElement>(null);
  const [groups, setGroups] = useState<TopologyGroup[]>(() => { try { const saved = JSON.parse(localStorage.getItem('netscope-topology-groups') ?? '[]') as TopologyGroup[]; return saved.map((group, index) => ({ ...group, position: group.position ?? { x: 40 + (index % 3) * 280, y: 35 + Math.floor(index / 3) * 180 } })); } catch { return []; } });
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const saveGroups = (next: TopologyGroup[]) => { setGroups(next); localStorage.setItem('netscope-topology-groups', JSON.stringify(next)); };
  const openGroupDialog = (group?: TopologyGroup) => setDialog(<TopologyGroupDialog devices={devices} group={group} onClose={() => setDialog(null)} onSave={(value) => { const next = group ? groups.map((item) => item.id === group.id ? { ...item, ...value } : item) : [...groups, { ...value, id: crypto.randomUUID(), collapsed: false }]; saveGroups(next); setDialog(null); }} />);
  const activeGroup = groups.find((group) => group.id === activeGroupId);
  const groupNodes: FlowNode[] = groups.map((group, index) => ({
    id: `group-${group.id}`,
    type: 'topologyGroup',
    position: group.position ?? { x: 40 + (index % 3) * 280, y: 35 + Math.floor(index / 3) * 180 },
    data: { group, devices },
    draggable: true,
    selectable: true,
  }));
  const visibleNodes = activeGroup
    ? nodes.filter((node) => activeGroup.deviceIds.includes(node.id))
    : [...groupNodes, ...nodes];
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleFlowEdges = activeGroup ? flowEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) : flowEdges;
  useEffect(()=>setNodes(makeNodes(devices)),[devices,setNodes]); useEffect(()=>{setFlowEdges(toFlowEdges(visibleEdges));setSelectedEdgeId((current)=>current&&edges.some((edge)=>edge.id===current)?current:null)},[visibleEdges,setFlowEdges]); useEffect(()=>setViewport({x:mapView.x,y:mapView.y,zoom:mapView.zoom}),[mapView]);
  const connect=async(connection:Connection)=>{if(!connection.source||!connection.target||connection.source===connection.target)return;const key=edgeKey(connection.source,connection.target);if(edges.some((edge)=>edgeKey(edge.source,edge.target)===key))return;await onSaveEdge({id:`line-${key}`,source:connection.source,target:connection.target,manual:true})};
  const add=async(position?:{x:number;y:number})=>setDialog(<TextDialog title="Добавить узел" label="Название устройства" placeholder="Например: Камера в серверной" onClose={()=>setDialog(null)} onSubmit={async(hostname)=>{setDialog(<TextDialog title="Добавить узел" label="IP-адрес или идентификатор" initialValue="manual" onClose={()=>setDialog(null)} onSubmit={async(ip)=>{await onAddDevice({hostname,ip,type:'unknown',position:position??{x:250,y:180}});setDialog(null)}}/> )}}/>);
  const saveViewport=(next:Viewport)=>{setViewport(next);void onSaveMapView({x:next.x,y:next.y,zoom:next.zoom})}; const autoLayout=()=>void Promise.all(devices.map((device,index)=>onPosition(device.id,{position:{x:80+(index%4)*260,y:80+Math.floor(index/4)*155}}))); const moveGroup=(groupId:string,position:{x:number;y:number})=>{saveGroups(groups.map((group)=>group.id===groupId?{...group,position}:group))};
  const exportMap=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({devices,edges},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='netscope-map.json';link.click();URL.revokeObjectURL(url)};
  const manualLine=(sourceId?:string)=>setDialog(<SelectDialog title="Связать устройства" fields={[{label:'Первое устройство',value:sourceId??devices[0]?.id??'',options:devices.map((device)=>({value:device.id,label:`${device.hostname||device.ip} · ${device.ip}`}))},{label:'Второе устройство',value:devices.find((device)=>device.id!==sourceId)?.id??devices[1]?.id??'',options:devices.map((device)=>({value:device.id,label:`${device.hostname||device.ip} · ${device.ip}`}))}]} onClose={()=>setDialog(null)} onSubmit={(values)=>{if(values['Первое устройство']!==values['Второе устройство'])void onSaveEdge({id:`line-${edgeKey(values['Первое устройство'],values['Второе устройство'])}`,source:values['Первое устройство'],target:values['Второе устройство'],manual:true});setDialog(null)}}/>);
  const autoConnect=()=>{if(devices.length<2)return;const root=devices.find((device)=>device.type==='router'||device.type==='switch')??devices[0];void Promise.all(devices.filter((device)=>device.id!==root.id&&!edges.some((edge)=>edgeKey(edge.source,edge.target)===edgeKey(root.id,device.id))).map((device)=>onSaveEdge({id:`line-${edgeKey(root.id,device.id)}`,source:root.id,target:device.id,manual:false})))};
  type ContextMenu={kind:'pane';x:number;y:number;flowPosition:{x:number;y:number}}|{kind:'node';x:number;y:number;id:string}|{kind:'edge';x:number;y:number;id:string}; const [contextMenu,setContextMenu]=useState<ContextMenu|null>(null);
  const showContextMenu=(event:MouseEvent|React.MouseEvent,menu:{kind:'pane'}|{kind:'node';id:string}|{kind:'edge';id:string})=>{event.preventDefault();const bounds=mapCanvasRef.current?.getBoundingClientRect();if(!bounds)return;const menuWidth=236;const menuHeight=270;const left=Math.max(8,Math.min(event.clientX-bounds.left,bounds.width-menuWidth-8));const top=Math.max(8,Math.min(event.clientY-bounds.top,bounds.height-menuHeight-8));const flowPosition={x:(event.clientX-bounds.left-viewport.x)/viewport.zoom-110,y:(event.clientY-bounds.top-viewport.y)/viewport.zoom-40};setContextMenu({...menu,x:left,y:top,...(menu.kind==='pane'?{flowPosition}:{})} as ContextMenu)};
  const contextDevice=contextMenu?.kind==='node'?devices.find((device)=>device.id===contextMenu.id):null; const contextEdge=contextMenu?.kind==='edge'?edges.find((edge)=>edge.id===contextMenu.id):null;
  const deleteGroup = (group: TopologyGroup) => { saveGroups(groups.filter((item) => item.id !== group.id)); if (activeGroupId === group.id) setActiveGroupId(null); };
  return <>{dialog}<PageTitle eyebrow="ТОПОЛОГИЯ" title="Карта сети" detail={devices.length?`${devices.length} устройств · ${flowEdges.length} связей`:'Нет узлов для отображения'} action={<div className="map-actions"><button className="secondary-button" onClick={()=>void add()}><Plus size={16}/> Узел</button><button className="secondary-button" onClick={()=>manualLine()}><Link2 size={16}/> Связать</button><button className="secondary-button" onClick={()=>openGroupDialog()}><Plus size={16}/> Группа</button><button className="secondary-button" onClick={autoConnect}><Radar size={16}/> Построить линии</button><button className="secondary-button" onClick={exportMap}><Download size={16}/> Экспорт</button></div>}/><div className="map-toolbar"><div className="map-toolbar-title"><span className="map-status-mark"/> Состояние сети</div><span><span className="legend-dot online"/> В сети <b>{devices.filter((device)=>device.status==='online').length}</b></span><span><span className="legend-dot warning"/> Внимание <b>{devices.filter((device)=>device.status==='warning').length}</b></span><span><span className="legend-dot offline"/> Не в сети <b>{devices.filter((device)=>device.status==='offline').length}</b></span><span className="toolbar-spacer"/><CustomSelect className="line-filter" value={lineMode} options={[{value:'all',label:'Все линии'},{value:'active',label:'Только активные'},{value:'hidden',label:'Скрыть линии'}]} onChange={(value)=>setLineMode(value as typeof lineMode)}/><button className="tool-button" onClick={autoLayout}><CircleGauge size={15}/> Авторасстановка</button>{selectedEdgeId&&<button className="tool-button delete-line-button" onClick={()=>setDeleteEdgeOpen(true)}><Trash2 size={14}/> Удалить линию</button>}</div>{deleteEdgeOpen&&selectedEdgeId&&<ConfirmDialog title="Удалить связь?" message="Связь будет удалена с карты. Это действие нельзя отменить." onClose={()=>setDeleteEdgeOpen(false)} onConfirm={()=>{const selected=edges.find((edge)=>edge.id===selectedEdgeId);if(selected){const key=edgeKey(selected.source,selected.target);void Promise.all(edges.filter((edge)=>edgeKey(edge.source,edge.target)===key).map((edge)=>onDeleteEdge(edge.id)))}setDeleteEdgeOpen(false);setSelectedEdgeId(null)}}/>}<div className="map-canvas" ref={mapCanvasRef} onContextMenu={(event)=>event.preventDefault()}>{devices.length?<ReactFlow nodes={visibleNodes} edges={visibleFlowEdges} nodeTypes={nodeTypes} viewport={viewport} onViewportChange={saveViewport} onConnect={(connection)=>void connect(connection)} onEdgesDelete={(deleted)=>void Promise.all(deleted.map((edge)=>onDeleteEdge(edge.id)))} onNodesChange={onNodesChange} onNodeClick={(_,node)=>{if(node.type==='device') onSelect(node.id)}} onNodeContextMenu={(event,node)=>node.type==='device'&&showContextMenu(event,{kind:'node',id:node.id})} onEdgeClick={(_,edge)=>setSelectedEdgeId(edge.id)} onEdgeContextMenu={(event,edge)=>{setSelectedEdgeId(edge.id);showContextMenu(event,{kind:'edge',id:edge.id})}} onPaneClick={()=>{setSelectedEdgeId(null);setContextMenu(null)}} onPaneContextMenu={(event)=>showContextMenu(event,{kind:'pane'})} onNodeDragStop={(_,node)=>{if(node.type==='device')void onPosition(node.id,{position:node.position});if(node.type==='topologyGroup')moveGroup(node.id.replace('group-',''),node.position)}} deleteKeyCode={['Backspace','Delete']} onNodesDelete={(deleted)=>void Promise.all(deleted.filter((node)=>node.type==='device').map((node)=>onDeleteDevice(node.id)))} fitView={false} proOptions={{hideAttribution:true}}><Background color="#2d394b" gap={24} size={1}/><Controls showInteractive={false}/></ReactFlow>:<EmptyState icon={<MapIcon size={24}/>} title="Карта пуста" detail="Добавьте узел или запустите сканирование локальной сети."/>}{contextMenu&&<div className="map-context-menu" style={{left:contextMenu.x,top:contextMenu.y}} onMouseDown={(event)=>event.stopPropagation()}>{contextMenu.kind==='pane'&&<><button onClick={()=>{void add(contextMenu.flowPosition);setContextMenu(null)}}><Plus size={15}/> ???????? ????</button><button onClick={()=>{setContextMenu(null);autoLayout()}}><CircleGauge size={15}/> ???????????????</button><button onClick={()=>{setContextMenu(null);autoConnect()}}><Radar size={15}/> ????????? ?????</button><button onClick={()=>{setContextMenu(null);manualLine()}}><Link2 size={15}/> ??????? ??????????</button>{groups.length > 0 && <><div className="map-context-separator"/><div className="map-context-section">??????</div>{groups.map((group)=><div className="map-context-group-row" key={group.id}><button onClick={()=>{setActiveGroupId(activeGroupId===group.id?null:group.id);setContextMenu(null)}}><Boxes size={15}/><span>{group.name}</span><small>{group.deviceIds.length}</small></button><button className="map-context-more" aria-label={`???????? ?????? ${group.name}`} onClick={()=>{setContextMenu(null);openGroupDialog(group)}}><MoreHorizontal size={15}/></button><button className="map-context-delete" aria-label={`??????? ?????? ${group.name}`} onClick={()=>{deleteGroup(group);setContextMenu(null)}}><Trash2 size={14}/></button></div>)}</>}</>}
{contextMenu.kind==='node'&&contextDevice&&<><div className="map-context-title">{contextDevice.hostname||contextDevice.ip}</div><button onClick={()=>{onSelect(contextDevice.id);setContextMenu(null)}}><Server size={15}/> Открыть сведения</button><button onClick={()=>{setContextMenu(null);manualLine(contextDevice.id)}}><Link2 size={15}/> Связать с устройством</button><button className="delete-line-button" onClick={()=>{void onDeleteDevice(contextDevice.id);setContextMenu(null)}}><Trash2 size={15}/> Удалить узел</button></>}{contextMenu.kind==='edge'&&contextEdge&&<><div className="map-context-title">Связь устройств</div><button onClick={()=>{void onSaveEdge({...contextEdge,active:contextEdge.active===false});setContextMenu(null)}}>{contextEdge.active===false?'Сделать линию активной':'Сделать линию неактивной'}</button><button className="delete-line-button" onClick={()=>{setDeleteEdgeOpen(true);setContextMenu(null)}}><Trash2 size={15}/> Удалить линию</button></>}</div>}</div><div className="map-footer"><span><span className="map-footer-dot"/> Перетаскивайте узлы, чтобы изменить схему</span></div></>;
}

function DevicesView({
  devices,
  filter,
  onFilterChange,
  onSelect,
  onDelete,
  onDeleteMany,
}: {
  devices: Device[];
  filter: DeviceType | 'all';
  onFilterChange: (value: DeviceType | 'all') => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<boolean>;
  onDeleteMany: (ids: string[]) => Promise<boolean>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => devices.some((device) => device.id === id)));
  }, [devices]);
  const allVisibleSelected =
    devices.length > 0 && devices.every((device) => selectedIds.includes(device.id));
  const someVisibleSelected =
    !allVisibleSelected && devices.some((device) => selectedIds.includes(device.id));
  const toggle = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  const clearSelection = () => setSelectedIds([]);
  const removeSelected = () => {
    if (!selectedIds.length) return;
    setPendingDelete(selectedIds);
  };
  const exportCsv = () => {
    const rows = [
      ['Название', 'IP', 'MAC', 'Тип', 'Статус', 'Задержка'],
      ...devices.map((device) => [
        device.hostname,
        device.ip,
        device.mac ?? '',
        typeLabels[device.type],
        device.status,
        device.latency?.toString() ?? '',
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(';'))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = 'netscope-devices.csv';
    link.click();
  };
  return (
    <>
      <PageTitle
        eyebrow="ИНВЕНТАРЬ"
        title="Устройства"
        detail={`${devices.length} найдено по текущему фильтру`}
        action={
          <button className="secondary-button" onClick={exportCsv}>
            <Download size={16} /> Экспорт CSV
          </button>
        }
      />
      <div className="list-toolbar">
        <div className="bulk-actions">
          <button
            className="tool-button"
            onClick={() =>
              setSelectedIds(allVisibleSelected ? [] : devices.map((device) => device.id))
            }
          >
            {allVisibleSelected ? 'Снять выделение' : 'Выделить все'}
          </button>
          {selectedIds.length > 0 && (
            <button className="tool-button delete-line-button" onClick={removeSelected}>
              <Trash2 size={14} /> Удалить выбранные ({selectedIds.length})
            </button>
          )}
        </div>
        <div className="filter-select">
          <Filter size={15} />
          <CustomSelect
            menuClassName="filter-menu"
            value={filter}
            options={[
              { value: 'all', label: 'Все типы' },
              ...Object.entries(typeLabels).map(([value, label]) => ({ value, label })),
            ]}
            onChange={(value) => onFilterChange(value as DeviceType | 'all')}
          />
          {filter !== 'all' && (
            <button
              className="clear-filter"
              aria-label="Сбросить фильтр"
              title="Сбросить фильтр"
              onClick={() => onFilterChange('all')}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <span className="table-meta">Обновление данных выполняется через сканирование</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="selection-cell">
                <Checkbox
                  label="Выделить все видимые устройства"
                  checked={allVisibleSelected}
                  mixed={someVisibleSelected}
                  onChange={() =>
                    setSelectedIds(
                      allVisibleSelected
                        ? selectedIds.filter((id) => !devices.some((device) => device.id === id))
                        : Array.from(
                            new Set([...selectedIds, ...devices.map((device) => device.id)]),
                          ),
                    )
                  }
                />
              </th>
              <th>Устройство</th>
              <th>IP-адрес</th>
              <th>MAC</th>
              <th>Производитель</th>
              <th>Статус</th>
              <th>Задержка</th>
              <th>Тип</th>
              <th aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id} onClick={() => onSelect(device.id)}>
                <td className="selection-cell" onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    label={`Выделить ${device.hostname || device.ip}`}
                    checked={selectedIds.includes(device.id)}
                    onChange={() => toggle(device.id)}
                  />
                </td>
                <td>
                  <span className={`table-icon ${typeColors[device.type]}`}>
                    <DeviceIcon type={device.type} size={16} />
                  </span>
                  <strong>{device.hostname || 'Без имени'}</strong>
                </td>
                <td className="mono">{device.ip}</td>
                <td className="mono muted-cell">{device.mac ?? '—'}</td>
                <td>{device.vendor ?? '—'}</td>
                <td>
                  <span className={`status-pill ${device.status}`}>
                    <i />
                    {statusLabel(device.status)}
                  </span>
                </td>
                <td className="mono">{device.latency === null ? '—' : `${device.latency} мс`}</td>
                <td>
                  <span className="type-cell">
                    <DeviceIcon type={device.type} size={14} />
                    {typeLabels[device.type]}
                  </span>
                </td>
                <td className="table-actions-cell">
                  <button
                    className="icon-button delete-action"
                    aria-label={`Удалить ${device.hostname || device.ip}`}
                    title="Удалить устройство"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPendingDelete([device.id]);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!devices.length && (
          <EmptyState
            icon={<Server size={22} />}
            title="Устройства не найдены"
            detail="Измените фильтр или запустите сканирование подсети."
          />
        )}
      </div>
      {pendingDelete && (
        <ConfirmDialog
          title={
            pendingDelete.length > 1
              ? `Удалить устройства (${pendingDelete.length})?`
              : 'Удалить устройство?'
          }
          message={
            pendingDelete.length > 1
              ? 'Выбранные устройства будут удалены из списка и с карты.'
              : 'Устройство будет удалено из списка и с карты.'
          }
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            const ids = pendingDelete;
            setPendingDelete(null);
            if (ids.length === 1) void onDelete(ids[0]).then(clearSelection);
            else void onDeleteMany(ids).then(clearSelection);
          }}
        />
      )}
    </>
  );
}

function Checkbox({
  checked,
  mixed = false,
  label,
  onChange,
}: {
  checked: boolean;
  mixed?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="checkbox-control" aria-label={label}>
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        aria-checked={mixed ? 'mixed' : checked}
        onChange={onChange}
      />
      <span className={`checkbox-box ${mixed ? 'mixed' : ''}`}>
        {mixed ? (
          <Minus size={12} strokeWidth={3} />
        ) : checked ? (
          <Check size={13} strokeWidth={3} />
        ) : null}
      </span>
    </label>
  );
}

function EventsView({ events }: { events: import('./types').NetworkEvent[] }) {
  const exportEvents = () => {
    const csv = [
      ['Событие', 'Описание', 'Время'],
      ...events.map((event) => [event.title, event.detail, formatEventTime(event.time)]),
    ]
      .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(';'))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = 'netscope-events.csv';
    link.click();
  };
  return (
    <>
      <PageTitle
        eyebrow="ЖУРНАЛ"
        title="События"
        detail="История изменений состояния сети"
        action={
          <button className="secondary-button" onClick={exportEvents}>
            <Download size={16} /> Экспорт
          </button>
        }
      />
      <section className="panel events-list">
        {events.length ? (
          events.map((event) => <EventRow key={event.id} event={event} expanded />)
        ) : (
          <EmptyState
            icon={<Clock3 size={22} />}
            title="Журнал пуст"
            detail="События появятся после первого сканирования."
          />
        )}
      </section>
    </>
  );
}

function EventRow({
  event,
  expanded = false,
}: {
  event: import('./types').NetworkEvent;
  expanded?: boolean;
}) {
  return (
    <div className="event-row">
      <div className={`event-icon ${event.kind}`}>
        {event.kind === 'online' ? (
          <CheckCircle2 size={16} />
        ) : event.kind === 'offline' ? (
          <Wifi size={16} />
        ) : event.kind === 'warning' ? (
          <AlertCircle size={16} />
        ) : (
          <Radar size={16} />
        )}
      </div>
      <div>
        <strong>{event.title}</strong>
        <span>{event.detail}</span>
      </div>
      <time>{formatEventTime(event.time)}</time>
      {expanded && (
        <button className="more-button" title="Событие">
          <ArrowDownUp size={14} />
        </button>
      )}
    </div>
  );
}
function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function statusLabel(status: DeviceStatus) {
  return status === 'online'
    ? 'В сети'
    : status === 'warning'
      ? 'Нет ответа'
      : status === 'offline'
        ? 'Недоступно'
        : 'Не проверено';
}
function AlertsView() {
  type Rule = {
    id: string;
    name: string;
    metric: string;
    operator: string;
    threshold: string;
    severity: string;
    action: string;
    enabled: boolean;
  };
  const options = {
    metric: [
      { value: 'status', label: 'Доступность устройства' },
      { value: 'latency', label: 'Задержка ответа' },
      { value: 'new', label: 'Новое устройство' },
    ],
    operator: [
      { value: 'offline', label: 'Не отвечает' },
      { value: 'gt', label: 'Больше порога' },
      { value: 'detected', label: 'Обнаружено' },
    ],
    severity: [
      { value: 'critical', label: 'Критично' },
      { value: 'warning', label: 'Предупреждение' },
      { value: 'info', label: 'Информация' },
    ],
    action: [
      { value: 'event', label: 'Записать событие' },
      { value: 'webhook', label: 'Отправить webhook' },
      { value: 'both', label: 'Событие и webhook' },
    ],
  };
  const defaults: Rule[] = [
    {
      id: 'offline',
      name: 'Устройство не отвечает',
      metric: 'status',
      operator: 'offline',
      threshold: '',
      severity: 'critical',
      action: 'event',
      enabled: true,
    },
    {
      id: 'latency',
      name: 'Высокая задержка',
      metric: 'latency',
      operator: 'gt',
      threshold: '100',
      severity: 'warning',
      action: 'event',
      enabled: true,
    },
  ];
  const [rules, setRules] = useState<Rule[]>(
    () => JSON.parse(localStorage.getItem('netscope-alert-rules') ?? 'null') ?? defaults,
  );
  const [editing, setEditing] = useState<Rule | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Rule | null>(null);
  const save = (next: Rule[]) => {
    setRules(next);
    localStorage.setItem('netscope-alert-rules', JSON.stringify(next));
  };
  const description = (rule: Rule) =>
    `${options.metric.find((item) => item.value === rule.metric)?.label} · ${options.operator.find((item) => item.value === rule.operator)?.label}${rule.threshold ? ` ${rule.threshold} мс` : ''} · действие: ${options.action.find((item) => item.value === rule.action)?.label}`;
  const newRule = () =>
    setEditing({
      id: crypto.randomUUID(),
      name: 'Новое правило',
      metric: 'latency',
      operator: 'gt',
      threshold: '100',
      severity: 'warning',
      action: 'event',
      enabled: true,
    });
  return (
    <>
      <PageTitle
        eyebrow="МОНИТОРИНГ"
        title="Оповещения"
        detail="Правила проверяются после сканирования и описывают, как реагировать на проблему"
        action={
          <button className="primary-button" onClick={newRule}>
            <Plus size={16} /> Добавить правило
          </button>
        }
      />
      <section className="settings-list">
        {rules.length ? (
          rules.map((rule) => (
            <div className="setting-row rule-row" key={rule.id}>
              <div>
                <strong>{rule.name}</strong>
                <span>{description(rule)}</span>
                <small className={`severity-${rule.severity}`}>
                  {rule.severity === 'critical'
                    ? 'Критично'
                    : rule.severity === 'warning'
                      ? 'Предупреждение'
                      : 'Информация'}
                </small>
              </div>
              <div className="row-actions">
                <button
                  className={`toggle ${rule.enabled ? 'on' : ''}`}
                  aria-label="Включить правило"
                  onClick={() =>
                    save(
                      rules.map((item) =>
                        item.id === rule.id ? { ...item, enabled: !item.enabled } : item,
                      ),
                    )
                  }
                >
                  <i />
                </button>
                <button
                  className="icon-button"
                  onClick={() => setEditing(rule)}
                  aria-label="Изменить"
                  title="Настроить правило"
                >
                  <Settings2 size={17} />
                </button>
                <button
                  className="icon-button delete-action"
                  onClick={() => setPendingDelete(rule)}
                  aria-label="Удалить"
                  title="Удалить правило"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            icon={<Bell size={22} />}
            title="Правил нет"
            detail="Добавьте первое условие контроля сети."
          />
        )}
      </section>
      {editing && (
        <RuleDialog
          rule={editing}
          options={options}
          onClose={() => setEditing(null)}
          onSave={(rule) => {
            save([...rules.filter((item) => item.id !== rule.id), rule]);
            setEditing(null);
          }}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Удалить правило?"
          message={`Правило «${pendingDelete.name}» будет удалено без возможности восстановления.`}
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            save(rules.filter((item) => item.id !== pendingDelete.id));
            setPendingDelete(null);
          }}
        />
      )}
    </>
  );
}

function RuleDialog({
  rule,
  options,
  onClose,
  onSave,
}: {
  rule: {
    id: string;
    name: string;
    metric: string;
    operator: string;
    threshold: string;
    severity: string;
    action: string;
    enabled: boolean;
  };
  options: Record<string, { value: string; label: string }[]>;
  onClose: () => void;
  onSave: (rule: {
    id: string;
    name: string;
    metric: string;
    operator: string;
    threshold: string;
    severity: string;
    action: string;
    enabled: boolean;
  }) => void;
}) {
  const [value, setValue] = useState(rule);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="dialog-card rule-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(value);
        }}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">УСЛОВИЕ МОНИТОРИНГА</span>
            <h2>Настройка правила</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <label className="setting-field">
          Название
          <input
            value={value.name}
            onChange={(event) => setValue({ ...value, name: event.target.value })}
          />
        </label>
        {[
          ['metric', 'Что проверять'],
          ['operator', 'Условие'],
          ['severity', 'Важность'],
          ['action', 'Действие'],
        ].map(([key, label]) => (
          <label className="setting-field" key={key}>
            {label}
            <CustomSelect
              value={value[key as keyof typeof value] as string}
              options={options[key]}
              onChange={(next) => setValue({ ...value, [key]: next })}
            />
          </label>
        ))}
        <label className="setting-field">
          Порог задержки, мс
          <input
            type="number"
            min="1"
            value={value.threshold}
            onChange={(event) => setValue({ ...value, threshold: event.target.value })}
          />
        </label>
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="primary-button">
            <CheckCircle2 size={15} /> Сохранить правило
          </button>
        </div>
      </form>
    </div>
  );
}

function SettingsView({
  scan,
  onConfig,
}: {
  scan: import('./types').ScanConfig;
  onConfig: (config: Partial<import('./types').ScanConfig>) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(
    () => localStorage.getItem('netscope-auto-refresh') !== 'false',
  );
  const save = () => {
    localStorage.setItem('netscope-auto-refresh', String(autoRefresh));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  return (
    <>
      <PageTitle
        eyebrow="ПРИЛОЖЕНИЕ"
        title="Настройки"
        detail="Параметры сканирования и поведения NetScope"
        action={
          <button className="primary-button" onClick={save}>
            <CheckCircle2 size={16} /> {saved ? 'Сохранено' : 'Сохранить'}
          </button>
        }
      />
      <section className="settings-list">
        <div className="settings-group">
          <h2>Сканирование</h2>
          <label className="setting-field">
            Таймаут TCP, мс
            <input
              type="number"
              min="100"
              max="10000"
              value={scan.timeout}
              onChange={(event) => onConfig({ timeout: Number(event.target.value) })}
            />
          </label>
          <label className="setting-field">
            Параллельные потоки
            <input
              type="number"
              min="1"
              max="512"
              value={scan.threads}
              onChange={(event) => onConfig({ threads: Number(event.target.value) })}
            />
          </label>
        </div>
        <div className="setting-row">
          <div>
            <strong>Обновлять интерфейс после сканирования</strong>
            <span>Подтягивать устройства, события и связи автоматически</span>
          </div>
          <button
            className={`toggle ${autoRefresh ? 'on' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <i />
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>Хранить ручные узлы и связи</strong>
            <span>Ручные элементы карты не удаляются новым сканированием</span>
          </div>
          <span className="setting-value">Включено</span>
        </div>
      </section>
    </>
  );
}

function IntegrationsView() {
  const [webhook, setWebhook] = useState(() => localStorage.getItem('netscope-webhook') ?? '');
  const [saved, setSaved] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const save = () => {
    localStorage.setItem('netscope-webhook', webhook);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  const test = async () => {
    if (!webhook) return;
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'NetScope',
          event: 'test',
          message: 'Тестовое уведомление',
        }),
      });
      setSaved(true);
      setTestMessage('Тестовый запрос отправлен');
    } catch {
      setSaved(false);
      setTestMessage('Не удалось отправить запрос');
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="ПОДКЛЮЧЕНИЯ"
        title="Интеграции"
        detail="Передача событий NetScope во внешние системы"
        action={
          <button className="primary-button" onClick={save}>
            <CheckCircle2 size={16} /> {saved ? 'Сохранено' : 'Сохранить'}
          </button>
        }
      />
      <section className="settings-list">
        <div className="integration-card">
          <div className="integration-icon">
            <PlugZap size={20} />
          </div>
          <div>
            <strong>Webhook</strong>
            <span>POST-запрос для событий сети, совместим с автоматизациями и чатами</span>
          </div>
          <label className="setting-field">
            URL webhook
            <input
              value={webhook}
              onChange={(event) => setWebhook(event.target.value)}
              placeholder="https://example.local/netscope"
            />
          </label>
          <button className="secondary-button" onClick={() => void test()} disabled={!webhook}>
            <Upload size={15} /> Проверить
          </button>
          {testMessage && <small className="integration-message">{testMessage}</small>}
        </div>
        <div className="integration-card">
          <div className="integration-icon">
            <Bell size={20} />
          </div>
          <div>
            <strong>Локальные уведомления</strong>
            <span>Используют правила оповещений и журнал событий приложения</span>
          </div>
          <span className="setting-value active-value">Активно</span>
        </div>
      </section>
    </>
  );
}

function MonitorsView({ devices }: { devices: Device[] }) {
  return (
    <>
      <PageTitle
        eyebrow="МОНИТОРИНГ"
        title="Мониторы"
        detail="Быстрый контроль доступности найденных устройств"
      />
      <section className="settings-list">
        {devices.length ? (
          devices.map((device) => (
            <div className="setting-row" key={device.id}>
              <div>
                <strong>{device.hostname || device.ip}</strong>
                <span>{device.ip} · проверка доступности и задержки</span>
              </div>
              <span className={`status-pill ${device.status}`}>
                <i />
                {statusLabel(device.status)}
              </span>
            </div>
          ))
        ) : (
          <EmptyState
            icon={<CircleGauge size={22} />}
            title="Нет устройств для мониторинга"
            detail="Сначала выполните сканирование локальной сети."
          />
        )}
      </section>
    </>
  );
}

function formatEventTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
}

function ScannerPanel({
  scan,
  interfaces,
  isScanning,
  scanMessage,
  onClose,
  onConfig,
  onStart,
  onStop,
}: {
  scan: import('./types').ScanConfig;
  interfaces: import('./types').InterfaceInfo[];
  isScanning: boolean;
  scanMessage: string | null;
  onClose: () => void;
  onConfig: (config: Partial<import('./types').ScanConfig>) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <div className="scanner-overlay">
      <section className="scanner-drawer">
        <div className="drawer-heading">
          <div>
            <span className="eyebrow">СЕТЕВОЙ ИНСТРУМЕНТ</span>
            <h2>Новое сканирование</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <p className="drawer-intro">
          Проверка доступности хостов и определение открытых портов в выбранной подсети.
        </p>
        <label className="field-label">
          Сетевой интерфейс
          <CustomSelect
            value={scan.interfaceName}
            options={[
              { value: '', label: 'Выберите интерфейс' },
              ...interfaces.map((item) => ({
                value: item.name,
                label: `${item.name} · ${item.address}`,
              })),
            ]}
            onChange={(value) => {
              const selected = interfaces.find((item) => item.name === value);
              onConfig({ interfaceName: value, subnet: selected?.cidr ?? scan.subnet });
            }}
          />
        </label>
        <label className="field-label">
          Диапазон CIDR
          <input
            value={scan.subnet}
            onChange={(event) => onConfig({ subnet: event.target.value })}
            placeholder="192.168.1.0/24"
          />
        </label>
        <div className="field-grid">
          <label className="field-label">
            Таймаут, мс
            <input
              type="number"
              min="100"
              max="10000"
              value={scan.timeout}
              onChange={(event) => onConfig({ timeout: Number(event.target.value) })}
            />
          </label>
          <label className="field-label">
            Параллельные потоки
            <input
              type="number"
              min="1"
              max="512"
              value={scan.threads}
              onChange={(event) => onConfig({ threads: Number(event.target.value) })}
            />
          </label>
        </div>
        <div className="scan-notice">
          <Radar size={18} />
          <p>
            <strong>Активное обнаружение</strong>
            <span>Проверяются TCP-порты и локальные таблицы ARP.</span>
          </p>
        </div>
        {scanMessage && (
          <div className="scan-message">
            <LoaderCircle size={15} className={isScanning ? 'spin' : ''} /> {scanMessage}
          </div>
        )}
        <div className="drawer-footer">
          {isScanning ? (
            <button className="danger-button" onClick={onStop}>
              <Square size={15} /> Остановить
            </button>
          ) : (
            <button className="primary-button full" onClick={onStart}>
              <Play size={15} /> Запустить сканирование
            </button>
          )}
          <button className="secondary-button full" disabled={isScanning} onClick={onClose}>
            Закрыть
          </button>
        </div>
      </section>
    </div>
  );
}
