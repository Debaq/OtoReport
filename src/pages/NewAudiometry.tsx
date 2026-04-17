import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { v4 as uuidv4 } from "uuid";
import { pdf } from "@react-pdf/renderer";
import { Header } from "@/components/layout/Header";
import { AudiometryForm } from "@/components/audiometry/AudiometryForm";
import { AudiometryPDF } from "@/components/export/AudiometryPDF";
import { useAudiometry } from "@/hooks/useAudiometry";
import { usePatients } from "@/hooks/usePatients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatRut, cleanRut, validateRut, calculateAge } from "@/lib/utils";
import { CheckCircle } from "lucide-react";
import type { Patient } from "@/types";

function tryFormatId(value: string): string {
  const clean = cleanRut(value);
  if (clean === value.replace(/[\s.-]/g, "").toUpperCase() && validateRut(clean)) {
    return formatRut(clean);
  }
  return value.trim();
}

export function NewAudiometry() {
  const [searchParams] = useSearchParams();
  const patientIdParam = searchParams.get("patient");
  const sessionIdParam = searchParams.get("session");
  const { report, createSession, updateReport, loadReport, flushSave } = useAudiometry();
  const { allPatients } = usePatients();
  const { config } = useWorkspace();
  const { toast } = useToast();

  const [rutInput, setRutInput] = useState("");
  const [foundPatient, setFoundPatient] = useState<Patient | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientBirthDate, setPatientBirthDate] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [isChileanRut, setIsChileanRut] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        if (patientIdParam && sessionIdParam) {
          await loadReport(patientIdParam, sessionIdParam);
        } else if (patientIdParam) {
          const p = await invoke<Patient>("get_patient", { id: patientIdParam });
          selectPatient(p);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setInitializing(false);
      }
    }
    init();
  }, [patientIdParam, sessionIdParam, loadReport]);

  function selectPatient(p: Patient) {
    setFoundPatient(p);
    setRutInput(cleanRut(p.rut));
    setPatientName(p.name);
    setPatientBirthDate(p.birth_date);
    setPatientPhone(p.phone);
    setPatientEmail(p.email);
    setIsChileanRut(true);
    setShowSuggestions(false);
  }

  const term = rutInput.trim().toLowerCase();
  const suggestions = term.length >= 2
    ? allPatients.filter((p) => {
        const r = p.rut.toLowerCase();
        const rc = cleanRut(p.rut).toLowerCase();
        return r.includes(term) || rc.includes(term.replace(/[^0-9kK]/gi, ""));
      })
    : [];

  function handleRutChange(v: string) {
    setRutInput(v);
    setIsChileanRut(validateRut(cleanRut(v)));
    setShowSuggestions(true);
    if (foundPatient && foundPatient.rut !== v.trim() && cleanRut(foundPatient.rut) !== cleanRut(v)) {
      setFoundPatient(null);
      setPatientName("");
      setPatientBirthDate("");
      setPatientPhone("");
      setPatientEmail("");
    }
  }

  async function handleStart() {
    if (!rutInput.trim() || !patientName.trim()) return;
    const now = new Date().toISOString();
    const patient: Patient = foundPatient
      ? {
          ...foundPatient,
          name: patientName,
          birth_date: patientBirthDate,
          age: patientBirthDate ? calculateAge(patientBirthDate) : 0,
          phone: patientPhone,
          email: patientEmail,
          updated_at: now,
        }
      : {
          id: uuidv4(),
          rut: tryFormatId(rutInput),
          name: patientName,
          birth_date: patientBirthDate,
          age: patientBirthDate ? calculateAge(patientBirthDate) : 0,
          phone: patientPhone,
          email: patientEmail,
          notes: "",
          created_at: now,
          updated_at: now,
        };
    await invoke("save_patient", { patient });
    await createSession(patient);
    toast("Audiometría iniciada", "success");
  }

  async function exportPDF() {
    if (!report || !config) return;
    const blob = await pdf(<AudiometryPDF report={report} config={config} />).toBlob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    const filename = `audiometria_${report.patient.name.replace(/\s+/g, "_")}_${report.session_id.slice(0, 6)}.pdf`;
    const path = await save({ defaultPath: filename, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (!path) return;
    await invoke("save_pdf", { path, data: Array.from(buf) });
    toast("PDF guardado", "success");
  }

  async function previewPDF() {
    if (!report || !config) return;
    const blob = await pdf(<AudiometryPDF report={report} config={config} />).toBlob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    const filename = `preview_${report.session_id.slice(0, 6)}.pdf`;
    const path = await invoke<string>("save_pdf_to_cache", { filename, data: Array.from(buf) });
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(path);
  }

  if (initializing && (patientIdParam || sessionIdParam)) {
    return (
      <>
        <Header title="Audiometría" />
        <div className="flex flex-1 items-center justify-center"><Spinner /></div>
      </>
    );
  }

  if (report) {
    const readOnly = report.status === "completed";
    return (
      <>
        <Header title={readOnly ? "Audiometría (solo lectura)" : "Audiometría"} />
        <div className="flex-1 overflow-auto p-6">
          <AudiometryForm
            report={report}
            onChange={updateReport}
            flushSave={flushSave}
            onExportPDF={exportPDF}
            onPreviewPDF={previewPDF}
            readOnly={readOnly}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Nueva Audiometría" />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-lg space-y-6">
          <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
            <h3 className="mb-4 text-lg font-semibold">Datos del paciente</h3>
            <div className="space-y-4">
              <div className="relative" ref={wrapperRef}>
                <Input
                  label="RUT / ID"
                  id="rut"
                  value={isChileanRut ? formatRut(rutInput) : rutInput}
                  onChange={(e) => handleRutChange(e.target.value)}
                  onFocus={() => term.length >= 2 && setShowSuggestions(true)}
                  placeholder="12.345.678-5"
                  autoComplete="off"
                />
                {showSuggestions && suggestions.length > 0 && !foundPatient && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-border-secondary bg-bg-secondary shadow-lg">
                    <div className="max-h-48 overflow-auto py-1">
                      {suggestions.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => selectPatient(p)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent-subtle transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-text-tertiary">{p.rut}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {foundPatient && (
                <div className="flex items-center gap-2 rounded-lg bg-success-subtle px-3 py-2 text-sm text-success-text">
                  <CheckCircle size={16} />
                  Paciente existente
                </div>
              )}
              <Input label="Nombre" id="name" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
              <Input
                label="Fecha de nacimiento"
                id="birth_date"
                type="date"
                value={patientBirthDate}
                onChange={(e) => setPatientBirthDate(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Teléfono" id="phone" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} />
                <Input label="Email" id="email" type="email" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} />
              </div>
            </div>
          </div>
          <Button onClick={handleStart} disabled={!rutInput.trim() || !patientName.trim()} className="w-full py-3">
            Iniciar audiometría
          </Button>
        </div>
      </div>
    </>
  );
}
