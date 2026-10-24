//! Persistente Einstellungen + Profile.
//! JSON-Format ist kompatibel zur alten WPF-Version (PascalCase-Keys),
//! damit settings.json / profiles.json beim ersten Start übernommen werden können.

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, time::SystemTime};

fn user_profile() -> PathBuf {
    std::env::var("USERPROFILE").map(PathBuf::from).unwrap_or_default()
}

fn default_source() -> String {
    user_profile().join("Desktop").join("Valorant Configs").to_string_lossy().into()
}
fn default_base() -> String {
    user_profile()
        .join("AppData").join("Local").join("VALORANT").join("Saved").join("Config")
        .to_string_lossy().into()
}
fn default_riot() -> String {
    r"C:\Riot Games\Riot Client\RiotClientServices.exe".into()
}
fn default_native_x() -> i32 { 1920 }
fn default_native_y() -> i32 { 1080 }
fn default_hz() -> f64 { 239.96 }

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "PascalCase")]
pub struct AppSettings {
    #[serde(default = "default_source")]
    pub source_config_path: String,
    #[serde(default = "default_base")]
    pub valorant_config_base: String,
    #[serde(default = "default_riot")]
    pub riot_client_path: String,
    #[serde(default)]
    pub henrik_api_key: String,
    #[serde(default)]
    pub henrik_name: String,
    #[serde(default)]
    pub henrik_tag: String,
    /// Native Monitor-Auflösung für "Auflösung zurücksetzen"
    #[serde(default = "default_native_x")]
    pub native_x: i32,
    #[serde(default = "default_native_y")]
    pub native_y: i32,
}

impl Default for AppSettings {
    fn default() -> Self {
        serde_json::from_str("{}").unwrap()
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "PascalCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub folder_id: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub resolution_x: Option<i32>,
    #[serde(default)]
    pub resolution_y: Option<i32>,
    #[serde(default = "default_hz")]
    pub refresh_rate: f64,
}

pub fn data_dir() -> PathBuf {
    let base = std::env::var("APPDATA").map(PathBuf::from).unwrap_or_else(|_| user_profile());
    let dir = base.join("ValorantConfigManager");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn settings_path() -> PathBuf { data_dir().join("settings.json") }
fn profiles_path() -> PathBuf { data_dir().join("profiles.json") }

/// Ordner, in denen die alte WPF-App settings.json/profiles.json abgelegt hat.
fn legacy_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(d) = exe.parent() { dirs.push(d.to_path_buf()); }
    }
    let old = user_profile().join("Documents").join("ValorantConfigManager").join("ValorantConfigManager").join("bin");
    for cfg in ["Debug", "Release"] {
        let b = old.join(cfg).join("net8.0-windows");
        dirs.push(b.join("publish"));
        dirs.push(b.join("win-x64"));
        dirs.push(b);
    }
    dirs
}

fn mtime(p: &PathBuf) -> SystemTime {
    fs::metadata(p).and_then(|m| m.modified()).unwrap_or(SystemTime::UNIX_EPOCH)
}

/// Kopiert beim allerersten Start die neueste alte settings.json/profiles.json.
pub fn migrate_legacy() {
    for (file, target) in [("settings.json", settings_path()), ("profiles.json", profiles_path())] {
        if target.exists() { continue; }
        let newest = legacy_dirs()
            .into_iter()
            .map(|d| d.join(file))
            .filter(|p| p.exists())
            .max_by_key(mtime);
        if let Some(src) = newest {
            let _ = fs::copy(src, &target);
        }
    }
}

fn read_json<T: for<'de> Deserialize<'de>>(path: PathBuf) -> Option<T> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(text.trim_start_matches('\u{feff}')).ok()
}

pub fn load_settings() -> AppSettings {
    read_json(settings_path()).unwrap_or_default()
}

pub fn load_profiles() -> Vec<Profile> {
    read_json(profiles_path()).unwrap_or_default()
}

pub fn write_settings(s: &AppSettings) -> Result<(), String> {
    let json = serde_json::to_string_pretty(s).map_err(|e| e.to_string())?;
    fs::write(settings_path(), json).map_err(|e| e.to_string())
}

pub fn write_profiles(p: &[Profile]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(p).map_err(|e| e.to_string())?;
    fs::write(profiles_path(), json).map_err(|e| e.to_string())
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}
