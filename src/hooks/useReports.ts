import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import type { Report, EarData, SessionInfo, Patient, FindingsCategoryConfig, ReportType } from "@/types";
import { DEFAULT_EAR_FINDINGS } from "@/types/findings";
import { getDefaultFindingsCategories, translateFindingsCategories } from "@/types/report";
import { useWorkspace } from "./useWorkspace";
import { calculateAge } from "@/lib/utils";

function createEmptyEarData(): EarData {
  return {
    findings: { ...DEFAULT_EAR_FINDINGS },
    marks: { marks: [] },
    images: [],
    observations: "",
  };
}

export function createEmptyReport(
  patient: Patient,
  sessionId: string,
  examiner: string,
  equipment: string,
  findingsCategories?: FindingsCategoryConfig[],
  reportType: ReportType = "otoscopy"
): Report {
  const now = new Date().toISOString();
  const cats = findingsCategories && findingsCategories.length > 0
    ? findingsCategories
    : getDefaultFindingsCategories();
  const translatedCats = translateFindingsCategories(cats);
  const report: Report = {
    id: uuidv4(),
    patient_id: patient.id,
    patient,
    session_id: sessionId,
    status: "in_progress" as const,
    report_type: reportType,
    examiner,
    equipment,
    right_ear: createEmptyEarData(),
    left_ear: createEmptyEarData(),
    conclusion: "",
    created_at: now,
    updated_at: now,
    findings_categories: translatedCats.map((c) => ({ ...c, checks: c.checks.map((ch) => ({ ...ch })) })),
  };
  if (reportType === "ear_wash") {
    report.post_right_ear = createEmptyEarData();
    report.post_left_ear = createEmptyEarData();
  }
  return report;
}

export function useReports() {
  const { config } = useWorkspace();
  const [report, setReport] = useState<Report | null>(null);
  const [saving, setSaving] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingReport = useRef<Report | null>(null);

  const createSession = useCallback(
    async (patient: Patient, reportType: ReportType = "otoscopy") => {
      const sessionId = uuidv4();
      await invoke("create_session", {
        patientId: patient.id,
        sessionId,
        reportType,
      });
      const r = createEmptyReport(
        patient,
        sessionId,
        config?.examiner ?? "",
        config?.equipment ?? "",
        config?.findings_categories,
        reportType
      );
      await invoke("save_report", { report: r });
      setReport(r);
      return r;
    },
    [config]
  );

  const saveReport = useCallback(async (r: Report) => {
    setSaving(true);
    try {
      const updated = { ...r, updated_at: new Date().toISOString() };
      await invoke("save_report", { report: updated });
      setReport(updated);
    } finally {
      setSaving(false);
    }
  }, []);

  const loadReport = useCallback(
    async (patientId: string, sessionId: string) => {
      const r = await invoke<Report>("load_report", {
        patientId,
        sessionId,
      });
      // Recalcular edad desde fecha de nacimiento para corregir valores obsoletos
      if (r.patient.birth_date) {
        r.patient.age = calculateAge(r.patient.birth_date);
      }
      setReport(r);
      return r;
    },
    []
  );

  const flushSave = useCallback(async () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (pendingReport.current) {
      const updated = { ...pendingReport.current, updated_at: new Date().toISOString() };
      pendingReport.current = null;
      await invoke("save_report", { report: updated });
    }
  }, []);

  const updateReport = useCallback(
    (updater: (prev: Report) => Report) => {
      setReport((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        // Auto-save after 2 seconds of inactivity
        pendingReport.current = next;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => {
          pendingReport.current = null;
          const updated = { ...next, updated_at: new Date().toISOString() };
          invoke("save_report", { report: updated }).catch(console.error);
        }, 2000);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (pendingReport.current) {
        const updated = { ...pendingReport.current, updated_at: new Date().toISOString() };
        invoke("save_report", { report: updated }).catch(console.error);
        pendingReport.current = null;
      }
    };
  }, []);

  return { report, setReport, createSession, saveReport, loadReport, updateReport, flushSave, saving };
}

export function useSessionList() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await invoke<SessionInfo[]>("list_sessions");
      setSessions(list);
    } catch (err) {
      console.error("Error loading sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { sessions, loading, reload: load };
}
