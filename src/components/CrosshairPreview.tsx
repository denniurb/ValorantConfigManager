import type { ReactElement } from "react";
import type { CrosshairLines, CrosshairProfile, ProCrosshair } from "../api";

interface LineSpec {
  thickness: number;
  length: number;
  offset: number;
  opacity: number;
}

export interface CrosshairSpec {
  color: [number, number, number];
  outline: boolean;
  dot: boolean;
  dotSize: number;
  inner: LineSpec | null;
  outer: LineSpec | null;
}

export function specFromPro(p: ProCrosshair): CrosshairSpec {
  return {
    color: p.color,
    outline: !!p.outline,
    dot: !!p.dot,
    dotSize: p.dotSize ?? 2,
    inner:
      p.innerShow === false
        ? null
        : { thickness: p.innerThickness ?? 2, length: p.innerLength ?? 4, offset: p.innerOffset ?? 2, opacity: p.innerOpacity ?? 1 },
    outer: p.outerShow
      ? { thickness: p.outerThickness ?? 2, length: p.outerLength ?? 2, offset: p.outerOffset ?? 10, opacity: p.outerOpacity ?? 0.35 }
      : null,
  };
}

export function specFromProfile(p: CrosshairProfile): CrosshairSpec | null {
  const pr = p.primary;
  if (!pr) return null;
  const line = (l?: CrosshairLines) =>
    l && (l.lineLength ?? 0) > 0 && (l.opacity ?? 0) > 0
      ? { thickness: l.lineThickness ?? 1, length: l.lineLength ?? 0, offset: l.lineOffset ?? 0, opacity: l.opacity ?? 1 }
      : null;
  return {
    color: [pr.color?.r ?? 255, pr.color?.g ?? 255, pr.color?.b ?? 255],
    outline: !!pr.bHasOutline,
    dot: !!pr.bDisplayCenterDot,
    dotSize: pr.centerDotSize ?? 2,
    inner: line(pr.innerLines),
    outer: line(pr.outerLines),
  };
}

/** Pixelgenaue Vorschau: 1 Valorant-Einheit = `scale` px */
export function CrosshairPreview({ spec, size = 96, scale = 3 }: { spec: CrosshairSpec; size?: number; scale?: number }) {
  const c = size / 2;
  const rgb = `rgb(${spec.color.join(",")})`;
  const rects: ReactElement[] = [];

  const addLines = (l: LineSpec | null, key: string) => {
    if (!l) return;
    const t = Math.max(1, l.thickness) * scale * 0.5;
    const len = l.length * scale;
    const off = l.offset * scale;
    const arms = [
      { x: c + off, y: c - t / 2, w: len, h: t },
      { x: c - off - len, y: c - t / 2, w: len, h: t },
      { x: c - t / 2, y: c + off, w: t, h: len },
      { x: c - t / 2, y: c - off - len, w: t, h: len },
    ];
    arms.forEach((a, i) => {
      if (spec.outline)
        rects.push(<rect key={`${key}o${i}`} x={a.x - 1} y={a.y - 1} width={a.w + 2} height={a.h + 2} fill="#000" opacity={0.8} />);
      rects.push(<rect key={`${key}${i}`} x={a.x} y={a.y} width={a.w} height={a.h} fill={rgb} opacity={l.opacity} />);
    });
  };
  addLines(spec.inner, "i");
  addLines(spec.outer, "a");

  const dot = spec.dot ? Math.max(1, spec.dotSize) * scale * 0.5 : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="xh-preview">
      {rects}
      {spec.dot && (
        <>
          {spec.outline && <rect x={c - dot / 2 - 1} y={c - dot / 2 - 1} width={dot + 2} height={dot + 2} fill="#000" opacity={0.8} />}
          <rect x={c - dot / 2} y={c - dot / 2} width={dot} height={dot} fill={rgb} />
        </>
      )}
    </svg>
  );
}
