import { useRef, useState } from "react";
import type { FowlerData, AudiogramEar, AudiogramEarSide, Frequency } from "@/types";
import { AUDIOGRAM_FREQUENCIES, classifyBalance, BALANCE_CLASS_LABELS, BALANCE_CLASS_COLORS } from "@/types";
import { AshaSymbol } from "./AudiogramChart";
import { Plus, Minus, RotateCcw } from "lucide-react";

interface Props {
  data: FowlerData;
  onChange: (next: FowlerData) => void;
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
const COL_OFFSET = 10;

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

export function FowlerChart({ data, onChange, right, left, readOnly }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const betterEar: AudiogramEarSide = data.reference_ear === "right" ? "left" : "right";
  const refEarLabel = data.reference_ear === "right" ? "OD" : "OI";
  const matchEarLabel = betterEar === "right" ? "OD" : "OI";
  const freqIdx = AUDIOGRAM_FREQUENCIES.indexOf(data.frequency);
  const xCol = xFor(Math.max(0, freqIdx));
  // La columna de referencia queda a la izquierda o derecha según el oído (OD izq, OI der)
  const refOffset = data.reference_ear === "right" ? -COL_OFFSET : COL_OFFSET;
  const matchOffset = -refOffset;
  const xRef = xCol + refOffset;
  const xMatch = xCol + matchOffset;

  const steps = data.matches.length;
  const referenceLevels = Array.from({ length: steps }, (_, i) => Math.min(MAX_DB, data.threshold_db + i * data.step_db));

  function update(patch: Partial<FowlerData>) { onChange({ ...data, ...patch }); }

  function setFrequency(f: Frequency) {
    const refAud = data.reference_ear === "right" ? right : left;
    const t = findThresholdAt(refAud, f);
    update({ frequency: f, threshold_db: t ?? data.threshold_db });
  }
  function setReferenceEar(ear: AudiogramEarSide) {
    const refAud = ear === "right" ? right : left;
    const t = findThresholdAt(refAud, data.frequency);
    update({ reference_ear: ear, threshold_db: t ?? data.threshold_db });
  }
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
    const distMatch = Math.abs(p.x - xMatch);
    const distRef = Math.abs(p.x - xRef);
    const HIT = 22;
    if (distMatch <= HIT && distMatch < distRef) {
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
    if (distRef <= HIT) {
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">Frecuencia</span>
          <select
            value={data.frequency}
            disabled={readOnly}
            onChange={(e) => setFrequency(Number(e.target.value) as Frequency)}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          >
            {AUDIOGRAM_FREQUENCIES.map((f) => (
              <option key={f} value={f}>{f >= 1000 ? `${f / 1000}k` : f} Hz</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">Peor oído</span>
          <select
            value={data.reference_ear}
            disabled={readOnly}
            onChange={(e) => setReferenceEar(e.target.value as AudiogramEarSide)}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          >
            <option value="right">OD</option>
            <option value="left">OI</option>
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
            const isSel = f === data.frequency;
            return (
              <g key={f}>
                {isSel && <rect x={x - 18} y={PAD_T} width={36} height={plotH} fill="#fef3c7" opacity={0.6} />}
                <line x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke={isSel ? "#f59e0b" : "#e5e7eb"} strokeWidth={isSel ? 1 : 0.5} />
                <text x={x} y={PAD_T - 8} textAnchor="middle" fontSize={10} fill={isSel ? "#92400e" : "#6b7280"} fontWeight={isSel ? "bold" : "normal"}>
                  {f >= 1000 ? `${f / 1000}k` : f}
                </text>
              </g>
            );
          })}
          <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="none" stroke="#9ca3af" strokeWidth={1} />
          <text x={W / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#6b7280">
            Fowler (ABLB) · {data.frequency >= 1000 ? `${data.frequency / 1000}k` : data.frequency} Hz · peor: {refEarLabel}
          </text>
          {/* conexiones */}
          {referenceLevels.map((ref, i) => {
            const m = data.matches[i];
            if (m === null || m === undefined) return null;
            return <line key={`ln${i}`} x1={xRef} y1={yFor(ref)} x2={xMatch} y2={yFor(m)} stroke="#374151" strokeWidth={1} />;
          })}
        </g>
        {/* referencia: símbolo aéreo del peor oído */}
        {referenceLevels.map((ref, i) => {
          const y = yFor(ref);
          const active = i === activeIdx;
          return (
            <g key={`ref${i}`} pointerEvents="none">
              {active && <circle cx={xRef} cy={y} r={13} fill="none" stroke="#f59e0b" strokeWidth={1.5} />}
              <AshaSymbol cx={xRef} cy={y} ear={data.reference_ear} kind="air" masked={false} noResponse={false} color={EAR_COLOR[data.reference_ear]} />
              <text x={xRef + (data.reference_ear === "right" ? -14 : 14)} y={y - 10} fontSize={8} fill="#374151" textAnchor={data.reference_ear === "right" ? "end" : "start"}>{i + 1}</text>
            </g>
          );
        })}
        {/* matches: símbolo aéreo del oído mejor */}
        {data.matches.map((m, i) => {
          if (m === null || m === undefined) return null;
          const y = yFor(m);
          return (
            <g key={`m${i}`} onClick={(e) => clearMatch(i, e)} style={{ cursor: readOnly ? "default" : "pointer" }}>
              <AshaSymbol cx={xMatch} cy={y} ear={betterEar} kind="air" masked={false} noResponse={false} color={EAR_COLOR[betterEar]} />
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
          Click en el <b>lado del oído mejor ({matchEarLabel})</b> dentro de la columna {data.frequency >= 1000 ? `${data.frequency / 1000}k` : data.frequency} Hz a la intensidad donde el paciente iguala.
          Click en un símbolo del oído mejor lo borra. Click en el lado del peor ({refEarLabel}) o en la tabla selecciona el paso activo.
        </p>
        <div className="rounded border border-border-secondary bg-bg-primary">
          <table className="text-xs">
            <thead>
              <tr className="border-b border-border-secondary text-text-tertiary">
                <th className="px-2 py-1 text-left">#</th>
                <th className="px-2 py-1 text-left" style={{ color: EAR_COLOR[data.reference_ear] }}>Peor {refEarLabel}</th>
                <th className="px-2 py-1 text-left" style={{ color: EAR_COLOR[betterEar] }}>Mejor {matchEarLabel}</th>
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
