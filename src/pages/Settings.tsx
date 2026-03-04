import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useWorkspace } from "@/hooks/useWorkspace";
import { FolderOpen, Save, ImageIcon, X, ZoomIn, ChevronUp, ChevronDown, GripVertical, RotateCcw } from "lucide-react";
import type { WorkspaceConfig } from "@/types";

type ShowField = "show_header" | "show_logo" | "show_patient_info" | "show_exam_info" | "show_diagram" | "show_annotations" | "show_findings" | "show_observations" | "show_images" | "show_conclusion" | "show_footer";

const REPORT_SECTIONS: { key: string; label: string; field: ShowField }[] = [
  { key: "header", label: "Encabezado", field: "show_header" },
  { key: "logo", label: "Logo del centro", field: "show_logo" },
  { key: "patient_info", label: "Datos del paciente", field: "show_patient_info" },
  { key: "exam_info", label: "Datos del examen", field: "show_exam_info" },
  { key: "diagram", label: "Diagrama timpánico", field: "show_diagram" },
  { key: "findings", label: "Hallazgos", field: "show_findings" },
  { key: "observations", label: "Observaciones", field: "show_observations" },
  { key: "images", label: "Imágenes", field: "show_images" },
  { key: "annotations", label: "Anotaciones en imágenes", field: "show_annotations" },
  { key: "conclusion", label: "Conclusión", field: "show_conclusion" },
  { key: "footer", label: "Pie de página", field: "show_footer" },
];

const DEFAULT_SECTION_ORDER = REPORT_SECTIONS.map((s) => s.key);

const defaultConfig: WorkspaceConfig = {
  workspace_path: "",
  center_name: "",
  center_address: "",
  center_phone: "",
  center_email: "",
  logo_path: "",
  examiner: "",
  equipment: "",
  report_title: "Informe de Otoscopía",
  show_header: true,
  show_logo: true,
  show_patient_info: true,
  show_exam_info: true,
  show_diagram: true,
  show_annotations: true,
  show_findings: true,
  show_observations: true,
  show_images: true,
  show_conclusion: true,
  show_footer: true,
  image_size: "medium",
  images_per_row: 3,
  theme_color: "blue",
  section_order: DEFAULT_SECTION_ORDER,
};

const THEMES: Record<string, { primary: string; dark: string; label: string }> = {
  blue: { primary: "#2563eb", dark: "#1e3a5f", label: "Azul" },
  green: { primary: "#059669", dark: "#064e3b", label: "Verde" },
  teal: { primary: "#0d9488", dark: "#134e4a", label: "Teal" },
  purple: { primary: "#7c3aed", dark: "#4c1d95", label: "Morado" },
  rose: { primary: "#e11d48", dark: "#881337", label: "Rosa" },
  gray: { primary: "#6b7280", dark: "#1f2937", label: "Gris" },
};

function getSectionOrder(order: string[] | undefined): string[] {
  if (!order || order.length === 0) return DEFAULT_SECTION_ORDER;
  // Ensure all sections are present
  const missing = DEFAULT_SECTION_ORDER.filter((s) => !order.includes(s));
  return [...order.filter((s) => DEFAULT_SECTION_ORDER.includes(s)), ...missing];
}

const MOCK_FINDINGS_OD = [
  { key: "normal", label: "Normal" },
  { key: "cerumen", label: "Cerumen" },
];
const MOCK_FINDINGS_OI = [
  { key: "normal", label: "Normal" },
  { key: "inflammation", label: "Inflamación" },
];

const EAR_CONTENT_KEYS = new Set(["diagram", "findings", "observations", "images", "annotations"]);

function EarMockup({
  label,
  side,
  findings,
  observation,
  form,
  contentOrder,
}: {
  label: string;
  side: "OD" | "OI";
  findings: { key: string; label: string }[];
  observation: string;
  form: WorkspaceConfig;
  contentOrder: string[];
}) {
  const earColor = side === "OD" ? "#dc2626" : "#2563eb";
  const primaryW = form.image_size === "small" ? 28 : form.image_size === "large" ? 44 : 36;
  const primaryH = Math.round(primaryW * 0.75);
  const secW = form.image_size === "small" ? 12 : form.image_size === "large" ? 22 : 16;
  const secH = Math.round(secW * 0.75);

  return (
    <div className="flex-1 min-w-0">
      <div className="mb-1 font-bold" style={{ color: earColor }}>{label}</div>
      {contentOrder.map((key) => {
        switch (key) {
          case "diagram":
            return form.show_diagram ? (
              <div key={key} className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-400" style={{ fontSize: "5px" }}>
                {side}
              </div>
            ) : null;
          case "findings":
            return form.show_findings ? (
              <div key={key} className="space-y-px text-gray-500">
                {findings.map((f) => (
                  <div key={f.key}>• {f.label}</div>
                ))}
              </div>
            ) : null;
          case "observations":
            return form.show_observations ? (
              <div key={key} className="mt-0.5 text-gray-400">Obs: {observation}</div>
            ) : null;
          case "images":
            return form.show_images ? (
              <div key={key} className="mt-1">
                <div className="mb-1 rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-300" style={{
                  width: primaryW,
                  height: primaryH,
                }}>
                  <ImageIcon size={Math.max(8, primaryW * 0.3)} />
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {Array.from({ length: Math.min(form.images_per_row, 3) }).map((_, i) => (
                    <div key={i} className="rounded bg-gray-100 border border-gray-200" style={{
                      width: secW,
                      height: secH,
                    }} />
                  ))}
                </div>
              </div>
            ) : null;
          default:
            return null;
        }
      })}
    </div>
  );
}

function PdfMockupContent({ form, logoPreview, scale = 1 }: { form: WorkspaceConfig; logoPreview: string | null; scale?: number }) {
  const theme = THEMES[form.theme_color] || THEMES.blue;

  const order = getSectionOrder(form.section_order);
  const earContentOrder = order.filter((k) => EAR_CONTENT_KEYS.has(k));
  const hasEarContent = earContentOrder.some((k) => {
    const sec = REPORT_SECTIONS.find((s) => s.key === k);
    return sec && form[sec.field] as boolean;
  });

  const mainSections: string[] = [];
  let earAdded = false;
  for (const key of order) {
    if (EAR_CONTENT_KEYS.has(key)) {
      if (!earAdded) { mainSections.push("__ear__"); earAdded = true; }
    } else if (key !== "logo") {
      mainSections.push(key);
    }
  }

  return (
    <div className="flex h-full flex-col text-[7px] leading-tight" style={{ padding: `${16 * scale}px` }}>
      {/* Secciones en orden configurable */}
      {mainSections.map((sectionKey) => {
        switch (sectionKey) {
          case "header":
            return form.show_header ? (
              <div
                key={sectionKey}
                className="flex items-center pb-2"
                style={{ borderBottom: `2px solid ${theme.primary}`, marginBottom: `${8 * scale}px`, gap: `${8 * scale}px` }}
              >
                {form.show_logo && (logoPreview ? (
                  <img src={logoPreview} alt="" className="rounded object-contain" style={{ height: 28 * scale, width: 28 * scale }} />
                ) : (
                  <div className="flex items-center justify-center rounded bg-gray-100 text-gray-300" style={{ height: 28 * scale, width: 28 * scale }}>
                    <ImageIcon size={10 * scale} />
                  </div>
                ))}
                <div className="flex-1 min-w-0">
                  <div className="truncate font-bold" style={{ color: theme.dark, fontSize: `${10 * scale}px` }}>
                    {form.report_title || "Informe de Otoscopía"}
                  </div>
                  {form.center_name && (
                    <div className="truncate font-semibold text-gray-600" style={{ fontSize: `${6 * scale}px` }}>
                      {form.center_name}
                    </div>
                  )}
                  {form.center_address && (
                    <div className="truncate text-gray-400" style={{ fontSize: `${5 * scale}px` }}>{form.center_address}</div>
                  )}
                  {(form.center_phone || form.center_email) && (
                    <div className="truncate text-gray-400" style={{ fontSize: `${5 * scale}px` }}>
                      {[form.center_phone, form.center_email].filter(Boolean).join(" • ")}
                    </div>
                  )}
                  <div className="text-gray-400" style={{ fontSize: `${5 * scale}px` }}>OtoReport — 04/03/2026</div>
                </div>
              </div>
            ) : null;
          case "patient_info":
            return form.show_patient_info ? (
              <div key={sectionKey} style={{ marginBottom: `${8 * scale}px` }}>
                <div className="border-b border-gray-200 pb-0.5 font-bold" style={{ color: theme.dark, marginBottom: `${4 * scale}px` }}>
                  Datos del Paciente
                </div>
                <div className="space-y-px text-gray-500">
                  <div><span className="font-semibold text-gray-600">Nombre:</span> Juan Pérez</div>
                  <div><span className="font-semibold text-gray-600">RUT:</span> 12.345.678-9</div>
                  <div><span className="font-semibold text-gray-600">Edad:</span> 45 años</div>
                </div>
              </div>
            ) : null;
          case "exam_info":
            return form.show_exam_info ? (
              <div key={sectionKey} style={{ marginBottom: `${8 * scale}px` }}>
                <div className="border-b border-gray-200 pb-0.5 font-bold" style={{ color: theme.dark, marginBottom: `${4 * scale}px` }}>
                  Datos del Examen
                </div>
                <div className="space-y-px text-gray-500">
                  <div><span className="font-semibold text-gray-600">Examinador:</span> {form.examiner || "Dr. Ejemplo"}</div>
                  <div><span className="font-semibold text-gray-600">Equipo:</span> {form.equipment || "Otoscopio"}</div>
                </div>
              </div>
            ) : null;
          case "__ear__":
            return hasEarContent ? (
              <div key={sectionKey} className="flex-1" style={{ marginBottom: `${8 * scale}px` }}>
                <div className="flex" style={{ gap: `${8 * scale}px` }}>
                  <EarMockup label="Oído Derecho (OD)" side="OD" findings={MOCK_FINDINGS_OD} observation="Sin novedades" form={form} contentOrder={earContentOrder} />
                  <EarMockup label="Oído Izquierdo (OI)" side="OI" findings={MOCK_FINDINGS_OI} observation="Leve inflamación" form={form} contentOrder={earContentOrder} />
                </div>
              </div>
            ) : null;
          case "conclusion":
            return form.show_conclusion ? (
              <div key={sectionKey} style={{ marginBottom: `${8 * scale}px` }}>
                <div className="border-b border-gray-200 pb-0.5 font-bold" style={{ color: theme.dark, marginBottom: `${4 * scale}px` }}>
                  Conclusión
                </div>
                <div className="rounded bg-gray-50 p-1" style={{ borderLeft: `2px solid ${theme.primary}` }}>
                  <span className="text-gray-500">Paciente con hallazgos dentro de lo normal...</span>
                </div>
              </div>
            ) : null;
          case "footer":
            return form.show_footer ? (
              <div key={sectionKey} className="mt-auto flex justify-between text-gray-300" style={{ fontSize: `${5 * scale}px` }}>
                <span>OtoReport v1.0.0</span>
                <span>Página 1 de 1</span>
              </div>
            ) : null;
          default:
            return null;
        }
      })}
    </div>
  );
}

function PdfMockup({ form, logoPreview }: { form: WorkspaceConfig; logoPreview: string | null }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="group relative w-full cursor-pointer rounded-lg border border-gray-300 bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{ aspectRatio: "210 / 297" }}
      >
        <PdfMockupContent form={form} logoPreview={logoPreview} />
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 opacity-0 transition-all group-hover:bg-black/5 group-hover:opacity-100">
          <div className="rounded-full bg-white/90 p-2 shadow-md">
            <ZoomIn size={16} className="text-gray-600" />
          </div>
        </div>
      </button>

      {/* Modal de vista previa ampliada */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-8"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative max-h-full w-full overflow-auto rounded-xl bg-white shadow-2xl"
            style={{ maxWidth: 520, aspectRatio: "210 / 297" }}
            onClick={(e) => e.stopPropagation()}
          >
            <PdfMockupContent form={form} logoPreview={logoPreview} scale={2} />
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute right-3 top-3 rounded-full bg-gray-100 p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function Settings() {
  const { config, workspacePath, selectWorkspace, updateConfig } =
    useWorkspace();
  const [form, setForm] = useState<WorkspaceConfig>(defaultConfig);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setForm({ ...defaultConfig, ...config });
    }
  }, [config]);

  useEffect(() => {
    if (form.logo_path) {
      loadLogoPreview(form.logo_path);
    } else {
      setLogoPreview(null);
    }
  }, [form.logo_path]);

  async function loadLogoPreview(path: string) {
    try {
      const bytes: number[] = await invoke("load_logo", { path });
      const blob = new Blob([new Uint8Array(bytes)]);
      setLogoPreview(URL.createObjectURL(blob));
    } catch {
      setLogoPreview(null);
    }
  }

  async function handleSelectLogo() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg"] }],
    });
    if (selected) {
      setForm((f) => ({ ...f, logo_path: selected as string }));
    }
  }

  function handleRemoveLogo() {
    setForm((f) => ({ ...f, logo_path: "" }));
    setLogoPreview(null);
  }

  async function handleSave() {
    await updateConfig(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updateField(field: keyof WorkspaceConfig, value: string | boolean | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
    <>
      <Header title="Configuración" />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto flex max-w-5xl gap-6">
          {/* Columna izquierda: Formulario */}
          <div className="flex-1 space-y-6">
            {/* Sección 1: Carpeta de Trabajo */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-800">
                Carpeta de Trabajo
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {workspacePath || "No configurado"}
                </div>
                <Button variant="secondary" onClick={selectWorkspace}>
                  <FolderOpen size={16} />
                  Cambiar
                </Button>
              </div>
            </div>

            {/* Sección 2: Centro de Salud y Examinador */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-800">
                Centro de Salud y Examinador
              </h3>
              <div className="space-y-4">
                <Input
                  label="Nombre del centro"
                  id="center_name"
                  value={form.center_name}
                  onChange={(e) => updateField("center_name", e.target.value)}
                  placeholder="Centro Auditivo San Carlos"
                />
                <Input
                  label="Dirección"
                  id="center_address"
                  value={form.center_address}
                  onChange={(e) => updateField("center_address", e.target.value)}
                  placeholder="Av. Libertador 1234, Santiago"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Teléfono"
                    id="center_phone"
                    value={form.center_phone}
                    onChange={(e) => updateField("center_phone", e.target.value)}
                    placeholder="+56 9 1234 5678"
                  />
                  <Input
                    label="Email"
                    id="center_email"
                    value={form.center_email}
                    onChange={(e) => updateField("center_email", e.target.value)}
                    placeholder="contacto@centro.cl"
                  />
                </div>

                {/* Logo */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Logo del centro
                  </label>
                  <div className="flex items-center gap-3">
                    {logoPreview ? (
                      <div className="relative">
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="h-16 w-16 rounded-lg border border-gray-200 object-contain"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400">
                        <ImageIcon size={24} />
                      </div>
                    )}
                    <Button variant="secondary" size="sm" onClick={handleSelectLogo}>
                      <ImageIcon size={14} />
                      {form.logo_path ? "Cambiar logo" : "Seleccionar logo"}
                    </Button>
                  </div>
                </div>

                <hr className="border-gray-200" />

                <Input
                  label="Nombre del examinador"
                  id="examiner"
                  value={form.examiner}
                  onChange={(e) => updateField("examiner", e.target.value)}
                  placeholder="Dr. Juan Pérez"
                />
                <Input
                  label="Equipo utilizado"
                  id="equipment"
                  value={form.equipment}
                  onChange={(e) => updateField("equipment", e.target.value)}
                  placeholder="Otoscopio digital Firefly DE550"
                />
              </div>
            </div>

            {/* Sección 3: Preferencias del Informe */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-800">
                Preferencias del Informe
              </h3>
              <div className="space-y-4">
                <Input
                  label="Título del informe"
                  id="report_title"
                  value={form.report_title}
                  onChange={(e) => updateField("report_title", e.target.value)}
                  placeholder="Informe de Otoscopía"
                />

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Secciones del informe
                    </label>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({
                        ...f,
                        section_order: DEFAULT_SECTION_ORDER,
                        show_header: true,
                        show_logo: true,
                        show_patient_info: true,
                        show_exam_info: true,
                        show_diagram: true,
                        show_findings: true,
                        show_observations: true,
                        show_images: true,
                        show_annotations: true,
                        show_conclusion: true,
                        show_footer: true,
                      }))}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <RotateCcw size={12} />
                      Restablecer
                    </button>
                  </div>
                  <div className="space-y-1">
                    {getSectionOrder(form.section_order).map((key, index, arr) => {
                      const section = REPORT_SECTIONS.find((s) => s.key === key);
                      if (!section) return null;
                      const enabled = form[section.field] as boolean;
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                        >
                          <GripVertical size={14} className="shrink-0 text-gray-400" />
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => updateField(section.field, e.target.checked)}
                            className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className={`flex-1 text-sm ${enabled ? "text-gray-700" : "text-gray-400"}`}>
                            {section.label}
                          </span>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => {
                              const order = [...arr];
                              [order[index - 1], order[index]] = [order[index], order[index - 1]];
                              setForm((f) => ({ ...f, section_order: order }));
                            }}
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={index === arr.length - 1}
                            onClick={() => {
                              const order = [...arr];
                              [order[index], order[index + 1]] = [order[index + 1], order[index]];
                              setForm((f) => ({ ...f, section_order: order }));
                            }}
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                          >
                            <ChevronDown size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Tamaño de imágenes"
                    id="image_size"
                    value={form.image_size}
                    onChange={(e) => updateField("image_size", e.target.value)}
                    options={[
                      { value: "small", label: "Pequeño" },
                      { value: "medium", label: "Mediano" },
                      { value: "large", label: "Grande" },
                    ]}
                  />
                  <Select
                    label="Imágenes por fila"
                    id="images_per_row"
                    value={String(form.images_per_row)}
                    onChange={(e) => updateField("images_per_row", Number(e.target.value))}
                    options={[
                      { value: "2", label: "2" },
                      { value: "3", label: "3" },
                      { value: "4", label: "4" },
                    ]}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Color del informe
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(THEMES).map(([value, t]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateField("theme_color", value)}
                        className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm transition-colors ${
                          form.theme_color === value
                            ? "border-gray-800 bg-gray-50 font-medium"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <span
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: t.primary }}
                        />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave}>
                <Save size={16} />
                {saved ? "Guardado" : "Guardar Configuración"}
              </Button>
            </div>
          </div>

          {/* Columna derecha: Vista previa */}
          <div className="w-64 shrink-0">
            <div className="sticky top-6 space-y-2">
              <h3 className="text-sm font-medium text-gray-500">Vista previa</h3>
              <PdfMockup form={form} logoPreview={logoPreview} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
