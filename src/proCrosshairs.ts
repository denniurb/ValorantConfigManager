import type { ProCrosshair } from "./api";

const W: [number, number, number] = [255, 255, 255];
const Y: [number, number, number] = [255, 255, 0];
const C: [number, number, number] = [0, 255, 255];

// Thickness / Length / Offset = Valorant-Ingame-Werte
const lines = (t: number, l: number, o: number) => ({ innerThickness: t, innerLength: l, innerOffset: o });

export const PRO_CROSSHAIRS: ProCrosshair[] = [
  { player: "TenZ", team: "Sentinels", color: C, ...lines(2, 4, 3) },
  { player: "ScreaM", team: "NA", color: Y, outline: true, outlineOpacity: 1, dot: true, ...lines(1, 1, 3) },
  { player: "Shroud", team: "Retired", color: W, ...lines(1, 5, 3) },
  { player: "Yay", team: "NRG", color: W, ...lines(1, 4, 3) },
  { player: "Aspas", team: "LOUD", color: W, ...lines(1, 4, 3) },
  { player: "NiS", team: "Paper Rex", color: W, ...lines(1, 4, 4) },
  { player: "Demon1", team: "NRG", color: W, ...lines(2, 4, 3) },
  { player: "Zellsis", team: "Sentinels", color: W, ...lines(1, 3, 2) },
  { player: "Derke", team: "Fnatic", color: W, ...lines(2, 4, 4) },
  { player: "Alfajer", team: "Fnatic", color: W, outline: true, outlineOpacity: 1, ...lines(2, 5, 3) },
  { player: "Chronicle", team: "Fnatic", color: W, ...lines(1, 4, 2) },
  { player: "Boaster", team: "Fnatic", color: [255, 0, 0], outline: true, outlineOpacity: 1, ...lines(2, 4, 2) },
  { player: "Leo", team: "Fnatic", color: W, ...lines(2, 5, 2) },
  { player: "Sacy", team: "Sentinels", color: W, ...lines(1, 4, 3) },
  { player: "Pgura", team: "Sentinels", color: Y, outline: true, outlineOpacity: 1, ...lines(2, 3, 2) },
  { player: "Neon", team: "Sentinels", color: W, ...lines(2, 4, 2) },
  { player: "Jawgemo", team: "LOUD", color: W, ...lines(1, 6, 3) },
  { player: "Less", team: "LOUD", color: W, outline: true, outlineOpacity: 1, ...lines(1, 3, 2) },
  { player: "f0rsaken", team: "Paper Rex", color: W, ...lines(2, 5, 3) },
  { player: "Jinggg", team: "Paper Rex", color: W, ...lines(2, 4, 2) },
  { player: "Mindfreak", team: "Paper Rex", color: [0, 255, 0], dot: true, outline: true, outlineOpacity: 0.5, ...lines(2, 3, 2) },
  { player: "Sheydos", team: "Team Liquid", color: W, ...lines(2, 4, 2) },
  { player: "Nats", team: "Team Liquid", color: W, ...lines(1, 3, 2) },
  { player: "cNed", team: "Team Liquid", color: Y, outline: true, outlineOpacity: 1, dot: true, ...lines(2, 4, 3) },
  { player: "Nivera", team: "Team Liquid", color: W, ...lines(1, 4, 2) },
  { player: "Laz", team: "ZETA", color: W, ...lines(2, 5, 3) },
  { player: "Dep", team: "ZETA", color: W, dot: true, dotSize: 3, innerShow: false },
  { player: "Something", team: "NRG", color: W, ...lines(1, 3, 2) },
  { player: "Crashies", team: "NRG", color: W, ...lines(2, 4, 2) },
  { player: "Victor", team: "NRG", color: W, ...lines(1, 4, 3) },
  { player: "Valyn", team: "NRG", color: W, ...lines(2, 5, 2) },
  { player: "Saadhak", team: "LOUD", color: W, outline: true, outlineOpacity: 1, ...lines(1, 3, 2) },
  { player: "Xeta", team: "Cloud9", color: W, ...lines(2, 4, 3) },
  { player: "Leaf", team: "Cloud9", color: W, ...lines(1, 3, 2) },
  { player: "Forsaken", team: "Cloud9", color: W, ...lines(2, 5, 4) },
  { player: "Zander", team: "Cloud9", color: W, ...lines(2, 4, 2) },
  { player: "Crim", team: "Cloud9", color: W, ...lines(1, 4, 2) },
  { player: "Yay (dot)", team: "Classic", color: Y, dot: true, innerShow: false },
  { player: "TenZ (dot)", team: "Classic", color: C, dot: true, innerShow: false },
  { player: "ScreaM (classic)", team: "Aim God", color: Y, outline: true, outlineOpacity: 1, dot: true, ...lines(1, 1, 2) },
];
