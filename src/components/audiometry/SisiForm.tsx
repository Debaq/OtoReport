import type { SisiData, AudiogramEar, AudiogramEarSide, Frequency } from "@/types";
import { AUDIOGRAM_FREQUENCIES, sisiScore, classifySisi } from "@/types";
import { RotateCcw, Check, X } from "lucide-react";

interface Props {
  data: SisiData;
  onChange: (next: SisiData) => void;
  right?: AudiogramEar;
  left?: AudiogramEar;
  readOnly?: boolean;
}

function findThresholdAt(ear: AudiogramEar | undefined, freq: Frequency): number | null {
  if (!ear) return null;
  const p = ear.air.find((pt) => pt.frequency === freq && !pt.noResponse);
  return p ? p.threshold : null;
}

const CLASS_LABEL: Record<"low" | "intermediate" | "high", string> = {
  low: "Bajo (0-20%) · sin reclutamiento",
  intermediate: "Intermedio (30-70%) · dudoso",
  high: "Alto (70-100%) · reclutamiento positivo",
};
const CLASS_COLOR: Record<"low" | "intermediate" | "high", string> = {
  low: "#059669",
  intermediate: "#d97706",
  high: "#dc2626",
};

export function SisiForm({ data, onChange, right, left, readOnly }: Props) {
  const aud = data.ear === "right" ? right : left;
  const earColor = data.ear === "right" ? "#dc2626" : "#2563eb";
  const score = sisiScore(data);
  const cls = classifySisi(score);

  function update(patch: Partial<SisiData>) { onChange({ ...data, ...patch }); }

  function setEar(ear: AudiogramEarSide) {
    const a = ear === "right" ? right : left;
    const t = findThresholdAt(a, data.frequency);
    const thr = t ?? data.threshold_db;
    update({ ear, threshold_db: thr, presentation_db: thr + data.sl_db });
  }
  function setFrequency(f: Frequency) {
    const t = findThresholdAt(aud, f);
    const thr = t ?? data.threshold_db;
    update({ frequency: f, threshold_db: thr, presentation_db: thr + data.sl_db });
  }
  function setSL(sl: number) {
    update({ sl_db: sl, presentation_db: data.threshold_db + sl });
  }

  function toggleTrial(i: number) {
    if (readOnly) return;
    const next = [...data.trials];
    next[i] = !next[i];
    update({ trials: next });
  }
  function resetTrials() {
    update({ trials: Array(data.trials.length).fill(false) });
  }
  function markAll(val: boolean) {
    update({ trials: Array(data.trials.length).fill(val) });
  }
  function setNumTrials(n: number) {
    const clean = Math.max(1, Math.min(50, Math.round(n)));
    const next = data.trials.slice(0, clean);
    while (next.length < clean) next.push(false);
    update({ trials: next });
  }

  const hits = data.trials.filter(Boolean).length;

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
          <span className="text-text-tertiary">Frecuencia</span>
          <select
            value={data.frequency}
            disabled={readOnly}
            onChange={(e) => setFrequency(Number(e.target.value) as Frequency)}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          >
            {AUDIOGRAM_FREQUENCIES.map((f) => <option key={f} value={f}>{f >= 1000 ? `${f / 1000}k` : f} Hz</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">Umbral (dB)</span>
          <input
            type="number" step={5} value={data.threshold_db} disabled={readOnly}
            onChange={(e) => {
              const thr = Number(e.target.value);
              update({ threshold_db: thr, presentation_db: thr + data.sl_db });
            }}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">SL (dB)</span>
          <input
            type="number" step={5} value={data.sl_db} disabled={readOnly}
            onChange={(e) => setSL(Number(e.target.value))}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">Presentación (dB)</span>
          <input
            type="number" step={5} value={data.presentation_db} disabled={readOnly}
            onChange={(e) => update({ presentation_db: Number(e.target.value) })}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">Incremento test (dB)</span>
          <select
            value={data.test_increment_db}
            disabled={readOnly}
            onChange={(e) => update({ test_increment_db: Number(e.target.value) })}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          >
            <option value={1}>1 dB (estándar)</option>
            <option value={0.5}>0.5 dB</option>
          </select>
        </label>
      </div>

      {/* Etapa 1: familiarización */}
      <div className="rounded-lg border border-border-secondary bg-bg-secondary p-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold" style={{ color: earColor }}>
            Etapa 1 · Familiarización
          </h4>
          <label className="flex items-center gap-2 text-xs">
            <span className="text-text-tertiary">Paso (dB)</span>
            <select
              value={data.familiarization_step_db}
              disabled={readOnly}
              onChange={(e) => update({ familiarization_step_db: Number(e.target.value) })}
              className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
            >
              <option value={5}>5 dB</option>
              <option value={2}>2 dB</option>
              <option value={1}>1 dB</option>
            </select>
          </label>
        </div>
        <p className="text-[11px] text-text-tertiary">
          Presenta tono continuo a {data.presentation_db} dB con incrementos de {data.familiarization_step_db} dB
          para que el paciente entienda la tarea. Desciende progresivamente (5 → 2 → 1 dB). Cuando el paciente
          detecte consistentemente los incrementos de 1 dB, pasa a la etapa 2.
        </p>
      </div>

      {/* Etapa 2: test */}
      <div className="rounded-lg border border-border-secondary bg-bg-secondary p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h4 className="text-xs font-semibold" style={{ color: earColor }}>
            Etapa 2 · Test ({data.trials.length} incrementos de {data.test_increment_db} dB)
          </h4>
          <label className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-text-tertiary">N° presentaciones</span>
            <input
              type="number" min={1} max={50} value={data.trials.length} disabled={readOnly}
              onChange={(e) => setNumTrials(Number(e.target.value))}
              className="w-16 rounded border border-border-secondary bg-bg-primary px-2 py-1"
            />
          </label>
          {!readOnly && (
            <>
              <button type="button" onClick={() => markAll(true)} className="flex items-center gap-1 rounded border border-emerald-400 bg-emerald-50 px-2 py-1 text-xs text-emerald-700"><Check size={12} /> Todos</button>
              <button type="button" onClick={() => markAll(false)} className="flex items-center gap-1 rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-600"><X size={12} /> Ninguno</button>
              <button type="button" onClick={resetTrials} className="flex items-center gap-1 rounded border border-border-secondary bg-bg-primary px-2 py-1 text-xs"><RotateCcw size={12} /> Reset</button>
            </>
          )}
        </div>
        <p className="mb-2 text-[11px] text-text-tertiary">
          Click en cada casilla cuando el paciente detecte el incremento. Verde = detectado · Gris = no detectado.
        </p>
        <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
          {data.trials.map((hit, i) => (
            <button
              key={i}
              type="button"
              disabled={readOnly}
              onClick={() => toggleTrial(i)}
              className={`flex flex-col items-center rounded border px-1 py-1.5 text-xs font-semibold transition-colors ${
                hit
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-border-secondary bg-bg-primary text-text-tertiary hover:border-accent"
              }`}
            >
              <span className="text-[9px] opacity-70">{i + 1}</span>
              <span className="text-[10px]">{hit ? "✓" : "—"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border-2 p-3" style={{ borderColor: CLASS_COLOR[cls], backgroundColor: `${CLASS_COLOR[cls]}14` }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-text-tertiary">Resultado</p>
            <p className="text-lg font-bold" style={{ color: CLASS_COLOR[cls] }}>
              {hits}/{data.trials.length} = {score}%
            </p>
            <p className="text-xs font-semibold" style={{ color: CLASS_COLOR[cls] }}>{CLASS_LABEL[cls]}</p>
          </div>
          <div className="text-right text-[11px] text-text-tertiary">
            <p>{data.ear === "right" ? "OD" : "OI"} · {data.frequency >= 1000 ? `${data.frequency / 1000}k` : data.frequency} Hz</p>
            <p>Presentación: {data.presentation_db} dB ({data.sl_db} dB SL)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
