/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { api } from "../api";

// ── Rang-Stufen (Icons/Farben von valorant-api.com) ─────────────────────────

export interface TierInfo {
  name: string;
  icon: string;
  color: string;
}

let tiersPromise: Promise<Record<number, TierInfo>> | null = null;

function loadTiers() {
  tiersPromise ??= api
    .competitiveTiers()
    .then((body) => {
      const sets: any[] = JSON.parse(body).data ?? [];
      const latest = sets[sets.length - 1];
      const map: Record<number, TierInfo> = {};
      for (const t of latest?.tiers ?? []) {
        map[t.tier] = { name: t.tierName, icon: t.smallIcon, color: `#${String(t.color ?? "ffffffff").slice(0, 6)}` };
      }
      return map;
    })
    .catch(() => {
      tiersPromise = null; // beim nächsten Mal erneut versuchen
      return {};
    });
  return tiersPromise;
}

export function useTiers() {
  const [tiers, setTiers] = useState<Record<number, TierInfo>>({});
  useEffect(() => {
    loadTiers().then(setTiers);
  }, []);
  return tiers;
}

export function RankIcon({ tier, tiers, size = 40 }: { tier: number; tiers: Record<number, TierInfo>; size?: number }) {
  const t = tiers[tier];
  if (!t?.icon) return <div className="rank-icon-fallback" style={{ width: size, height: size }} />;
  return <img className="rank-icon" src={t.icon} width={size} height={size} alt={t.name} title={t.name} />;
}

// ── Daten-Typen (HenrikDev MMR v3 / MMR-History v2) ─────────────────────────

interface TierRef {
  id: number;
  name: string;
}
export interface MmrV3 {
  current: { tier: TierRef; rr: number; last_change: number; elo: number; games_needed_for_rating: number; rank_protection_shields: number };
  peak: { season: { short: string }; tier: TierRef; rr: number } | null;
  seasonal: { season: { short: string }; wins: number; games: number; end_tier: TierRef; end_rr: number; act_wins: TierRef[] }[];
}
export interface MmrHistoryEntry {
  tier: TierRef;
  map: { name: string };
  season: { short: string };
  rr: number;
  last_change: number;
  elo: number;
  date: string;
  is_placement_match?: boolean;
  was_derank_protected?: boolean;
  refunded_rr?: number;
}

const actLabel = (short: string) => short.toUpperCase().replace("A", " A");

// ── Karten ──────────────────────────────────────────────────────────────────

export function RankCards({ mmr, tiers }: { mmr: MmrV3; tiers: Record<number, TierInfo> }) {
  const c = mmr.current;
  const unrated = c.tier.id === 0;
  const color = tiers[c.tier.id]?.color ?? "var(--dim)";
  return (
    <div className="rank-cards">
      <div className="card rank-card">
        <span className="kpi-label">Aktueller Rang</span>
        <div className="rank-main">
          <RankIcon tier={c.tier.id} tiers={tiers} size={64} />
          <div className="rank-text">
            <b style={{ color: unrated ? undefined : color }}>{c.tier.name}</b>
            {unrated ? (
              <span className="muted">
                {c.games_needed_for_rating > 0 ? `Noch ${c.games_needed_for_rating} Placement-Spiele` : "Keine Wertung in diesem Act"}
              </span>
            ) : (
              <>
                <div className="rr-bar">
                  <div style={{ width: `${Math.min(100, Math.max(0, c.rr))}%`, background: color }} />
                </div>
                <span className="muted">
                  {c.rr} / 100 RR
                  {c.last_change !== 0 && (
                    <b className={c.last_change > 0 ? "ok-text" : "err-text"}>
                      {" "}
                      {c.last_change > 0 ? "+" : ""}
                      {c.last_change}
                    </b>
                  )}
                </span>
              </>
            )}
          </div>
        </div>
        {c.rank_protection_shields > 0 && <span className="chip ok">🛡 {c.rank_protection_shields} Rank-Protection</span>}
      </div>

      <div className="card rank-card">
        <span className="kpi-label">Peak</span>
        {mmr.peak ? (
          <div className="rank-main">
            <RankIcon tier={mmr.peak.tier.id} tiers={tiers} size={64} />
            <div className="rank-text">
              <b style={{ color: tiers[mmr.peak.tier.id]?.color }}>{mmr.peak.tier.name}</b>
              <span className="muted">{actLabel(mmr.peak.season.short)}</span>
            </div>
          </div>
        ) : (
          <span className="muted">Kein Peak bekannt</span>
        )}
      </div>
    </div>
  );
}

/** RR-Änderung pro Spiel als Balken (älteste links) */
export function RrHistory({ history }: { history: MmrHistoryEntry[] }) {
  const games = [...history].reverse();
  const ranked = games.filter((g) => !g.is_placement_match);
  if (games.length === 0) return <p className="muted">Keine Competitive-Spiele gefunden.</p>;

  const max = Math.max(30, ...games.map((g) => Math.abs(g.last_change)));
  const W = 34;
  const H = 150;
  const mid = H / 2;
  const total = ranked.reduce((s, g) => s + g.last_change, 0);
  const wins = ranked.filter((g) => g.last_change > 0).length;

  return (
    <div className="rr-history">
      <div className="rr-summary">
        <span>
          Letzte {games.length} Spiele{" "}
          {ranked.length > 0 && (
            <>
              · Saldo{" "}
              <b className={total >= 0 ? "ok-text" : "err-text"}>
                {total > 0 ? "+" : ""}
                {total} RR
              </b>{" "}
              · {wins}/{ranked.length} gewonnen
            </>
          )}
        </span>
      </div>
      <div className="rr-chart-scroll">
        <svg width={games.length * W} height={H + 22} className="rr-chart">
          <line x1={0} x2={games.length * W} y1={mid} y2={mid} className="rr-zero" />
          {games.map((g, i) => {
            const x = i * W + 5;
            const bw = W - 10;
            const date = new Date(g.date).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
            const tip = `${g.map?.name ?? "?"} · ${date}${g.is_placement_match ? " · Placement" : ""}${g.was_derank_protected ? " · Derank-Schutz" : ""}\n${g.tier.name} ${g.rr} RR (${g.last_change > 0 ? "+" : ""}${g.last_change})`;
            if (g.is_placement_match) {
              return (
                <g key={i}>
                  <title>{tip}</title>
                  <rect x={x} y={mid - 8} width={bw} height={16} rx={3} className="rr-placement" />
                  <text x={x + bw / 2} y={mid + 4} className="rr-label">
                    P
                  </text>
                </g>
              );
            }
            const h = Math.max(2, (Math.abs(g.last_change) / max) * (mid - 14));
            const up = g.last_change >= 0;
            return (
              <g key={i}>
                <title>{tip}</title>
                <rect x={x} y={up ? mid - h : mid} width={bw} height={h} rx={3} className={up ? "rr-up" : "rr-down"} />
                <text x={x + bw / 2} y={up ? mid - h - 4 : mid + h + 12} className="rr-label">
                  {up ? "+" : ""}
                  {g.last_change}
                </text>
              </g>
            );
          })}
          {games.map((g, i) => (
            <text key={`m${i}`} x={i * W + W / 2} y={H + 16} className="rr-map">
              {(g.map?.name ?? "?").slice(0, 4)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

/** Act-Historie, neueste zuerst */
export function ActList({ seasonal, tiers }: { seasonal: MmrV3["seasonal"]; tiers: Record<number, TierInfo> }) {
  const acts = [...seasonal].filter((s) => s.games > 0).reverse();
  if (acts.length === 0) return <p className="muted">Keine Act-Daten.</p>;
  return (
    <div className="act-list">
      {acts.map((s) => {
        const top = s.act_wins.reduce((best, t) => (t.id > best ? t.id : best), 0);
        return (
          <div className="act" key={s.season.short} title={top ? `Höchster Sieg: ${tiers[top]?.name ?? top}` : undefined}>
            <span className="act-name">{actLabel(s.season.short)}</span>
            <RankIcon tier={s.end_tier.id} tiers={tiers} size={44} />
            <b style={{ color: tiers[s.end_tier.id]?.color }}>{s.end_tier.name}</b>
            <span className="muted">
              {s.wins}W / {s.games}
            </span>
            <span className="dim">{Math.round((s.wins / s.games) * 100)}% WR</span>
          </div>
        );
      })}
    </div>
  );
}
