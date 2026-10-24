import { useCallback, useEffect, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { api, errText, type CustomResolution, type StretchStatus } from "../api";
import { profileRes, useApp } from "../state";

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div className={`step ${done ? "done" : ""}`}>
      <div className="step-num">{done ? "✔" : n}</div>
      <div className="step-body">
        <h4>{title}</h4>
        {children}
      </div>
    </div>
  );
}

export function StretchTab() {
  const { settings, selected, toast } = useApp();
  const res = profileRes(selected);
  const [status, setStatus] = useState<StretchStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [backup, setBackup] = useState<string | null>(null);
  const [ingameDone, setIngameDone] = useState(false);

  const [customs, setCustoms] = useState<CustomResolution[] | null>(null);
  const [nvError, setNvError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.stretchStatus(res.x, res.y).then(setStatus).catch((e) => toast(errText(e), "err"));
    api
      .nvidiaListCustom()
      .then((c) => {
        setCustoms(c);
        setNvError(null);
      })
      .catch((e) => setNvError(errText(e)));
  }, [res.x, res.y, toast]);

  useEffect(refresh, [refresh]);

  const run = async (key: string, fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(key);
    try {
      await fn();
      if (okMsg) toast(okMsg);
    } catch (e) {
      toast(errText(e), "err");
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const resetConfig = async () => {
    const ok = await ask(
      `Der Ordner\n${settings.ValorantConfigBase}\nwird gesichert und danach gelöscht. Valorant legt ihn beim nächsten Start neu an.\n\nFortfahren?`,
      { title: "Valorant Config zurücksetzen", kind: "warning" },
    );
    if (!ok) return;
    run("reset", async () => setBackup(await api.resetValorantConfig(settings.ValorantConfigBase)), "Config gesichert und gelöscht");
  };

  const monitorsOk = status?.monitors_disabled ?? false;
  const resOk = status?.resolution_available ?? false;
  const doneCount = [monitorsOk, resOk, !!backup, ingameDone].filter(Boolean).length;
  const cur = status?.current;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>True Stretched Setup</h2>
          <p className="muted">
            Neue Methode ohne schwarze Balken — Ziel: <b className="accent">{res.x}×{res.y}</b>
            {selected ? <> (Profil „{selected.Name}“)</> : <> (kein Profil gewählt)</>}
          </p>
        </div>
        <div className="progress">
          <div className="progress-bar">
            <div style={{ width: `${(doneCount / 4) * 100}%` }} />
          </div>
          <span>{doneCount}/4</span>
          <button className="icon-btn" title="Status neu prüfen" onClick={refresh}>
            ⟳
          </button>
        </div>
      </div>

      {cur && (
        <p className="current-mode">
          Aktuelle Windows-Auflösung: <b>{cur.width}×{cur.height} @ {cur.hz} Hz</b>
        </p>
      )}

      <div className="steps">
        <Step n={1} title="Monitore im Geräte-Manager deaktivieren" done={monitorsOk}>
          <p>
            Deaktiviert den Standard-Monitortreiber, damit Windows die EDID-Grenzen nicht mehr erzwingt. Der Bildschirm wird dabei <b>nicht</b> schwarz.
          </p>
          <div className="monitor-list">
            {status === null && <span className="muted">Prüfe Monitore…</span>}
            {status?.monitors.length === 0 && <span className="muted">Keine Monitore gefunden.</span>}
            {status?.monitors.map((m) => (
              <div key={m.InstanceId} className="monitor">
                <span>{m.FriendlyName ?? "Monitor"}</span>
                <span className={`chip ${m.Status === "OK" ? "warn" : "ok"}`}>{m.Status === "OK" ? "aktiv" : "deaktiviert"}</span>
              </div>
            ))}
          </div>
          <div className="btn-row">
            <button className="btn primary" disabled={!!busy || monitorsOk} onClick={() => run("mon", () => api.setMonitorsEnabled(false), "Monitore deaktiviert")}>
              {busy === "mon" ? "Warte auf Admin-Freigabe…" : "Alle deaktivieren (Admin)"}
            </button>
            <button className="btn ghost" disabled={!!busy} onClick={() => run("mon-on", () => api.setMonitorsEnabled(true), "Monitore wieder aktiviert")}>
              Wieder aktivieren
            </button>
            <button className="btn link" onClick={() => run("dm", api.openDeviceManager)}>
              Geräte-Manager öffnen
            </button>
          </div>
        </Step>

        <Step n={2} title="Benutzerdefinierte Auflösung anlegen" done={resOk}>
          <p>
            Legt <code>{res.x} × {res.y}</code> direkt im NVIDIA-Treiber an — ohne Systemsteuerung. Es kommt eine Admin-Abfrage, danach wird der
            Grafiktreiber neu gestartet (Bildschirm 2–3 Sekunden schwarz). Hz und Skalierung werden von deiner zuletzt angelegten Auflösung übernommen.
          </p>
          <div className="check-line">
            {resOk ? (
              <span className="chip ok">✔ {res.x}×{res.y} ist im Treiber angelegt</span>
            ) : (
              <span className="chip warn">✗ {res.x}×{res.y} noch nicht verfügbar</span>
            )}
          </div>
          <div className="btn-row">
            <button
              className="btn primary"
              disabled={!!busy || resOk || !!nvError}
              onClick={() => run("create", () => api.nvidiaCreateCustom(res.x, res.y), `${res.x}×${res.y} angelegt`)}
            >
              {busy === "create" ? "Lege an…" : `${res.x}×${res.y} jetzt anlegen`}
            </button>
            <button className="btn ghost" onClick={() => run("nv", api.openNvidiaPanel)}>
              NVIDIA Systemsteuerung öffnen
            </button>
            <button
              className="btn ghost"
              disabled={!resOk || !!busy}
              onClick={() => run("test", () => api.changeResolution(res.x, res.y, res.hz, true), `Windows läuft jetzt mit ${res.x}×${res.y}`)}
            >
              Auflösung jetzt setzen
            </button>
            <button
              className="btn link"
              onClick={() => run("back", () => api.changeResolution(settings.NativeX, settings.NativeY, res.hz, false), "Auflösung zurückgesetzt")}
            >
              Zurück auf {settings.NativeX}×{settings.NativeY}
            </button>
          </div>
          {nvError && <p className="err-text">NVIDIA-Treiber nicht ansprechbar: {nvError}</p>}
          {customs && customs.length > 0 && (
            <div className="monitor-list">
              <span className="hint">Deine benutzerdefinierten Auflösungen:</span>
              {customs.map((c) => (
                <div key={`${c.width}x${c.height}`} className="monitor">
                  <span className="mono">
                    {c.width}×{c.height} @ {c.hz} Hz
                  </span>
                  <button
                    className="btn danger-ghost sm"
                    disabled={!!busy}
                    onClick={async () => {
                      if (await ask(`${c.width}×${c.height} aus dem NVIDIA-Treiber löschen?`, { title: "Auflösung löschen", kind: "warning" }))
                        run("del", () => api.nvidiaDeleteCustom(c.width, c.height), `${c.width}×${c.height} gelöscht`);
                    }}
                  >
                    Löschen
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="hint">
            Falls „Skalierung durchführen auf: GPU“ noch nicht gesetzt ist: einmalig in der Systemsteuerung unter „Desktop-Größe und -Position anpassen“ → Vollbild + GPU.
          </p>
        </Step>

        <Step n={3} title="Valorant Config zurücksetzen" done={!!backup}>
          <p>
            Wichtig, wenn die Video-Einstellungen ingame ausgegraut sind. Der Ordner <code>%localappdata%\VALORANT\Saved\Config</code> wird{" "}
            <b>vorher automatisch gesichert</b> und dann gelöscht — Valorant erzeugt ihn beim nächsten Start sauber neu.
          </p>
          {status?.valorant_running && <p className="err-text">Valorant läuft gerade — bitte zuerst komplett schließen.</p>}
          {backup && (
            <p className="ok-text">
              Backup: <span className="mono">{backup}</span>{" "}
              <button className="btn link" onClick={() => revealItemInDir(backup)}>
                Ordner zeigen
              </button>
            </p>
          )}
          <div className="btn-row">
            <button className="btn danger" disabled={!!busy || status?.valorant_running} onClick={resetConfig}>
              Sichern & Config löschen
            </button>
          </div>
          <p className="hint">Deine Profile im Manager bleiben erhalten. Nach dem ersten Start kannst du bei Bedarf wieder „Configs anwenden“.</p>
        </Step>

        <Step n={4} title="Ingame: Letterbox → Ausfüllen" done={ingameDone}>
          <ol className="howto">
            <li>Valorant starten — der Manager stellt Windows vorher auf {res.x}×{res.y} um.</li>
            <li>
              <b>Einstellungen → Video → Allgemein</b>: Auflösung {res.x}×{res.y} wählen (falls nicht aktiv)
            </li>
            <li>
              <b>Seitenverhältnis-Methode</b>: erst <b>Letterbox</b>, dann direkt <b>Ausfüllen</b> → Übernehmen
            </li>
          </ol>
          <p className="hint">Im Ladebildschirm können kurz schwarze Balken auftauchen — ingame/auf der Range ist das Bild voll gestreckt.</p>
          <div className="btn-row">
            <button
              className="btn primary"
              disabled={!!busy}
              onClick={() =>
                run("launch", async () => {
                  const warn = await api.launchValorant(settings.RiotClientPath, res.x, res.y, res.hz);
                  if (warn) toast(warn, "err");
                }, "Valorant wird gestartet…")
              }
            >
              ▶ Valorant starten
            </button>
            <label className="checkbox">
              <input type="checkbox" checked={ingameDone} onChange={(e) => setIngameDone(e.target.checked)} />
              Ingame erledigt
            </label>
          </div>
        </Step>
      </div>
    </div>
  );
}
