//! Config-Ordner auflisten, INIs kopieren + patchen, Valorant starten.

use serde::Serialize;
use std::{fs, path::Path, process::Command, time::SystemTime};

const GAME_USER_SETTINGS: &str = "GameUserSettings.ini";
const RIOT_USER_SETTINGS: &str = "RiotUserSettings.ini";
/// Ordner im Config-Verzeichnis, die keine Account-Ordner sind
const NON_ACCOUNT_DIRS: [&str; 2] = ["WindowsClient", "CrashReportClient"];

#[derive(Serialize)]
pub struct ConfigFolder {
    pub id: String,
    pub modified: i64,
}

pub fn list_folders(base: &str) -> Result<Vec<ConfigFolder>, String> {
    let entries = fs::read_dir(base).map_err(|_| format!("Config-Ordner nicht gefunden: {base}"))?;
    let mut folders: Vec<ConfigFolder> = entries
        .flatten()
        .filter(|e| e.path().is_dir())
        .filter_map(|e| {
            let id = e.file_name().to_string_lossy().to_string();
            if NON_ACCOUNT_DIRS.contains(&id.as_str()) {
                return None;
            }
            let modified = e
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            Some(ConfigFolder { id, modified })
        })
        .collect();
    folders.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(folders)
}

/// Ersetzt `Key=...`-Zeilen in einer INI. Zeilenenden bleiben erhalten.
fn patch_ini(path: &Path, values: &[(&str, String)]) -> Result<(), String> {
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let eol = if text.contains("\r\n") { "\r\n" } else { "\n" };
    let patched: Vec<String> = text
        .split(eol)
        .map(|line| {
            for (key, val) in values {
                if line.starts_with(&format!("{key}=")) {
                    return format!("{key}={val}");
                }
            }
            line.to_string()
        })
        .collect();
    fs::write(path, patched.join(eol)).map_err(|e| e.to_string())
}

fn patch_game_settings(path: &Path, res_x: i32, res_y: i32) -> Result<(), String> {
    patch_ini(
        path,
        &[
            ("ResolutionSizeX", res_x.to_string()),
            ("ResolutionSizeY", res_y.to_string()),
            ("LastUserConfirmedResolutionSizeX", res_x.to_string()),
            ("LastUserConfirmedResolutionSizeY", res_y.to_string()),
            // "Ausfüllen" statt Letterbox
            ("bShouldLetterbox", "False".into()),
            ("bLastConfirmedShouldLetterbox", "False".into()),
        ],
    )
}

/// Kopiert die Quell-INIs in <Base>\<Folder>\Windows, \WindowsClient und <Base>\WindowsClient.
pub fn apply_config(source: &str, base: &str, folder_id: &str, res_x: i32, res_y: i32) -> Result<usize, String> {
    let source = Path::new(source);
    let base = Path::new(base);
    for file in [GAME_USER_SETTINGS, RIOT_USER_SETTINGS] {
        if !source.join(file).exists() {
            return Err(format!("Quelldatei nicht gefunden: {}", source.join(file).display()));
        }
    }

    let targets = [
        base.join(folder_id).join("Windows"),
        base.join(folder_id).join("WindowsClient"),
        base.join("WindowsClient"),
    ];

    let mut copied = 0;
    for dir in targets {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        for file in [GAME_USER_SETTINGS, RIOT_USER_SETTINGS] {
            let dst = dir.join(file);
            fs::copy(source.join(file), &dst).map_err(|e| format!("{}: {e}", dst.display()))?;
            if file == GAME_USER_SETTINGS {
                patch_game_settings(&dst, res_x, res_y)?;
            }
            copied += 1;
        }
    }
    Ok(copied)
}

pub fn launch_riot(riot_path: &str) -> Result<(), String> {
    if !Path::new(riot_path).exists() {
        return Err("Riot Client nicht gefunden. Bitte Pfad in den Einstellungen setzen.".into());
    }
    Command::new(riot_path)
        .args(["--launch-product=valorant", "--launch-patchline=live"])
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Riot Client konnte nicht gestartet werden: {e}"))
}
