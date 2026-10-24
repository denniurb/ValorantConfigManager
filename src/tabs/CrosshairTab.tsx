import { useEffect, useMemo, useState } from "react";
import { api, errText, type CrosshairState, type ProCrosshair } from "../api";
import { useApp } from "../state";
import { PRO_CROSSHAIRS } from "../proCrosshairs";
import { CrosshairPreview, specFromPro, specFromProfile } from "../components/CrosshairPreview";

export function CrosshairTab() {
  const { settings, selected, toast } = useApp();
  const [paths, setPaths] = useState<string[] | null>(null);
  const [state, setState] = useState<CrosshairState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.crosshairPaths(settings.ValorantConfigBase, selected?.FolderId ?? null).then(async (p) => {
      setPaths(p);
      if (p.length === 0) {
        setError("RiotUserSettings.ini nicht gefunden. Profil wählen und zuerst „Configs anwenden“ oder Valorant einmal starten.");
        return;
      }
      try {
        setState(await api.crosshairLoad(p));
        setError(null);
      } catch (e) {
        setError(errText(e));
      }
    });
  }, [settings.ValorantConfigBase, selected?.FolderId]);

  const act = async (fn: () => Promise<CrosshairState>, msg: string) => {
    try {
      setState(await fn());
      toast(msg);
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const pros = useMemo(() => {
    const q = filter.toLowerCase();
    return PRO_CROSSHAIRS.filter((p) => !q || p.player.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
  }, [filter]);

  const active = state?.profiles[state.current];
  const activeSpec = active ? specFromProfile(active) : null;

  const applyPro = (pro: ProCrosshair) =>
    paths && act(() => api.crosshairApplyPro(paths, pro), `✔ '${pro.player}' auf '${active?.profileName ?? "aktives Profil"}' angewendet`);

  return (
    <div className="split">
      <aside className="list-pane wide">
        <div className="pane-head">
          <h3>Deine Crosshairs</h3>
          {state && <span className="count">{state.profiles.length}</span>}
        </div>
        {error && <p className="err-text pad">{error}</p>}
        {active && activeSpec && (
          <div className="active-xh">
            <span className="chip ok">AKTIV</span>
            <div className="xh-stage big">
              <CrosshairPreview spec={activeSpec} size={180} scale={4.5} />
            </div>
            <b>{active.profileName || `Profil ${state!.current + 1}`}</b>
          </div>
        )}
        <div className="xh-list">
          {state?.profiles.map((p, i) => {
            const spec = specFromProfile(p);
            return (
              <button
                key={i}
                className={`xh-row ${i === state.current ? "selected" : ""}`}
                onClick={() => paths && i !== state.current && act(() => api.crosshairSetActive(paths, i), `'${p.profileName}' ist jetzt aktiv`)}
              >
                <div className="xh-stage">{spec && <CrosshairPreview spec={spec} size={40} scale={1.6} />}</div>
                <span>{p.profileName || `Profil ${i + 1}`}</span>
              </button>
            );
          })}
        </div>
        {paths && paths.length > 0 && (
          <button className="btn ghost wide" onClick={() => act(() => api.crosshairLoadDefault(paths), "Standard-Config geladen")}>
            ⟳ Standard-Config laden
          </button>
        )}
      </aside>

      <section className="detail">
        <div className="detail-head">
          <div>
            <h2>Pro Crosshairs</h2>
            <p className="muted">Klick = wird auf dein aktives Crosshair-Profil geschrieben (Valorant vorher schließen).</p>
          </div>
          <input className="search" placeholder="Spieler oder Team…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <div className="pro-grid">
          {pros.map((p) => (
            <button key={p.player} className="pro-card" disabled={!state} onClick={() => applyPro(p)}>
              <div className="xh-stage">
                <CrosshairPreview spec={specFromPro(p)} size={96} scale={3} />
              </div>
              <b>{p.player}</b>
              <span>{p.team}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
