mod config;
mod crosshair;
mod display;
mod nvidia;
mod stats;
mod store;
mod stretch;
mod sys;

use serde::Serialize;
use std::path::Path;
use store::{AppSettings, Profile};

type Res<T> = Result<T, String>;

// ── Store ────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct InitialState {
    settings: AppSettings,
    profiles: Vec<Profile>,
    data_dir: String,
}

#[tauri::command]
fn get_state() -> InitialState {
    InitialState {
        settings: store::load_settings(),
        profiles: store::load_profiles(),
        data_dir: store::data_dir().to_string_lossy().into(),
    }
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Res<()> {
    store::write_settings(&settings)
}

#[tauri::command]
fn save_profiles(profiles: Vec<Profile>) -> Res<()> {
    store::write_profiles(&profiles)
}

#[tauri::command]
fn new_id() -> String {
    store::new_id()
}

#[derive(Serialize)]
struct PathStatus {
    source: bool,
    base: bool,
    riot: bool,
}

#[tauri::command]
fn check_paths(settings: AppSettings) -> PathStatus {
    PathStatus {
        source: Path::new(&settings.source_config_path).is_dir(),
        base: Path::new(&settings.valorant_config_base).is_dir(),
        riot: Path::new(&settings.riot_client_path).is_file(),
    }
}

// ── Configs / Launch ─────────────────────────────────────────────────────────

#[tauri::command]
fn list_config_folders(base: String) -> Res<Vec<config::ConfigFolder>> {
    config::list_folders(&base)
}

#[tauri::command]
fn apply_config(source: String, base: String, folder_id: String, res_x: i32, res_y: i32) -> Res<usize> {
    config::apply_config(&source, &base, &folder_id, res_x, res_y)
}

#[tauri::command]
fn change_resolution(width: u32, height: u32, hz: f64, stretch: bool) -> Res<()> {
    display::change_resolution(width, height, hz.round() as u32, stretch)
}

#[tauri::command]
fn list_display_modes() -> Vec<display::DisplayMode> {
    display::list_modes()
}

#[tauri::command]
fn launch_valorant(riot_path: String, width: u32, height: u32, hz: f64) -> Res<Option<String>> {
    // Auflösungsfehler nicht fatal — Valorant trotzdem starten, aber Warnung zurückgeben
    let warning = display::change_resolution(width, height, hz.round() as u32, true).err();
    config::launch_riot(&riot_path)?;
    Ok(warning)
}

// ── Stretched ────────────────────────────────────────────────────────────────

#[tauri::command]
async fn stretch_status(width: u32, height: u32) -> Res<stretch::StretchStatus> {
    tauri::async_runtime::spawn_blocking(move || stretch::status(width, height))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_monitors_enabled(enabled: bool) -> Res<Vec<stretch::Monitor>> {
    tauri::async_runtime::spawn_blocking(move || stretch::set_monitors_enabled(enabled))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn nvidia_list_custom() -> Res<Vec<nvidia::CustomResolution>> {
    nvidia::list_custom()
}

#[tauri::command]
async fn nvidia_create_custom(width: u32, height: u32) -> Res<()> {
    tauri::async_runtime::spawn_blocking(move || nvidia::create_custom(width, height))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn nvidia_delete_custom(width: u32, height: u32) -> Res<()> {
    tauri::async_runtime::spawn_blocking(move || nvidia::delete_custom(width, height))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn open_nvidia_panel() -> Res<()> {
    stretch::open_nvidia_panel()
}

#[tauri::command]
fn open_device_manager() -> Res<()> {
    stretch::open_device_manager()
}

#[tauri::command]
fn reset_valorant_config(base: String) -> Res<String> {
    stretch::reset_config(&base)
}

// ── Crosshair ────────────────────────────────────────────────────────────────

#[tauri::command]
fn crosshair_paths(base: String, folder_id: Option<String>) -> Vec<String> {
    let base = Path::new(&base);
    let mut candidates = Vec::new();
    if let Some(fid) = folder_id {
        candidates.push(base.join(&fid).join("Windows").join("RiotUserSettings.ini"));
        candidates.push(base.join(&fid).join("WindowsClient").join("RiotUserSettings.ini"));
    }
    candidates.push(base.join("WindowsClient").join("RiotUserSettings.ini"));
    candidates.into_iter().filter(|p| p.exists()).map(|p| p.to_string_lossy().into()).collect()
}

#[tauri::command]
fn crosshair_load(paths: Vec<String>) -> Res<crosshair::CrosshairState> {
    crosshair::load(&paths)
}

#[tauri::command]
fn crosshair_set_active(paths: Vec<String>, index: usize) -> Res<crosshair::CrosshairState> {
    crosshair::set_active(&paths, index)
}

#[tauri::command]
fn crosshair_apply_pro(paths: Vec<String>, pro: crosshair::ProCrosshair) -> Res<crosshair::CrosshairState> {
    crosshair::apply_pro(&paths, &pro)
}

#[tauri::command]
fn crosshair_load_default(paths: Vec<String>) -> Res<crosshair::CrosshairState> {
    crosshair::load_default(&paths)
}

// ── Stats ────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn henrik_get(state: tauri::State<'_, stats::StatsState>, path: String, ttl: u64, api_key: String) -> Res<String> {
    state.get(&path, ttl, &api_key).await
}

#[tauri::command]
async fn competitive_tiers(state: tauri::State<'_, stats::StatsState>) -> Res<String> {
    state.competitive_tiers().await
}

#[tauri::command]
fn henrik_invalidate(state: tauri::State<'_, stats::StatsState>, fragment: String) {
    state.invalidate(&fragment)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    store::migrate_legacy();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(stats::StatsState::default())
        .invoke_handler(tauri::generate_handler![
            get_state,
            save_settings,
            save_profiles,
            new_id,
            check_paths,
            list_config_folders,
            apply_config,
            change_resolution,
            list_display_modes,
            launch_valorant,
            stretch_status,
            set_monitors_enabled,
            nvidia_list_custom,
            nvidia_create_custom,
            nvidia_delete_custom,
            open_nvidia_panel,
            open_device_manager,
            reset_valorant_config,
            crosshair_paths,
            crosshair_load,
            crosshair_set_active,
            crosshair_apply_pro,
            crosshair_load_default,
            henrik_get,
            henrik_invalidate,
            competitive_tiers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
