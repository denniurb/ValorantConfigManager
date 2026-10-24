//! Neue True-Stretched-Methode:
//! 1. Monitore im Geräte-Manager deaktivieren
//! 2. NVIDIA: benutzerdefinierte Auflösung + Skalierung "Vollbild" auf GPU
//! 3. Valorant Config-Ordner zurücksetzen (wir sichern ihn vorher)
//! 4. Ingame: Letterbox → Ausfüllen

use crate::{display, store, sys};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Serialize, Deserialize)]
pub struct Monitor {
    #[serde(rename = "FriendlyName")]
    pub name: Option<String>,
    #[serde(rename = "InstanceId")]
    pub instance_id: String,
    #[serde(rename = "Status")]
    pub status: Option<String>,
}

pub fn list_monitors() -> Result<Vec<Monitor>, String> {
    let json = sys::powershell(
        "ConvertTo-Json -Compress -InputObject @(Get-PnpDevice -Class Monitor -PresentOnly -ErrorAction SilentlyContinue | \
         Select-Object FriendlyName,InstanceId,@{n='Status';e={[string]$_.Status}})",
    )?;
    if json.is_empty() {
        return Ok(vec![]);
    }
    serde_json::from_str(&json).map_err(|e| format!("Monitorliste nicht lesbar: {e}"))
}

pub fn set_monitors_enabled(enabled: bool) -> Result<Vec<Monitor>, String> {
    let script = if enabled {
        "Get-PnpDevice -Class Monitor -PresentOnly | Where-Object Status -ne 'OK' | Enable-PnpDevice -Confirm:$false"
    } else {
        "Get-PnpDevice -Class Monitor -PresentOnly | Where-Object Status -eq 'OK' | Disable-PnpDevice -Confirm:$false"
    };
    sys::powershell_elevated(script)?;
    list_monitors()
}

pub fn open_nvidia_panel() -> Result<(), String> {
    sys::powershell(
        "$p = Get-AppxPackage -Name NVIDIACorp.NVIDIAControlPanel -ErrorAction SilentlyContinue | Select-Object -First 1; \
         $legacy = \"$env:ProgramFiles\\NVIDIA Corporation\\Control Panel Client\\nvcplui.exe\"; \
         if ($p) { Start-Process \"shell:AppsFolder\\$($p.PackageFamilyName)!NVIDIACorp.NVIDIAControlPanel\" } \
         elseif (Test-Path $legacy) { Start-Process $legacy } \
         else { Write-Error 'NVIDIA Systemsteuerung nicht gefunden (Microsoft Store: \"NVIDIA Control Panel\")'; exit 2 }",
    )
    .map(|_| ())
}

pub fn open_device_manager() -> Result<(), String> {
    sys::powershell("Start-Process devmgmt.msc").map(|_| ())
}

#[derive(Serialize)]
pub struct StretchStatus {
    pub monitors: Vec<Monitor>,
    pub monitors_disabled: bool,
    pub resolution_available: bool,
    pub current: Option<display::DisplayMode>,
    pub valorant_running: bool,
}

pub fn status(width: u32, height: u32) -> StretchStatus {
    let monitors = list_monitors().unwrap_or_default();
    let monitors_disabled =
        !monitors.is_empty() && monitors.iter().all(|m| m.status.as_deref() != Some("OK"));
    StretchStatus {
        monitors,
        monitors_disabled,
        resolution_available: display::mode_available(width, height),
        current: display::current_mode(),
        valorant_running: sys::valorant_running(),
    }
}

fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let target = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

/// Sichert den Valorant Config-Ordner und löscht ihn danach (Valorant erzeugt ihn neu).
pub fn reset_config(base: &str) -> Result<String, String> {
    let path = Path::new(base);
    let lower = base.to_lowercase();
    if !lower.contains("valorant") || !lower.trim_end_matches(['\\', '/']).ends_with("config") {
        return Err(format!("Sicherheitsabbruch: '{base}' sieht nicht wie der VALORANT Config-Ordner aus."));
    }
    if !path.exists() {
        return Err("Config-Ordner existiert nicht (wurde evtl. schon gelöscht).".into());
    }
    if sys::valorant_running() {
        return Err("Valorant läuft noch — bitte zuerst komplett schließen.".into());
    }
    let stamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S");
    let backup = store::data_dir().join("backups").join(format!("Config_{stamp}"));
    copy_dir(path, &backup).map_err(|e| format!("Backup fehlgeschlagen: {e}"))?;
    fs::remove_dir_all(path).map_err(|e| format!("Löschen fehlgeschlagen: {e}"))?;
    Ok(backup.to_string_lossy().into())
}
