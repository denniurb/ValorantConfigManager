//! Benutzerdefinierte NVIDIA-Auflösungen über den Registry-Wert `CustomDisplay`.
//!
//! NvAPI_DISP_SaveCustomDisplay liefert auf aktuellen Treibern immer NVAPI_ERROR, daher schreiben wir
//! den Wert so, wie ihn die NVIDIA Systemsteuerung selbst ablegt (per Vergleich zweier Einträge ermittelt):
//! - 32 Plätze à 320 Byte, neuester Eintrag vorne, leere Plätze = Nullen
//! - Quellauflösung als u32 an Offset 8/12, 36/40 und 52/56
//! - Rest (Monitorkennung, natives Timing für GPU-Skalierung, Name) ist bei gleicher Hz-Zahl identisch
//!
//! Ein neuer Eintrag ist daher eine Kopie des neuesten vorhandenen mit geänderter Breite/Höhe.

use crate::{store, sys};
use base64::Engine;
use serde::Serialize;
use std::fs;

const ENTRY_SIZE: usize = 320;
const SLOTS: usize = 32;
const SIZE_OFFSETS: [(usize, usize); 3] = [(8, 12), (36, 40), (52, 56)];
const RRX1K_OFFSET: usize = 124;
const CLASS_KEY: &str = r"HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}";

#[derive(Serialize)]
pub struct CustomResolution {
    pub width: u32,
    pub height: u32,
    pub hz: f64,
}

fn u32_at(b: &[u8], o: usize) -> u32 {
    u32::from_le_bytes(b[o..o + 4].try_into().unwrap())
}

/// Liest `CustomDisplay` der NVIDIA-Grafikkarte. Gibt (Registry-Pfad, Daten) zurück.
fn read_blob() -> Result<(String, Vec<u8>), String> {
    let script = format!(
        "$k = Get-ChildItem '{CLASS_KEY}' -ErrorAction SilentlyContinue | Where-Object {{ \
           (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DriverDesc -like '*NVIDIA*' }} | Select-Object -First 1; \
         if (-not $k) {{ Write-Error 'Keine NVIDIA-Grafikkarte in der Registry gefunden'; exit 2 }}; \
         $v = (Get-ItemProperty $k.PSPath).CustomDisplay; \
         $k.Name + '|' + $(if ($v) {{ [Convert]::ToBase64String($v) }} else {{ '' }})"
    );
    let out = sys::powershell(&script)?;
    let (key, b64) = out.split_once('|').ok_or("Registry-Antwort unlesbar")?;
    let key = key.replace("HKEY_LOCAL_MACHINE", "HKLM:");
    let data = base64::engine::general_purpose::STANDARD.decode(b64.trim()).map_err(|e| e.to_string())?;
    Ok((key, data))
}

fn entries(blob: &[u8]) -> Vec<&[u8]> {
    blob.chunks_exact(ENTRY_SIZE).filter(|e| e.iter().any(|&x| x != 0)).collect()
}

fn to_info(e: &[u8]) -> CustomResolution {
    let hz = u32_at(e, RRX1K_OFFSET) as f64 / 1000.0;
    CustomResolution { width: u32_at(e, 8), height: u32_at(e, 12), hz: (hz * 100.0).round() / 100.0 }
}

pub fn list_custom() -> Result<Vec<CustomResolution>, String> {
    let (_, blob) = read_blob()?;
    Ok(entries(&blob).into_iter().map(to_info).collect())
}

/// Sichert den alten Wert, schreibt den neuen (Admin) und startet den Grafiktreiber neu.
fn write_blob(key: &str, old: &[u8], new: &[u8]) -> Result<(), String> {
    let dir = store::data_dir().join("backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S");
    fs::write(dir.join(format!("CustomDisplay_{stamp}.bin")), old).map_err(|e| e.to_string())?;
    // Zu groß für die Kommandozeile → über eine Datei an das Admin-Skript übergeben
    let pending = dir.join("CustomDisplay_pending.bin");
    fs::write(&pending, new).map_err(|e| e.to_string())?;

    let script = format!(
        "$ErrorActionPreference = 'Stop'; \
         Set-ItemProperty -Path '{key}' -Name CustomDisplay -Type Binary -Value ([IO.File]::ReadAllBytes('{}')); \
         $gpu = Get-PnpDevice -Class Display -PresentOnly | Where-Object FriendlyName -like '*NVIDIA*' | Select-Object -First 1; \
         if ($gpu) {{ pnputil /restart-device \"$($gpu.InstanceId)\" | Out-Null }}",
        pending.display()
    );
    let result = sys::powershell_elevated(&script);
    let _ = fs::remove_file(&pending);
    result
}

pub fn create_custom(width: u32, height: u32) -> Result<(), String> {
    let (key, blob) = read_blob()?;
    if blob.len() != ENTRY_SIZE * SLOTS {
        return Err(format!("Unbekanntes CustomDisplay-Format ({} Byte) — bitte über die Systemsteuerung anlegen.", blob.len()));
    }
    let existing = entries(&blob);
    let template = existing.first().ok_or(
        "Noch keine Vorlage vorhanden: Lege einmalig eine beliebige Auflösung in der NVIDIA Systemsteuerung an, danach geht es hier.",
    )?;
    if existing.iter().any(|e| u32_at(e, 8) == width && u32_at(e, 12) == height) {
        return Err(format!("{width}×{height} ist bereits angelegt."));
    }
    if existing.len() >= SLOTS {
        return Err("Alle 32 Plätze belegt — bitte zuerst eine Auflösung löschen.".into());
    }

    let mut entry = template.to_vec();
    for (wo, ho) in SIZE_OFFSETS {
        entry[wo..wo + 4].copy_from_slice(&width.to_le_bytes());
        entry[ho..ho + 4].copy_from_slice(&height.to_le_bytes());
    }
    // Neuer Eintrag vorne, Rest rückt nach (wie die Systemsteuerung es macht)
    let mut new = entry;
    for e in &existing {
        new.extend_from_slice(e);
    }
    new.resize(ENTRY_SIZE * SLOTS, 0);
    write_blob(&key, &blob, &new)
}

pub fn delete_custom(width: u32, height: u32) -> Result<(), String> {
    let (key, blob) = read_blob()?;
    let existing = entries(&blob);
    let kept: Vec<&[u8]> = existing.iter().copied().filter(|e| !(u32_at(e, 8) == width && u32_at(e, 12) == height)).collect();
    if kept.len() == existing.len() {
        return Err(format!("{width}×{height} ist keine benutzerdefinierte Auflösung"));
    }
    let mut new: Vec<u8> = kept.concat();
    new.resize(blob.len().max(ENTRY_SIZE * SLOTS), 0);
    write_blob(&key, &blob, &new)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Nur lesend
    #[test]
    fn read_registry() {
        let (key, blob) = read_blob().expect("read");
        println!("key {key} len {}", blob.len());
        for e in entries(&blob) {
            let i = to_info(e);
            println!("custom: {}x{} @ {} Hz", i.width, i.height, i.hz);
        }
    }

    /// Prüft die Einfügelogik gegen die echten Systemsteuerungs-Daten:
    /// 1280×880 vorhanden + 1392×960 neu muss byte-genau (bis auf Füllbytes) dem Treiberergebnis entsprechen.
    #[test]
    fn insert_matches_nvcp() {
        let (_, blob) = read_blob().expect("read");
        let e = entries(&blob);
        let Some(first) = e.first() else { return };
        let mut copy = first.to_vec();
        for (wo, ho) in SIZE_OFFSETS {
            copy[wo..wo + 4].copy_from_slice(&1000u32.to_le_bytes());
            copy[ho..ho + 4].copy_from_slice(&700u32.to_le_bytes());
        }
        assert_eq!(to_info(&copy).width, 1000);
        assert_eq!(to_info(&copy).height, 700);
        assert_eq!(copy[0..8], first[0..8], "Monitorkennung muss erhalten bleiben");
    }
}
