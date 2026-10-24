//! Windows-Auflösung lesen/ändern (ChangeDisplaySettingsW / EnumDisplaySettingsW).

use serde::Serialize;
use windows_sys::Win32::Graphics::Gdi::{
    CDS_UPDATEREGISTRY, ChangeDisplaySettingsW, DEVMODEW, DISP_CHANGE_SUCCESSFUL, DM_DISPLAYFIXEDOUTPUT,
    DM_DISPLAYFREQUENCY, DM_PELSHEIGHT, DM_PELSWIDTH, DMDFO_STRETCH, ENUM_CURRENT_SETTINGS, EnumDisplaySettingsW,
};

#[derive(Serialize, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct DisplayMode {
    pub width: u32,
    pub height: u32,
    pub hz: u32,
}

fn empty_devmode() -> DEVMODEW {
    let mut dm: DEVMODEW = unsafe { std::mem::zeroed() };
    dm.dmSize = std::mem::size_of::<DEVMODEW>() as u16;
    dm
}

fn to_mode(dm: &DEVMODEW) -> DisplayMode {
    DisplayMode { width: dm.dmPelsWidth, height: dm.dmPelsHeight, hz: dm.dmDisplayFrequency }
}

pub fn current_mode() -> Option<DisplayMode> {
    let mut dm = empty_devmode();
    let ok = unsafe { EnumDisplaySettingsW(std::ptr::null(), ENUM_CURRENT_SETTINGS, &mut dm) };
    (ok != 0).then(|| to_mode(&dm))
}

/// Alle Modi, die der Treiber für den Hauptmonitor anbietet (inkl. NVIDIA Custom-Auflösungen).
pub fn list_modes() -> Vec<DisplayMode> {
    let mut modes = Vec::new();
    let mut i = 0u32;
    loop {
        let mut dm = empty_devmode();
        if unsafe { EnumDisplaySettingsW(std::ptr::null(), i, &mut dm) } == 0 {
            break;
        }
        modes.push(to_mode(&dm));
        i += 1;
    }
    modes.sort();
    modes.dedup();
    modes
}

pub fn mode_available(width: u32, height: u32) -> bool {
    list_modes().iter().any(|m| m.width == width && m.height == height)
}

fn apply(width: u32, height: u32, hz: u32, stretch: bool) -> i32 {
    let mut dm = empty_devmode();
    dm.dmPelsWidth = width;
    dm.dmPelsHeight = height;
    dm.dmFields = DM_PELSWIDTH | DM_PELSHEIGHT;
    if hz > 0 {
        dm.dmDisplayFrequency = hz;
        dm.dmFields |= DM_DISPLAYFREQUENCY;
    }
    if stretch {
        // Skalierungsmodus "Vollbild" — entspricht NVIDIA "Vollbild"-Skalierung
        dm.Anonymous1.Anonymous2.dmDisplayFixedOutput = DMDFO_STRETCH;
        dm.dmFields |= DM_DISPLAYFIXEDOUTPUT;
    }
    unsafe { ChangeDisplaySettingsW(&dm, CDS_UPDATEREGISTRY) }
}

/// Setzt die Auflösung. Versucht zuerst mit Vollbild-Skalierung, fällt sonst ohne zurück.
pub fn change_resolution(width: u32, height: u32, hz: u32, stretch: bool) -> Result<(), String> {
    let mut code = apply(width, height, hz, stretch);
    if code != DISP_CHANGE_SUCCESSFUL && stretch {
        code = apply(width, height, hz, false);
    }
    if code != DISP_CHANGE_SUCCESSFUL && hz > 0 {
        // Bildwiederholrate passt evtl. nicht exakt (z.B. 239.96 vs 240) → Treiber wählen lassen
        code = apply(width, height, 0, false);
    }
    if code == DISP_CHANGE_SUCCESSFUL {
        Ok(())
    } else {
        Err(format!(
            "Auflösung {width}×{height} konnte nicht gesetzt werden (Code {code}). \
             Ist sie in der NVIDIA Systemsteuerung als benutzerdefinierte Auflösung angelegt?"
        ))
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn print_modes() {
        let mut seen = std::collections::BTreeMap::<(u32, u32), Vec<u32>>::new();
        for m in super::list_modes() {
            seen.entry((m.width, m.height)).or_default().push(m.hz);
        }
        for ((w, h), hz) in seen {
            println!("mode {w}x{h}: {hz:?}");
        }
        println!("current {:?}", super::current_mode().map(|m| (m.width, m.height, m.hz)));
    }
}
