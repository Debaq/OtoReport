import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import type { AudiometryReport, Patient } from "@/types";
import { computeAllPTA, emptyAcumetry, emptyAudiogramEar, emptyLogoEar } from "@/types";
import { useWorkspace } from "./useWorkspace";
import { calculateAge } from "@/lib/utils";

export function createEmptyAudiometry(
  patient: Patient,
  sessionId: string,
  examiner: string,
  equipment: string
): AudiometryReport {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    patient_id: patient.id,
    patient,
    session_id: sessionId,
    status: "in_progress",
    report_type: "audiometry",
    examiner,
    equipment,
    right_audiogram: emptyAudiogramEar(),
    left_audiogram: emptyAudiogramEar(),
    logo_right: emptyLogoEar(),
    logo_left: emptyLogoEar(),
    supraliminar: { tests: [] },
    acumetry: emptyAcumetry(),
    pta: {
      right_air: null, left_air: null, right_bone: null, left_bone: null,
      right_air_4: null, left_air_4: null, right_bone_4: null, left_bone_4: null,
    },
    conclusion: "",
    created_at: now,
    updated_at: now,
  };
}

export function useAudiometry() {
  const { config } = useWorkspace();
  const [report, setReport] = useState<AudiometryReport | null>(null);
  const [saving, setSaving] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<AudiometryReport | null>(null);

  const createSession = useCallback(
    async (patient: Patient) => {
      const sessionId = uuidv4();
      await invoke("create_audiometry_session", { patientId: patient.id, sessionId });
      const r = createEmptyAudiometry(patient, sessionId, config?.examiner ?? "", config?.equipment ?? "");
      await invoke("save_audiometry", { report: r });
      setReport(r);
      return r;
    },
    [config]
  );

  const loadReport = useCallback(async (patientId: string, sessionId: string) => {
    const r = await invoke<AudiometryReport>("load_audiometry", { patientId, sessionId });
    if (r.patient.birth_date) r.patient.age = calculateAge(r.patient.birth_date);
    r.right_audiogram.ldl ??= [];
    r.left_audiogram.ldl ??= [];
    if (!r.supraliminar || !Array.isArray((r.supraliminar as any).tests)) {
      r.supraliminar = { tests: [] };
    }
    setReport(r);
    return r;
  }, []);

  const saveReport = useCallback(async (r: AudiometryReport) => {
    setSaving(true);
    try {
      const updated = { ...r, updated_at: new Date().toISOString() };
      await invoke("save_audiometry", { report: updated });
      setReport(updated);
    } finally {
      setSaving(false);
    }
  }, []);

  const flushSave = useCallback(async () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (pending.current) {
      const updated = { ...pending.current, updated_at: new Date().toISOString() };
      pending.current = null;
      await invoke("save_audiometry", { report: updated });
    }
  }, []);

  const updateReport = useCallback((updater: (prev: AudiometryReport) => AudiometryReport) => {
    setReport((prev) => {
      if (!prev) return prev;
      let next = updater(prev);
      next = { ...next, pta: computeAllPTA(next.right_audiogram, next.left_audiogram) };
      pending.current = next;
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        pending.current = null;
        const updated = { ...next, updated_at: new Date().toISOString() };
        invoke("save_audiometry", { report: updated }).catch(console.error);
      }, 2000);
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (pending.current) {
        const updated = { ...pending.current, updated_at: new Date().toISOString() };
        invoke("save_audiometry", { report: updated }).catch(console.error);
        pending.current = null;
      }
    };
  }, []);

  return { report, setReport, createSession, loadReport, saveReport, updateReport, flushSave, saving };
}
