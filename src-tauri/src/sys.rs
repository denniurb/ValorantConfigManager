//! Windows-Helfer: PowerShell (normal + elevated), Prozess-Checks.

use base64::Engine;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn hidden(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Führt ein PowerShell-Skript aus und gibt stdout zurück.
pub fn powershell(script: &str) -> Result<String, String> {
    let full = format!("[Console]::OutputEncoding=[Text.Encoding]::UTF8; {script}");
    let out = hidden(&mut Command::new("powershell.exe"))
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &full])
        .output()
        .map_err(|e| format!("PowerShell konnte nicht gestartet werden: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if out.status.success() {
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

/// Führt ein Skript mit Admin-Rechten aus (UAC-Abfrage) und wartet auf das Ende.
pub fn powershell_elevated(script: &str) -> Result<(), String> {
    let utf16: Vec<u8> = script.encode_utf16().flat_map(|c| c.to_le_bytes()).collect();
    let encoded = base64::engine::general_purpose::STANDARD.encode(utf16);
    let outer = format!(
        "try {{ $p = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -WindowStyle Hidden \
         -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','{encoded}' -ErrorAction Stop; \
         exit $p.ExitCode }} catch {{ Write-Output 'UAC abgebrochen'; exit 1223 }}"
    );
    powershell(&outer).map(|_| ()).map_err(|e| {
        if e.contains("UAC") { "Admin-Abfrage wurde abgebrochen.".into() } else { e }
    })
}

pub fn is_process_running(image: &str) -> bool {
    hidden(&mut Command::new("tasklist"))
        .args(["/FI", &format!("IMAGENAME eq {image}"), "/NH"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_lowercase().contains(&image.to_lowercase()))
        .unwrap_or(false)
}

pub fn valorant_running() -> bool {
    is_process_running("VALORANT-Win64-Shipping.exe") || is_process_running("VALORANT.exe")
}
