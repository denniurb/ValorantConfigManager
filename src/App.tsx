import { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppProvider, useApp } from "./state";
import { ProfilesTab } from "./tabs/ProfilesTab";
import { StretchTab } from "./tabs/StretchTab";
import { CrosshairTab } from "./tabs/CrosshairTab";
import { StatsTab } from "./tabs/StatsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import "./App.css";

const TABS = [
  { id: "profiles", label: "Profile", icon: "◆" },
  { id: "stretch", label: "Stretched", icon: "⇔" },
  { id: "crosshair", label: "Crosshair", icon: "✛" },
  { id: "stats", label: "Stats", icon: "▲" },
  { id: "settings", label: "Einstellungen", icon: "⚙" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function TitleBar() {
  const win = getCurrentWindow();
  return (
    <header className="titlebar" data-tauri-drag-region onDoubleClick={() => win.toggleMaximize()}>
      <div className="brand" data-tauri-drag-region>
        <span className="brand-mark">V</span>
        <span data-tauri-drag-region>
          CONFIG <b>MANAGER</b>
        </span>
      </div>
      <div className="win-btns">
        <button onClick={() => win.minimize()} aria-label="Minimieren">
          ─
        </button>
        <button className="close" onClick={() => win.close()} aria-label="Schließen">
          ✕
        </button>
      </div>
    </header>
  );
}

function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Shell() {
  const [tab, setTab] = useState<TabId>(() => {
    try {
      return (localStorage.getItem("tab") as TabId) || "profiles";
    } catch {
      return "profiles";
    }
  });
  const { selected } = useApp();
  const go = (id: TabId) => {
    setTab(id);
    try {
      localStorage.setItem("tab", id);
    } catch {
      /* egal */
    }
  };

  return (
    <div className="app">
      <TitleBar />
      <div className="body">
        <nav className="rail">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => go(t.id)}>
              <span className="icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
          <div className="rail-foot">
            {selected ? (
              <>
                <span className="muted">Aktives Profil</span>
                <b>{selected.Name}</b>
              </>
            ) : (
              <span className="muted">Kein Profil gewählt</span>
            )}
          </div>
        </nav>
        <main className="content">
          {tab === "profiles" && <ProfilesTab onOpenStretch={() => go("stretch")} />}
          {tab === "stretch" && <StretchTab />}
          {tab === "crosshair" && <CrosshairTab />}
          {tab === "stats" && <StatsTab />}
          {tab === "settings" && <SettingsTab />}
        </main>
      </div>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
