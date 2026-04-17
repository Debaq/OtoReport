import { useState } from "react";
import type { AudiometryReport, AudiometrySymbolSet } from "@/types";
import { useWorkspace } from "@/hooks/useWorkspace";
import { AudiogramChart } from "./AudiogramChart";
import { LogoaudiometryChart } from "./LogoaudiometryChart";
import { SupraliminarForm } from "./SupraliminarForm";
import { AcumetryForm } from "./AcumetryForm";
import { PTAPanel } from "./PTAPanel";
import { Button } from "@/components/ui/Button";
import { Check, Eye, Download } from "lucide-react";

interface Props {
  report: AudiometryReport;
  onChange: (updater: (prev: AudiometryReport) => AudiometryReport) => void;
  flushSave: () => Promise<void>;
  onExportPDF: () => void;
  onPreviewPDF: () => void;
  readOnly?: boolean;
}

type Tab = "audiogram" | "logo" | "supra" | "acumetry";

export function AudiometryForm({ report, onChange, flushSave, onExportPDF, onPreviewPDF, readOnly }: Props) {
  const [tab, setTab] = useState<Tab>("audiogram");
  const { config } = useWorkspace();
  const symbolSet: AudiometrySymbolSet = (config?.audiometry_symbol_set as AudiometrySymbolSet) || "asha";

  async function markCompleted() {
    await flushSave();
    onChange((p) => ({ ...p, status: "completed" }));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "audiogram", label: "Audiograma" },
    { id: "logo", label: "Logoaudiometría" },
    { id: "supra", label: "Pruebas supraliminares" },
    { id: "acumetry", label: "Acumetría" },
  ];

  return (
    <div className="space-y-6">
      {/* Metadata */}
      <div className="rounded-lg border border-border-secondary bg-bg-secondary p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-text-tertiary">Paciente</p>
            <p className="font-medium">{report.patient.name}</p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">ID</p>
            <p className="font-medium">{report.patient.rut}</p>
          </div>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-text-tertiary">Examinador</span>
            <input
              value={report.examiner}
              disabled={readOnly}
              onChange={(e) => onChange((p) => ({ ...p, examiner: e.target.value }))}
              className="rounded border border-border-secondary bg-bg-secondary px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-text-tertiary">Equipo</span>
            <input
              value={report.equipment}
              disabled={readOnly}
              onChange={(e) => onChange((p) => ({ ...p, equipment: e.target.value }))}
              className="rounded border border-border-secondary bg-bg-secondary px-2 py-1"
            />
          </label>
        </div>
      </div>

      <PTAPanel pta={report.pta} />

      <div className="flex gap-1 border-b border-border-secondary">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-accent text-accent-text"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "audiogram" && (
        <AudiogramChart
          right={report.right_audiogram}
          left={report.left_audiogram}
          onChangeRight={(v) => onChange((p) => ({ ...p, right_audiogram: v }))}
          onChangeLeft={(v) => onChange((p) => ({ ...p, left_audiogram: v }))}
          readOnly={readOnly}
          symbolSet={symbolSet}
        />
      )}

      {tab === "logo" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LogoaudiometryChart
            ear="right"
            data={report.logo_right}
            onChange={(v) => onChange((p) => ({ ...p, logo_right: v }))}
            readOnly={readOnly}
          />
          <LogoaudiometryChart
            ear="left"
            data={report.logo_left}
            onChange={(v) => onChange((p) => ({ ...p, logo_left: v }))}
            readOnly={readOnly}
          />
        </div>
      )}

      {tab === "supra" && (
        <SupraliminarForm
          data={report.supraliminar}
          onChange={(v) => onChange((p) => ({ ...p, supraliminar: v }))}
          right={report.right_audiogram}
          left={report.left_audiogram}
          readOnly={readOnly}
        />
      )}

      {tab === "acumetry" && (
        <AcumetryForm
          data={report.acumetry}
          onChange={(v) => onChange((p) => ({ ...p, acumetry: v }))}
          readOnly={readOnly}
        />
      )}

      <div className="rounded-lg border border-border-secondary bg-bg-secondary p-4">
        <label className="text-xs text-text-tertiary">Conclusión</label>
        <textarea
          value={report.conclusion}
          disabled={readOnly}
          onChange={(e) => onChange((p) => ({ ...p, conclusion: e.target.value }))}
          placeholder="Conclusión diagnóstica..."
          className="mt-1 min-h-[100px] w-full rounded border border-border-secondary bg-bg-primary px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={onPreviewPDF} variant="secondary">
          <Eye size={16} />
          Vista previa PDF
        </Button>
        <Button onClick={onExportPDF} variant="secondary">
          <Download size={16} />
          Exportar PDF
        </Button>
        {!readOnly && (
          <Button onClick={markCompleted} className="ml-auto">
            <Check size={16} />
            Marcar como terminado
          </Button>
        )}
      </div>
    </div>
  );
}
