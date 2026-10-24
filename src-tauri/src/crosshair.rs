//! Crosshair-Profile in RiotUserSettings.ini lesen/schreiben.
//! Valorant speichert sie als JSON-String in `SavedCrosshairProfileData="..."`
//! plus "flache" Keys für das aktive Profil.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use std::{fs, path::Path};

const KEY_PROFILES: &str = "EAresStringSettingName::SavedCrosshairProfileData=";
const KEY_SETTINGS: &str = "EAresStringSettingName::CrosshairSettings=";

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProCrosshair {
    pub player: String,
    pub color: [u8; 3],
    #[serde(default)]
    pub outline: bool,
    #[serde(default = "half")]
    pub outline_opacity: f64,
    #[serde(default)]
    pub dot: bool,
    #[serde(default = "two")]
    pub dot_size: f64,
    #[serde(default = "one")]
    pub dot_opacity: f64,
    #[serde(default = "yes")]
    pub inner_show: bool,
    #[serde(default = "two_i")]
    pub inner_thickness: i64,
    #[serde(default = "four_i")]
    pub inner_length: i64,
    #[serde(default = "two_i")]
    pub inner_offset: i64,
    #[serde(default = "one")]
    pub inner_opacity: f64,
    #[serde(default)]
    pub outer_show: bool,
    #[serde(default = "two_i")]
    pub outer_thickness: i64,
    #[serde(default = "two_i")]
    pub outer_length: i64,
    #[serde(default = "ten_i")]
    pub outer_offset: i64,
    #[serde(default = "outer_op")]
    pub outer_opacity: f64,
    #[serde(default)]
    pub fade_on_fire: bool,
}
fn half() -> f64 { 0.5 }
fn one() -> f64 { 1.0 }
fn two() -> f64 { 2.0 }
fn outer_op() -> f64 { 0.35 }
fn yes() -> bool { true }
fn two_i() -> i64 { 2 }
fn four_i() -> i64 { 4 }
fn ten_i() -> i64 { 10 }

#[derive(Serialize)]
pub struct CrosshairState {
    pub current: usize,
    pub profiles: Vec<Value>,
    pub paths: Vec<String>,
}

/// Zahl so schreiben wie Valorant (1 statt 1.0)
fn num(v: f64) -> Value {
    if v.fract() == 0.0 { json!(v as i64) } else { json!(v) }
}

// ── INI-String-Escaping ────────────────────────────────────────────────────

fn ini_unescape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('"') => out.push('"'),
                Some('\\') => out.push('\\'),
                Some('r') => out.push('\r'),
                Some('n') => out.push('\n'),
                Some('t') => out.push('\t'),
                Some(o) => { out.push('\\'); out.push(o); }
                None => out.push('\\'),
            }
        } else {
            out.push(c);
        }
    }
    out
}

fn ini_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 64);
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\r' => out.push_str("\\r"),
            '\n' => out.push_str("\\n"),
            '\t' => out.push_str("\\t"),
            c => out.push(c),
        }
    }
    format!("\"{out}\"")
}

struct Ini {
    lines: Vec<String>,
    eol: &'static str,
}

impl Ini {
    fn read(path: &Path) -> Result<Self, String> {
        let text = fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
        let eol = if text.contains("\r\n") { "\r\n" } else { "\n" };
        Ok(Ini { lines: text.split(eol).map(String::from).collect(), eol })
    }
    fn write(&self, path: &Path) -> Result<(), String> {
        fs::write(path, self.lines.join(self.eol)).map_err(|e| e.to_string())
    }
    fn get(&self, key_eq: &str) -> Option<&str> {
        self.lines.iter().find_map(|l| l.strip_prefix(key_eq))
    }
    fn set(&mut self, key_eq: &str, value: String) {
        let line = format!("{key_eq}{value}");
        match self.lines.iter().position(|l| l.starts_with(key_eq)) {
            Some(i) => self.lines[i] = line,
            None => {
                // vor abschließender Leerzeile einfügen
                let at = if self.lines.last().is_some_and(|l| l.is_empty()) { self.lines.len() - 1 } else { self.lines.len() };
                self.lines.insert(at, line);
            }
        }
    }
    fn set_flat(&mut self, key: &str, value: impl Into<String>) {
        self.set(&format!("{key}="), value.into());
    }
}

fn parse_profiles(ini: &Ini) -> Option<(usize, Vec<Value>)> {
    let raw = ini.get(KEY_PROFILES)?;
    let inner = raw.strip_prefix('"')?.strip_suffix('"')?;
    let root: Value = serde_json::from_str(&ini_unescape(inner)).ok()?;
    let current = root.get("currentProfile")?.as_u64()? as usize;
    let profiles = root.get("profiles")?.as_array()?.clone();
    Some((current, profiles))
}

pub fn load(paths: &[String]) -> Result<CrosshairState, String> {
    // Datei mit den meisten Profilen gewinnt (wie in der alten Version)
    let best = paths
        .iter()
        .filter_map(|p| Ini::read(Path::new(p)).ok().and_then(|ini| parse_profiles(&ini)))
        .max_by_key(|(_, profiles)| profiles.len())
        .ok_or("Keine Crosshair-Profile in RiotUserSettings.ini gefunden.")?;
    let (mut current, mut profiles) = best;
    for p in profiles.iter_mut() {
        p["bUseAdvancedOptions"] = json!(true);
    }
    if current >= profiles.len() {
        current = 0;
    }
    Ok(CrosshairState { current, profiles, paths: paths.to_vec() })
}

fn f(v: &Value, key: &str, default: f64) -> f64 {
    v.get(key).and_then(Value::as_f64).unwrap_or(default)
}
fn b(v: &Value, key: &str) -> bool {
    v.get(key).and_then(Value::as_bool).unwrap_or(false)
}
fn fmt(v: f64) -> String {
    num(v).to_string()
}

/// Baut den Wert für `CrosshairSettings` (formatiertes JSON wie Valorant es schreibt).
fn crosshair_settings(primary: &Value) -> String {
    let color = &primary["color"];
    let lines = |l: &Value| {
        format!(
            "{{\r\n\t\t\"lineThickness\": {},\r\n\t\t\"lineLength\": {},\r\n\t\t\"lineOffset\": {},\r\n\
             \t\t\"bShowMovementError\": false,\r\n\t\t\"bShowShootingError\": false,\r\n\t\t\"bShowMinError\": true,\r\n\
             \t\t\"opacity\": {}\r\n\t}}",
            fmt(f(l, "lineThickness", 0.0)),
            fmt(f(l, "lineLength", 0.0)),
            fmt(f(l, "lineOffset", 0.0)),
            fmt(f(l, "opacity", 0.0)),
        )
    };
    let outline = b(primary, "bHasOutline");
    let text = format!(
        "{{\r\n\t\"color\":\r\n\t{{\r\n\t\t\"b\": {},\r\n\t\t\"g\": {},\r\n\t\t\"r\": {},\r\n\t\t\"a\": 255\r\n\t}},\r\n\
         \t\"bHasOutline\": {},\r\n\t\"outlineThickness\": 1,\r\n\
         \t\"outlineColor\":\r\n\t{{\r\n\t\t\"b\": 0,\r\n\t\t\"g\": 0,\r\n\t\t\"r\": 0,\r\n\t\t\"a\": 255\r\n\t}},\r\n\
         \t\"outlineOpacity\": {},\r\n\t\"centerDotSize\": {},\r\n\t\"centerDotOpacity\": {},\r\n\
         \t\"bDisplayCenterDot\": {},\r\n\t\"innerLines\":\r\n\t{},\r\n\t\"outerLines\":\r\n\t{}\r\n}}",
        fmt(f(color, "b", 255.0)),
        fmt(f(color, "g", 255.0)),
        fmt(f(color, "r", 255.0)),
        outline,
        if outline { fmt(f(primary, "outlineOpacity", 1.0)) } else { "0".into() },
        fmt(f(primary, "centerDotSize", 2.0)),
        fmt(f(primary, "centerDotOpacity", 1.0)),
        b(primary, "bDisplayCenterDot"),
        lines(&primary["innerLines"]),
        lines(&primary["outerLines"]),
    );
    ini_escape(&text)
}

fn write_flat_keys(ini: &mut Ini, profile: &Value) {
    let Some(primary) = profile.get("primary") else { return };
    let color = &primary["color"];
    let col = format!(
        "(R={},G={},B={},A=255)",
        fmt(f(color, "r", 255.0)),
        fmt(f(color, "g", 255.0)),
        fmt(f(color, "b", 255.0))
    );
    let il = &primary["innerLines"];
    let ol = &primary["outerLines"];
    let tf = |v: bool| if v { "True" } else { "False" };
    let shows = |l: &Value| f(l, "lineLength", 0.0) > 0.0 && f(l, "opacity", 0.0) > 0.0;

    ini.set_flat("EAresStringSettingName::CrosshairProfileName", profile["profileName"].as_str().unwrap_or(""));
    ini.set_flat("EAresStringSettingName::CrosshairColor", col.clone());
    ini.set_flat("EAresStringSettingName::CrosshairSniperCenterDotColor", col);
    ini.set_flat("EAresBoolSettingName::CrosshairDisplayCenterDot", tf(b(primary, "bDisplayCenterDot")));
    ini.set_flat("EAresBoolSettingName::CrosshairHasOutline", tf(b(primary, "bHasOutline")));
    ini.set_flat("EAresBoolSettingName::CrosshairInnerLinesShowLines", tf(shows(il)));
    ini.set_flat("EAresBoolSettingName::CrosshairOuterLinesShowLines", tf(shows(ol)));
    ini.set_flat("EAresBoolSettingName::CrosshairUseAdvancedOptions", "True");
    ini.set(KEY_SETTINGS, crosshair_settings(primary));
}

pub fn save(state: &CrosshairState) -> Result<(), String> {
    let root = json!({ "currentProfile": state.current, "profiles": state.profiles });
    let encoded = ini_escape(&root.to_string());
    let mut written = 0;
    for path in &state.paths {
        let path = Path::new(path);
        let Ok(mut ini) = Ini::read(path) else { continue };
        if ini.get(KEY_PROFILES).is_none() {
            continue;
        }
        ini.set(KEY_PROFILES, encoded.clone());
        if let Some(active) = state.profiles.get(state.current) {
            write_flat_keys(&mut ini, active);
        }
        ini.write(path)?;
        written += 1;
    }
    if written == 0 {
        return Err("Keine RiotUserSettings.ini konnte beschrieben werden.".into());
    }
    Ok(())
}

pub fn set_active(paths: &[String], index: usize) -> Result<CrosshairState, String> {
    let mut state = load(paths)?;
    if index >= state.profiles.len() {
        return Err("Ungültiges Profil.".into());
    }
    state.current = index;
    save(&state)?;
    Ok(state)
}

pub fn apply_pro(paths: &[String], ch: &ProCrosshair) -> Result<CrosshairState, String> {
    let mut state = load(paths)?;
    let idx = state.current;
    let old = state.profiles.get(idx).cloned().ok_or("Kein aktives Profil.")?;

    let [r, g, b_] = ch.color;
    let color = json!({ "b": b_, "g": g, "r": r, "a": 255 });
    let lines = |inner: bool| {
        let (show, t, l, o, op) = if inner {
            (ch.inner_show, ch.inner_thickness, ch.inner_length, ch.inner_offset, ch.inner_opacity)
        } else {
            (ch.outer_show, ch.outer_thickness, ch.outer_length, ch.outer_offset, ch.outer_opacity)
        };
        let len = if show { l } else { 0 };
        json!({
            "lineThickness": t,
            "lineLength": len,
            "lineLengthVertical": len,
            "bAllowVertScaling": false,
            "lineOffset": o,
            "bShowMovementError": false,
            "bShowShootingError": false,
            "bShowMinError": true,
            "opacity": num(if show { op } else { 0.0 }),
            "bShowLines": show,
            "firingErrorScale": 1,
            "movementErrorScale": 1
        })
    };
    let primary = json!({
        "color": color,
        "colorCustom": color,
        "bUseCustomColor": false,
        "bHasOutline": ch.outline,
        "outlineThickness": 1,
        "outlineColor": { "b": 0, "g": 0, "r": 0, "a": 255 },
        "outlineOpacity": num(if ch.outline { ch.outline_opacity } else { 0.5 }),
        "centerDotSize": num(ch.dot_size),
        "centerDotOpacity": num(ch.dot_opacity),
        "bDisplayCenterDot": ch.dot,
        "bFadeCrosshairWithFiringError": ch.fade_on_fire,
        "bShowSpectatedPlayerCrosshair": true,
        "bHideCrosshair": false,
        "bFixMinErrorAcrossWeapons": false,
        "innerLines": lines(true),
        "outerLines": lines(false)
    });

    let mut sniper = old.get("sniper").cloned().unwrap_or_else(|| json!({}));
    if let Some(obj) = sniper.as_object_mut() {
        obj.insert("centerDotColor".into(), color.clone());
    }
    let keep_bool = |key: &str, default: bool| old.get(key).and_then(Value::as_bool).unwrap_or(default);

    let mut profile = Map::new();
    profile.insert("primary".into(), primary.clone());
    profile.insert("aDS".into(), primary.clone());
    profile.insert("focusMode".into(), old.get("focusMode").cloned().unwrap_or(primary));
    profile.insert("sniper".into(), sniper);
    profile.insert("bUsePrimaryCrosshairForADS".into(), json!(keep_bool("bUsePrimaryCrosshairForADS", true)));
    profile.insert("bUsePrimaryCrosshairForFocusMode".into(), json!(keep_bool("bUsePrimaryCrosshairForFocusMode", false)));
    profile.insert("bUseCustomCrosshairOnAllPrimary".into(), json!(keep_bool("bUseCustomCrosshairOnAllPrimary", false)));
    profile.insert("bUseAdvancedOptions".into(), json!(true));
    profile.insert("bScaleToResolution".into(), json!(keep_bool("bScaleToResolution", false)));
    profile.insert("profileName".into(), old.get("profileName").cloned().unwrap_or_else(|| json!(ch.player)));

    state.profiles[idx] = Value::Object(profile);
    save(&state)?;
    Ok(state)
}

/// Lädt `DefaultCrosshairConfig.ini` (neben der .exe oder im App-Datenordner).
pub fn load_default(paths: &[String]) -> Result<CrosshairState, String> {
    let mut candidates = vec![crate::store::data_dir().join("DefaultCrosshairConfig.ini")];
    if let Some(dir) = std::env::current_exe().ok().and_then(|e| e.parent().map(Path::to_path_buf)) {
        candidates.insert(0, dir.join("DefaultCrosshairConfig.ini"));
    }
    let file = candidates
        .iter()
        .find(|p| p.exists())
        .ok_or_else(|| format!("DefaultCrosshairConfig.ini nicht gefunden. Lege sie hier ab: {}", candidates.last().unwrap().display()))?;
    let ini = Ini::read(file)?;
    let (current, profiles) = parse_profiles(&ini).ok_or("Keine SavedCrosshairProfileData in DefaultCrosshairConfig.ini.")?;
    let state = CrosshairState { current, profiles, paths: paths.to_vec() };
    save(&state)?;
    Ok(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Round-Trip auf einer Kopie der echten INI: `VCM_TEST_INI=<pfad> cargo test`
    #[test]
    fn roundtrip_real_ini() {
        let Ok(src) = std::env::var("VCM_TEST_INI") else { return };
        let copy = std::env::temp_dir().join("vcm_test_RiotUserSettings.ini");
        fs::copy(&src, &copy).unwrap();
        let paths = vec![copy.to_string_lossy().to_string()];
        let before = load(&paths).unwrap();
        let line_count = fs::read_to_string(&copy).unwrap().lines().count();

        let pro: ProCrosshair = serde_json::from_str(r#"{"player":"TenZ","color":[0,255,255],"innerThickness":2,"innerLength":4,"innerOffset":3}"#).unwrap();
        let after = apply_pro(&paths, &pro).unwrap();
        assert_eq!(after.profiles.len(), before.profiles.len());
        assert_eq!(after.current, before.current);
        let reloaded = load(&paths).unwrap();
        assert_eq!(reloaded.profiles[reloaded.current]["primary"]["color"]["g"], 255);
        assert_eq!(reloaded.profiles[reloaded.current]["primary"]["color"]["r"], 0);

        let text = fs::read_to_string(&copy).unwrap();
        // CrosshairSettings muss einzeilig bleiben (alte Version hat echte Zeilenumbrüche geschrieben)
        // höchstens fehlende flache Keys werden ergänzt, keine Zeilen ohne `key=`
        assert!(text.lines().count() <= line_count + 8, "zu viele neue Zeilen");
        for l in text.lines().filter(|l| !l.is_empty() && !l.starts_with('[')) {
            assert!(l.contains('='), "kaputte Zeile: {}", &l[..60.min(l.len())]);
        }
        let cs = text.lines().find(|l| l.starts_with(KEY_SETTINGS)).unwrap();
        assert!(cs.contains(r#"{\r\n\t\"color\""#), "{}", &cs[..120.min(cs.len())]);
        fs::remove_file(copy).unwrap();
    }
}
