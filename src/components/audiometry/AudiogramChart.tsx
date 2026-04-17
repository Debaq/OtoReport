import { useRef, useState, type ReactElement } from "react";
import type { AudiogramEar, AudiogramPoint, AudiogramEarSide, AudiometrySymbolSet } from "@/types";
import { AUDIOGRAM_FREQUENCIES, emptyAudiogramEar } from "@/types";
import { Trash2, Eraser, Plus, MousePointerClick } from "lucide-react";

type SeriesKind = "air" | "bone" | "ldl";

interface Props {
  right: AudiogramEar;
  left: AudiogramEar;
  onChangeRight: (next: AudiogramEar) => void;
  onChangeLeft: (next: AudiogramEar) => void;
  readOnly?: boolean;
  symbolSet?: AudiometrySymbolSet;
}

const MIN_DB = -10;
const MAX_DB = 120;
const DB_STEP = 10;
const DB_SNAP = 5;
const PAD_L = 54;
const PAD_T = 28;
const PAD_R = 32;
const PAD_B = 30;
const W = 700;
const H = 440;
const plotW = W - PAD_L - PAD_R;
const plotH = H - PAD_T - PAD_B;
const EAR_COLOR: Record<AudiogramEarSide, string> = { right: "#dc2626", left: "#2563eb" };
const BONE_OFFSET = 18;
function xOffsetFor(ear: AudiogramEarSide, kind: SeriesKind) {
  if (kind !== "bone") return 0;
  return ear === "right" ? -BONE_OFFSET : BONE_OFFSET;
}

function xFor(i: number) { return PAD_L + (i * plotW) / (AUDIOGRAM_FREQUENCIES.length - 1); }
function yFor(db: number) { return PAD_T + ((db - MIN_DB) * plotH) / (MAX_DB - MIN_DB); }
function dbFromY(y: number) {
  const db = MIN_DB + ((y - PAD_T) / plotH) * (MAX_DB - MIN_DB);
  return Math.round(db / DB_SNAP) * DB_SNAP;
}
function freqIdxFromX(x: number) {
  const n = AUDIOGRAM_FREQUENCIES.length - 1;
  const idx = Math.round(((x - PAD_L) / plotW) * n);
  return Math.max(0, Math.min(n, idx));
}

export function AshaSymbol({ cx, cy, ear, kind, masked, noResponse, color, size = 8, strokeWidth = 2, symbolSet = "asha" }: {
  cx: number; cy: number; ear: AudiogramEarSide; kind: SeriesKind; masked: boolean; noResponse: boolean; color: string; size?: number; strokeWidth?: number; symbolSet?: AudiometrySymbolSet;
}) {
  const s = size;
  const els: ReactElement[] = [];
  if (kind === "air" && !masked) {
    if (ear === "right") els.push(<circle key="s" cx={cx} cy={cy} r={s} fill="none" stroke={color} strokeWidth={strokeWidth} />);
    else els.push(
      <line key="a" x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} stroke={color} strokeWidth={strokeWidth} />,
      <line key="b" x1={cx - s} y1={cy + s} x2={cx + s} y2={cy - s} stroke={color} strokeWidth={strokeWidth} />
    );
  } else if (kind === "air" && masked) {
    if (ear === "right") els.push(<path key="s" d={`M${cx - s} ${cy + s} L${cx} ${cy - s} L${cx + s} ${cy + s} Z`} fill="none" stroke={color} strokeWidth={strokeWidth} />);
    else els.push(<rect key="s" x={cx - s} y={cy - s} width={s * 2} height={s * 2} fill="none" stroke={color} strokeWidth={strokeWidth} />);
  } else if (kind === "bone" && !masked) {
    if (ear === "right") els.push(<path key="s" d={`M${cx + s} ${cy - s} L${cx} ${cy} L${cx + s} ${cy + s}`} fill="none" stroke={color} strokeWidth={strokeWidth} />);
    else els.push(<path key="s" d={`M${cx - s} ${cy - s} L${cx} ${cy} L${cx - s} ${cy + s}`} fill="none" stroke={color} strokeWidth={strokeWidth} />);
  } else if (kind === "bone" && masked) {
    if (ear === "right") els.push(<path key="s" d={`M${cx} ${cy - s} L${cx + s} ${cy - s} L${cx + s} ${cy + s} L${cx} ${cy + s}`} fill="none" stroke={color} strokeWidth={strokeWidth} />);
    else els.push(<path key="s" d={`M${cx} ${cy - s} L${cx - s} ${cy - s} L${cx - s} ${cy + s} L${cx} ${cy + s}`} fill="none" stroke={color} strokeWidth={strokeWidth} />);
  } else {
    // LDL
    if (symbolSet === "chile") {
      // Triángulo rectángulo. Cateto mayor (vertical, 2H) paralelo a la línea de frecuencia,
      // con espaciado GAP. Cateto menor horizontal en el extremo inferior (fuera de la intensidad
      // del umbral, que está en cy). Ángulo recto abajo, al lado del eje de frecuencia.
      // OD a la izquierda del punto, OI a la derecha.
      const GAP = s * 0.5;
      const H = s * 1.2;  // mitad del cateto mayor
      const WLEG = s * 1.0; // cateto menor
      const d = ear === "right"
        ? `M${cx - GAP} ${cy} L${cx - GAP} ${cy + 2 * H} L${cx - GAP - WLEG} ${cy + 2 * H} Z`
        : `M${cx + GAP} ${cy} L${cx + GAP} ${cy + 2 * H} L${cx + GAP + WLEG} ${cy + 2 * H} Z`;
      els.push(<path key="s" d={d} fill="none" stroke={color} strokeWidth={strokeWidth} />);
    } else {
      els.push(
        <text
          key="s"
          x={cx}
          y={cy + s - 1}
          textAnchor="middle"
          fontSize={s * 2}
          fontWeight="bold"
          fill={color}
          style={{ userSelect: "none" }}
        >U</text>
      );
    }
  }
  if (noResponse) {
    const dir = ear === "right" ? -1 : 1;
    els.push(
      <path
        key="nr"
        d={`M${cx} ${cy + s} L${cx + dir * (s + 6)} ${cy + s + 10} M${cx + dir * (s + 6)} ${cy + s + 10} L${cx + dir * (s + 2)} ${cy + s + 4} M${cx + dir * (s + 6)} ${cy + s + 10} L${cx + dir * (s + 10)} ${cy + s + 4}`}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
    );
  }
  return <>{els}</>;
}

export function AudiogramChart({ right, left, onChangeRight, onChangeLeft, readOnly, symbolSet = "asha" }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<{ ear: AudiogramEarSide; kind: SeriesKind; masked: boolean; noResponse: boolean; tool: "add" | "delete" }>({
    ear: "right",
    kind: "air",
    masked: false,
    noResponse: false,
    tool: "add",
  });

  function dataFor(ear: AudiogramEarSide) {
    return ear === "right" ? right : left;
  }
  function emit(ear: AudiogramEarSide, next: AudiogramEar) {
    (ear === "right" ? onChangeRight : onChangeLeft)(next);
  }
  function listOf(d: AudiogramEar, k: SeriesKind) {
    return k === "air" ? d.air : k === "bone" ? d.bone : d.ldl;
  }
  function setList(d: AudiogramEar, k: SeriesKind, list: AudiogramPoint[]): AudiogramEar {
    if (k === "air") return { ...d, air: list };
    if (k === "bone") return { ...d, bone: list };
    return { ...d, ldl: list };
  }

  function handleClick(evt: React.MouseEvent<SVGSVGElement>) {
    if (readOnly || !svgRef.current) return;
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgPt = svg.createSVGPoint();
    svgPt.x = evt.clientX;
    svgPt.y = evt.clientY;
    const p = svgPt.matrixTransform(ctm.inverse());
    const sx = p.x;
    const sy = p.y;
    if (sy < PAD_T - 6 || sy > H - PAD_B + 6) return;
    // compensar offset de vía ósea al mapear al eje de frecuencia
    const sxAdj = sx - xOffsetFor(sel.ear, sel.kind);
    if (sxAdj < PAD_L - 20 || sxAdj > W - PAD_R + 20) return;
    const freqIdx = freqIdxFromX(sxAdj);
    const freq = AUDIOGRAM_FREQUENCIES[freqIdx];
    const d = dataFor(sel.ear);
    const list = listOf(d, sel.kind);
    if (sel.tool === "delete") {
      const filtered = list.filter((p) => p.frequency !== freq);
      if (filtered.length !== list.length) emit(sel.ear, setList(d, sel.kind, filtered));
      return;
    }
    const db = dbFromY(sy);
    const pt: AudiogramPoint = {
      frequency: freq,
      threshold: Math.max(MIN_DB, Math.min(MAX_DB, db)),
      masked: sel.masked,
      noResponse: sel.noResponse,
    };
    const filtered = list.filter((p) => p.frequency !== freq);
    const updated = [...filtered, pt].sort((a, b) => a.frequency - b.frequency);
    emit(sel.ear, setList(d, sel.kind, updated));
  }

  function clearEar(ear: AudiogramEarSide) {
    if (readOnly) return;
    if (!confirm(`¿Limpiar todos los umbrales de ${ear === "right" ? "OD" : "OI"}?`)) return;
    emit(ear, emptyAudiogramEar());
  }
  function clearAll() {
    if (readOnly) return;
    if (!confirm("¿Limpiar todo el audiograma (OD + OI)?")) return;
    onChangeRight(emptyAudiogramEar());
    onChangeLeft(emptyAudiogramEar());
  }
  function clearCurrentSeries() {
    if (readOnly) return;
    const d = dataFor(sel.ear);
    emit(sel.ear, setList(d, sel.kind, []));
  }

  function lineD(pts: AudiogramPoint[], ear: AudiogramEarSide, kind: SeriesKind) {
    const off = xOffsetFor(ear, kind);
    return [...pts]
      .sort((a, b) => a.frequency - b.frequency)
      .filter((p) => !p.noResponse)
      .map((p, i) => {
        const idx = AUDIOGRAM_FREQUENCIES.indexOf(p.frequency);
        return `${i === 0 ? "M" : "L"}${xFor(idx) + off} ${yFor(p.threshold)}`;
      })
      .join(" ");
  }

  const series: { ear: AudiogramEarSide; kind: SeriesKind; pts: AudiogramPoint[] }[] = [
    { ear: "right", kind: "air", pts: right.air },
    { ear: "right", kind: "bone", pts: right.bone },
    { ear: "right", kind: "ldl", pts: right.ldl },
    { ear: "left", kind: "air", pts: left.air },
    { ear: "left", kind: "bone", pts: left.bone },
    { ear: "left", kind: "ldl", pts: left.ldl },
  ];

  const btnBase = "rounded px-2 py-1 text-xs font-semibold transition-colors";
  const inactive = "bg-bg-primary text-text-secondary hover:bg-bg-tertiary border border-border-secondary";

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && (
        <div className="rounded-lg border border-border-secondary bg-bg-secondary p-2 sm:p-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Oído */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] sm:text-xs font-medium text-text-tertiary">Oído</span>
              <button
                type="button"
                onClick={() => setSel((s) => ({ ...s, ear: "right" }))}
                className={`${btnBase} ${sel.ear === "right" ? "bg-red-600 text-white" : inactive}`}
              >OD</button>
              <button
                type="button"
                onClick={() => setSel((s) => ({ ...s, ear: "left" }))}
                className={`${btnBase} ${sel.ear === "left" ? "bg-blue-600 text-white" : inactive}`}
              >OI</button>
            </div>
            <div className="h-6 w-px bg-border-secondary hidden sm:block" />
            {/* Vía */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] sm:text-xs font-medium text-text-tertiary">Vía</span>
              <button
                type="button"
                onClick={() => setSel((s) => ({ ...s, kind: "air" }))}
                className={`${btnBase} ${sel.kind === "air" ? "bg-accent text-white" : inactive}`}
              >Aérea</button>
              <button
                type="button"
                onClick={() => setSel((s) => ({ ...s, kind: "bone" }))}
                className={`${btnBase} ${sel.kind === "bone" ? "bg-accent text-white" : inactive}`}
              >Ósea</button>
              <button
                type="button"
                onClick={() => setSel((s) => ({ ...s, kind: "ldl", masked: false, noResponse: false }))}
                className={`${btnBase} ${sel.kind === "ldl" ? "bg-accent text-white" : inactive}`}
              >LDL</button>
            </div>
            <div className="h-6 w-px bg-border-secondary hidden sm:block" />
            {/* Modificadores */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={sel.kind === "ldl"}
                onClick={() => setSel((s) => ({ ...s, masked: !s.masked }))}
                className={`${btnBase} ${sel.masked ? "bg-amber-500 text-white" : inactive} disabled:opacity-40`}
              >Enmask.</button>
              <button
                type="button"
                onClick={() => setSel((s) => ({ ...s, noResponse: !s.noResponse }))}
                className={`${btnBase} ${sel.noResponse ? "bg-purple-600 text-white" : inactive}`}
              >Sin resp.</button>
            </div>
            <div className="h-6 w-px bg-border-secondary hidden sm:block" />
            {/* Herramienta */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] sm:text-xs font-medium text-text-tertiary">Herramienta</span>
              <button
                type="button"
                onClick={() => setSel((s) => ({ ...s, tool: "add" }))}
                className={`${btnBase} ${sel.tool === "add" ? "bg-emerald-600 text-white" : inactive} flex items-center gap-1`}
              ><Plus size={12} />Añadir</button>
              <button
                type="button"
                onClick={() => setSel((s) => ({ ...s, tool: "delete" }))}
                className={`${btnBase} ${sel.tool === "delete" ? "bg-red-600 text-white" : inactive} flex items-center gap-1`}
              ><MousePointerClick size={12} />Borrar</button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] sm:text-xs text-text-tertiary">Acciones:</span>
            <button type="button" onClick={clearCurrentSeries} className={`${btnBase} ${inactive} flex items-center gap-1`}>
              <Eraser size={12} /> Vaciar serie activa
            </button>
            <button type="button" onClick={() => clearEar("right")} className={`${btnBase} ${inactive} flex items-center gap-1 text-red-700`}>
              <Trash2 size={12} /> Limpiar OD
            </button>
            <button type="button" onClick={() => clearEar("left")} className={`${btnBase} ${inactive} flex items-center gap-1 text-blue-700`}>
              <Trash2 size={12} /> Limpiar OI
            </button>
            <button type="button" onClick={clearAll} className={`${btnBase} bg-red-600 text-white hover:bg-red-700 flex items-center gap-1`}>
              <Trash2 size={12} /> Limpiar todo
            </button>
            <span className="ml-auto text-[10px] sm:text-xs text-text-tertiary">
              <span style={{ color: EAR_COLOR[sel.ear] }}>●</span> {sel.ear === "right" ? "OD" : "OI"} · {sel.kind === "air" ? "Aérea" : sel.kind === "bone" ? "Ósea" : "LDL"}
              {sel.masked ? " · M" : ""}{sel.noResponse ? " · SR" : ""}
            </span>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full border border-border-secondary bg-bg-secondary"
        style={{ maxHeight: "65vh", cursor: readOnly ? "default" : "crosshair" }}
        onClick={handleClick}
      >
        <g pointerEvents="none">
          {Array.from({ length: (MAX_DB - MIN_DB) / DB_STEP + 1 }, (_, i) => {
            const db = MIN_DB + i * DB_STEP;
            const y = yFor(db);
            return (
              <g key={`h${db}`}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />
                <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize={10} fill="#6b7280">{db}</text>
              </g>
            );
          })}
          {AUDIOGRAM_FREQUENCIES.map((f, i) => {
            const x = xFor(i);
            return (
              <g key={`v${f}`}>
                <line x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="#e5e7eb" strokeWidth={0.5} />
                <text x={x} y={PAD_T - 8} textAnchor="middle" fontSize={10} fill="#6b7280">
                  {f >= 1000 ? `${f / 1000}k` : f}
                </text>
              </g>
            );
          })}
          <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="none" stroke="#9ca3af" strokeWidth={1} />
        </g>
        <defs>
          {series.map(({ ear, kind, pts }) => (
            <mask key={`mk-${ear}-${kind}`} id={`mk-${ear}-${kind}`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
              <rect x={0} y={0} width={W} height={H} fill="white" />
              {pts.map((p) => {
                const idx = AUDIOGRAM_FREQUENCIES.indexOf(p.frequency);
                const cx = xFor(idx) + xOffsetFor(ear, kind);
                const cy = yFor(p.threshold);
                return <circle key={`mkc-${p.frequency}`} cx={cx} cy={cy} r={10} fill="black" />;
              })}
            </mask>
          ))}
        </defs>
        {series.map(({ ear, kind, pts }) => (
          <path
            key={`ln-${ear}-${kind}`}
            d={lineD(pts, ear, kind)}
            fill="none"
            stroke={EAR_COLOR[ear]}
            strokeWidth={1.5}
            strokeDasharray={kind === "bone" ? "4 3" : kind === "ldl" ? "1 3" : undefined}
            opacity={kind === "ldl" ? 0.6 : 1}
            mask={`url(#mk-${ear}-${kind})`}
            pointerEvents="none"
          />
        ))}
        {series.map(({ ear, kind, pts }) =>
          pts.map((p) => {
            const idx = AUDIOGRAM_FREQUENCIES.indexOf(p.frequency);
            const cx = xFor(idx) + xOffsetFor(ear, kind);
            const cy = yFor(p.threshold);
            return (
              <g key={`pt-${ear}-${kind}-${p.frequency}`} pointerEvents="none">
                <AshaSymbol cx={cx} cy={cy} ear={ear} kind={kind} masked={p.masked} noResponse={p.noResponse} color={EAR_COLOR[ear]} symbolSet={symbolSet} />
              </g>
            );
          })
        )}
      </svg>

      <div className="flex flex-wrap gap-x-3 gap-y-1 rounded border border-border-secondary bg-bg-secondary p-2 text-[10px] sm:text-[11px] text-text-secondary">
        <span className="font-semibold">{symbolSet === "chile" ? "Chile:" : "ASHA:"}</span>
        <span style={{ color: EAR_COLOR.right }}>
          OD: O aérea · Δ aérea-M · &lt; ósea · [ ósea-M · {symbolSet === "chile" ? "◁ LDL" : "U LDL"}
        </span>
        <span style={{ color: EAR_COLOR.left }}>
          OI: X aérea · □ aérea-M · &gt; ósea · ] ósea-M · {symbolSet === "chile" ? "▷ LDL" : "U LDL"}
        </span>
        <span>↙/↘ sin respuesta</span>
      </div>
      {!readOnly && (
        <p className="text-[10px] sm:text-[11px] text-text-tertiary">
          Modo <b>Añadir</b>: click coloca/reemplaza umbral en la frecuencia más cercana (se ajusta a la grilla). Modo <b>Borrar</b>: click en una frecuencia elimina su punto. Las vías óseas se dibujan desplazadas al lado del símbolo aéreo.
        </p>
      )}
    </div>
  );
}
