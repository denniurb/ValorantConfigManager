import { useMemo, useState } from "react";
import { useApp } from "../state";
import { CrosshairPreview } from "../components/CrosshairPreview";
import { decodeCrosshair } from "../crosshairCode";
import codes from "../data/crosshairCodes.json";

interface CodeEntry {
  name: string;
  code: string;
}
const LIBRARY = codes as CodeEntry[];

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CrosshairTab() {
  const { toast } = useApp();
  const [query, setQuery] = useState("");
  const [pasted, setPasted] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? LIBRARY.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) : LIBRARY;
  }, [query]);

  const pastedSpec = pasted.trim() ? decodeCrosshair(pasted.trim()) : null;

  const copy = async (code: string) => {
    if (await copyText(code)) {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1500);
      toast("Code kopiert — in Valorant einfügen", "ok");
    } else {
      toast("Kopieren nicht möglich, bitte Code manuell markieren", "err");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Crosshairs</h2>
          <p className="muted">Crosshair auswählen, Code kopieren und in Valorant einfügen.</p>
        </div>
        <input className="search" placeholder="Name oder Code suchen…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="card howto-card">
        <h4>So importierst du den Code</h4>
        <ol className="howto">
          <li>Crosshair anklicken (der Code wird kopiert).</li>
          <li>
            In Valorant: <b>Einstellungen → Crosshair</b> → oben rechts <b>Import Profile Code</b>.
          </li>
          <li>Code einfügen → <b>Import</b>. Das Crosshair wird sofort in der Vorschau übernommen.</li>
        </ol>
        <p className="hint">Ein Account kann bis zu 15 Crosshair-Profile speichern. Codes ändern nur das Aussehen, keine Sensitivität oder Tasten.</p>
      </div>

      <div className="card paste-card">
        <h4>Code von anderswo einfügen</h4>
        <div className="paste-row">
          <input placeholder="0;P;c;5;h;0;…" value={pasted} onChange={(e) => setPasted(e.target.value)} className="mono" />
          {pastedSpec && (
            <div className="xh-stage">
              <CrosshairPreview spec={pastedSpec} size={72} scale={2.4} />
            </div>
          )}
          <button className="btn primary" disabled={!pastedSpec} onClick={() => copy(pasted.trim())}>
            {copiedCode === pasted.trim() ? "✔ Kopiert" : "Kopieren"}
          </button>
        </div>
        {pasted.trim() && !pastedSpec && <p className="err-text">Das sieht nicht nach einem Valorant-Crosshair-Code aus.</p>}
      </div>

      <div className="code-grid">
        {filtered.map((c) => {
          const spec = decodeCrosshair(c.code);
          const isCopied = copiedCode === c.code;
          return (
            <button key={c.code} className={`code-card ${isCopied ? "copied" : ""}`} onClick={() => copy(c.code)} title={c.code}>
              <div className="xh-stage">{spec && <CrosshairPreview spec={spec} size={96} scale={3} />}</div>
              <b>{c.name}</b>
              <span className="code-text mono">{c.code}</span>
              <span className="copy-hint">{isCopied ? "✔ kopiert" : "Klicken zum Kopieren"}</span>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="muted">Keine Crosshairs gefunden.</p>}
      </div>
    </div>
  );
}
