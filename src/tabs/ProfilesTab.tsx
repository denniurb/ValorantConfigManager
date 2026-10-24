import { useEffect, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { api, errText, type ConfigFolder, type DisplayMode, type Profile } from "../api";
import { profileRes, useApp } from "../state";

// Stretched funktioniert nur bei Seitenverhältnis ≈1,45 (wie 1568×1080); Breite+Höhe durch 8 teilbar für NVIDIA
export const STRETCH_RATIO = 1568 / 1080;
export const isStretchRatio = (r: number) => Math.abs(r - STRETCH_RATIO) <= 0.006;
export const RES_PRESETS: [number, number, string][] = [
  [1568, 1080, "Standard"],
  [1440, 992, "etwas mehr FPS"],
  [1344, 928, "mehr FPS"],
  [1280, 880, "viel mehr FPS"],
  [1160, 800, "max FPS"],
  [1920, 1080, "Nativ"],
];

const shortId = (id: string) => (id.length <= 20 ? id : `${id.slice(0, 8)}…${id.slice(-8)}`);

function ProfileList() {
  const { profiles, setProfiles, selected, selectProfile } = useApp();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    const p: Profile = {
      Id: await api.newId(),
      Name: name.trim(),
      FolderId: null,
      Username: null,
      Password: null,
      ResolutionX: 1568,
      ResolutionY: 1080,
      RefreshRate: 239.96,
    };
    setProfiles([...profiles, p]);
    selectProfile(p.Id);
    setName("");
    setAdding(false);
  };

  return (
    <aside className="list-pane">
      <div className="pane-head">
        <h3>Profile</h3>
        <span className="count">{profiles.length}</span>
      </div>
      <div className="profile-list">
        {profiles.length === 0 && <p className="muted pad">Noch keine Profile.</p>}
        {profiles.map((p) => (
          <button key={p.Id} className={`profile-item ${selected?.Id === p.Id ? "selected" : ""}`} onClick={() => selectProfile(p.Id)}>
            <span className="name">{p.Name}</span>
            <span className={`sub ${p.FolderId ? "mono" : "warn"}`}>{p.FolderId ? shortId(p.FolderId) : "Kein Ordner zugewiesen"}</span>
            <span className="res">
              {p.ResolutionX ?? 1280}×{p.ResolutionY ?? 1024}
            </span>
          </button>
        ))}
      </div>
      {adding ? (
        <div className="add-row">
          <input autoFocus placeholder="Profilname" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => (e.key === "Enter" ? add() : e.key === "Escape" && setAdding(false))} />
          <button className="btn primary sm" onClick={add}>
            OK
          </button>
        </div>
      ) : (
        <button className="btn ghost wide" onClick={() => setAdding(true)}>
          + Profil hinzufügen
        </button>
      )}
    </aside>
  );
}

function CopyField({ label, value, secret, onChange }: { label: string; value: string; secret?: boolean; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  const { toast } = useApp();
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-group">
        <input type={secret && !show ? "password" : "text"} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
        {secret && (
          <button className="icon-btn" onClick={() => setShow(!show)} title={show ? "Verbergen" : "Anzeigen"}>
            {show ? "◉" : "○"}
          </button>
        )}
        <button
          className="icon-btn"
          title="Kopieren"
          onClick={() => navigator.clipboard.writeText(value).then(() => toast(`${label} kopiert`, "info"))}
        >
          ⧉
        </button>
      </div>
    </label>
  );
}

export function ProfilesTab({ onOpenStretch }: { onOpenStretch: () => void }) {
  const { settings, profiles, setProfiles, selected, selectProfile, updateSelected, toast } = useApp();
  const [folders, setFolders] = useState<ConfigFolder[]>([]);
  const [folderErr, setFolderErr] = useState<string | null>(null);
  const [modes, setModes] = useState<DisplayMode[]>([]);
  const [busy, setBusy] = useState(false);

  const loadFolders = () =>
    api
      .listConfigFolders(settings.ValorantConfigBase)
      .then((f) => {
        setFolders(f);
        setFolderErr(null);
      })
      .catch((e) => setFolderErr(errText(e)));

  useEffect(() => {
    loadFolders();
    api.listDisplayModes().then(setModes);
  }, [settings.ValorantConfigBase]);

  if (!selected)
    return (
      <div className="split">
        <ProfileList />
        <section className="detail empty-state">
          <div className="big-mark">◆</div>
          <h2>Kein Profil ausgewählt</h2>
          <p className="muted">Wähle links ein Profil oder lege ein neues an.</p>
        </section>
      </div>
    );

  const res = profileRes(selected);
  const resAvailable = modes.some((m) => m.width === res.x && m.height === res.y);
  const ratio = res.y > 0 ? res.x / res.y : null;
  const isNative = res.x === settings.NativeX && res.y === settings.NativeY;
  const base = settings.ValorantConfigBase;

  const applyConfigs = async () => {
    if (!selected.FolderId) return;
    setBusy(true);
    try {
      const n = await api.applyConfig(settings.SourceConfigPath, base, selected.FolderId, res.x, res.y);
      toast(`✔ ${n} Dateien kopiert — Configs für '${selected.Name}' angewendet`);
    } catch (e) {
      toast(errText(e), "err");
    } finally {
      setBusy(false);
    }
  };

  const launch = async () => {
    setBusy(true);
    try {
      const warn = await api.launchValorant(settings.RiotClientPath, res.x, res.y, res.hz);
      if (warn) toast(warn, "err");
      toast(`Valorant wird mit ${res.x}×${res.y} gestartet…`, "info");
    } catch (e) {
      toast(errText(e), "err");
    } finally {
      setBusy(false);
    }
  };

  const resetRes = async () => {
    try {
      await api.changeResolution(settings.NativeX, settings.NativeY, res.hz, false);
      toast(`Windows-Auflösung auf ${settings.NativeX}×${settings.NativeY} zurückgesetzt`);
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const remove = async () => {
    if (!(await ask(`Profil '${selected.Name}' wirklich löschen?\nDateien auf der Festplatte bleiben unberührt.`, { title: "Profil löschen", kind: "warning" })))
      return;
    setProfiles(profiles.filter((p) => p.Id !== selected.Id));
    selectProfile(null);
    toast("Profil gelöscht", "info");
  };

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div className="split">
      <ProfileList />
      <section className="detail">
        <div className="detail-head">
          <input className="title-input" value={selected.Name} onChange={(e) => updateSelected({ Name: e.target.value })} />
          <button className="btn danger-ghost sm" onClick={remove}>
            Löschen
          </button>
        </div>

        <div className="cards">
          <div className="card">
            <div className="card-head">
              <h4>Account-Ordner</h4>
              <button className="icon-btn" title="Neu laden" onClick={loadFolders}>
                ⟳
              </button>
            </div>
            {folderErr ? (
              <p className="err-text">{folderErr}</p>
            ) : (
              <select value={selected.FolderId ?? ""} onChange={(e) => updateSelected({ FolderId: e.target.value || null })}>
                <option value="">— Ordner wählen —</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.id} · {new Date(f.modified * 1000).toLocaleDateString("de-DE")}
                  </option>
                ))}
              </select>
            )}
            <p className="hint">Neuester Ordner steht oben — das ist meist der zuletzt eingeloggte Account.</p>
            {selected.FolderId && (
              <div className="paths mono">
                <div>{`${base}\\${selected.FolderId}\\Windows`}</div>
                <div>{`${base}\\${selected.FolderId}\\WindowsClient`}</div>
                <div>{`${base}\\WindowsClient`}</div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h4>Auflösung</h4>
              {resAvailable ? (
                <span className="chip ok">✔ im Treiber verfügbar</span>
              ) : (
                <button className="chip warn" onClick={onOpenStretch} title="Zum Stretched-Setup">
                  ✗ nicht angelegt → Setup
                </button>
              )}
            </div>
            <div className="res-row">
              <label className="field">
                <span>Breite</span>
                <input type="number" value={selected.ResolutionX ?? ""} onChange={(e) => updateSelected({ ResolutionX: num(e.target.value) })} />
              </label>
              <span className="x">×</span>
              <label className="field">
                <span>Höhe</span>
                <input type="number" value={selected.ResolutionY ?? ""} onChange={(e) => updateSelected({ ResolutionY: num(e.target.value) })} />
              </label>
              <label className="field">
                <span>Hz</span>
                <input type="number" step="0.01" value={selected.RefreshRate} onChange={(e) => updateSelected({ RefreshRate: Number(e.target.value) || 239.96 })} />
              </label>
            </div>
            {ratio !== null && !isNative && (
              <p className={isStretchRatio(ratio) ? "ok-text" : "err-text"}>
                Verhältnis {ratio.toFixed(3).replace(".", ",")}
                {isStretchRatio(ratio) ? " — passt für Stretched" : " — muss ≈1,45 sein (wie 1568×1080), sonst funktioniert Stretched nicht"}
              </p>
            )}
            <div className="presets">
              {RES_PRESETS.map(([w, h, label]) => (
                <button
                  key={`${w}x${h}`}
                  className={`preset ${res.x === w && res.y === h ? "on" : ""}`}
                  onClick={() => updateSelected({ ResolutionX: w, ResolutionY: h })}
                >
                  <b>
                    {w}×{h}
                  </b>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h4>Riot Account</h4>
            </div>
            <CopyField label="Benutzername" value={selected.Username ?? ""} onChange={(v) => updateSelected({ Username: v })} />
            <CopyField label="Passwort" secret value={selected.Password ?? ""} onChange={(v) => updateSelected({ Password: v })} />
            <p className="hint">Wird lokal gespeichert. Zum schnellen Kopieren beim Riot-Login.</p>
          </div>
        </div>

        <div className="action-bar">
          <button className="btn ghost" onClick={resetRes}>
            Auflösung zurücksetzen
          </button>
          <div className="spacer" />
          <button className="btn secondary" disabled={!selected.FolderId || busy} onClick={applyConfigs}>
            Configs anwenden
          </button>
          <button className="btn primary big" disabled={!selected.FolderId || busy} onClick={launch}>
            ▶ VALORANT STARTEN
          </button>
        </div>
      </section>
    </div>
  );
}
