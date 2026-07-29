use crate::classification::{ClassificationEngine, DeviceFeatures};
use crate::database::Database;
use crate::device::{Device, InterfaceInfo, NetworkEdge, Position, ScanConfig, ScanResult};
use crate::history::ClassificationHistory;
use chrono::Utc;
use dns_lookup::lookup_addr;
use get_if_addrs::{get_if_addrs, IfAddr};
use log::{debug, error, info, warn};
use std::collections::{HashMap, HashSet};
use std::net::{IpAddr, Ipv4Addr};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::sync::Semaphore;
use tokio::time::{timeout, Duration, Instant};

#[derive(Clone, Default)]
pub struct ScanState {
    pub running: Arc<AtomicBool>,
}

pub fn interfaces() -> Vec<InterfaceInfo> {
    let items = match get_if_addrs() {
        Ok(items) => items,
        Err(error) => {
            error!("failed to enumerate network interfaces: {error}");
            return Vec::new();
        }
    };
    let result: Vec<_> = items
        .into_iter()
        .filter_map(|item| match item.addr {
            IfAddr::V4(addr) if !addr.ip.is_loopback() => Some(InterfaceInfo {
                name: item.name.clone(),
                address: addr.ip.to_string(),
                cidr: network_cidr(addr.ip, addr.netmask),
                kind: interface_kind(&item.name),
                active: true,
            }),
            _ => None,
        })
        .collect();
    for interface in &result {
        info!(
            "interface: {} {} ({})",
            interface.name, interface.address, interface.cidr
        );
    }
    result
}
fn interface_kind(name: &str) -> String {
    let n = name.to_lowercase();
    if n.contains("wi-fi") || n.contains("wifi") || n.contains("wireless") {
        "wifi"
    } else if n.contains("vpn") {
        "vpn"
    } else if n.contains("ethernet") || n.contains("eth") {
        "ethernet"
    } else {
        "other"
    }
    .into()
}
fn network_cidr(ip: Ipv4Addr, mask: Ipv4Addr) -> String {
    format!(
        "{}/{}",
        Ipv4Addr::from(u32::from(ip) & u32::from(mask)),
        u32::from(mask).count_ones()
    )
}

pub async fn scan(
    config: ScanConfig,
    state: Arc<ScanState>,
    db: &Database,
) -> Result<ScanResult, String> {
    let started = Instant::now();
    let (network, prefix) = parse_cidr(&config.subnet)?;
    let addresses = addresses(network, prefix);
    if addresses.is_empty() {
        return Err("В подсети нет адресов для проверки.".into());
    }
    if state
        .running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("Сканирование уже выполняется.".into());
    }
    let _running_guard = RunningGuard(state.clone());
    info!(
        "scan started: subnet={}, network={network}/{prefix}, addresses={}",
        config.subnet,
        addresses.len()
    );
    let timeout_ms = config.timeout.clamp(100, 10_000);
    let semaphore = Arc::new(Semaphore::new(config.threads.clamp(1, 256)));
    let stage_started = Instant::now();
    let arp = arp_table().await;
    info!(
        "ARP table loaded: {} entries in {}ms",
        arp.len(),
        stage_started.elapsed().as_millis()
    );
    let stage_started = Instant::now();
    let gateway = default_gateway().await;
    info!(
        "default gateway: {:?} in {}ms",
        gateway,
        stage_started.elapsed().as_millis()
    );
    let mut handles = Vec::with_capacity(addresses.len());
    for ip in addresses.iter().copied() {
        if !state.running.load(Ordering::SeqCst) {
            break;
        }
        // Do not acquire the semaphore in this loop. Waiting here after the
        // first batch is full deadlocks because the spawned tasks are only
        // awaited below. Each task owns its permit instead.
        let semaphore = semaphore.clone();
        let arp_hit = arp.contains_key(&ip.to_string());
        handles.push(tokio::spawn(async move {
            let permit = semaphore.acquire_owned().await.ok()?;
            let result = probe(ip, timeout_ms, arp_hit).await;
            drop(permit);
            result
        }));
    }
    let now = Utc::now().to_rfc3339();
    let mut devices = Vec::new();
    for handle in handles {
        match handle.await {
            Ok(Some((ip, latency, ports, ttl, ping_ok))) => {
                let ip_text = ip.to_string();
                let dns_name =
                    tokio::task::spawn_blocking(move || lookup_addr(&IpAddr::V4(ip)).ok())
                        .await
                        .ok()
                        .flatten();
                let hostname = dns_name.clone().unwrap_or_else(|| ip_text.clone());
                let mac = arp.get(&ip_text).cloned();
                let vendor = mac.as_deref().and_then(oui_vendor);
                let is_gateway = gateway.as_deref() == Some(ip_text.as_str());
                let history = db.classification_history(&ip_text).await.ok().flatten();
                let banners = grab_banners(ip, &ports, timeout_ms).await;
                let features = collect_features(
                    &hostname,
                    vendor.as_deref(),
                    &ports,
                    ttl,
                    &banners,
                    is_gateway,
                    history,
                );
                let classification = ClassificationEngine::classify(&features);
                // Network roles are more reliable than the generic type fallback.
                // In particular, a gateway used to be returned as `networkDevice`,
                // which is not a UI type and therefore looked like an unknown node.
                let device_type = normalized_device_type(
                    &classification.device_type,
                    classification.role.as_deref(),
                );
                let position = Position {
                    x: 80.0 + (devices.len() % 4) as f64 * 260.0,
                    y: 80.0 + (devices.len() / 4) as f64 * 155.0,
                };
                let connection_count = if is_gateway { 100 } else { ports.len() as i32 };
                devices.push(Device {
                    id: format!("device-{}", ip),
                    hostname,
                    ip: ip_text,
                    ipv6: None,
                    mac,
                    vendor,
                    os: classification.os.clone(),
                    device_type,
                    role: classification.role,
                    status: if ping_ok { "online" } else { "warning" }.into(),
                    latency: Some(latency),
                    last_seen: now.clone(),
                    subnet: config.subnet.clone(),
                    ports: ports.clone(),
                    udp_ports: Vec::new(),
                    dns_name,
                    netbios_name: None,
                    mdns_name: None,
                    upnp_name: None,
                    dhcp_hostname: None,
                    snmp_sys_name: None,
                    snmp_description: None,
                    ttl: Some(ttl),
                    os_fingerprint: classification.os,
                    banners: serde_json::to_value(&banners)
                        .unwrap_or_else(|_| serde_json::json!({})),
                    first_seen: now.clone(),
                    last_discovered: now.clone(),
                    discovery_count: 1,
                    confidence: classification.confidence,
                    matched_features: classification
                        .matched_features
                        .iter()
                        .map(|item| {
                            format!(
                                "{} (+{}, {}, reliability {:.2}, rule:{})",
                                item.label,
                                item.effective_weight,
                                item.source,
                                item.reliability,
                                item.rule_id
                            )
                        })
                        .collect(),
                    alternative_types: classification.alternative_types,
                    negative_features: classification
                        .negative_features
                        .iter()
                        .map(|item| serde_json::to_value(item).unwrap_or_default())
                        .collect(),
                    roles: classification
                        .roles
                        .iter()
                        .map(|item| serde_json::to_value(item).unwrap_or_default())
                        .collect(),
                    hierarchy: classification.hierarchy,
                    os_confidence: classification.os_confidence,
                    services_count: ports.len() as i32,
                    connection_count,
                    position,
                    note: None,
                    manual: false,
                });
            }
            Ok(None) => {}
            Err(error) => error!("scan task failed: {error}"),
        }
    }
    info!(
        "probe stage complete: found {} device(s), elapsed={}ms",
        devices.len(),
        started.elapsed().as_millis()
    );
    let edges = topology_edges(&devices, gateway.as_deref());
    info!("topology stage complete: {} edge(s)", edges.len());
    db.save_scan(&config.subnet, &devices, &edges)
        .await
        .map_err(|error| {
            error!("failed to save scan result: {error}");
            error.to_string()
        })?;
    for device in &devices {
        if let Err(error) = db.save_classification_snapshot(&device.ip, device).await {
            warn!(
                "failed to save classification history for {}: {error}",
                device.ip
            );
        }
    }
    info!(
        "scan completed: scanned={}, found={}, elapsed={}ms",
        addresses.len(),
        devices.len(),
        started.elapsed().as_millis()
    );
    Ok(ScanResult {
        scanned: addresses.len(),
        elapsed_ms: started.elapsed().as_millis() as i64,
        devices,
    })
}

struct RunningGuard(Arc<ScanState>);
impl Drop for RunningGuard {
    fn drop(&mut self) {
        self.0.running.store(false, Ordering::SeqCst);
    }
}

async fn probe(
    ip: Ipv4Addr,
    timeout_ms: u64,
    arp_hit: bool,
) -> Option<(Ipv4Addr, i64, Vec<i32>, i32, bool)> {
    let ports = [
        21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 554, 587, 631, 993, 995, 1883, 3389,
        5000, 5900, 8080, 8443, 9100,
    ];
    let started = Instant::now();
    let ping_latency = icmp_ping(ip, timeout_ms).await;
    let ping_ok = ping_latency.is_some();
    info!(
        "ping {}: success={}, latency={:?}ms, arp_hit={}",
        ip, ping_ok, ping_latency, arp_hit
    );
    let checks = futures::future::join_all(ports.into_iter().map(|port| async move {
        let result = timeout(
            Duration::from_millis(timeout_ms),
            TcpStream::connect((ip, port)),
        )
        .await;
        let open = matches!(result, Ok(Ok(_)));
        debug!("tcp scan {}:{} open={}", ip, port, open);
        if open {
            Some(port as i32)
        } else {
            None
        }
    }))
    .await;
    let open: Vec<i32> = checks.into_iter().flatten().collect();
    if ping_ok || arp_hit || !open.is_empty() {
        // Do not use the total probe duration as latency: it also includes
        // the TCP port scan and can be hundreds of milliseconds even when
        // ICMP replies immediately. That incorrectly rendered live hosts as
        // "Нет ответа" (warning) in the UI.
        let latency = ping_latency.unwrap_or_else(|| started.elapsed().as_millis().max(1) as i64);
        Some((ip, latency, open, 64, ping_ok))
    } else {
        None
    }
}

/// Service detection / banner grabbing is intentionally separate from
/// classification. It is conservative: a failed banner probe is simply an
/// absent feature, never evidence for another device type.
async fn grab_banners(ip: Ipv4Addr, ports: &[i32], timeout_ms: u64) -> HashMap<String, String> {
    let mut banners = HashMap::new();
    let targets = ports.iter().filter_map(|port| {
        let scheme = match *port {
            80 | 8080 => Some("http"),
            443 | 8443 => Some("https"),
            22 => Some("ssh"),
            21 => Some("ftp"),
            _ => None,
        }?;
        Some((*port, scheme))
    });
    for (port, scheme) in targets {
        let address = format!("{ip}:{port}");
        let result = timeout(
            Duration::from_millis(timeout_ms),
            TcpStream::connect(&address),
        )
        .await;
        if let Ok(Ok(mut stream)) = result {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            let request = if scheme == "http" || scheme == "https" {
                Some(b"GET / HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n".as_slice())
            } else if scheme == "ftp" {
                Some(b"\r\n".as_slice())
            } else {
                None
            };
            if let Some(request) = request {
                let _ = stream.write_all(request).await;
            }
            let mut buffer = vec![0u8; 4096];
            if let Ok(Ok(size)) =
                timeout(Duration::from_millis(timeout_ms), stream.read(&mut buffer)).await
            {
                let text = String::from_utf8_lossy(&buffer[..size])
                    .chars()
                    .take(512)
                    .collect::<String>();
                if !text.is_empty() {
                    banners.insert(format!("{scheme}:{port}"), text);
                }
            }
        }
    }
    banners
}

fn collect_features(
    hostname: &str,
    vendor: Option<&str>,
    ports: &[i32],
    ttl: i32,
    banners: &HashMap<String, String>,
    is_gateway: bool,
    history: Option<ClassificationHistory>,
) -> DeviceFeatures {
    let mut signals = HashSet::new();
    let name = hostname.to_lowercase();
    let vendor_name = vendor.unwrap_or("").to_lowercase();
    if is_gateway {
        signals.insert("gateway".into());
    }
    if !name.is_empty() && !name.parse::<Ipv4Addr>().is_ok() {
        signals.insert("hostname".into());
    }
    for port in ports {
        signals.insert(format!("port:{port}"));
    }
    if ports.contains(&445) {
        signals.insert("smb".into());
    }
    if ports.contains(&139) {
        signals.insert("netbios".into());
    }
    if ports.contains(&3389) {
        signals.insert("rdp".into());
    }
    if ports.contains(&22) {
        signals.insert("ssh".into());
    }
    if ports.contains(&554) {
        signals.insert("rtsp".into());
    }
    if ports.contains(&631) {
        signals.insert("ipp".into());
    }
    if ports.contains(&53) {
        signals.insert("dns-server".into());
    }
    if ports.contains(&67) || ports.contains(&68) {
        signals.insert("dhcp-server".into());
    }
    if ports.contains(&161) {
        signals.insert("network-management".into());
    }
    if ports.contains(&830) {
        signals.insert("network-management".into());
    }
    if ttl == 64 {
        signals.insert("ttl:64".into());
    }
    if ttl == 128 {
        signals.insert("ttl:128".into());
    }
    if name.contains("router") || name.contains("gateway") {
        signals.insert("gateway".into());
    }
    let vendor_tokens = [
        ("mikrotik", "mikrotik"),
        ("cisco", "cisco"),
        ("ubiquiti", "ubiquiti"),
        ("tp-link", "tp-link"),
        ("tplink", "tp-link"),
        ("synology", "synology"),
        ("qnap", "qnap"),
        ("hikvision", "hikvision"),
        ("dahua", "dahua"),
        ("hewlett", "hp"),
        ("hp", "hp"),
        ("canon", "canon"),
        ("epson", "epson"),
        ("brother", "brother"),
    ];
    for (needle, normalized) in vendor_tokens {
        if vendor_name.contains(needle) {
            signals.insert(format!("vendor:{normalized}"));
        }
    }
    for text in banners.values().map(|value| value.to_lowercase()) {
        let fingerprints = [
            ("routeros", "http:routeros", "os:routeros"),
            ("openwrt", "http:openwrt", "os:openwrt"),
            ("keenetic", "http:keenetic", ""),
            ("fritz!box", "http:fritzbox", ""),
            ("synology", "http:synology", "os:synology"),
            ("qnap", "http:qnap", "os:qnap"),
            ("truenas", "http:truenas", "os:truenas"),
            ("hikvision", "http:hikvision", ""),
            ("dahua", "http:dahua", ""),
            ("microsoft-iis", "http:iis", "os:windows"),
            (" nginx", "http:nginx", "os:linux"),
            ("apache", "http:apache", "os:linux"),
            ("proxmox", "http:proxmox", "os:proxmox"),
            ("esxi", "http:esxi", "os:esxi"),
            ("openssh", "ssh:openssh", "os:linux"),
            ("windows", "smb:windows", "os:windows"),
        ];
        for (needle, signal, os_signal) in fingerprints {
            if text.contains(needle) {
                signals.insert(signal.into());
                if !os_signal.is_empty() {
                    signals.insert(os_signal.into());
                }
            }
        }
    }
    let fingerprint_text = banners
        .values()
        .map(|value| value.to_lowercase())
        .chain(std::iter::once(name.clone()))
        .collect::<Vec<_>>()
        .join(" ");
    if fingerprint_text.contains("windows 11") {
        signals.insert("os:windows-11".into());
    } else if fingerprint_text.contains("windows 10") {
        signals.insert("os:windows-10".into());
    }
    if fingerprint_text.contains("windows server")
        || ["server", "srv", "dc", "domain-controller"]
            .iter()
            .any(|token| name.split(['.', '-', '_']).any(|part| part == *token))
    {
        signals.insert("os:windows-server".into());
    }
    // SMB + the Windows RPC/RDP ports is a useful fallback when the host does
    // not expose a readable product banner.
    if ports.contains(&445)
        && (ports.contains(&135) || ports.contains(&139) || ports.contains(&3389))
    {
        signals.insert("smb:windows".into());
    }
    let mut history_signals = crate::history::signals(history.as_ref());
    signals.extend(history_signals.drain());
    DeviceFeatures {
        signals,
    }
}

fn normalized_device_type(device_type: &str, role: Option<&str>) -> String {
    match role {
        Some("router") => "router",
        Some("switch") => "switch",
        Some("firewall") => "firewall",
        Some("accessPoint") => "accessPoint",
        Some("printer") => "printer",
        Some("camera") => "camera",
        Some("nas") => "nas",
        Some("hypervisor") => "virtual",
        _ => match device_type {
            "networkDevice" => "unknown",
            value => value,
        },
    }
    .into()
}

async fn icmp_ping(ip: Ipv4Addr, timeout_ms: u64) -> Option<i64> {
    let started = Instant::now();
    let mut command = tokio::process::Command::new("ping");
    // NetScope is a GUI application. Prevent one visible console window from
    // being created for every host probe on Windows.
    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000);
    if cfg!(target_os = "windows") {
        command.args(["-n", "1", "-w", &timeout_ms.to_string(), &ip.to_string()]);
    } else {
        command.args([
            "-c",
            "1",
            "-W",
            &((timeout_ms / 1000).max(1)).to_string(),
            &ip.to_string(),
        ]);
    }
    match command.output().await {
        Ok(output) if output.status.success() => Some(started.elapsed().as_millis().max(1) as i64),
        Ok(_) => None,
        Err(error) => {
            warn!("ICMP ping {ip} failed to start: {error}");
            None
        }
    }
}

fn topology_edges(devices: &[Device], gateway: Option<&str>) -> Vec<NetworkEdge> {
    if devices.len() < 2 {
        return Vec::new();
    }
    let root = gateway
        .and_then(|ip| devices.iter().find(|device| device.ip == ip))
        .or_else(|| {
            devices
                .iter()
                .filter(|device| {
                    ["router", "firewall", "switch"].contains(&device.device_type.as_str())
                })
                .max_by_key(|device| device.confidence)
        })
        .or_else(|| {
            devices
                .iter()
                .filter(|device| device.device_type == "server")
                .max_by_key(|device| device.connection_count)
        })
        .or_else(|| devices.iter().max_by_key(|device| device.connection_count))
        .unwrap_or(&devices[0]);
    devices
        .iter()
        .filter(|device| device.id != root.id)
        .map(|device| NetworkEdge {
            id: format!("line-{}-{}", root.id, device.id),
            source: root.id.clone(),
            target: device.id.clone(),
            label: Some(
                if gateway == Some(root.ip.as_str()) {
                    "Default Gateway"
                } else {
                    "Network evidence"
                }
                .into(),
            ),
            manual: false,
            confidence: if gateway == Some(root.ip.as_str()) {
                90
            } else {
                35
            },
            evidence: if gateway == Some(root.ip.as_str()) {
                vec!["Default Gateway".into(), "ARP".into()]
            } else {
                vec!["ARP / service proximity".into()]
            },
            active: device.status == "online",
        })
        .collect()
}

fn parse_cidr(value: &str) -> Result<(Ipv4Addr, u8), String> {
    let (ip, prefix) = value
        .trim()
        .split_once('/')
        .ok_or("CIDR должен иметь формат адрес/префикс, например 192.168.1.0/24.")?;
    let ip = ip
        .parse::<Ipv4Addr>()
        .map_err(|_| "Некорректный IPv4-адрес.")?;
    let prefix = prefix
        .parse::<u8>()
        .map_err(|_| "Некорректная длина префикса.")?;
    if !(16..=32).contains(&prefix) {
        return Err("Поддерживаются префиксы от /16 до /32.".into());
    }
    Ok((ip, prefix))
}
fn addresses(network: Ipv4Addr, prefix: u8) -> Vec<Ipv4Addr> {
    let mask = u32::MAX << (32 - prefix);
    let first = u32::from(network) & mask;
    let last = first | !mask;
    let (start, end) = if prefix <= 30 {
        (first.saturating_add(1), last.saturating_sub(1))
    } else {
        (first, last)
    };
    (start..=end).map(Ipv4Addr::from).collect()
}

async fn arp_table() -> HashMap<String, String> {
    let mut command = tokio::process::Command::new("arp");
    command.arg("-a");
    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000);
    let output = match command.output().await {
        Ok(output) => output,
        Err(error) => {
            warn!("failed to read ARP table: {error}");
            return HashMap::new();
        }
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let mut table = HashMap::new();
    for line in text.lines() {
        let parts: Vec<_> = line.split_whitespace().collect();
        if parts.len() >= 2 && parts[0].parse::<Ipv4Addr>().is_ok() {
            if let Some(mac) = parts
                .iter()
                .find(|part| part.replace('-', ":").split(':').count() == 6)
            {
                table.insert(parts[0].into(), mac.replace('-', ":").to_uppercase());
            }
        }
    }
    table
}

async fn default_gateway() -> Option<String> {
    let mut command = tokio::process::Command::new(if cfg!(target_os = "windows") {
        "route"
    } else {
        "ip"
    });
    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000);
    if cfg!(target_os = "windows") {
        command.args(["print", "-4"]);
    } else {
        command.args(["route", "show", "default"]);
    }
    let output = match command.output().await {
        Ok(output) => output,
        Err(error) => {
            warn!("failed to read default gateway: {error}");
            return None;
        }
    };
    let text = String::from_utf8_lossy(&output.stdout);
    if cfg!(target_os = "windows") {
        // `route print -4` starts a default-route row with two 0.0.0.0
        // values. The gateway is the third column, so looking for the first
        // IPv4 address incorrectly selected 0.0.0.0 and returned no gateway.
        text.lines()
            .filter_map(|line| {
                let parts: Vec<_> = line.split_whitespace().collect();
                if parts.len() >= 3 && parts[0] == "0.0.0.0" && parts[1] == "0.0.0.0" {
                    parts[2].parse::<Ipv4Addr>().ok()
                } else {
                    None
                }
            })
            .find(|ip| !ip.is_unspecified() && !ip.is_broadcast())
            .map(|ip| ip.to_string())
    } else {
        text.split_whitespace()
            .skip_while(|part| *part != "via")
            .nth(1)
            .and_then(|part| part.parse::<Ipv4Addr>().ok())
            .filter(|ip| !ip.is_unspecified() && !ip.is_broadcast())
            .map(|ip| ip.to_string())
    }
}

fn oui_vendor(mac: &str) -> Option<String> {
    let oui = mac.replace(':', "").to_uppercase();
    let oui = oui.get(0..6)?;
    let vendor = match oui {
        "001132" => "Synology",
        "00155D" => "Microsoft",
        "B827EB" => "Raspberry Pi",
        "C006C3" => "Hikvision",
        "A45E60" => "Ubiquiti",
        "3C5282" => "Dell",
        _ => return None,
    };
    Some(vendor.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;

    #[test]
    fn cidr_address_generation_excludes_network_and_broadcast() {
        let (network, prefix) = parse_cidr("192.168.1.99/30").expect("valid CIDR");
        assert_eq!(
            addresses(network, prefix),
            vec![
                Ipv4Addr::new(192, 168, 1, 97),
                Ipv4Addr::new(192, 168, 1, 98)
            ]
        );
    }

    #[tokio::test]
    async fn scan_pipeline_pings_and_persists_result() {
        let path = std::env::temp_dir().join(format!(
            "netscope-scan-test-{}.sqlite",
            uuid::Uuid::new_v4()
        ));
        let database = Database::open(&path)
            .await
            .expect("database opens and migrates");
        let state = Arc::new(ScanState::default());
        let result = scan(
            ScanConfig {
                subnet: "127.0.0.1/32".into(),
                interface_name: "loopback".into(),
                timeout: 100,
                threads: 2,
            },
            state,
            &database,
        )
        .await
        .expect("scan completes");
        assert_eq!(result.scanned, 1);
        assert!(result.devices.iter().any(|device| device.ip == "127.0.0.1"));
        assert_eq!(
            database.devices().await.expect("devices load").len(),
            result.devices.len()
        );
        drop(database);
        let _ = std::fs::remove_file(path);
    }
}
