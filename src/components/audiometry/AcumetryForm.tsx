import type { Acumetry, AcumetryResult, RinneResult, SchwabachResult } from "@/types";

interface Props {
  data: Acumetry;
  onChange: (next: Acumetry) => void;
  readOnly?: boolean;
}

const WEBER_OPTS: { value: AcumetryResult; label: string }[] = [
  { value: "not_performed", label: "No realizado" },
  { value: "central", label: "Central" },
  { value: "lateralized_right", label: "Lateraliza a OD" },
  { value: "lateralized_left", label: "Lateraliza a OI" },
  { value: "normal", label: "Normal" },
];

const RINNE_OPTS: { value: RinneResult; label: string }[] = [
  { value: "not_performed", label: "No realizado" },
  { value: "positive", label: "Positivo (VA > VO)" },
  { value: "negative", label: "Negativo (VO > VA)" },
  { value: "neutral", label: "Neutro (VA = VO)" },
];

const SCHWABACH_OPTS: { value: SchwabachResult; label: string }[] = [
  { value: "not_performed", label: "No realizado" },
  { value: "normal", label: "Normal" },
  { value: "shortened", label: "Acortado" },
  { value: "lengthened", label: "Alargado" },
];

export function AcumetryForm({ data, onChange, readOnly }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-text-secondary">Weber</span>
        <select
          value={data.weber}
          disabled={readOnly}
          onChange={(e) => onChange({ ...data, weber: e.target.value as AcumetryResult })}
          className="rounded border border-border-secondary bg-bg-secondary px-2 py-1"
        >
          {WEBER_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-text-secondary">Schwabach</span>
        <select
          value={data.schwabach}
          disabled={readOnly}
          onChange={(e) => onChange({ ...data, schwabach: e.target.value as SchwabachResult })}
          className="rounded border border-border-secondary bg-bg-secondary px-2 py-1"
        >
          {SCHWABACH_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium" style={{ color: "#dc2626" }}>Rinne OD</span>
        <select
          value={data.rinne_right}
          disabled={readOnly}
          onChange={(e) => onChange({ ...data, rinne_right: e.target.value as RinneResult })}
          className="rounded border border-border-secondary bg-bg-secondary px-2 py-1"
        >
          {RINNE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium" style={{ color: "#2563eb" }}>Rinne OI</span>
        <select
          value={data.rinne_left}
          disabled={readOnly}
          onChange={(e) => onChange({ ...data, rinne_left: e.target.value as RinneResult })}
          className="rounded border border-border-secondary bg-bg-secondary px-2 py-1"
        >
          {RINNE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs md:col-span-2">
        <span className="font-medium text-text-secondary">Observaciones acumetría</span>
        <textarea
          value={data.observations}
          disabled={readOnly}
          onChange={(e) => onChange({ ...data, observations: e.target.value })}
          className="min-h-[60px] rounded border border-border-secondary bg-bg-secondary px-2 py-1"
        />
      </label>
    </div>
  );
}
