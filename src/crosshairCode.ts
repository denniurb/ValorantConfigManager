import type { CrosshairSpec } from "./components/CrosshairPreview";

/**
 * Valorant-Crosshair-Code → Vorschau.
 *
 * Aufbau: Blöcke `P` (Primär), `A` (ADS), `S` (Sniper), jeweils mit `Schlüssel;Wert`-Paaren.
 * Linien-Schlüssel tragen ein Präfix: `0` = innere, `1` = äußere Linien.
 *
 * Bekannte Schlüssel (aus öffentlichen Codes abgeleitet):
 *   c  Farbe (Preset-Index)      u  eigene Farbe als Hex
 *   o  Outline (nur im Block)    d  Center-Dot an/aus   z  Dot-Größe
 *   t  Dicke   l  Länge   o  Abstand (Offset)   a  Deckkraft   b  Linie an/aus
 * Alle anderen Schlüssel werden ignoriert, damit unbekannte Felder nichts kaputt machen.
 */

// Valorant-Preset-Farben (Index → RGB), Reihenfolge laut Valorant-Menü
const PRESET_COLORS: [number, number, number][] = [
  [255, 255, 255], // 0 weiß
  [0, 255, 0], // 1 grün
  [162, 255, 0], // 2 gelbgrün
  [204, 255, 0], // 3 grüngelb
  [255, 255, 0], // 4 gelb
  [0, 255, 255], // 5 cyan
  [255, 140, 228], // 6 pink
  [255, 0, 0], // 7 rot
];

const num = (v: string | undefined, fallback: number) => {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.replace(/^#/, "");
  if (h.length === 8) return [parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), parseInt(h.slice(6, 8), 16)];
  if (h.length === 6) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  return null;
}

/** Nur den Primär-Block (`P`) auswerten, ADS und Sniper ignorieren */
export function decodeCrosshair(code: string): CrosshairSpec | null {
  const tokens = code.trim().split(";").filter((t) => t !== "");
  const start = tokens.findIndex((t) => t === "P");
  if (start < 0) return null;

  const primary: Record<string, string> = {};
  for (let i = start + 1; i < tokens.length; i += 2) {
    const key = tokens[i];
    if (/^[A-Z]$/.test(key)) break; // nächster Block beginnt
    primary[key] = tokens[i + 1];
  }

  const color =
    primary["u"] !== undefined && parseHex(primary["u"])
      ? parseHex(primary["u"])!
      : PRESET_COLORS[num(primary["c"], 0)] ?? PRESET_COLORS[0];

  const line = (prefix: "0" | "1"): CrosshairSpec["inner"] => {
    const l = num(primary[`${prefix}l`], 0);
    const shown = primary[`${prefix}b`] !== "0" && l > 0;
    if (!shown) return null;
    return {
      thickness: num(primary[`${prefix}t`], 2),
      length: l,
      offset: num(primary[`${prefix}o`], 2),
      opacity: num(primary[`${prefix}a`], 1),
    };
  };

  return {
    color,
    outline: primary["o"] === "1",
    dot: primary["d"] === "1",
    dotSize: num(primary["z"], 2),
    inner: line("0"),
    outer: line("1"),
  };
}
