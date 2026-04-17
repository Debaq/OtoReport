import { useRef, useState } from "react";
import type { RegerData, AudiogramEar, AudiogramEarSide, Frequency } from "@/types";
import { AUDIOGRAM_FREQUENCIES, classifyBalance, BALANCE_CLASS_LABELS, BALANCE_CLASS_COLORS } from "@/types";
import { AshaSymbol } from "./AudiogramChart";
import { Plus, Minus, RotateCcw } from "lucide-react";

interface Props {
  data: RegerData;
  onChange: (next: RegerData) => void;
  right?: AudiogramEar;
  left?: AudiogramEar;
  readOnly?: boolean;
}

const MIN_DB = -10;
const MAX_DB = 120;
const STEP_SNAP = 5;
const PAD_L = 54;
const PAD_T = 28;
const PAD_R = 32;
const PAD_B = 34;
const W = 700;
const H = 440;
const plotW = W - PAD_L - PAD_R;
const plotH = H - PAD_T - PAD_B;
const EAR_COLOR: Record<AudiogramEarSide, string> = { right: "#dc2626", left: "#2563eb" };

function xFor(i: number) { return PAD_L + (i * plotW) / (AUDIOGRAM_FREQUENCIES.length - 1); }
function yFor(db: number) { return PAD_T + ((db - MIN_DB) * plotH) / (MAX_DB - MIN_DB); }
function dbFromY(y: number) {
  const db = MIN_DB + ((y - PAD_T) / plotH) * (MAX_DB - MIN_DB);
  return Math.max(MIN_DB, Math.min(MAX_DB, Math.round(db / STEP_SNAP) * STEP_SNAP));
}
function findThresholdAt(ear: AudiogramEar | undefined, freq: Frequency): number | null {
  if (!ear) return null;
  const p = ear.air.find((pt) => pt.frequency === freq && !pt.noResponse);
  return p ? p.threshold : null;
}
function freqLabel(f: Frequency) { return f >= 1000 ? `${f / 1000}k` : `${f}`; }

export function RegerChart({ data, onChange, right, left, readOnly }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const earColor = EAR_COLOR[data.ear];
  const earAud = data.ear === "right" ? right : left;
  const refIdx = AUDIOGRAM_FREQUENCIES.indexOf(data.reference_frequency);
  const cmpIdx = AUDIOGRAM_FREQUENCIES.indexOf(data.comparison_frequency);
  const xRef = xFor(Math.max(0, refIdx));
  const xCmp = xFor(Math.max(0, cmpIdx));

  const steps = data.matches.length;
  const referenceLevels = Array.from({ length: steps }, (_, i) => Math.min(MAX_DB, data.threshold_db + i * data.step_db));

  function update(patch: Partial<RegerData>) { onChange({ ...data, ...patch }); }

  function setEar(ear: AudiogramEarSide) {
    const aud = ear === "right" ? right : left;
    const t = findThresholdAt(aud, data.reference_frequency);
    update({ ear, threshold_db: t ?? data.threshold_db });
  }
  function setRefFreq(f: Frequency) {
    const t = findThresholdAt(earAud, f);
    update({ reference_frequency: f, threshold_db: t ?? data.threshold_db });
  }
  function setCmpFreq(f: Frequency) { update({ comparison_frequency: f }); }
  function addStep() { update({ matches: [...data.matches, null] }); }
  function removeLastStep() {
    if (data.matches.length === 0) return;
    update({ matches: data.matches.slice(0, -1) });
  }
  function resetMatches() { update({ matches: data.matches.map(() => null) }); }

  function handleClick(evt: React.MouseEvent<SVGSVGElement>) {
    if (readOnly || !svgRef.current) return;
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    if (p.y < PAD_T - 6 || p.y > H - PAD_B + 6) return;
    const dCmp = Math.abs(p.x - xCmp);
    const dRef = Math.abs(p.x - xRef);
    const HIT = 22;
    if (dCmp <= HIT && dCmp < dRef) {
      const db = dbFromY(p.y);
      let idx = activeIdx;
      if (idx === null || idx < 0 || idx >= data.matches.length) {
        idx = data.matches.findIndex((m) => m === null);
        if (idx === -1) return;
      }
      const next = [...data.matches];
      next[idx] = db;
      update({ matches: next });
      if (autoAdvance) {
        const nextEmpty = next.findIndex((m, i) => m === null && i > idx!);
        setActiveIdx(nextEmpty >= 0 ? nextEmpty : null);
      }
      return;
    }
    if (dRef <= HIT) {
      const db = dbFromY(p.y);
      let closest = 0;
      let bestD = Infinity;
      for (let i = 0; i < referenceLevels.length; i++) {
        const d = Math.abs(referenceLevels[i] - db);
        if (d < bestD) { bestD = d; closest = i; }
      }
      setActiveIdx(closest);
    }
  }

  function clearMatch(i: number, evt: React.MouseEvent) {
    if (readOnly) return;
    evt.stopPropagation();
    const next = [...data.matches];
    next[i] = null;
    update({ matches: next });
    setActiveIdx(i);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">Oído</span>
          <select
            value={data.ear}
            disabled={readOnly}
            onChange={(e) => setEar(e.target.value as AudiogramEarSide)}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          >
            <option value="right">OD</option>
            <option value="left">OI</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">Frec. peor</span>
          <select
            value={data.reference_frequency}
            disabled={readOnly}
            onChange={(e) => setRefFreq(Number(e.target.value) as Frequency)}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          >
            {AUDIOGRAM_FREQUENCIES.map((f) => <option key={f} value={f}>{freqLabel(f)} Hz</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">Frec. mejor</span>
          <select
            value={data.comparison_frequency}
            disabled={readOnly}
            onChange={(e) => setCmpFreq(Number(e.target.value) as Frequency)}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          >
            {AUDIOGRAM_FREQUENCIES.map((f) => <option key={f} value={f}>{freqLabel(f)} Hz</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">Umbral peor (dB)</span>
          <input
            type="number" step={5} value={data.threshold_db} disabled={readOnly}
            onChange={(e) => update({ threshold_db: Number(e.target.value) })}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">Paso (dB)</span>
          <input
            type="number" step={5} value={data.step_db} disabled={readOnly}
            onChange={(e) => update({ step_db: Math.max(5, Number(e.target.value)) })}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          />
        </label>
        {!readOnly && (
          <div className="flex items-end gap-1">
            <button type="button" onClick={addStep} className="flex items-center gap-1 rounded bg-accent px-2 py-1.5 text-xs font-semibold text-white"><Plus size={12} /></button>
            <button type="button" onClick={removeLastStep} className="flex items-center gap-1 rounded border border-border-secondary px-2 py-1.5 text-xs"><Minus size={12} /></button>
            <button type="button" onClick={resetMatches} className="flex items-center gap-1 rounded border border-border-secondary px-2 py-1.5 text-xs"><RotateCcw size={12} /></button>
          </div>
        )}
      </div>
      {!readOnly && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} />
          <span>Avanzar automáticamente al siguiente paso tras marcar</span>
        </label>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full border border-border-secondary bg-bg-secondary"
        style={{ maxHeight: "60vh", cursor: readOnly ? "default" : "crosshair" }}
        onClick={handleClick}
      >
        <g pointerEvents="none">
          {Array.from({ length: (MAX_DB - MIN_DB) / 10 + 1 }, (_, i) => {
            const db = MIN_DB + i * 10;
            const y = yFor(db);
            return (
              <g key={db}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />
                <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize={10} fill="#6b7280">{db}</text>
              </g>
            );
          })}
          {AUDIOGRAM_FREQUENCIES.map((f, i) => {
            const x = xFor(i);
            const isRef = f === data.reference_frequency;
            const isCmp = f === data.comparison_frequency;
            const sel = isRef || isCmp;
            return (
              <g key={f}>
                {sel && <rect x={x - 18} y={PAD_T} width={36} height={plotH} fill={isRef ? "#fee2e2" : "#dbeafe"} opacity={0.5} />}
                <line x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke={sel ? "#f59e0b" : "#e5e7eb"} strokeWidth={sel ? 1 : 0.5} />
                <text x={x} y={PAD_T - 8} textAnchor="middle" fontSize={10} fill={sel ? "#92400e" : "#6b7280"} fontWeight={sel ? "bold" : "normal"}>
                  {freqLabel(f)}
                </text>
              </g>
            );
          })}
          <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="none" stroke="#9ca3af" strokeWidth={1} />
          <text x={W / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#6b7280">
            Reger (MBLB) · {data.ear === "right" ? "OD" : "OI"} · peor: {freqLabel(data.reference_frequency)} Hz · mejor: {freqLabel(data.comparison_frequency)} Hz
          </text>
          {referenceLevels.map((ref, i) => {
            const m = data.matches[i];
            if (m === null || m === undefined) return null;
            return <line key={`ln${i}`} x1={xRef} y1={yFor(ref)} x2={xCmp} y2={yFor(m)} stroke="#374151" strokeWidth={1} />;
          })}
        </g>
        {referenceLevels.map((ref, i) => {
          const y = yFor(ref);
          const active = i === activeIdx;
          return (
            <g key={`ref${i}`} pointerEvents="none">
              {active && <circle cx={xRef} cy={y} r={13} fill="none" stroke="#f59e0b" strokeWidth={1.5} />}
              <AshaSymbol cx={xRef} cy={y} ear={data.ear} kind="air" masked={false} noResponse={false} color={earColor} />
              <text x={xRef - 12} y={y - 10} fontSize={8} fill="#374151" textAnchor="end">{i + 1}</text>
            </g>
          );
        })}
        {data.matches.map((m, i) => {
          if (m === null || m === undefined) return null;
          const y = yFor(m);
          return (
            <g key={`m${i}`} onClick={(e) => clearMatch(i, e)} style={{ cursor: readOnly ? "default" : "pointer" }}>
              <AshaSymbol cx={xCmp} cy={y} ear={data.ear} kind="air" masked={false} noResponse={false} color={earColor} />
            </g>
          );
        })}
      </svg>

      {(() => {
        const cls = classifyBalance(referenceLevels, data.matches);
        const color = BALANCE_CLASS_COLORS[cls];
        return (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 p-3" style={{ borderColor: color, backgroundColor: `${color}14` }}>
            <div>
              <p className="text-[11px] text-text-tertiary">Interpretación</p>
              <p className="text-base font-bold" style={{ color }}>
                {BALANCE_CLASS_LABELS[cls]}{data.diplacusia ? " + diploacusia" : ""}
              </p>
            </div>
            {!readOnly && (
              <label className="ml-auto flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={!!data.diplacusia}
                  onChange={(e) => update({ diplacusia: e.target.checked })}
                />
                Fenómeno de diploacusia
              </label>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-start">
        <p className="text-[11px] text-text-tertiary">
          Mismo oído, dos frecuencias. Click en la columna <b>{freqLabel(data.comparison_frequency)} Hz (mejor)</b> a la intensidad donde iguala la sonoridad del tono <b>{freqLabel(data.reference_frequency)} Hz</b>.
          Click en un símbolo del lado mejor lo borra. Convergencia de líneas = reclutamiento.
        </p>
        <div className="rounded border border-border-secondary bg-bg-primary">
          <table className="text-xs">
            <thead>
              <tr className="border-b border-border-secondary text-text-tertiary">
                <th className="px-2 py-1 text-left">#</th>
                <th className="px-2 py-1 text-left">{freqLabel(data.reference_frequency)} Hz</th>
                <th className="px-2 py-1 text-left">{freqLabel(data.comparison_frequency)} Hz</th>
              </tr>
            </thead>
            <tbody>
              {referenceLevels.map((ref, i) => (
                <tr key={i} onClick={() => setActiveIdx(i)} className={`cursor-pointer border-b border-border-secondary last:border-b-0 ${i === activeIdx ? "bg-accent/10" : ""}`}>
                  <td className="px-2 py-0.5">{i + 1}</td>
                  <td className="px-2 py-0.5 font-mono">{ref}</td>
                  <td className="px-2 py-0.5 font-mono">
                    {data.matches[i] === null || data.matches[i] === undefined ? <span className="text-text-tertiary">—</span> : data.matches[i]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
