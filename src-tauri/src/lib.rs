mod classification;
mod commands;
mod database;
mod device;
mod history;
mod scanner;

use database::Database;
use scanner::ScanState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .try_init();
    log::info!("NetScope starting");
    tauri::Builder::default()
        .manage(ScanState::default())
        .setup(|app| {
            let path = app
                .path()
                .app_data_dir()
                .expect("не удалось определить каталог данных");
            std::fs::create_dir_all(&path).expect("не удалось создать каталог данных");
            log::info!("opening database at {}", path.display());
            let database =
                tauri::async_runtime::block_on(Database::open(path.join("netscope.sqlite")))
                    .expect("не удалось открыть базу NetScope");
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_network_interfaces,
            commands::list_devices,
            commands::list_events,
            commands::list_edges,
            commands::get_map_view,
            commands::save_map_view,
            commands::add_device,
            commands::delete_device,
            commands::delete_devices,
            commands::save_edge,
            commands::delete_edge,
            commands::scan_subnet,
            commands::stop_scan,
            commands::update_device
        ])
        .run(tauri::generate_context!())
        .expect("ошибка запуска приложения NetScope");
}
