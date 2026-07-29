use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub id: String,
    pub hostname: String,
    pub ip: String,
    pub ipv6: Option<String>,
    pub mac: Option<String>,
    pub vendor: Option<String>,
    pub os: Option<String>,
    #[serde(rename = "type")]
    pub device_type: String,
    #[serde(default)]
    pub role: Option<String>,
    pub status: String,
    pub latency: Option<i64>,
    pub last_seen: String,
    pub subnet: String,
    pub ports: Vec<i32>,
    #[serde(default)]
    pub udp_ports: Vec<i32>,
    pub dns_name: Option<String>,
    pub netbios_name: Option<String>,
    pub mdns_name: Option<String>,
    pub upnp_name: Option<String>,
    pub dhcp_hostname: Option<String>,
    pub snmp_sys_name: Option<String>,
    pub snmp_description: Option<String>,
    pub ttl: Option<i32>,
    pub os_fingerprint: Option<String>,
    #[serde(default)]
    pub banners: serde_json::Value,
    pub first_seen: String,
    pub last_discovered: String,
    pub discovery_count: i64,
    pub confidence: i32,
    #[serde(default)]
    pub matched_features: Vec<String>,
    #[serde(default)]
    pub alternative_types: Vec<String>,
    #[serde(default)]
    pub negative_features: Vec<serde_json::Value>,
    #[serde(default)]
    pub roles: Vec<serde_json::Value>,
    #[serde(default)]
    pub hierarchy: Vec<String>,
    #[serde(default)]
    pub os_confidence: i32,
    pub services_count: i32,
    pub connection_count: i32,
    pub position: Position,
    pub note: Option<String>,
    #[serde(default)]
    pub manual: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkEvent {
    pub id: String,
    pub title: String,
    pub detail: String,
    pub time: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterfaceInfo {
    pub name: String,
    pub address: String,
    pub cidr: String,
    pub kind: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanConfig {
    pub subnet: String,
    pub interface_name: String,
    pub timeout: u64,
    pub threads: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub devices: Vec<Device>,
    pub scanned: usize,
    pub elapsed_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub label: Option<String>,
    #[serde(default)]
    pub manual: bool,
    #[serde(default)]
    pub confidence: i32,
    #[serde(default)]
    pub evidence: Vec<String>,
    #[serde(default = "default_true")]
    pub active: bool,
    #[serde(default)]
    pub source_handle: Option<String>,
    #[serde(default)]
    pub target_handle: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapView {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewDeviceInput {
    pub hostname: String,
    pub ip: String,
    #[serde(rename = "type")]
    pub device_type: String,
    pub position: Position,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeviceUpdate {
    pub hostname: Option<String>,
    pub note: Option<String>,
    pub position: Option<Position>,
    #[serde(rename = "type")]
    pub device_type: Option<String>,
}

fn default_true() -> bool {
    true
}
