use crate::device::{
    Device, DeviceUpdate, MapView, NetworkEdge, NetworkEvent, NewDeviceInput, Position,
};
use log::{debug, error, info, warn};
use serde::{de::DeserializeOwned, Serialize};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    Row, SqlitePool,
};
use std::path::Path;

pub struct Database {
    pub pool: SqlitePool,
}

impl Database {
    pub async fn open(path: impl AsRef<Path>) -> Result<Self, sqlx::Error> {
        let options = SqliteConnectOptions::new()
            .filename(path.as_ref())
            .create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(8)
            .connect_with(options)
            .await?;
        sqlx::query("PRAGMA journal_mode = WAL")
            .execute(&pool)
            .await?;
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await?;
        sqlx::query("CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, hostname TEXT NOT NULL, ip TEXT NOT NULL UNIQUE, ipv6 TEXT, mac TEXT, vendor TEXT, os TEXT, device_type TEXT NOT NULL, role TEXT, status TEXT NOT NULL, latency INTEGER, last_seen TEXT NOT NULL, subnet TEXT NOT NULL, ports TEXT NOT NULL DEFAULT '[]', udp_ports TEXT NOT NULL DEFAULT '[]', dns_name TEXT, netbios_name TEXT, mdns_name TEXT, upnp_name TEXT, dhcp_hostname TEXT, snmp_sys_name TEXT, snmp_description TEXT, ttl INTEGER, os_fingerprint TEXT, banners TEXT NOT NULL DEFAULT '{}', matched_features TEXT NOT NULL DEFAULT '[]', alternative_types TEXT NOT NULL DEFAULT '[]', first_seen TEXT NOT NULL DEFAULT '', last_discovered TEXT NOT NULL DEFAULT '', discovery_count INTEGER NOT NULL DEFAULT 1, confidence INTEGER NOT NULL DEFAULT 0, services_count INTEGER NOT NULL DEFAULT 0, connection_count INTEGER NOT NULL DEFAULT 0, pos_x REAL NOT NULL DEFAULT 0, pos_y REAL NOT NULL DEFAULT 0, note TEXT, manual INTEGER NOT NULL DEFAULT 0)").execute(&pool).await?;
        for (name, definition) in [
            ("udp_ports", "TEXT NOT NULL DEFAULT '[]'"),
            ("dns_name", "TEXT"),
            ("netbios_name", "TEXT"),
            ("mdns_name", "TEXT"),
            ("upnp_name", "TEXT"),
            ("dhcp_hostname", "TEXT"),
            ("snmp_sys_name", "TEXT"),
            ("snmp_description", "TEXT"),
            ("ttl", "INTEGER"),
            ("os_fingerprint", "TEXT"),
            ("banners", "TEXT NOT NULL DEFAULT '{}'"),
            ("role", "TEXT"),
            ("matched_features", "TEXT NOT NULL DEFAULT '[]'"),
            ("alternative_types", "TEXT NOT NULL DEFAULT '[]'"),
            ("negative_features", "TEXT NOT NULL DEFAULT '[]'"),
            ("roles", "TEXT NOT NULL DEFAULT '[]'"),
            ("hierarchy", "TEXT NOT NULL DEFAULT '[]'"),
            ("os_confidence", "INTEGER NOT NULL DEFAULT 0"),
            ("first_seen", "TEXT NOT NULL DEFAULT ''"),
            ("last_discovered", "TEXT NOT NULL DEFAULT ''"),
            ("discovery_count", "INTEGER NOT NULL DEFAULT 1"),
            ("confidence", "INTEGER NOT NULL DEFAULT 0"),
            ("services_count", "INTEGER NOT NULL DEFAULT 0"),
            ("connection_count", "INTEGER NOT NULL DEFAULT 0"),
            ("manual", "INTEGER NOT NULL DEFAULT 0"),
        ] {
            ensure_column(&pool, "devices", name, definition).await?;
        }
        sqlx::query("CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT NOT NULL, detail TEXT NOT NULL, time TEXT NOT NULL, kind TEXT NOT NULL)").execute(&pool).await?;
        sqlx::query("CREATE TABLE IF NOT EXISTS classification_history (id INTEGER PRIMARY KEY AUTOINCREMENT, device_ip TEXT NOT NULL, time TEXT NOT NULL, device_type TEXT NOT NULL, role TEXT, confidence INTEGER NOT NULL, matched_features TEXT NOT NULL DEFAULT '[]')").execute(&pool).await?;
        sqlx::query("CREATE TABLE IF NOT EXISTS edges (id TEXT PRIMARY KEY, source TEXT NOT NULL, target TEXT NOT NULL, label TEXT, manual INTEGER NOT NULL DEFAULT 0, confidence INTEGER NOT NULL DEFAULT 0, evidence TEXT NOT NULL DEFAULT '[]', active INTEGER NOT NULL DEFAULT 1, source_handle TEXT, target_handle TEXT)").execute(&pool).await?;
        for (name, definition) in [
            ("confidence", "INTEGER NOT NULL DEFAULT 0"),
            ("evidence", "TEXT NOT NULL DEFAULT '[]'"),
            ("active", "INTEGER NOT NULL DEFAULT 1"),
            ("source_handle", "TEXT"),
            ("target_handle", "TEXT"),
        ] {
            ensure_column(&pool, "edges", name, definition).await?;
        }
        info!("database schema is ready");
        sqlx::query("CREATE TABLE IF NOT EXISTS map_settings (id INTEGER PRIMARY KEY CHECK (id = 1), x REAL NOT NULL DEFAULT 0, y REAL NOT NULL DEFAULT 0, zoom REAL NOT NULL DEFAULT 1)").execute(&pool).await?;
        Ok(Self { pool })
    }

    pub async fn devices(&self) -> Result<Vec<Device>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM devices ORDER BY ip")
            .fetch_all(&self.pool)
            .await?;
        rows.into_iter().map(row_device).collect()
    }

    pub async fn classification_history(
        &self,
        ip: &str,
    ) -> Result<Option<crate::history::ClassificationHistory>, sqlx::Error> {
        let row = sqlx::query("SELECT device_type,role,confidence FROM classification_history WHERE device_ip=? ORDER BY id DESC LIMIT 1")
            .bind(ip)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|row| crate::history::ClassificationHistory {
            device_type: row.try_get("device_type").ok(),
            role: row.try_get("role").ok(),
            confidence: row.try_get("confidence").unwrap_or(0),
        }))
    }

    pub async fn save_classification_snapshot(
        &self,
        ip: &str,
        device: &Device,
    ) -> Result<(), sqlx::Error> {
        let features = serialize_json(&device.matched_features, "history.matched_features")?;
        sqlx::query("INSERT INTO classification_history (device_ip,time,device_type,role,confidence,matched_features) VALUES (?,?,?,?,?,?)")
            .bind(ip).bind(&device.last_discovered).bind(&device.device_type).bind(&device.role).bind(device.confidence).bind(features).execute(&self.pool).await?;
        sqlx::query("DELETE FROM classification_history WHERE device_ip=? AND id NOT IN (SELECT id FROM classification_history WHERE device_ip=? ORDER BY id DESC LIMIT 30)")
            .bind(ip).bind(ip).execute(&self.pool).await?;
        Ok(())
    }

    pub async fn events(&self) -> Result<Vec<NetworkEvent>, sqlx::Error> {
        sqlx::query_as::<_, (String, String, String, String, String)>(
            "SELECT id,title,detail,time,kind FROM events ORDER BY time DESC LIMIT 100",
        )
        .fetch_all(&self.pool)
        .await
        .map(|rows| {
            rows.into_iter()
                .map(|(id, title, detail, time, kind)| NetworkEvent {
                    id,
                    title,
                    detail,
                    time,
                    kind,
                })
                .collect()
        })
    }

    pub async fn edges(&self) -> Result<Vec<NetworkEdge>, sqlx::Error> {
        let rows = sqlx::query("SELECT id,source,target,label,manual,confidence,evidence,active,source_handle,target_handle FROM edges ORDER BY id").fetch_all(&self.pool).await?;
        rows.into_iter()
            .map(|row| {
                Ok(NetworkEdge {
                    id: row.try_get("id")?,
                    source: row.try_get("source")?,
                    target: row.try_get("target")?,
                    label: row.try_get("label")?,
                    manual: row.try_get::<i64, _>("manual")? != 0,
                    confidence: row.try_get("confidence")?,
                    evidence: parse_json_text(
                        &row.try_get::<String, _>("evidence")?,
                        "edges.evidence",
                    )?,
                    active: row.try_get::<i64, _>("active")? != 0,
                    source_handle: row.try_get("source_handle")?,
                    target_handle: row.try_get("target_handle")?,
                })
            })
            .collect()
    }

    pub async fn save_scan(
        &self,
        subnet: &str,
        devices: &[Device],
        edges: &[NetworkEdge],
    ) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE devices SET status='offline', latency=NULL WHERE subnet=? AND manual=0",
        )
        .bind(subnet)
        .execute(&mut *tx)
        .await?;
        for device in devices {
            let ports = serialize_json(&device.ports, "devices.ports")?;
            let udp_ports = serialize_json(&device.udp_ports, "devices.udp_ports")?;
            let banners = device.banners.to_string();
            let matched_features =
                serialize_json(&device.matched_features, "devices.matched_features")?;
            let alternative_types =
                serialize_json(&device.alternative_types, "devices.alternative_types")?;
            let negative_features =
                serialize_json(&device.negative_features, "devices.negative_features")?;
            let roles = serialize_json(&device.roles, "devices.roles")?;
            let hierarchy = serialize_json(&device.hierarchy, "devices.hierarchy")?;
            sqlx::query("INSERT INTO devices (id,hostname,ip,ipv6,mac,vendor,os,device_type,role,status,latency,last_seen,subnet,ports,udp_ports,dns_name,netbios_name,mdns_name,upnp_name,dhcp_hostname,snmp_sys_name,snmp_description,ttl,os_fingerprint,banners,matched_features,alternative_types,negative_features,roles,hierarchy,os_confidence,first_seen,last_discovered,discovery_count,confidence,services_count,connection_count,pos_x,pos_y,note,manual) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0) ON CONFLICT(ip) DO UPDATE SET id=excluded.id,hostname=excluded.hostname,ipv6=COALESCE(excluded.ipv6,devices.ipv6),mac=COALESCE(excluded.mac,devices.mac),vendor=COALESCE(excluded.vendor,devices.vendor),os=COALESCE(excluded.os,devices.os),device_type=CASE WHEN devices.manual=1 THEN devices.device_type ELSE excluded.device_type END,role=excluded.role,status=excluded.status,latency=excluded.latency,last_seen=excluded.last_seen,subnet=excluded.subnet,ports=excluded.ports,udp_ports=excluded.udp_ports,dns_name=excluded.dns_name,netbios_name=excluded.netbios_name,mdns_name=excluded.mdns_name,upnp_name=excluded.upnp_name,dhcp_hostname=excluded.dhcp_hostname,snmp_sys_name=excluded.snmp_sys_name,snmp_description=excluded.snmp_description,ttl=excluded.ttl,os_fingerprint=excluded.os_fingerprint,banners=excluded.banners,matched_features=excluded.matched_features,alternative_types=excluded.alternative_types,negative_features=excluded.negative_features,roles=excluded.roles,hierarchy=excluded.hierarchy,os_confidence=excluded.os_confidence,last_discovered=excluded.last_discovered,discovery_count=devices.discovery_count+1,confidence=excluded.confidence,services_count=excluded.services_count,connection_count=excluded.connection_count")
                .bind(&device.id).bind(&device.hostname).bind(&device.ip).bind(&device.ipv6).bind(&device.mac).bind(&device.vendor).bind(&device.os).bind(&device.device_type).bind(&device.role).bind(&device.status).bind(device.latency).bind(&device.last_seen).bind(subnet).bind(ports).bind(udp_ports).bind(&device.dns_name).bind(&device.netbios_name).bind(&device.mdns_name).bind(&device.upnp_name).bind(&device.dhcp_hostname).bind(&device.snmp_sys_name).bind(&device.snmp_description).bind(device.ttl).bind(&device.os_fingerprint).bind(banners).bind(matched_features).bind(alternative_types).bind(negative_features).bind(roles).bind(hierarchy).bind(device.os_confidence).bind(&now).bind(&now).bind(device.discovery_count.max(1)).bind(device.confidence).bind(device.services_count).bind(device.connection_count).bind(device.position.x).bind(device.position.y).bind(&device.note).execute(&mut *tx).await?;
        }
        sqlx::query("DELETE FROM edges WHERE manual=0")
            .execute(&mut *tx)
            .await?;
        for edge in edges {
            let evidence = serialize_json(&edge.evidence, "edges.evidence")?;
            sqlx::query("INSERT INTO edges (id,source,target,label,manual,confidence,evidence,active,source_handle,target_handle) VALUES (?,?,?,?,0,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source=excluded.source,target=excluded.target,label=excluded.label,confidence=excluded.confidence,evidence=excluded.evidence,active=excluded.active,source_handle=excluded.source_handle,target_handle=excluded.target_handle").bind(&edge.id).bind(&edge.source).bind(&edge.target).bind(&edge.label).bind(edge.confidence).bind(evidence).bind(if edge.active {1} else {0}).bind(&edge.source_handle).bind(&edge.target_handle).execute(&mut *tx).await?;
        }
        sqlx::query("INSERT INTO events (id,title,detail,time,kind) VALUES (?,?,?,?,?)")
            .bind(uuid::Uuid::new_v4().to_string())
            .bind("Сканирование завершено")
            .bind(format!(
                "{} · обнаружено {} устройств, история обновлена",
                subnet,
                devices.len()
            ))
            .bind(&now)
            .bind("scan")
            .execute(&mut *tx)
            .await?;
        tx.commit().await
    }

    pub async fn update_device(
        &self,
        id: &str,
        changes: &DeviceUpdate,
    ) -> Result<Device, sqlx::Error> {
        if let Some(value) = &changes.hostname {
            sqlx::query("UPDATE devices SET hostname=? WHERE id=?")
                .bind(value)
                .bind(id)
                .execute(&self.pool)
                .await?;
        }
        if let Some(value) = &changes.note {
            sqlx::query("UPDATE devices SET note=? WHERE id=?")
                .bind(value)
                .bind(id)
                .execute(&self.pool)
                .await?;
        }
        if let Some(value) = &changes.device_type {
            sqlx::query("UPDATE devices SET device_type=? WHERE id=?")
                .bind(value)
                .bind(id)
                .execute(&self.pool)
                .await?;
        }
        if let Some(position) = &changes.position {
            sqlx::query("UPDATE devices SET pos_x=?,pos_y=? WHERE id=?")
                .bind(position.x)
                .bind(position.y)
                .bind(id)
                .execute(&self.pool)
                .await?;
        }
        self.devices()
            .await?
            .into_iter()
            .find(|device| device.id == id)
            .ok_or(sqlx::Error::RowNotFound)
    }

    pub async fn add_device(&self, input: &NewDeviceInput) -> Result<Device, sqlx::Error> {
        let now = chrono::Utc::now().to_rfc3339();
        let device = Device {
            id: format!("manual-{}", uuid::Uuid::new_v4()),
            hostname: if input.hostname.trim().is_empty() {
                input.ip.clone()
            } else {
                input.hostname.clone()
            },
            ip: input.ip.clone(),
            ipv6: None,
            mac: None,
            vendor: None,
            os: None,
            device_type: input.device_type.clone(),
            role: None,
            status: "unknown".into(),
            latency: None,
            last_seen: "Никогда".into(),
            subnet: "manual".into(),
            ports: Vec::new(),
            udp_ports: Vec::new(),
            dns_name: None,
            netbios_name: None,
            mdns_name: None,
            upnp_name: None,
            dhcp_hostname: None,
            snmp_sys_name: None,
            snmp_description: None,
            ttl: None,
            os_fingerprint: None,
            banners: serde_json::json!({}),
            matched_features: Vec::new(),
            alternative_types: Vec::new(),
            negative_features: Vec::new(),
            roles: Vec::new(),
            hierarchy: Vec::new(),
            os_confidence: 0,
            first_seen: now.clone(),
            last_discovered: now,
            discovery_count: 1,
            confidence: 0,
            services_count: 0,
            connection_count: 0,
            position: input.position.clone(),
            note: input.note.clone(),
            manual: true,
        };
        sqlx::query("INSERT INTO devices (id,hostname,ip,device_type,role,status,last_seen,subnet,ports,udp_ports,banners,first_seen,last_discovered,discovery_count,pos_x,pos_y,note,manual) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)").bind(&device.id).bind(&device.hostname).bind(&device.ip).bind(&device.device_type).bind(&device.role).bind(&device.status).bind(&device.last_seen).bind(&device.subnet).bind("[]").bind("[]").bind("{}").bind(&device.first_seen).bind(&device.last_discovered).bind(1).bind(device.position.x).bind(device.position.y).bind(&device.note).execute(&self.pool).await?;
        Ok(device)
    }

    pub async fn delete_devices(&self, ids: &[String]) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        for id in ids {
            sqlx::query("DELETE FROM devices WHERE id=?")
                .bind(id)
                .execute(&mut *tx)
                .await?;
            sqlx::query("DELETE FROM edges WHERE source=? OR target=?")
                .bind(id)
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
        tx.commit().await
    }
    pub async fn delete_device(&self, id: &str) -> Result<(), sqlx::Error> {
        self.delete_devices(&[id.to_string()]).await
    }

    pub async fn save_edge(&self, edge: &NetworkEdge) -> Result<NetworkEdge, sqlx::Error> {
        let evidence = serialize_json(&edge.evidence, "edges.evidence")?;
        sqlx::query("INSERT INTO edges (id,source,target,label,manual,confidence,evidence,active,source_handle,target_handle) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source=excluded.source,target=excluded.target,label=excluded.label,manual=excluded.manual,confidence=excluded.confidence,evidence=excluded.evidence,active=excluded.active,source_handle=excluded.source_handle,target_handle=excluded.target_handle").bind(&edge.id).bind(&edge.source).bind(&edge.target).bind(&edge.label).bind(if edge.manual {1} else {0}).bind(edge.confidence).bind(evidence).bind(if edge.active {1} else {0}).bind(&edge.source_handle).bind(&edge.target_handle).execute(&self.pool).await?;
        Ok(edge.clone())
    }
    pub async fn delete_edge(&self, id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM edges WHERE id=?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map(|_| ())
    }
    pub async fn map_view(&self) -> Result<MapView, sqlx::Error> {
        sqlx::query("INSERT OR IGNORE INTO map_settings (id,x,y,zoom) VALUES (1,0,0,1)")
            .execute(&self.pool)
            .await?;
        sqlx::query_as::<_, (f64, f64, f64)>("SELECT x,y,zoom FROM map_settings WHERE id=1")
            .fetch_one(&self.pool)
            .await
            .map(|(x, y, zoom)| MapView { x, y, zoom })
    }
    pub async fn save_map_view(&self, view: &MapView) -> Result<(), sqlx::Error> {
        sqlx::query("INSERT INTO map_settings (id,x,y,zoom) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET x=excluded.x,y=excluded.y,zoom=excluded.zoom").bind(view.x).bind(view.y).bind(view.zoom).execute(&self.pool).await.map(|_| ())
    }
}

fn row_device(row: sqlx::sqlite::SqliteRow) -> Result<Device, sqlx::Error> {
    Ok(Device {
        id: row.try_get("id")?,
        hostname: row.try_get("hostname")?,
        ip: row.try_get("ip")?,
        ipv6: row.try_get("ipv6")?,
        mac: row.try_get("mac")?,
        vendor: row.try_get("vendor")?,
        os: row.try_get("os")?,
        device_type: row.try_get("device_type")?,
        role: row.try_get("role")?,
        status: row.try_get("status")?,
        latency: row.try_get("latency")?,
        last_seen: row.try_get("last_seen")?,
        subnet: row.try_get("subnet")?,
        ports: parse_json(&row, "ports")?,
        udp_ports: parse_json(&row, "udp_ports")?,
        dns_name: row.try_get("dns_name")?,
        netbios_name: row.try_get("netbios_name")?,
        mdns_name: row.try_get("mdns_name")?,
        upnp_name: row.try_get("upnp_name")?,
        dhcp_hostname: row.try_get("dhcp_hostname")?,
        snmp_sys_name: row.try_get("snmp_sys_name")?,
        snmp_description: row.try_get("snmp_description")?,
        ttl: row.try_get("ttl")?,
        os_fingerprint: row.try_get("os_fingerprint")?,
        banners: parse_json_text(&row.try_get::<String, _>("banners")?, "devices.banners")?,
        matched_features: parse_json(&row, "matched_features")?,
        alternative_types: parse_json(&row, "alternative_types")?,
        negative_features: parse_json(&row, "negative_features")?,
        roles: parse_json(&row, "roles")?,
        hierarchy: parse_json(&row, "hierarchy")?,
        os_confidence: row.try_get("os_confidence")?,
        first_seen: row.try_get("first_seen")?,
        last_discovered: row.try_get("last_discovered")?,
        discovery_count: row.try_get("discovery_count")?,
        confidence: row.try_get("confidence")?,
        services_count: row.try_get("services_count")?,
        connection_count: row.try_get("connection_count")?,
        position: Position {
            x: row.try_get("pos_x")?,
            y: row.try_get("pos_y")?,
        },
        note: row.try_get("note")?,
        manual: row.try_get::<i64, _>("manual")? != 0,
    })
}

fn ensure_column<'a>(
    pool: &'a SqlitePool,
    table: &'static str,
    name: &'static str,
    definition: &'static str,
) -> impl std::future::Future<Output = Result<(), sqlx::Error>> + 'a {
    async move {
        let rows = sqlx::query(&format!("PRAGMA table_info({table})"))
            .fetch_all(pool)
            .await?;
        if rows.iter().any(|row| {
            row.try_get::<String, _>("name")
                .map(|value| value == name)
                .unwrap_or(false)
        }) {
            debug!("database column already exists: {table}.{name}");
            return Ok(());
        }
        info!("migrating database: adding {table}.{name}");
        sqlx::query(&format!(
            "ALTER TABLE {table} ADD COLUMN {name} {definition}"
        ))
        .execute(pool)
        .await?;
        Ok(())
    }
}

fn serialize_json<T: Serialize>(value: &T, field: &str) -> Result<String, sqlx::Error> {
    serde_json::to_string(value).map_err(|error| {
        error!("JSON serialization failed for {field}: {error}");
        sqlx::Error::Protocol(format!("JSON serialization failed for {field}: {error}"))
    })
}

fn parse_json<T: DeserializeOwned + Default>(
    row: &sqlx::sqlite::SqliteRow,
    name: &str,
) -> Result<T, sqlx::Error> {
    let value = row.try_get::<String, _>(name)?;
    parse_json_text(&value, name)
}

fn parse_json_text<T: DeserializeOwned + Default>(
    value: &str,
    field: &str,
) -> Result<T, sqlx::Error> {
    serde_json::from_str(value).map_err(|error| {
        warn!("JSON deserialization failed for {field}: {error}");
        sqlx::Error::Protocol(format!("JSON deserialization failed for {field}: {error}"))
    })
}
