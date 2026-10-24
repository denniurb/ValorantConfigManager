import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { api, type AppSettings, type PathStatus } from "../api";
import { useApp } from "../state";

function PathRow({ label, value, ok, onBrowse }: { label: string; value: string; ok?: boolean; onBrowse: () => void }) {
  return (
    <div className="path-row">
      <div>
        <span className="label">{label}</span>
        <span className="mono">{value}</span>
      </div>
      <span className={`chip ${ok ? "ok" : "warn"}`}>{ok ? "✔" : "✗ nicht gefunden"}</span>
      <button className="btn ghost sm" onClick={onBrowse}>
        Ändern
      </button>
    </div>
  );
}

export function SettingsTab() {
  const { settings, updateSettings, dataDir } = useApp();
  const [status, setStatus] = useState<PathStatus | null>(null);

  useEffect(() => {
    api.checkPaths(settings).then(setStatus);
  }, [settings]);

  const pickDir = async (key: keyof AppSettings, title: string) => {
    const dir = await open({ directory: true, title, defaultPath: String(settings[key]) });
    if (typeof dir === "string") updateSettings({ [key]: dir });
  };

  const pickRiot = async () => {
    const file = await open({
      title: "RiotClientServices.exe wählen",
      defaultPath: "C:\\Riot Games",
      filters: [{ name: "RiotClientServices", extensions: ["exe"] }],
    });
    if (typeof file === "string") updateSettings({ RiotClientPath: file });
  };

  return (
    <div className="page narrow">
      <h2>Einstellungen</h2>

      <div className="card">
        <h4>Pfade</h4>
        <PathRow
          label="Quell-Configs (GameUserSettings.ini + RiotUserSettings.ini)"
          value={settings.SourceConfigPath}
          ok={status?.source}
          onBrowse={() => pickDir("SourceConfigPath", "Ordner mit den Vorlage-INIs wählen")}
        />
        <PathRow
          label="VALORANT Config-Ordner"
          value={settings.ValorantConfigBase}
          ok={status?.base}
          onBrowse={() => pickDir("ValorantConfigBase", "VALORANT\\Saved\\Config wählen")}
        />
        <PathRow label="Riot Client" value={settings.RiotClientPath} ok={status?.riot} onBrowse={pickRiot} />
      </div>

      <div className="card">
        <h4>Native Monitor-Auflösung</h4>
        <p className="hint">Wird bei „Auflösung zurücksetzen“ verwendet.</p>
        <div className="res-row">
          <label className="field">
            <span>Breite</span>
            <input type="number" value={settings.NativeX} onChange={(e) => updateSettings({ NativeX: Number(e.target.value) || 1920 })} />
          </label>
          <span className="x">×</span>
          <label className="field">
            <span>Höhe</span>
            <input type="number" value={settings.NativeY} onChange={(e) => updateSettings({ NativeY: Number(e.target.value) || 1080 })} />
          </label>
        </div>
      </div>

      <div className="card">
        <h4>HenrikDev API</h4>
        <label className="field">
          <span>API Key</span>
          <input type="password" value={settings.HenrikApiKey} onChange={(e) => updateSettings({ HenrikApiKey: e.target.value.trim() })} />
        </label>
      </div>

      <div className="card">
        <h4>Daten</h4>
        <p className="hint">Profile, Einstellungen und Config-Backups liegen hier (beim ersten Start aus der alten WPF-Version übernommen):</p>
        <div className="path-row">
          <span className="mono">{dataDir}</span>
          <button className="btn ghost sm" onClick={() => openPath(dataDir)}>
            Öffnen
          </button>
        </div>
      </div>
    </div>
  );
}
