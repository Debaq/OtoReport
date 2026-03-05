import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { Report, SessionInfo } from "@/types";
import { EarPanel } from "./EarPanel";
import { ReportPreview } from "./ReportPreview";
import { Button } from "@/components/ui/Button";
import { Save, FileText, ChevronDown, ChevronUp, RefreshCw, Settings, Import, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { EarImage } from "@/types/image";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getDefaultFindingsCategories, translateFindingsCategories } from "@/types/report";
import { formatDate } from "@/lib/utils";

interface ReportFormProps {
  report: Report;
  onChange: (updater: (prev: Report) => Report) => void;
  onSave: (report: Report) => Promise<void>;
  saving: boolean;
  readOnly?: boolean;
}

export function ReportForm({ report, onChange, onSave, saving, readOnly }: ReportFormProps) {
  const { t } = useTranslation();
  const [showPreview, setShowPreview] = useState(false);
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const { config } = useWorkspace();

  const reportCategories = report.findings_categories;

  function handleUpdateFindings() {
    const cats = translateFindingsCategories(
      config?.findings_categories && config.findings_categories.length > 0
        ? config.findings_categories
        : getDefaultFindingsCategories()
    );
    onChange((r) => ({
      ...r,
      findings_categories: cats.map((c) => ({ ...c, checks: c.checks.map((ch) => ({ ...ch })) })),
    }));
  }

  const isEarWash = report.report_type === "ear_wash";
  const [activePhase, setActivePhase] = useState<"pre" | "post">("pre");
  const [importTarget, setImportTarget] = useState<"pre" | "post" | null>(null);
  const [importSessions, setImportSessions] = useState<SessionInfo[]>([]);
  const [importing, setImporting] = useState(false);

  async function openImportModal(phase: "pre" | "post") {
    try {
      const sessions = await invoke<SessionInfo[]>("list_patient_sessions", {
        patientId: report.patient_id,
      });
      // Filtrar: solo otoscopías (no el informe actual), y también ear_wash para permitir importar desde otro lavado
      const filtered = sessions.filter(
        (s) => s.id !== report.session_id
      );
      setImportSessions(filtered);
      setImportTarget(phase);
    } catch (err) {
      console.error("Error cargando sesiones:", err);
    }
  }

  async function handleImportSession(session: SessionInfo) {
    if (!importTarget) return;
    setImporting(true);
    try {
      const rightDir = importTarget === "pre" ? "pre_right" : "post_right";
      const leftDir = importTarget === "pre" ? "pre_left" : "post_left";

      // Copiar archivos de imágenes
      await invoke("import_session_ears", {
        sourcePatientId: session.patient_id,
        sourceSessionId: session.id,
        targetPatientId: report.patient_id,
        targetSessionId: report.session_id,
        targetRightDir: rightDir,
        targetLeftDir: leftDir,
      });

      // Cargar el reporte fuente para copiar los EarData
      const sourceReport = await invoke<Report>("load_report", {
        patientId: session.patient_id,
        sessionId: session.id,
      });

      // Copiar datos de oídos al reporte actual
      if (importTarget === "pre") {
        onChange((r) => ({
          ...r,
          right_ear: { ...sourceReport.right_ear },
          left_ear: { ...sourceReport.left_ear },
        }));
      } else {
        onChange((r) => ({
          ...r,
          post_right_ear: { ...sourceReport.right_ear },
          post_left_ear: { ...sourceReport.left_ear },
        }));
      }

      setImportTarget(null);
    } catch (err) {
      console.error("Error importando sesión:", err);
    } finally {
      setImporting(false);
    }
  }

  type MoveableSide = "right" | "left" | "pre_right" | "pre_left" | "post_right" | "post_left";

  function sideToReportKey(side: MoveableSide): "right_ear" | "left_ear" | "post_right_ear" | "post_left_ear" {
    switch (side) {
      case "right": case "pre_right": return "right_ear";
      case "left": case "pre_left": return "left_ear";
      case "post_right": return "post_right_ear";
      case "post_left": return "post_left_ear";
    }
  }

  function oppositeSide(side: MoveableSide): MoveableSide {
    switch (side) {
      case "right": return "left";
      case "left": return "right";
      case "pre_right": return "pre_left";
      case "pre_left": return "pre_right";
      case "post_right": return "post_left";
      case "post_left": return "post_right";
    }
  }

  function sideToDir(side: MoveableSide): string {
    if (!isEarWash) return side === "right" ? "right" : "left";
    return side;
  }

  async function handleMoveImage(fromSide: MoveableSide, image: EarImage) {
    const toSide = oppositeSide(fromSide);
    await invoke("move_image", {
      patientId: report.patient_id,
      sessionId: report.session_id,
      fromSide: sideToDir(fromSide),
      toSide: sideToDir(toSide),
      filename: image.filename,
      thumbnail: image.thumbnail,
    });

    const movedImage: EarImage = { ...image, primary: false, sort_order: 0 };
    onChange((r) => {
      const fromKey = sideToReportKey(fromSide);
      const toKey = sideToReportKey(toSide);
      const fromData = r[fromKey];
      const toData = r[toKey];
      if (!fromData || !toData) return r;
      const fromImages = fromData.images.filter((i) => i.id !== image.id);
      const toImages = [...toData.images, { ...movedImage, sort_order: toData.images.length }];
      return {
        ...r,
        [fromKey]: { ...fromData, images: fromImages },
        [toKey]: { ...toData, images: toImages },
      };
    });
  }

  const loadImageUrl = useCallback(
    async (
      patientId: string,
      sessionId: string,
      side: string,
      filename: string
    ): Promise<string> => {
      const data = await invoke<number[]>("load_image", {
        patientId,
        sessionId,
        side,
        filename,
      });
      const bytes = new Uint8Array(data);
      const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
      const mime =
        ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : "image/png";
      return new Promise<string>((resolve, reject) => {
        const blob = new Blob([bytes], { type: mime });
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* Metadata */}
      <div className="rounded-xl border border-border-secondary bg-bg-secondary p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-medium text-text-primary">{report.patient.name}</p>
                <p className="text-xs text-text-tertiary">{report.patient.rut}</p>
                {report.patient.age > 0 && (
                  <p className="text-xs text-text-tertiary">{report.patient.age} {t("patients.ageYears")}</p>
                )}
              </div>
              <button
                onClick={() => setShowPatientDetails(!showPatientDetails)}
                className="ml-auto text-text-tertiary hover:text-text-secondary"
                title={t("report.metadata.patientDetails")}
              >
                {showPatientDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-tertiary">
              {t("report.metadata.examiner")}
            </label>
            <input
              value={report.examiner}
              onChange={(e) =>
                onChange((r) => ({ ...r, examiner: e.target.value }))
              }
              disabled={readOnly}
              className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-bg-tertiary disabled:text-text-tertiary"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-tertiary">
              {t("report.metadata.equipment")}
            </label>
            <input
              value={report.equipment}
              onChange={(e) =>
                onChange((r) => ({ ...r, equipment: e.target.value }))
              }
              disabled={readOnly}
              className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-bg-tertiary disabled:text-text-tertiary"
            />
          </div>
        </div>

        {showPatientDetails && (
          <div className="mt-3 grid grid-cols-3 gap-4 border-t border-border-secondary pt-3">
            <div className="text-xs text-text-tertiary">
              <span className="font-medium">{t("report.metadata.phone")}:</span> {report.patient.phone || "—"}
            </div>
            <div className="text-xs text-text-tertiary">
              <span className="font-medium">{t("report.metadata.email")}:</span> {report.patient.email || "—"}
            </div>
            <div className="text-xs text-text-tertiary">
              <span className="font-medium">{t("report.metadata.birthDate")}:</span> {report.patient.birth_date || "—"}
            </div>
          </div>
        )}
      </div>

      {/* Acciones de hallazgos */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-2">
          <Link
            to="/settings?tab=hallazgos"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-tertiary transition-colors hover:bg-accent-subtle hover:text-accent-text"
            title={t("report.findings.updateTitle")}
          >
            <Settings size={13} />
            {t("report.findings.configure")}
          </Link>
          <button
            type="button"
            onClick={handleUpdateFindings}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-tertiary transition-colors hover:bg-accent-subtle hover:text-accent-text"
            title={t("report.findings.updateDescription")}
          >
            <RefreshCw size={13} />
            {t("report.findings.update")}
          </button>
        </div>
      )}

      {/* Oídos */}
      {isEarWash && (
        <div className="flex gap-1 rounded-lg bg-bg-tertiary p-1">
          <button
            type="button"
            onClick={() => setActivePhase("pre")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activePhase === "pre"
                ? "bg-bg-secondary text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {t("report.earWash.pre")}
          </button>
          <button
            type="button"
            onClick={() => setActivePhase("post")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activePhase === "post"
                ? "bg-bg-secondary text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {t("report.earWash.post")}
          </button>
        </div>
      )}

      {(!isEarWash || activePhase === "pre") && (
        <>
          {isEarWash && !readOnly && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => openImportModal("pre")}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-tertiary transition-colors hover:bg-accent-subtle hover:text-accent-text"
              >
                <Import size={13} />
                {t("report.earWash.import")}
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-6">
            <EarPanel
              side={isEarWash ? "pre_right" : "right"}
              data={report.right_ear}
              patientId={report.patient_id}
              sessionId={report.session_id}
              onChange={(data) => onChange((r) => ({ ...r, right_ear: data }))}
              onMoveImage={(img) => handleMoveImage(isEarWash ? "pre_right" : "right", img)}
              readOnly={readOnly}
              patientName={report.patient.name}
              reportDate={report.created_at}
              categoriesConfig={reportCategories}
            />
            <EarPanel
              side={isEarWash ? "pre_left" : "left"}
              data={report.left_ear}
              patientId={report.patient_id}
              sessionId={report.session_id}
              onChange={(data) => onChange((r) => ({ ...r, left_ear: data }))}
              onMoveImage={(img) => handleMoveImage(isEarWash ? "pre_left" : "left", img)}
              readOnly={readOnly}
              patientName={report.patient.name}
              reportDate={report.created_at}
              categoriesConfig={reportCategories}
            />
          </div>
        </>
      )}

      {isEarWash && activePhase === "post" && report.post_right_ear && report.post_left_ear && (
        <>
          {!readOnly && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => openImportModal("post")}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-tertiary transition-colors hover:bg-accent-subtle hover:text-accent-text"
              >
                <Import size={13} />
                {t("report.earWash.import")}
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-6">
            <EarPanel
              side="post_right"
              data={report.post_right_ear}
              patientId={report.patient_id}
              sessionId={report.session_id}
              onChange={(data) => onChange((r) => ({ ...r, post_right_ear: data }))}
              onMoveImage={(img) => handleMoveImage("post_right", img)}
              readOnly={readOnly}
              patientName={report.patient.name}
              reportDate={report.created_at}
              categoriesConfig={reportCategories}
            />
            <EarPanel
              side="post_left"
              data={report.post_left_ear}
              patientId={report.patient_id}
              sessionId={report.session_id}
              onChange={(data) => onChange((r) => ({ ...r, post_left_ear: data }))}
              onMoveImage={(img) => handleMoveImage("post_left", img)}
              readOnly={readOnly}
              patientName={report.patient.name}
              reportDate={report.created_at}
              categoriesConfig={reportCategories}
            />
          </div>
        </>
      )}

      {/* Conclusión */}
      <div className="rounded-xl border border-border-secondary bg-bg-secondary p-4">
        <label className="mb-2 block text-sm font-medium text-text-secondary">
          {t("report.conclusion.label")}
        </label>
        <textarea
          value={report.conclusion}
          onChange={(e) =>
            onChange((r) => ({ ...r, conclusion: e.target.value }))
          }
          disabled={readOnly}
          rows={4}
          className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-bg-tertiary disabled:text-text-tertiary"
          placeholder={t("report.conclusion.placeholder")}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setShowPreview(true)}>
          <FileText size={16} />
          {t("report.preview")}
        </Button>
        {!readOnly && (
          <Button onClick={() => onSave(report)} disabled={saving}>
            <Save size={16} />
            {saving ? t("report.saving") : t("report.save")}
          </Button>
        )}
      </div>

      {showPreview && (
        <ReportPreview
          report={report}
          loadImageUrl={loadImageUrl}
          onClose={() => setShowPreview(false)}
          onStatusComplete={
            !readOnly
              ? () => {
                  onChange((r) => ({ ...r, status: "completed" }));
                  onSave({ ...report, status: "completed" });
                }
              : undefined
          }
        />
      )}

      {/* Modal importar otoscopía */}
      {importTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
          <div className="flex w-[420px] max-h-[80vh] flex-col rounded-xl bg-bg-secondary shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-secondary px-6 py-4">
              <h3 className="text-lg font-semibold text-text-primary">
                {t("report.earWash.importTitle", { phase: importTarget === "pre" ? t("report.earWash.pre") : t("report.earWash.post") })}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setImportTarget(null)} disabled={importing}>
                <X size={18} />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {importing ? (
                <div className="flex flex-col items-center gap-3 py-8 text-text-tertiary">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-accent border-t-transparent" />
                  <span className="text-sm">{t("report.earWash.importing")}</span>
                </div>
              ) : importSessions.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-tertiary">
                  {t("report.earWash.noSessions")}
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="mb-3 text-sm text-text-secondary">
                    {t("report.earWash.selectSession")}
                  </p>
                  {importSessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleImportSession(s)}
                      className="flex w-full items-center justify-between rounded-lg border border-border-secondary bg-bg-tertiary px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent-subtle"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {formatDate(s.created_at) || "Sin fecha"}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {s.report_type === "ear_wash" ? t("report.earWash.types.ear_wash") : t("report.earWash.types.otoscopy")}
                          {" · "}
                          {s.status === "completed" ? t("report.earWash.status.completed") : t("report.earWash.status.in_progress")}
                        </p>
                      </div>
                      <Import size={16} className="text-text-tertiary" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
