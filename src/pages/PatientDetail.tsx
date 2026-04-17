import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import {
  FilePlus,
  Trash2,
  Copy,
  ArrowLeft,
  FileText,
  Pencil,
  AudioLines,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { Patient, SessionInfo } from "@/types";

export function PatientDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config } = useWorkspace();
  const idLabel = t(`patients.idLabel.${config?.id_type || "rut_id_dni"}`);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [p, s] = await Promise.all([
        invoke<Patient>("get_patient", { id }),
        invoke<SessionInfo[]>("list_patient_sessions", { patientId: id }),
      ]);
      setPatient(p);
      setSessions(s);
    } catch (err) {
      console.error("Error loading patient:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeleteSession() {
    if (!deleteTarget || !id) return;
    try {
      await invoke("delete_session", {
        patientId: id,
        sessionId: deleteTarget,
      });
      setDeleteTarget(null);
      toast(t("patients.detail.reportDeleted"), "success");
      await load();
    } catch (err) {
      console.error(err);
      toast(t("patients.detail.deleteError"), "error");
    }
  }

  async function handleDuplicate(sessionId: string) {
    if (!id) return;
    try {
      await invoke<string>("duplicate_session", {
        patientId: id,
        sessionId,
      });
      toast(t("patients.detail.reportDuplicated"), "success");
      await load();
    } catch (err) {
      console.error(err);
      toast(t("patients.detail.duplicateError"), "error");
    }
  }

  if (loading) {
    return (
      <>
        <Header title={t("patients.title")} />
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      </>
    );
  }

  if (!patient) {
    return (
      <>
        <Header title={t("patients.title")} />
        <div className="flex flex-1 items-center justify-center text-text-tertiary">
          {t("patients.detail.patientNotFound")}
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={patient.name} />
      <div className="flex-1 overflow-auto p-6">
        {/* Back + actions */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate("/patients")}
            className="flex items-center gap-1 text-sm text-text-tertiary hover:text-text-secondary"
          >
            <ArrowLeft size={16} />
            {t("patients.detail.back")}
          </button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/patients?edit=${patient.id}`)}
            >
              <Pencil size={14} />
              {t("patients.detail.edit")}
            </Button>
            <Button
              size="sm"
              onClick={() => navigate(`/new-report?patient=${patient.id}`)}
            >
              <FilePlus size={14} />
              {t("sidebar.newReport")}
            </Button>
            <Button
              size="sm"
              onClick={() => navigate(`/new-audiometry?patient=${patient.id}`)}
            >
              <AudioLines size={14} />
              {t("sidebar.newAudiometry")}
            </Button>
          </div>
        </div>

        {/* Patient info card */}
        <div className="mb-6 rounded-xl border border-border-secondary bg-bg-secondary p-4">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs font-medium text-text-tertiary">{idLabel}</span>
              <p className="text-text-primary">{patient.rut}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-text-tertiary">{t("patients.age")}</span>
              <p className="text-text-primary">{patient.age} {t("patients.ageYears")}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-text-tertiary">
                {t("patients.phone")}
              </span>
              <p className="text-text-primary">{patient.phone || "—"}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-text-tertiary">{t("patients.email")}</span>
              <p className="text-text-primary">{patient.email || "—"}</p>
            </div>
          </div>
        </div>

        {/* Sessions / Reports list */}
        <h3 className="mb-3 text-base font-semibold text-text-primary">
          {t("patients.detail.reports")} ({sessions.length})
        </h3>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-primary py-12 text-text-tertiary">
            <FileText size={36} className="mb-2" />
            <p className="text-sm">{t("patients.detail.noReports")}</p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => navigate(`/new-report?patient=${patient.id}`)}
            >
              {t("patients.detail.createFirst")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-border-secondary bg-bg-secondary px-4 py-3 transition-shadow hover:shadow-sm"
                onClick={() =>
                  navigate(
                    `/${s.report_type === "audiometry" ? "new-audiometry" : "new-report"}?patient=${s.patient_id}&session=${s.id}`
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <FileText
                    size={20}
                    className={
                      s.status === "completed" ? "text-accent-text" : "text-text-tertiary"
                    }
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">
                        {formatDate(s.created_at) || "Sin fecha"}
                      </p>
                      {s.report_type === "ear_wash" && (
                        <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-xs font-medium text-accent-text">
                          {t("history.wash")}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        s.status === "completed"
                          ? "text-success-text"
                          : "text-warning-text"
                      }`}
                    >
                      {s.status === "completed" ? t("history.completed") : t("history.inProgress")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    title={t("patients.detail.duplicateReport")}
                    onClick={() => handleDuplicate(s.id)}
                  >
                    <Copy size={16} />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    title={t("patients.detail.deleteReport")}
                    onClick={() => setDeleteTarget(s.id)}
                  >
                    <Trash2 size={16} className="text-danger" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("patients.detail.deleteReport")}
      >
        <p className="mb-4 text-sm text-text-secondary">
          {t("patients.detail.confirmDeleteReport")}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={handleDeleteSession}>
            {t("common.delete")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
