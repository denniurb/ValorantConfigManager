/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, errText } from "../api";
import { useApp } from "../state";
import { ActList, RankCards, RankIcon, RrHistory, useTiers, type MmrHistoryEntry, type MmrV3, type TierInfo } from "../components/RankPanel";

const TTL = { matches: 180, rank: 300, account: 600 };
const FILTERS = [
  ["competitive", "Competitive"],
  ["unrated", "Unrated"],
  ["swiftplay", "Swiftplay"],
  ["teamdeathmatch", "Team DM"],
  ["deathmatch", "Deathmatch"],
  ["spikerush", "Spike Rush"],
] as const;

const RANKS: Record<number, [string, string, string?]> = {
  3: ["I1", "#6b6b6b"], 4: ["I2", "#6b6b6b"], 5: ["I3", "#6b6b6b"],
  6: ["B1", "#8b501a"], 7: ["B2", "#8b501a"], 8: ["B3", "#8b501a"],
  9: ["S1", "#858c94"], 10: ["S2", "#858c94"], 11: ["S3", "#858c94"],
  12: ["G1", "#b88a00"], 13: ["G2", "#b88a00"], 14: ["G3", "#b88a00"],
  15: ["P1", "#008b94"], 16: ["P2", "#008b94"], 17: ["P3", "#008b94"],
  18: ["D1", "#6a29be"], 19: ["D2", "#6a29be"], 20: ["D3", "#6a29be"],
  21: ["A1", "#1e963a"], 22: ["A2", "#1e963a"], 23: ["A3", "#1e963a"],
  24: ["IM1", "#bf2e2e"], 25: ["IM2", "#bf2e2e"], 26: ["IM3", "#bf2e2e"],
  27: ["RAD", "#ffe400", "#1a1000"],
};

/** Rang-Icon, solange valorant-api.com nicht erreichbar ist als Text-Kürzel */
function RankBadge({ tier, tiers }: { tier: number; tiers: Record<number, TierInfo> }) {
  if (tier > 0 && tiers[tier]?.icon) return <RankIcon tier={tier} tiers={tiers} size={22} />;
  const [abbr, bg, fg] = RANKS[tier] ?? ["?", "#353540"];
  return (
    <span className="rank-badge" style={{ background: bg, color: fg ?? "#fff" }}>
      {abbr}
    </span>
  );
}

const enc = encodeURIComponent;

interface MyStats {
  k: number; d: number; a: number; score: number; hs: number; bs: number; ls: number; won: boolean; agent: string;
}

function myStats(match: any, name: string): MyStats {
  const players: any[] = match?.players?.all_players ?? [];
  const me = players.find((p) => p.name?.toLowerCase() === name.toLowerCase());
  if (!me) return { k: 0, d: 0, a: 0, score: 0, hs: 0, bs: 0, ls: 0, won: false, agent: "—" };
  const s = me.stats ?? {};
  let won = false;
  if (match.metadata?.mode?.toLowerCase() === "deathmatch") won = !players.some((p) => (p.stats?.kills ?? 0) > s.kills);
  else won = !!match.teams?.[me.team?.toLowerCase()]?.has_won;
  return { k: s.kills ?? 0, d: s.deaths ?? 0, a: s.assists ?? 0, score: s.score ?? 0, hs: s.headshots ?? 0, bs: s.bodyshots ?? 0, ls: s.legshots ?? 0, won, agent: me.character ?? "—" };
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

export function StatsTab() {
  const { settings, updateSettings } = useApp();
  const [nameInput, setNameInput] = useState(settings.HenrikName);
  const [tagInput, setTagInput] = useState(settings.HenrikTag);
  const [keyInput, setKeyInput] = useState("");
  const [filter, setFilter] = useState("competitive");
  const [account, setAccount] = useState<{ name: string; level: number } | null>(null);
  const [mmr, setMmr] = useState<MmrV3 | null>(null);
  const [rrHistory, setRrHistory] = useState<MmrHistoryEntry[] | null>(null);
  const tiers = useTiers();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<any | null>(null);

  const name = settings.HenrikName;
  const tag = settings.HenrikTag;
  const key = settings.HenrikApiKey;

  const get = async (path: string, ttl: number) => JSON.parse(await api.henrikGet(path, ttl, key)).data;

  const load = async (n: string, t: string, mode: string) => {
    if (!n || !t || !key) return;
    setLoading(true);
    setError(null);
    const [acc, mmrRes, hist, m] = await Promise.allSettled([
      get(`v1/account/${enc(n)}/${enc(t)}`, TTL.account),
      get(`v3/mmr/eu/pc/${enc(n)}/${enc(t)}`, TTL.rank),
      get(`v2/mmr-history/eu/pc/${enc(n)}/${enc(t)}`, TTL.rank),
      get(`v3/matches/eu/${enc(n)}/${enc(t)}?size=20&mode=${mode}`, TTL.matches),
    ]);
    setAccount(acc.status === "fulfilled" ? { name: `${acc.value.name}#${acc.value.tag}`, level: acc.value.account_level } : null);
    setMmr(mmrRes.status === "fulfilled" ? mmrRes.value : null);
    setRrHistory(hist.status === "fulfilled" ? hist.value.history ?? [] : null);
    setMatches(m.status === "fulfilled" ? m.value : []);
    const firstErr = [acc, mmrRes, m].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (acc.status === "rejected") setError(errText(acc.reason));
    else if (m.status === "rejected") setError(errText(firstErr?.reason));
    setLoading(false);
  };

  useEffect(() => {
    load(name, tag, filter);
  }, [name, tag, key, filter]);

  const search = (n = nameInput.trim(), t = tagInput.replace(/^#/, "").trim()) => {
    if (!n || !t) return;
    setNameInput(n);
    setTagInput(t);
    api.henrikInvalidate(`/${enc(n)}/${enc(t)}`);
    if (n === name && t === tag) load(n, t, filter);
    else updateSettings({ HenrikName: n, HenrikTag: t });
  };

  if (!key)
    return (
      <div className="page">
        <div className="banner">
          <h3>HenrikDev API Key benötigt</h3>
          <p>
            Kostenlosen Key holen unter{" "}
            <button className="btn link" onClick={() => openUrl("https://dashboard.henrikdev.xyz")}>
              dashboard.henrikdev.xyz
            </button>
          </p>
          <div className="add-row">
            <input placeholder="HDEV-xxxxxxxx-…" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
            <button className="btn primary" onClick={() => keyInput.trim() && updateSettings({ HenrikApiKey: keyInput.trim() })}>
              Speichern
            </button>
          </div>
        </div>
      </div>
    );

  // Aggregierte Stats
  const all = matches.map((m) => ({ m, s: myStats(m, name) }));
  const tot = all.reduce(
    (acc, { m, s }) => {
      acc.k += s.k; acc.d += s.d; acc.hs += s.hs; acc.shots += s.hs + s.bs + s.ls;
      acc.acs += s.score / Math.max(1, m.metadata?.rounds_played ?? 1);
      if (s.won) acc.w++;
      return acc;
    },
    { k: 0, d: 0, hs: 0, shots: 0, acs: 0, w: 0 },
  );
  const n = all.length;
  const groupBy = (keyFn: (x: (typeof all)[number]) => string) => {
    const map = new Map<string, { games: number; wins: number; k: number; d: number }>();
    for (const x of all) {
      const g = map.get(keyFn(x)) ?? { games: 0, wins: 0, k: 0, d: 0 };
      g.games++; g.wins += x.s.won ? 1 : 0; g.k += x.s.k; g.d += x.s.d;
      map.set(keyFn(x), g);
    }
    return [...map.entries()].sort((a, b) => b[1].games - a[1].games).slice(0, 5);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div className="player-head">
          <h2>{account?.name ?? (name ? `${name}#${tag}` : "Spieler suchen")}</h2>
          <p className="muted">
            {account ? `Level ${account.level}` : ""}
          </p>
        </div>
        <div className="search-row">
          <input placeholder="Name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          <input className="tag" placeholder="#TAG" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          <button className="btn primary" onClick={() => search()}>
            Suchen
          </button>
          <button className="icon-btn" title="Neu laden" onClick={() => search(name, tag)}>
            ⟳
          </button>
        </div>
      </div>

      {mmr && (
        <div className="rank-row">
          <RankCards mmr={mmr} tiers={tiers} />
          <div className="card rr-card">
            <span className="kpi-label">RR-Verlauf</span>
            {rrHistory ? <RrHistory history={rrHistory} /> : <span className="muted">Nicht verfügbar</span>}
          </div>
        </div>
      )}
      {mmr && mmr.seasonal.length > 0 && (
        <div className="card">
          <span className="kpi-label">Acts</span>
          <ActList seasonal={mmr.seasonal} tiers={tiers} />
        </div>
      )}

      <div className="filters">
        {FILTERS.map(([id, label]) => (
          <button key={id} className={`pill ${filter === id ? "on" : ""}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="err-text">{error}</p>}

      <div className="kpis">
        {[
          ["Winrate", n ? pct(tot.w, n) : "—"],
          ["K/D", n ? (tot.d ? (tot.k / tot.d).toFixed(2) : String(tot.k)) : "—"],
          ["ACS", n ? Math.round(tot.acs / n) : "—"],
          ["HS%", pct(tot.hs, tot.shots)],
          ["Matches", n || "—"],
        ].map(([l, v]) => (
          <div className="kpi" key={l}>
            <span>{l}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>

      <div className="stats-grid">
        <div className="card match-list">
          <div className="card-head">
            <h4>Letzte Matches</h4>
            {loading && <span className="muted">lädt…</span>}
          </div>
          {all.map(({ m, s }) => {
            const rounds = Math.max(1, m.metadata?.rounds_played ?? 1);
            return (
              <button key={m.metadata?.matchid} className={`match ${s.won ? "win" : "loss"}`} onClick={() => setBoard(m)}>
                <b className="wl">{s.won ? "WIN" : "LOSS"}</b>
                <span>{s.agent}</span>
                <span className="muted">{m.metadata?.map}</span>
                <span>{s.k}/{s.d}/{s.a}</span>
                <span className="dim">ACS {Math.round(s.score / rounds)}</span>
                <span className="dim">HS {pct(s.hs, s.hs + s.bs + s.ls)}</span>
                <span className="dim">KD {(s.d ? s.k / s.d : s.k).toFixed(2)}</span>
              </button>
            );
          })}
          {!loading && n === 0 && !error && <p className="muted pad">Keine Matches.</p>}
        </div>
        <div className="side-col">
          <div className="card">
            <h4>Top Maps</h4>
            {groupBy((x) => x.m.metadata?.map ?? "?").map(([k, g]) => (
              <div className="top-row" key={k}>
                <span>{k}</span>
                <span className="muted">{g.games} Spiele</span>
                <b className="accent">{pct(g.wins, g.games)} WR</b>
              </div>
            ))}
          </div>
          <div className="card">
            <h4>Top Agents</h4>
            {groupBy((x) => x.s.agent).map(([k, g]) => (
              <div className="top-row" key={k}>
                <span>{k}</span>
                <span className="muted">{g.games} Spiele</span>
                <b className="accent">KD {(g.d ? g.k / g.d : g.k).toFixed(2)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      {board && (
        <Scoreboard
          match={board}
          me={name}
          fetchTier={async (n, t) => {
            try {
              return (await get(`v2/mmr/eu/${enc(n)}/${enc(t)}`, TTL.rank)).current_data?.currenttier ?? 0;
            } catch {
              return 0;
            }
          }}
          onClose={() => setBoard(null)}
          onPlayer={(n, t) => {
            setBoard(null);
            search(n, t);
          }}
        />
      )}
    </div>
  );
}

function Scoreboard({ match, me, fetchTier, onClose, onPlayer }: {
  match: any; me: string; fetchTier: (n: string, t: string) => Promise<number>; onClose: () => void; onPlayer: (n: string, t: string) => void;
}) {
  const [tiers, setTiers] = useState<Record<string, number>>({});
  const tierInfo = useTiers();
  const players: any[] = match.players?.all_players ?? [];
  const isDM = match.metadata?.mode?.toLowerCase() === "deathmatch";
  const rounds = Math.max(1, match.metadata?.rounds_played ?? 1);

  useEffect(() => {
    players.forEach((p) => fetchTier(p.name, p.tag).then((t) => setTiers((prev) => ({ ...prev, [`${p.name}#${p.tag}`]: t }))));
  }, [match]);

  const row = (p: any, i: number) => {
    const s = p.stats ?? {};
    const shots = (s.headshots ?? 0) + (s.bodyshots ?? 0) + (s.legshots ?? 0);
    return (
      <button key={`${p.name}#${p.tag}`} className={`sb-row ${p.name?.toLowerCase() === me.toLowerCase() ? "me" : ""}`} onClick={() => onPlayer(p.name, p.tag)}>
        {isDM && <span className={i === 0 ? "gold" : "muted"}>#{i + 1}</span>}
        <span className="sb-name">
          <RankBadge tier={tiers[`${p.name}#${p.tag}`] ?? 0} tiers={tierInfo} /> {p.name}#{p.tag}
        </span>
        <span>{p.character}</span>
        <span>{s.kills}/{s.deaths}/{s.assists}</span>
        <span className="dim">{Math.round((s.score ?? 0) / rounds)}</span>
        <span className="dim">{pct(s.headshots ?? 0, shots)}</span>
        <span className="dim">{p.damage_made ?? 0}</span>
      </button>
    );
  };
  const head = (
    <div className={`sb-row head ${isDM ? "dm" : ""}`}>
      {isDM && <span>#</span>}
      <span>Spieler</span><span>Agent</span><span>K/D/A</span><span>ACS</span><span>HS%</span><span>DMG</span>
    </div>
  );

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h3 className="accent">{match.metadata?.map} — {match.metadata?.mode}</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className={`scoreboard ${isDM ? "dm" : ""}`}>
          {isDM ? (
            <>
              {head}
              {[...players].sort((a, b) => (b.stats?.kills ?? 0) - (a.stats?.kills ?? 0)).map(row)}
            </>
          ) : (
            ["red", "blue"].map((team) => {
              const t = match.teams?.[team];
              if (!t) return null;
              return (
                <div key={team} className="sb-team">
                  <h4 className={t.has_won ? "ok-text" : "err-text"}>
                    {team.toUpperCase()} — {t.has_won ? "WIN" : "LOSS"} {t.rounds_won}:{t.rounds_lost}
                  </h4>
                  {head}
                  {players.filter((p) => p.team?.toLowerCase() === team).map(row)}
                </div>
              );
            })
          )}
        </div>
        <p className="hint">Klick auf einen Spieler lädt seine Stats.</p>
      </div>
    </div>
  );
}
