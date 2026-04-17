import type { PTA } from "@/types";
import { classifyHearingLoss } from "@/types";

interface Props {
  pta: PTA;
}

const CLASS_LABELS: Record<string, string> = {
  normal: "Audición normal",
  mild: "Hipoacusia leve",
  moderate: "Hipoacusia moderada",
  moderate_severe: "Hipoacusia moderada-severa",
  severe: "Hipoacusia severa",
  profound: "Hipoacusia profunda",
  "—": "—",
};

function Val({ v, color }: { v: number | null; color?: string }) {
  return (
    <span className="font-mono font-semibold tabular-nums" style={{ color }}>
      {v === null ? "—" : `${v} dB`}
    </span>
  );
}

export function PTAPanel({ pta }: Props) {
  return (
    <div className="rounded-lg border border-border-secondary bg-bg-secondary p-4">
      <h3 className="mb-3 text-sm font-semibold">Promedios tonales puros</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border border-border-secondary bg-bg-primary p-3">
          <h4 className="mb-2 text-xs font-semibold text-text-secondary">PTA 500 · 1k · 2k Hz</h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-text-tertiary">Aéreo OD</span><Val v={pta.right_air} color="#dc2626" />
            <span className="text-text-tertiary">Óseo OD</span><Val v={pta.right_bone} color="#dc2626" />
            <span className="text-text-tertiary">Aéreo OI</span><Val v={pta.left_air} color="#2563eb" />
            <span className="text-text-tertiary">Óseo OI</span><Val v={pta.left_bone} color="#2563eb" />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-text-tertiary">
            <span style={{ color: "#dc2626" }}>{CLASS_LABELS[classifyHearingLoss(pta.right_air)]}</span>
            <span style={{ color: "#2563eb" }}>{CLASS_LABELS[classifyHearingLoss(pta.left_air)]}</span>
          </div>
        </div>
        <div className="rounded border border-border-secondary bg-bg-primary p-3">
          <h4 className="mb-2 text-xs font-semibold text-text-secondary">PTA 500 · 1k · 2k · 4k Hz</h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-text-tertiary">Aéreo OD</span><Val v={pta.right_air_4} color="#dc2626" />
            <span className="text-text-tertiary">Óseo OD</span><Val v={pta.right_bone_4} color="#dc2626" />
            <span className="text-text-tertiary">Aéreo OI</span><Val v={pta.left_air_4} color="#2563eb" />
            <span className="text-text-tertiary">Óseo OI</span><Val v={pta.left_bone_4} color="#2563eb" />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-text-tertiary">
            <span style={{ color: "#dc2626" }}>{CLASS_LABELS[classifyHearingLoss(pta.right_air_4)]}</span>
            <span style={{ color: "#2563eb" }}>{CLASS_LABELS[classifyHearingLoss(pta.left_air_4)]}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
