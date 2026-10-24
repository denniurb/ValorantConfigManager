# Valorant Config Manager

Desktop-App (Windows) zum Verwalten mehrerer Valorant-Accounts, Configs und True-Stretched-Auflösungen.
Gebaut mit [Tauri 2](https://tauri.app) (Rust) und React/TypeScript.

## Features

- **Profile** pro Account: Config-Ordner, Auflösung, Login-Daten zum Kopieren
- **Configs anwenden**: kopiert `GameUserSettings.ini` + `RiotUserSettings.ini` aus einem Vorlagen-Ordner und setzt die Auflösung
- **Valorant starten**: stellt vorher die Windows-Auflösung um (Vollbild-Skalierung)
- **True-Stretched-Assistent** (ohne schwarze Balken):
  1. Monitore im Geräte-Manager deaktivieren (ein Klick, Admin)
  2. Benutzerdefinierte NVIDIA-Auflösung direkt aus der App anlegen/löschen
  3. Valorant-Config-Ordner sichern und zurücksetzen
  4. Ingame: Letterbox → Ausfüllen
- **Crosshair**: eigene Profile ansehen, aktives Profil wählen, Pro-Crosshairs per Klick übernehmen
- **Stats** über die [HenrikDev API](https://dashboard.henrikdev.xyz) (eigener API-Key nötig): Rang, Matches, Scoreboard

Stretched funktioniert nur mit einem Seitenverhältnis von ≈1,45 (z. B. 1568×1080) — die App zeigt passende Vorschläge und prüft das Verhältnis.

## Benutzerdefinierte Auflösungen

`NvAPI_DISP_SaveCustomDisplay` schlägt auf aktuellen NVIDIA-Treibern fehl. Die App schreibt deshalb den Registry-Wert
`CustomDisplay` der Grafikkarte im selben Format wie die NVIDIA Systemsteuerung (32 Einträge à 320 Byte, neuester vorne)
und startet danach den Grafiktreiber neu. Voraussetzung: mindestens eine Auflösung wurde einmal über die Systemsteuerung
angelegt (dient als Vorlage). Vor jeder Änderung wird der alte Wert gesichert.

## Daten

Profile, Einstellungen und Backups liegen in `%APPDATA%\ValorantConfigManager`. Passwörter werden dort im Klartext gespeichert.

## Entwickeln / Bauen

Voraussetzungen: Node.js, Rust (MSVC), Visual Studio Build Tools mit C++.

```bat
npm install
tauri.cmd dev     :: Entwicklungsmodus
tauri.cmd build   :: Release-.exe + NSIS-Installer unter src-tauri\target\release
```

`tauri.cmd` lädt die VS-2022-Build-Tools-Umgebung; mit funktionierender Standard-Toolchain geht auch `npm run tauri dev`.

## Hinweis

Nicht mit Riot Games verbunden. Änderungen an Treiber-/Geräteeinstellungen auf eigene Verantwortung.
