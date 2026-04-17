import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Supraliminar, SupraliminarTest, SupraliminarTestType, SupraliminarEarScope, FowlerData, RegerData, SisiData, CarhartData } from "@/types";
import { SUPRALIMINAR_TEST_LABELS, SUPRALIMINAR_RESULT_HINT, SUPRALIMINAR_DESCRIPTION } from "@/types";
import { Plus, Trash2 } from "lucide-react";
import { FowlerChart } from "./FowlerChart";
import { RegerChart } from "./RegerChart";
import { SisiForm } from "./SisiForm";
import { CarhartForm } from "./CarhartForm";

interface Props {
  data: Supraliminar;
  onChange: (next: Supraliminar) => void;
  right?: import("@/types").AudiogramEar;
  left?: import("@/types").AudiogramEar;
  readOnly?: boolean;
}

const EAR_COLOR: Record<SupraliminarEarScope, string> = {
  right: "#dc2626",
  left: "#2563eb",
  bilateral: "#6b7280",
};
const EAR_LABEL: Record<SupraliminarEarScope, string> = {
  right: "OD",
  left: "OI",
  bilateral: "Bilateral",
};

export function SupraliminarForm({ data, onChange, right, left, readOnly }: Props) {
  const tests = data.tests ?? [];
  const [draftType, setDraftType] = useState<SupraliminarTestType>("sisi");
  const [draftEar, setDraftEar] = useState<SupraliminarEarScope>("right");

  function addTest() {
    const t: SupraliminarTest = {
      id: uuidv4(),
      type: draftType,
      ear: draftEar,
      result: "",
      observations: "",
    };
    if (draftType === "fowler") {
      const freq = 1000;
      const refEar: "right" | "left" = draftEar === "left" ? "left" : "right";
      const refAud = refEar === "right" ? right : left;
      const thr = refAud?.air.find((p) => p.frequency === freq && !p.noResponse)?.threshold ?? 0;
      t.fowler = {
        frequency: freq,
        reference_ear: refEar,
        threshold_db: thr,
        step_db: 20,
        matches: [null, null, null, null, null],
      };
    }
    if (draftType === "sisi") {
      const ear: "right" | "left" = draftEar === "left" ? "left" : "right";
      const freq = 1000;
      const aud = ear === "right" ? right : left;
      const thr = aud?.air.find((p) => p.frequency === freq && !p.noResponse)?.threshold ?? 0;
      t.sisi = {
        ear,
        frequency: freq,
        threshold_db: thr,
        sl_db: 20,
        presentation_db: thr + 20,
        familiarization_step_db: 5,
        test_increment_db: 1,
        trials: Array(20).fill(false),
      };
    }
    if (draftType === "tone_decay") {
      const ear: "right" | "left" = draftEar === "left" ? "left" : "right";
      const freq = 4000;
      const aud = ear === "right" ? right : left;
      const thr = aud?.air.find((p) => p.frequency === freq && !p.noResponse)?.threshold ?? 0;
      t.carhart = {
        ear,
        frequency: freq,
        threshold_db: thr,
        start_sl_db: 5,
        step_db: 5,
        max_decay_db: 30,
        steps: [{ level_db: thr + 5, seconds_heard: 0 }],
      };
    }
    if (draftType === "reger") {
      const ear: "right" | "left" = draftEar === "left" ? "left" : "right";
      const refFreq = 4000;
      const cmpFreq = 1000;
      const aud = ear === "right" ? right : left;
      const thr = aud?.air.find((p) => p.frequency === refFreq && !p.noResponse)?.threshold ?? 0;
      t.reger = {
        ear,
        reference_frequency: refFreq,
        comparison_frequency: cmpFreq,
        threshold_db: thr,
        step_db: 20,
        matches: [null, null, null, null, null],
      };
    }
    onChange({ tests: [...tests, t] });
  }
  function updateTest(id: string, patch: Partial<SupraliminarTest>) {
    onChange({ tests: tests.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  }
  function removeTest(id: string) {
    onChange({ tests: tests.filter((t) => t.id !== id) });
  }

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border-secondary bg-bg-secondary p-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-text-tertiary">Prueba</span>
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as SupraliminarTestType)}
              className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
            >
              {(Object.keys(SUPRALIMINAR_TEST_LABELS) as SupraliminarTestType[]).map((k) => (
                <option key={k} value={k}>{SUPRALIMINAR_TEST_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-text-tertiary">Oído</span>
            <select
              value={draftEar}
              onChange={(e) => setDraftEar(e.target.value as SupraliminarEarScope)}
              className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
            >
              <option value="right">OD</option>
              <option value="left">OI</option>
              <option value="bilateral">Bilateral</option>
            </select>
          </label>
          <button
            type="button"
            onClick={addTest}
            className="flex items-center gap-1 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            <Plus size={14} /> Agregar prueba
          </button>
          <span className="ml-auto text-[11px] text-text-tertiary">Solo aparecen en el informe las pruebas realizadas.</span>
        </div>
      )}

      {tests.length === 0 ? (
        <p className="rounded border border-dashed border-border-secondary p-4 text-center text-xs text-text-tertiary">
          No se han agregado pruebas supraliminares.
        </p>
      ) : (
        <ul className="space-y-2">
          {tests.map((t) => {
            const title =
              t.type === "other" && t.custom_name ? t.custom_name : SUPRALIMINAR_TEST_LABELS[t.type];
            return (
              <li key={t.id} className="rounded-lg border border-border-secondary bg-bg-secondary p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: EAR_COLOR[t.ear] }}>
                    {EAR_LABEL[t.ear]}
                  </span>
                  <span className="text-sm font-semibold">{title}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => removeTest(t.id)}
                      className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={12} /> Eliminar
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[11px] italic text-text-tertiary">{SUPRALIMINAR_DESCRIPTION[t.type]}</p>
                {t.type === "fowler" && (
                  <div className="mt-3">
                    <FowlerChart
                      data={t.fowler ?? { frequency: 1000, reference_ear: "right", threshold_db: 0, step_db: 20, matches: [null, null, null, null, null] }}
                      onChange={(v: FowlerData) => updateTest(t.id, { fowler: v })}
                      right={right}
                      left={left}
                      readOnly={readOnly}
                    />
                  </div>
                )}
                {t.type === "sisi" && (
                  <div className="mt-3">
                    <SisiForm
                      data={t.sisi ?? { ear: "right", frequency: 1000, threshold_db: 0, sl_db: 20, presentation_db: 20, familiarization_step_db: 5, test_increment_db: 1, trials: Array(20).fill(false) }}
                      onChange={(v: SisiData) => updateTest(t.id, { sisi: v })}
                      right={right}
                      left={left}
                      readOnly={readOnly}
                    />
                  </div>
                )}
                {t.type === "tone_decay" && (
                  <div className="mt-3">
                    <CarhartForm
                      data={t.carhart ?? { ear: "right", frequency: 4000, threshold_db: 0, start_sl_db: 5, step_db: 5, max_decay_db: 30, steps: [{ level_db: 5, seconds_heard: 0 }] }}
                      onChange={(v: CarhartData) => updateTest(t.id, { carhart: v })}
                      right={right}
                      left={left}
                      readOnly={readOnly}
                    />
                  </div>
                )}
                {t.type === "reger" && (
                  <div className="mt-3">
                    <RegerChart
                      data={t.reger ?? { ear: "right", reference_frequency: 4000, comparison_frequency: 1000, threshold_db: 0, step_db: 20, matches: [null, null, null, null, null] }}
                      onChange={(v: RegerData) => updateTest(t.id, { reger: v })}
                      right={right}
                      left={left}
                      readOnly={readOnly}
                    />
                  </div>
                )}
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {t.type === "other" && (
                    <label className="flex flex-col gap-1 text-xs md:col-span-2">
                      <span className="text-text-tertiary">Nombre de la prueba</span>
                      <input
                        value={t.custom_name ?? ""}
                        disabled={readOnly}
                        onChange={(e) => updateTest(t.id, { custom_name: e.target.value })}
                        className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
                      />
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-text-tertiary">Resultado · {SUPRALIMINAR_RESULT_HINT[t.type]}</span>
                    <input
                      value={t.result}
                      disabled={readOnly}
                      onChange={(e) => updateTest(t.id, { result: e.target.value })}
                      className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-text-tertiary">Oído</span>
                    <select
                      value={t.ear}
                      disabled={readOnly}
                      onChange={(e) => updateTest(t.id, { ear: e.target.value as SupraliminarEarScope })}
                      className="rounded border border-border-secondary bg-bg-primary px-2 py-1"
                    >
                      <option value="right">OD</option>
                      <option value="left">OI</option>
                      <option value="bilateral">Bilateral</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs md:col-span-2">
                    <span className="text-text-tertiary">Observaciones</span>
                    <textarea
                      value={t.observations}
                      disabled={readOnly}
                      onChange={(e) => updateTest(t.id, { observations: e.target.value })}
                      className="min-h-[50px] rounded border border-border-secondary bg-bg-primary px-2 py-1"
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
