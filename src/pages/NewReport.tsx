import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import { Header } from "@/components/layout/Header";
import { ReportForm } from "@/components/otoscopy/ReportForm";
import { useReports } from "@/hooks/useReports";
import { usePatients } from "@/hooks/usePatients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatRut, cleanRut, validateRut, calculateAge } from "@/lib/utils";

/** Si parece RUT chileno (solo dígitos y K), intenta formatearlo */
function tryFormatId(value: string): string {
  const clean = cleanRut(value);
  if (clean === value.replace(/[\s.-]/g, "").toUpperCase() && validateRut(clean)) {
    return formatRut(clean);
  }
  return value.trim();
}
import { CheckCircle, Stethoscope, Droplets } from "lucide-react";
import type { Patient, ReportType } from "@/types";

export function NewReport() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const patientIdParam = searchParams.get("patient");
  const sessionIdParam = searchParams.get("session");

  const { report, createSession, updateReport, loadReport, flushSave } =
    useReports();
  const { allPatients } = usePatients();
  useWorkspace();
  const { toast } = useToast();

  // Patient inline state
  const [rutInput, setRutInput] = useState("");
  const [foundPatient, setFoundPatient] = useState<Patient | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientBirthDate, setPatientBirthDate] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [isChileanRut, setIsChileanRut] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("otoscopy");
  const [initializing, setInitializing] = useState(true);

  // Dropdown state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Si vienen params de edición, cargar directo
  useEffect(() => {
    async function init() {
      try {
        if (patientIdParam && sessionIdParam) {
          await loadReport(patientIdParam, sessionIdParam);
        } else if (patientIdParam) {
          const patient = await invoke<Patient>("get_patient", { id: patientIdParam });
          selectPatient(patient);
        }
      } catch (err) {
        console.error("Error initializing report:", err);
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

  // Filtrar pacientes por lo que se va escribiendo
  const searchTerm = rutInput.trim().toLowerCase();
  const suggestions =
    searchTerm.length >= 2
      ? allPatients.filter((p) => {
          const pRut = p.rut.toLowerCase();
          const pRutClean = cleanRut(p.rut).toLowerCase();
          return pRut.includes(searchTerm) || pRutClean.includes(searchTerm.replace(/[^0-9kK]/gi, ""));
        })
      : [];

  function handleRutChange(value: string) {
    setRutInput(value);
    setIsChileanRut(validateRut(cleanRut(value)));
    setShowSuggestions(true);

    // Si ya tenían un paciente seleccionado y cambiaron el ID, desvincularlo
    if (foundPatient && foundPatient.rut !== value.trim() && cleanRut(foundPatient.rut) !== cleanRut(value)) {
      setFoundPatient(null);
      setPatientName("");
      setPatientBirthDate("");
      setPatientPhone("");
      setPatientEmail("");
    }
  }

  async function handleStartReport() {
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
    await createSession(patient, reportType);
    toast(foundPatient ? t("report.reportStarted") : t("report.patientCreatedAndReportStarted"), "success");
  }

  // Loading para edición de informe existente
  if (initializing && (patientIdParam || sessionIdParam)) {
    return (
      <>
        <Header title={t("report.new")} />
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      </>
    );
  }

  // Ya hay informe cargado → mostrar formulario
  if (report) {
    const isReadOnly = report.status === "completed";
    const typeLabel = report.report_type === "ear_wash" ? t("report.earWash.types.ear_wash") : t("report.earWash.types.otoscopy");
    return (
      <>
        <Header title={isReadOnly ? `${typeLabel} (${t("report.readOnly")})` : typeLabel} />
        <div className="flex-1 overflow-auto p-6">
          <ReportForm
            report={report}
            onChange={updateReport}
            flushSave={flushSave}
            readOnly={isReadOnly}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={t("report.new")} />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-lg space-y-6">
          <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
            <h3 className="mb-4 text-lg font-semibold text-text-primary">
              {t("pdf.labels.patientData")}
            </h3>

            <div className="space-y-4">
              {/* RUT con dropdown de sugerencias */}
              <div className="relative" ref={wrapperRef}>
                <Input
                  label={t("patients.rut")}
                  id="rut"
                  value={isChileanRut ? formatRut(rutInput) : rutInput}
                  onChange={(e) => handleRutChange(e.target.value)}
                  onFocus={() => searchTerm.length >= 2 && setShowSuggestions(true)}
                  placeholder="12.345.678-5"
                  autoComplete="off"
                />

                {/* Dropdown sugerencias */}
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
                            <p className="font-medium text-text-primary">
                              {p.name}
                            </p>
                            <p className="text-xs text-text-tertiary">{p.rut}</p>
                          </div>
                          {p.age > 0 && (
                            <span className="text-xs text-text-tertiary">
                              {p.age} {t("patients.ageYears")}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {foundPatient && (
                <div className="flex items-center gap-2 rounded-lg bg-success-subtle px-3 py-2 text-sm text-success-text">
                  <CheckCircle size={16} />
                  {t("report.patientExisting")}
                </div>
              )}

              <Input
                label={t("patients.form.nameLabel")}
                id="name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Juan Pérez González"
              />

              <Input
                label={t("patients.birthDate")}
                id="birth_date"
                type="date"
                value={patientBirthDate}
                onChange={(e) => setPatientBirthDate(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t("patients.phone")}
                  id="phone"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                />
                <Input
                  label={t("patients.email")}
                  id="email"
                  type="email"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  placeholder="paciente@email.com"
                />
              </div>
            </div>
          </div>

          {/* Tipo de informe */}
          <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
            <h3 className="mb-4 text-lg font-semibold text-text-primary">
              {t("report.reportType")}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReportType("otoscopy")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                  reportType === "otoscopy"
                    ? "border-accent bg-accent-subtle text-accent-text"
                    : "border-border-secondary bg-bg-tertiary text-text-secondary hover:border-border-primary"
                }`}
              >
                <Stethoscope size={24} />
                <span className="text-sm font-medium">{t("report.earWash.types.otoscopy")}</span>
              </button>
              <button
                type="button"
                onClick={() => setReportType("ear_wash")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                  reportType === "ear_wash"
                    ? "border-accent bg-accent-subtle text-accent-text"
                    : "border-border-secondary bg-bg-tertiary text-text-secondary hover:border-border-primary"
                }`}
              >
                <Droplets size={24} />
                <span className="text-sm font-medium">{t("report.earWash.types.ear_wash")}</span>
              </button>
            </div>
          </div>

          <Button
            onClick={handleStartReport}
            disabled={!rutInput.trim() || !patientName.trim()}
            className="w-full py-3"
          >
            {t("report.startReport")}
          </Button>
        </div>
      </div>
    </>
  );
}
