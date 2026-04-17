import { useEffect, useRef, useState } from "react";
import type { CarhartData, CarhartStep, AudiogramEar, AudiogramEarSide, Frequency } from "@/types";
import {
  AUDIOGRAM_FREQUENCIES,
  carhartDecayDb,
  classifyCarhart,
  CARHART_CLASS_LABELS,
  CARHART_CLASS_COLORS,
} from "@/types";
import { Play, Pause, RotateCcw, Plus, Trash2 } from "lucide-react";

interface Props {
  data: CarhartData;
  onChange: (next: CarhartData) => void;
  right?: AudiogramEar;
  left?: AudiogramEar;
  readOnly?: boolean;
}

function findThresholdAt(ear: AudiogramEar | undefined, freq: Frequency): number | null {
  if (!ear) return null;
  const p = ear.air.find((pt) => pt.frequency === freq && !pt.noResponse);
  return p ? p.threshold : null;
}

/** Frecuencias típicas para Carhart. */
const CARHART_FREQS: Frequency[] = [500, 1000, 2000, 4000];

export function CarhartForm({ data, onChange, right, left, readOnly }: Props) {
  const aud = data.ear === "right" ? right : left;
  const earColor = data.ear === "right" ? "#dc2626" : "#2563eb";
  const decay = carhartDecayDb(data);
  const cls = classifyCarhart(decay);

  function update(patch: Partial<CarhartData>) {
    onChange({ ...data, ...patch });
  }

  function setEar(ear: AudiogramEarSide) {
    const a = ear === "right" ? right : left;
    const thr = findThresholdAt(a, data.frequency) ?? data.threshold_db;
    update({ ear, threshold_db: thr, steps: seedSteps(thr, data.start_sl_db, data.step_db) });
  }
  function setFrequency(f: Frequency) {
    const thr = findThresholdAt(aud, f) ?? data.threshold_db;
    update({ frequency: f, threshold_db: thr, steps: seedSteps(thr, data.start_sl_db, data.step_db) });
  }
  function setThreshold(thr: number) {
    update({ threshold_db: thr, steps: seedSteps(thr, data.start_sl_db, data.step_db) });
  }

  function seedSteps(thr: number, startSl: number, step: number): CarhartStep[] {
    if (data.steps.length === 0) return [{ level_db: thr + startSl, seconds_heard: 0 }];
    return data.steps.map((s, i) => ({ ...s, level_db: thr + startSl + i * step }));
  }

  function updateStep(i: number, patch: Partial<CarhartStep>) {
    const next = data.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange({ ...data, steps: next });
  }
  function addStep() {
    const last = data.steps[data.steps.length - 1];
    const nextLevel = last ? last.level_db + data.step_db : data.threshold_db + data.start_sl_db;
    onChange({ ...data, steps: [...data.steps, { level_db: nextLevel, seconds_heard: 0 }] });
  }
  function removeStep(i: number) {
    onChange({ ...data, steps: data.steps.filter((_, idx) => idx !== i) });
  }
  function resetSteps() {
    onChange({
      ...data,
      steps: [{ level_db: data.threshold_db + data.start_sl_db, seconds_heard: 0 }],
    });
  }

  const maxLevel = data.threshold_db + data.max_decay_db;
  const lastLevel = data.steps.length ? data.steps[data.steps.length - 1].level_db : data.threshold_db;
  const heldFull = data.steps.some((s) => s.seconds_heard >= 60);
  const reachedMax = lastLevel >= maxLevel;

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
            {AUDIOGRAM_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f >= 1000 ? `${f / 1000}k` : f} Hz{CARHART_FREQS.includes(f) ? " •" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">Umbral (dB)</span>
          <input
            type="number"
            step={5}
            value={data.threshold_db}
            disabled={readOnly}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">SL inicial (dB)</span>
          <input
            type="number"
            step={1}
            value={data.start_sl_db}
            disabled={readOnly}
            onChange={(e) => update({ start_sl_db: Number(e.target.value) })}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">Paso (dB)</span>
          <input
            type="number"
            step={1}
            value={data.step_db}
            disabled={readOnly}
            onChange={(e) => update({ step_db: Number(e.target.value) })}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">Tope decay (dB)</span>
          <input
            type="number"
            step={5}
            value={data.max_decay_db}
            disabled={readOnly}
            onChange={(e) => update({ max_decay_db: Number(e.target.value) })}
            className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
          />
        </label>
      </div>

      <div className="rounded-lg border border-border-secondary bg-bg-secondary p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h4 className="text-xs font-semibold" style={{ color: earColor }}>
            Pasos · tono 60 s por nivel
          </h4>
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={addStep}
                className="ml-auto flex items-center gap-1 rounded border border-accent bg-accent/10 px-2 py-1 text-xs text-accent"
              >
                <Plus size={12} /> Agregar paso
              </button>
              <button
                type="button"
                onClick={resetSteps}
                className="flex items-center gap-1 rounded border border-border-secondary bg-bg-primary px-2 py-1 text-xs"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </>
          )}
        </div>

        <p className="mb-2 text-[11px] text-text-tertiary">
          Tono continuo por 60 s a cada nivel. Si el paciente deja de oír antes → +{data.step_db} dB y se agrega
          nuevo paso. Cronómetro interno opcional (si usas el del audiómetro o un reloj externo, ingresa los
          segundos a mano). Termina cuando sostenga 60 s completos o al superar el tope de decay.
        </p>

        {data.steps.length === 0 ? (
          <p className="rounded border border-dashed border-border-secondary p-3 text-center text-xs text-text-tertiary">
            Sin pasos. Usa «Agregar paso».
          </p>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-[60px_80px_1fr_80px_40px] items-center gap-2 border-b border-border-secondary pb-1 text-[10px] font-semibold text-text-tertiary">
              <span>#</span>
              <span>Nivel (dB)</span>
              <span>Cronómetro / tiempo oído</span>
              <span className="text-right">Segundos</span>
              <span></span>
            </div>
            {data.steps.map((s, i) => (
              <StepRow
                key={i}
                index={i}
                step={s}
                readOnly={readOnly}
                onChange={(patch) => updateStep(i, patch)}
                onRemove={() => removeStep(i)}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className="rounded-lg border-2 p-3"
        style={{ borderColor: CARHART_CLASS_COLORS[cls], backgroundColor: `${CARHART_CLASS_COLORS[cls]}14` }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-text-tertiary">Decay total</p>
            <p className="text-lg font-bold" style={{ color: CARHART_CLASS_COLORS[cls] }}>
              +{decay} dB
            </p>
            <p className="text-xs font-semibold" style={{ color: CARHART_CLASS_COLORS[cls] }}>
              {CARHART_CLASS_LABELS[cls]}
            </p>
          </div>
          <div className="text-right text-[11px] text-text-tertiary">
            <p>
              {data.ear === "right" ? "OD" : "OI"} ·{" "}
              {data.frequency >= 1000 ? `${data.frequency / 1000}k` : data.frequency} Hz
            </p>
            <p>Umbral {data.threshold_db} dB · tope +{data.max_decay_db} dB</p>
            <p>
              {heldFull
                ? "Sostuvo 60 s"
                : reachedMax
                ? "Tope alcanzado sin sostener"
                : "Test en curso"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StepRowProps {
  index: number;
  step: CarhartStep;
  readOnly?: boolean;
  onChange: (patch: Partial<CarhartStep>) => void;
  onRemove: () => void;
}

function StepRow({ index, step, readOnly, onChange, onRemove }: StepRowProps) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(step.seconds_heard);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) setElapsed(step.seconds_heard);
  }, [step.seconds_heard, running]);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - elapsed * 1000;
    const tick = () => {
      if (startRef.current === null) return;
      const secs = Math.min(60, (Date.now() - startRef.current) / 1000);
      setElapsed(secs);
      if (secs >= 60) {
        setRunning(false);
        onChange({ seconds_heard: 60 });
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function startStop() {
    if (running) {
      setRunning(false);
      onChange({ seconds_heard: Math.round(elapsed) });
    } else {
      setRunning(true);
    }
  }
  function resetRow() {
    setRunning(false);
    setElapsed(0);
    onChange({ seconds_heard: 0 });
  }

  const pct = Math.min(100, (elapsed / 60) * 100);
  const full = step.seconds_heard >= 60;

  return (
    <div className="grid grid-cols-[60px_80px_1fr_80px_40px] items-center gap-2 text-xs">
      <span className="text-text-tertiary">#{index + 1}</span>
      <input
        type="number"
        step={5}
        value={step.level_db}
        disabled={readOnly}
        onChange={(e) => onChange({ level_db: Number(e.target.value) })}
        className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
      />
      <div className="flex items-center gap-2">
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={startStop}
              className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold ${
                running
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-emerald-400 bg-emerald-50 text-emerald-700"
              }`}
            >
              {running ? <Pause size={12} /> : <Play size={12} />}
              {running ? "Pausa" : "Iniciar"}
            </button>
            <button
              type="button"
              onClick={resetRow}
              className="flex items-center gap-1 rounded border border-border-secondary bg-bg-primary px-2 py-1 text-[11px]"
            >
              <RotateCcw size={12} />
            </button>
          </>
        )}
        <div className="relative h-2 flex-1 overflow-hidden rounded bg-bg-primary">
          <div
            className="h-full transition-[width] duration-100"
            style={{
              width: `${pct}%`,
              backgroundColor: full ? "#059669" : running ? "#f59e0b" : "#6b7280",
            }}
          />
        </div>
      </div>
      <input
        type="number"
        min={0}
        max={60}
        step={1}
        value={Math.round(step.seconds_heard)}
        disabled={readOnly || running}
        onChange={(e) => {
          const v = Math.max(0, Math.min(60, Number(e.target.value)));
          setElapsed(v);
          onChange({ seconds_heard: v });
        }}
        className="rounded border border-border-secondary bg-bg-primary px-2 py-1 text-right"
      />
      {!readOnly ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center justify-center rounded p-1 text-red-600 hover:bg-red-50"
        >
          <Trash2 size={12} />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
