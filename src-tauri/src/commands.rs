use crate::{
    database::Database,
    device::{
        Device, DeviceUpdate, InterfaceInfo, MapView, NetworkEdge, NetworkEvent, NewDeviceInput,
        ScanConfig, ScanResult,
    },
    scanner::{self, ScanState},
};
use log::{error, info};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_network_interfaces() -> Vec<InterfaceInfo> {
    let result = scanner::interfaces();
    info!(
        "get_network_interfaces returned {} interface(s)",
        result.len()
    );
    result
}

#[tauri::command]
pub async fn list_devices(db: State<'_, Database>) -> Result<Vec<Device>, String> {
    db.devices().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_events(db: State<'_, Database>) -> Result<Vec<NetworkEvent>, String> {
    db.events().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_edges(db: State<'_, Database>) -> Result<Vec<NetworkEdge>, String> {
    db.edges().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_map_view(db: State<'_, Database>) -> Result<MapView, String> {
    db.map_view().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_map_view(view: MapView, db: State<'_, Database>) -> Result<(), String> {
    db.save_map_view(&view).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_device(input: NewDeviceInput, db: State<'_, Database>) -> Result<Device, String> {
    db.add_device(&input).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_device(id: String, db: State<'_, Database>) -> Result<(), String> {
    db.delete_device(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_devices(ids: Vec<String>, db: State<'_, Database>) -> Result<(), String> {
    db.delete_devices(&ids).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_edge(edge: NetworkEdge, db: State<'_, Database>) -> Result<NetworkEdge, String> {
    db.save_edge(&edge).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_edge(id: String, db: State<'_, Database>) -> Result<(), String> {
    db.delete_edge(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scan_subnet(
    config: ScanConfig,
    state: State<'_, ScanState>,
    db: State<'_, Database>,
) -> Result<ScanResult, String> {
    info!(
        "scan_subnet invoked: subnet={}, interface={}, timeout={}ms, threads={}",
        config.subnet, config.interface_name, config.timeout, config.threads
    );
    let result = scanner::scan(config, Arc::new(state.inner().clone()), &db).await;
    if let Err(message) = &result {
        error!("scan_subnet failed: {message}");
    }
    result
}

#[tauri::command]
pub fn stop_scan(state: State<'_, ScanState>) {
    info!("stop_scan invoked");
    state
        .running
        .store(false, std::sync::atomic::Ordering::SeqCst);
}

#[tauri::command]
pub async fn update_device(
    id: String,
    changes: DeviceUpdate,
    db: State<'_, Database>,
) -> Result<Device, String> {
    db.update_device(&id, &changes)
        .await
        .map_err(|e| e.to_string())
}
