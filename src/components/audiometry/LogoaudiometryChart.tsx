import type { LogoaudiometryEar, AudiogramEarSide } from "@/types";

interface Props {
  ear: AudiogramEarSide;
  data: LogoaudiometryEar;
  onChange: (next: LogoaudiometryEar) => void;
  readOnly?: boolean;
}

const MIN_DB = 0;
const MAX_DB = 110;
const W = 420;
const H = 320;
const PAD_L = 40;
const PAD_R = 20;
const PAD_T = 20;
const PAD_B = 30;
const plotW = W - PAD_L - PAD_R;
const plotH = H - PAD_T - PAD_B;

function xFor(db: number) {
  return PAD_L + ((db - MIN_DB) / (MAX_DB - MIN_DB)) * plotW;
}
function yFor(pct: number) {
  return PAD_T + ((100 - pct) / 100) * plotH;
}

export function LogoaudiometryChart({ ear, data, onChange, readOnly }: Props) {
  const color = ear === "right" ? "#dc2626" : "#2563eb";

  function handleClick(evt: React.MouseEvent<SVGSVGElement>) {
    if (readOnly) return;
    const rect = evt.currentTarget.getBoundingClientRect();
    const sx = ((evt.clientX - rect.left) / rect.width) * W;
    const sy = ((evt.clientY - rect.top) / rect.height) * H;
    if (sx < PAD_L || sx > W - PAD_R || sy < PAD_T || sy > H - PAD_B) return;
    const db = Math.round((((sx - PAD_L) / plotW) * (MAX_DB - MIN_DB) + MIN_DB) / 5) * 5;
    const pct = Math.max(0, Math.min(100, Math.round((1 - (sy - PAD_T) / plotH) * 100 / 5) * 5));
    const filtered = data.curve.filter((p) => p.intensity !== db);
    const updated = [...filtered, { intensity: db, percent: pct }].sort((a, b) => a.intensity - b.intensity);
    onChange({ ...data, curve: updated });
  }

  function removePoint(intensity: number, evt: React.MouseEvent) {
    if (readOnly) return;
    evt.stopPropagation();
    onChange({ ...data, curve: data.curve.filter((p) => p.intensity !== intensity) });
  }

  const sorted = [...data.curve].sort((a, b) => a.intensity - b.intensity);
  const pathD = sorted.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(p.intensity)} ${yFor(p.percent)}`).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold" style={{ color }}>
        Logoaudiometría {ear === "right" ? "OD" : "OI"}
      </h3>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-text-tertiary">SRT (dB)</span>
          <input
            type="number"
            value={data.srt ?? ""}
            disabled={readOnly}
            onChange={(e) => onChange({ ...data, srt: e.target.value === "" ? null : Number(e.target.value) })}
            className="rounded border border-border-secondary bg-bg-secondary px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-tertiary">Discrim. %</span>
          <input
            type="number"
            value={data.discrimination ?? ""}
            disabled={readOnly}
            onChange={(e) => onChange({ ...data, discrimination: e.target.value === "" ? null : Number(e.target.value) })}
            className="rounded border border-border-secondary bg-bg-secondary px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-tertiary">@ Intensidad (dB)</span>
          <input
            type="number"
            value={data.discrimination_intensity ?? ""}
            disabled={readOnly}
            onChange={(e) => onChange({ ...data, discrimination_intensity: e.target.value === "" ? null : Number(e.target.value) })}
            className="rounded border border-border-secondary bg-bg-secondary px-2 py-1"
          />
        </label>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full border border-border-secondary bg-bg-secondary"
        onClick={handleClick}
        style={{ cursor: readOnly ? "default" : "crosshair" }}
      >
        {Array.from({ length: 11 }, (_, i) => {
          const pct = i * 10;
          const y = yFor(pct);
          return (
            <g key={`h${pct}`}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#6b7280">{pct}</text>
            </g>
          );
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const db = i * 10;
          const x = xFor(db);
          return (
            <g key={`v${db}`}>
              <line x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="#e5e7eb" strokeWidth={0.5} />
              <text x={x} y={H - PAD_B + 12} textAnchor="middle" fontSize={9} fill="#6b7280">{db}</text>
            </g>
          );
        })}
        <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="none" stroke="#9ca3af" strokeWidth={1} />
        <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
        {sorted.map((p) => (
          <circle
            key={p.intensity}
            cx={xFor(p.intensity)}
            cy={yFor(p.percent)}
            r={4}
            fill={color}
            onClick={(e) => removePoint(p.intensity, e)}
            style={{ cursor: readOnly ? "default" : "pointer" }}
          />
        ))}
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#6b7280">Intensidad (dB)</text>
        <text x={10} y={H / 2} textAnchor="middle" fontSize={9} fill="#6b7280" transform={`rotate(-90 10 ${H / 2})`}>% Discrim.</text>
      </svg>
      <textarea
        value={data.observations}
        disabled={readOnly}
        onChange={(e) => onChange({ ...data, observations: e.target.value })}
        placeholder="Observaciones logoaudiometría..."
        className="min-h-[60px] rounded border border-border-secondary bg-bg-secondary px-2 py-1 text-xs"
      />
    </div>
  );
}
