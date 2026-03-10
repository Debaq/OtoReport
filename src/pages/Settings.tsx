import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { isAndroid } from "@/lib/platform";
import { FolderOpen, Save, ImageIcon, X, ZoomIn, ChevronUp, ChevronDown, GripVertical, RotateCcw, Settings2, FileText, Stethoscope, Sun, Moon, Palette, Plus, Trash2, Search, Users, LogOut, Sparkles, Wine, Info, ExternalLink, Github, BookOpen, Loader2, WifiOff, Camera, ShoppingCart, RefreshCw, ImageOff, MessageCircle, Heart, Coffee, MapPin, FlaskConical } from "lucide-react";
import { useBetaFeatures } from "@/hooks/useBetaFeatures";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useUpdateChecker, APP_VERSION } from "@/hooks/useUpdateChecker";
import type { WorkspaceConfig, FindingsCategoryConfig, FindingCheckConfig, UserProfile } from "@/types";
import { PROFILE_COLORS } from "@/types/report";
import { SpriteAvatar, AvatarPicker } from "@/components/ui/SpriteAvatar";
import { SpriteEditor } from "@/components/settings/SpriteEditor";
import { getDefaultFindingsCategories, translateFindingsCategories } from "@/types";
import i18n from "@/i18n/config";
import { FindingsSearchModal } from "@/components/settings/FindingsSearchModal";
import type { LibraryFinding } from "@/lib/findings-library";

type ShowField = "show_header" | "show_logo" | "show_patient_info" | "show_exam_info" | "show_diagram" | "show_annotations" | "show_findings" | "show_observations" | "show_images" | "show_conclusion" | "show_footer";

const REPORT_SECTIONS: { key: string; labelKey: string; field: ShowField; subField?: { key: string; labelKey: string; field: ShowField } }[] = [
  { key: "header", labelKey: "pdf.sections.header", field: "show_header", subField: { key: "logo", labelKey: "pdf.sections.logo", field: "show_logo" } },
  { key: "patient_info", labelKey: "pdf.sections.patient_info", field: "show_patient_info" },
  { key: "exam_info", labelKey: "pdf.sections.exam_info", field: "show_exam_info" },
  { key: "diagram", labelKey: "pdf.sections.diagram", field: "show_diagram" },
  { key: "findings", labelKey: "pdf.sections.findings", field: "show_findings" },
  { key: "observations", labelKey: "pdf.sections.observations", field: "show_observations" },
  { key: "images", labelKey: "pdf.sections.images", field: "show_images" },
  { key: "annotations", labelKey: "pdf.sections.annotations", field: "show_annotations" },
  { key: "conclusion", labelKey: "pdf.sections.conclusion", field: "show_conclusion" },
  { key: "footer", labelKey: "pdf.sections.footer", field: "show_footer" },
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
  ear_wash_report_title: "Informe de Lavado de Oído",
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
  app_theme: "dracula",
  id_type: "rut_id_dni",
};

const THEMES: Record<string, { primary: string; dark: string; label: string }> = {
  blue: { primary: "#2563eb", dark: "#1e3a5f", label: "Azul" },
  green: { primary: "#059669", dark: "#064e3b", label: "Verde" },
  teal: { primary: "#0d9488", dark: "#134e4a", label: "Teal" },
  purple: { primary: "#7c3aed", dark: "#4c1d95", label: "Morado" },
  rose: { primary: "#e11d48", dark: "#881337", label: "Rosa" },
  gray: { primary: "#6b7280", dark: "#1f2937", label: "Gris" },
};

const APP_THEMES: { id: Theme; labelKey: string; icon: typeof Sun; colors: { bg: string; sidebar: string; accent: string; text: string } }[] = [
  { id: "dracula", labelKey: "settings.appearance.themes.dracula", icon: Palette, colors: { bg: "#282a36", sidebar: "#343746", accent: "#bd93f9", text: "#f8f8f2" } },
  { id: "alucard", labelKey: "settings.appearance.themes.alucard", icon: Sparkles, colors: { bg: "#f8f8f2", sidebar: "#ffffff", accent: "#7c3aed", text: "#282a36" } },
  { id: "light", labelKey: "settings.appearance.themes.light", icon: Sun, colors: { bg: "#f9fafb", sidebar: "#ffffff", accent: "#2563eb", text: "#1f2937" } },
  { id: "dark", labelKey: "settings.appearance.themes.dark", icon: Moon, colors: { bg: "#111827", sidebar: "#1f2937", accent: "#3b82f6", text: "#f9fafb" } },
  { id: "wine", labelKey: "settings.appearance.themes.wine", icon: Wine, colors: { bg: "#1a0a10", sidebar: "#2a1520", accent: "#c2185b", text: "#f5e6ec" } },
  { id: "wine-light", labelKey: "settings.appearance.themes.wine-light", icon: Wine, colors: { bg: "#fdf2f4", sidebar: "#ffffff", accent: "#a01348", text: "#3b0a1a" } },
];

const EQUIPMENT_URL = "https://raw.githubusercontent.com/TecMedHub/Otoreports_findings/main/json/equipment.json";

interface Equipment {
  name: string;
  comments: { es: string; en: string };
  image?: string;
  price?: string;
  link?: string;
}

function EquipmentCard({ item, lang }: { item: Equipment; lang: string }) {
  const { t } = useTranslation();
  const [imgStatus, setImgStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [lightbox, setLightbox] = useState(false);
  const comment = lang.startsWith("es") ? item.comments.es : item.comments.en;

  return (
    <>
      <div className="flex gap-4 rounded-lg border border-border-secondary bg-bg-primary p-4">
        <button
          className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-bg-tertiary focus:outline-none"
          onClick={() => item.image && imgStatus === "loaded" && setLightbox(true)}
          title={imgStatus === "loaded" ? t("settings.contribute.equipmentViewImage") : undefined}
        >
          {item.image ? (
            <>
              {imgStatus === "loading" && (
                <div className="flex h-full w-full items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-text-tertiary" />
                </div>
              )}
              <img
                src={item.image}
                alt={item.name}
                className={`h-full w-full object-cover transition-opacity ${imgStatus === "loaded" ? "hover:opacity-80" : "invisible absolute"}`}
                onLoad={() => setImgStatus("loaded")}
                onError={() => setImgStatus("error")}
              />
              {imgStatus === "error" && (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageOff size={20} className="text-text-tertiary" />
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Camera size={24} className="text-text-tertiary" />
            </div>
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <h4 className="text-sm font-semibold text-text-primary">{item.name}</h4>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">{comment}</p>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {item.price && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-500">
                <ShoppingCart size={10} />
                {item.price}
              </span>
            )}
            {item.link && (
              <button
                onClick={() => openUrl(item.link!)}
                className="inline-flex items-center gap-1 text-xs text-sky-500 hover:underline"
              >
                <ShoppingCart size={10} />
                {t("settings.contribute.equipmentBuy")}
                <ExternalLink size={10} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && item.image && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={item.image}
              alt={item.name}
              className="max-h-[80vh] max-w-[80vw] rounded-xl object-contain shadow-2xl"
            />
            <div className="mt-3 text-center text-sm font-medium text-white">{item.name}</div>
            <button
              onClick={() => setLightbox(false)}
              className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function getSectionOrder(order: string[] | undefined): string[] {
  if (!order || order.length === 0) return DEFAULT_SECTION_ORDER;
  // Filter out "logo" from old saved orders since it's now part of header
  const cleaned = order.filter((s) => s !== "logo");
  const missing = DEFAULT_SECTION_ORDER.filter((s) => !cleaned.includes(s));
  return [...cleaned.filter((s) => DEFAULT_SECTION_ORDER.includes(s)), ...missing];
}

function getMockFindings(side: "OD" | "OI") {
  const tf = (key: string) => i18n.t(key, { ns: 'findings' });
  if (side === "OD") return [
    { key: "normal", label: tf("findings.normal.label") },
    { key: "cerumen", label: tf("findings.cae_cerumen.label") },
  ];
  return [
    { key: "normal", label: tf("findings.normal.label") },
    { key: "inflammation", label: tf("findings.inflammation.label") },
  ];
}

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
  const { t } = useTranslation();
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
              <div key={key} className="mt-0.5 text-gray-400">{t("pdf.labels.observations")}: {observation}</div>
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
  const { t } = useTranslation();
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
                    {form.report_title || t("dashboard.subtitle")}
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
                  {t("pdf.labels.patientData")}
                </div>
                <div className="space-y-px text-gray-500">
                  <div><span className="font-semibold text-gray-600">{t("patients.name")}:</span> Juan Pérez</div>
                  <div><span className="font-semibold text-gray-600">{t(`patients.idLabel.${form.id_type || "rut_id_dni"}`)}:</span> 12.345.678-9</div>
                  <div><span className="font-semibold text-gray-600">{t("patients.age")}:</span> 45 {t("patients.ageYears")}</div>
                </div>
              </div>
            ) : null;
          case "exam_info":
            return form.show_exam_info ? (
              <div key={sectionKey} style={{ marginBottom: `${8 * scale}px` }}>
                <div className="border-b border-gray-200 pb-0.5 font-bold" style={{ color: theme.dark, marginBottom: `${4 * scale}px` }}>
                  {t("pdf.labels.examData")}
                </div>
                <div className="space-y-px text-gray-500">
                  <div><span className="font-semibold text-gray-600">{t("pdf.labels.examiner")}:</span> {form.examiner || "Dr. Ejemplo"}</div>
                  <div><span className="font-semibold text-gray-600">{t("pdf.labels.equipment")}:</span> {form.equipment || "Otoscopio"}</div>
                </div>
              </div>
            ) : null;
          case "__ear__":
            return hasEarContent ? (
              <div key={sectionKey} className="flex-1" style={{ marginBottom: `${8 * scale}px` }}>
                <div className="flex" style={{ gap: `${8 * scale}px` }}>
                  <EarMockup label={t("pdf.labels.rightEar")} side="OD" findings={getMockFindings("OD")} observation={t("pdf.mock.observationOD")} form={form} contentOrder={earContentOrder} />
                  <EarMockup label={t("pdf.labels.leftEar")} side="OI" findings={getMockFindings("OI")} observation={t("pdf.mock.observationOI")} form={form} contentOrder={earContentOrder} />
                </div>
              </div>
            ) : null;
          case "conclusion":
            return form.show_conclusion ? (
              <div key={sectionKey} style={{ marginBottom: `${8 * scale}px` }}>
                <div className="border-b border-gray-200 pb-0.5 font-bold" style={{ color: theme.dark, marginBottom: `${4 * scale}px` }}>
                  {t("pdf.labels.conclusion")}
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
                <span>{t("pdf.labels.page", { current: 1, total: 1 })}</span>
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

type TabId = "general" | "informe" | "hallazgos" | "perfiles" | "acerca" | "contribuir";

const TABS: { id: TabId; labelKey: string; icon: typeof Settings2 }[] = [
  { id: "general", labelKey: "settings.tabs.general", icon: Settings2 },
  { id: "informe", labelKey: "settings.tabs.report", icon: FileText },
  { id: "hallazgos", labelKey: "settings.tabs.findings", icon: Stethoscope },
  { id: "perfiles", labelKey: "settings.tabs.profiles", icon: Users },
  { id: "acerca", labelKey: "settings.tabs.about", icon: Info },
  { id: "contribuir", labelKey: "settings.tabs.contribute", icon: Heart },
];

function FindingsConfigTab({
  categories,
  onChange,
}: {
  categories: FindingsCategoryConfig[];
  onChange: (categories: FindingsCategoryConfig[]) => void;
}) {
  const { t } = useTranslation();
  const [searchModal, setSearchModal] = useState<{ catIndex: number } | null>(null);

  // All active keys across all categories
  const allActiveKeys = new Set(categories.flatMap((cat) => cat.checks.map((c) => c.key)));

  function updateCategoryName(catIndex: number, name: string) {
    const updated = categories.map((cat, i) =>
      i === catIndex ? { ...cat, name } : cat
    );
    onChange(updated);
  }

  function updateCheckField(catIndex: number, checkIndex: number, field: keyof FindingCheckConfig, value: string) {
    const updated = categories.map((cat, ci) =>
      ci === catIndex
        ? {
            ...cat,
            checks: cat.checks.map((ch, chi) =>
              chi === checkIndex ? { ...ch, [field]: value } : ch
            ),
          }
        : cat
    );
    onChange(updated);
  }

  function removeCheck(catIndex: number, checkIndex: number) {
    const updated = categories.map((cat, ci) =>
      ci === catIndex
        ? { ...cat, checks: cat.checks.filter((_, chi) => chi !== checkIndex) }
        : cat
    );
    onChange(updated);
  }

  function removeCategory(catIndex: number) {
    onChange(categories.filter((_, i) => i !== catIndex));
  }

  function addCategory() {
    const id = `custom_${Date.now()}`;
    onChange([...categories, { id, name: t("settings.findings.newCategory"), checks: [] }]);
  }

  function addFindingFromLibrary(catIndex: number, finding: LibraryFinding) {
    const check: FindingCheckConfig = {
      key: finding.key,
      label: finding.label,
      enabled: true,
      description: finding.description,
    };
    const updated = categories.map((cat, ci) =>
      ci === catIndex ? { ...cat, checks: [...cat.checks, check] } : cat
    );
    onChange(updated);
  }

  function handleReset() {
    onChange(getDefaultFindingsCategories().map((cat) => ({
      ...cat,
      checks: cat.checks.map((ch) => ({ ...ch })),
    })));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">{t("settings.findings.title")}</h3>
          <p className="mt-1 text-sm text-text-tertiary">
            {t("settings.findings.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addCategory}
            className="flex items-center gap-1 rounded-lg border border-border-secondary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-tertiary"
          >
            <Plus size={12} />
            {t("settings.findings.addCategory")}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 rounded px-2 py-1.5 text-xs text-text-tertiary hover:bg-bg-tertiary hover:text-text-secondary"
          >
            <RotateCcw size={12} />
            {t("settings.findings.reset")}
          </button>
        </div>
      </div>

      {categories.map((cat, catIndex) => (
        <div key={cat.id} className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-text-tertiary">
                {t("settings.findings.categoryName")}
              </label>
              <input
                type="text"
                value={cat.name}
                onChange={(e) => updateCategoryName(catIndex, e.target.value)}
                className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm font-semibold text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <p className="mt-1 text-xs text-text-tertiary">
                {t("settings.findings.findingCount", { count: cat.checks.length })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeCategory(catIndex)}
              className="mt-5 rounded p-1.5 text-text-tertiary hover:bg-danger-subtle hover:text-danger-text"
              title={t("settings.findings.removeCategory")}
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="space-y-1">
            {cat.checks.map((check, checkIndex) => (
              <div
                key={check.key}
                className="group flex items-start gap-2 rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <input
                    type="text"
                    value={check.label}
                    onChange={(e) => updateCheckField(catIndex, checkIndex, "label", e.target.value)}
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-sm font-medium text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <input
                    type="text"
                    value={check.description || ""}
                    onChange={(e) => updateCheckField(catIndex, checkIndex, "description", e.target.value)}
                    placeholder={t("settings.findings.descriptionPlaceholder")}
                    className="w-full rounded border-0 bg-transparent px-1 py-0 text-xs text-text-tertiary placeholder-text-tertiary/50 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCheck(catIndex, checkIndex)}
                  className="mt-1 shrink-0 rounded p-1 text-text-tertiary opacity-0 transition-opacity hover:bg-danger-subtle hover:text-danger-text group-hover:opacity-100"
                  title={t("settings.findings.removeFinding")}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSearchModal({ catIndex })}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-secondary py-2.5 text-sm text-text-tertiary transition-colors hover:border-accent hover:text-accent-text"
          >
            <Search size={14} />
            {t("settings.findings.addFinding")}
          </button>
        </div>
      ))}

      {searchModal !== null && (
        <FindingsSearchModal
          excludeKeys={allActiveKeys}
          targetCategoryId={categories[searchModal.catIndex]?.id || "membrane"}
          onAdd={(finding) => addFindingFromLibrary(searchModal.catIndex, finding)}
          onClose={() => setSearchModal(null)}
        />
      )}
    </div>
  );
}

function SectionOrderList({
  sectionOrder,
  form,
  onReorder,
  onToggle,
}: {
  sectionOrder: string[];
  form: WorkspaceConfig;
  onReorder: (order: string[]) => void;
  onToggle: (field: ShowField, value: boolean) => void;
}) {
  const { t } = useTranslation();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const order = [...sectionOrder];
    const [moved] = order.splice(dragIndex, 1);
    order.splice(dropIndex, 0, moved);
    onReorder(order);
    setDragIndex(null);
    setOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <div className="space-y-1">
      {sectionOrder.map((key, index) => {
        const section = REPORT_SECTIONS.find((s) => s.key === key);
        if (!section) return null;
        const enabled = form[section.field] as boolean;
        const isDragging = dragIndex === index;
        const isOver = overIndex === index && dragIndex !== index;

        return (
          <div
            key={key}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
              isDragging
                ? "border-accent bg-accent-subtle opacity-50"
                : isOver
                  ? "border-accent bg-accent-subtle"
                  : "border-border-secondary bg-bg-tertiary"
            }`}
          >
            <GripVertical size={14} className="shrink-0 cursor-grab text-text-tertiary active:cursor-grabbing" />
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggle(section.field, e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-border-primary text-accent focus:ring-accent"
            />
            <span className={`flex-1 text-sm ${enabled ? "text-text-secondary" : "text-text-tertiary"}`}>
              {t(section.labelKey)}
            </span>
            {section.subField && enabled && (
              <label className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <input
                  type="checkbox"
                  checked={form[section.subField.field] as boolean}
                  onChange={(e) => onToggle(section.subField!.field, e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border-primary text-accent focus:ring-accent"
                />
                {t(section.subField.labelKey)}
              </label>
            )}
            <button
              type="button"
              disabled={index === 0}
              onClick={() => {
                const order = [...sectionOrder];
                [order[index - 1], order[index]] = [order[index], order[index - 1]];
                onReorder(order);
              }}
              className="rounded p-0.5 text-text-tertiary hover:bg-bg-inset hover:text-text-secondary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-tertiary"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              disabled={index === sectionOrder.length - 1}
              onClick={() => {
                const order = [...sectionOrder];
                [order[index], order[index + 1]] = [order[index + 1], order[index]];
                onReorder(order);
              }}
              className="rounded p-0.5 text-text-tertiary hover:bg-bg-inset hover:text-text-secondary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-tertiary"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Settings() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const { config, workspacePath, selectWorkspace, updateConfig, profiles, activeProfile, addProfile, updateProfile, removeProfile, clearProfileSelection } =
    useWorkspace();
  const { theme, setTheme } = useTheme();
  const { features: betaFeatures, toggle: toggleBeta } = useBetaFeatures();
  const [form, setForm] = useState<WorkspaceConfig>(defaultConfig);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [androidMode, setAndroidMode] = useState(false);
  const initialTab = (searchParams.get("tab") as TabId) || "general";
  const [activeTab, setActiveTab] = useState<TabId>(
    ["general", "informe", "hallazgos", "perfiles", "acerca", "contribuir"].includes(initialTab) ? initialTab : "general"
  );
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentStatus, setEquipmentStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const update = useUpdateChecker(false);

  const findingsCategories: FindingsCategoryConfig[] = translateFindingsCategories(
    form.findings_categories && form.findings_categories.length > 0
      ? form.findings_categories
      : getDefaultFindingsCategories().map((cat) => ({
          ...cat,
          checks: cat.checks.map((ch) => ({ ...ch })),
        }))
  );

  useEffect(() => {
    isAndroid().then(setAndroidMode);
  }, []);

  useEffect(() => {
    if (config) {
      setForm({ ...defaultConfig, ...config });
    }
  }, [config]);

  useEffect(() => {
    if (form.logo_path) {
      loadLogoPreview(form.logo_path);
    } else {
      // Fallback: mostrar logo por defecto
      setLogoPreview("/tecmedhub.jpeg");
    }
  }, [form.logo_path]);

  useEffect(() => {
    if (activeTab !== "contribuir" || equipmentStatus !== "idle") return;
    setEquipmentStatus("loading");
    fetch(EQUIPMENT_URL)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: unknown) => {
        let list: Equipment[];
        if (Array.isArray(data)) {
          list = data as Equipment[];
        } else if (data && typeof data === "object") {
          const obj = data as Record<string, unknown>;
          list = Array.isArray(obj.equipment) ? obj.equipment as Equipment[]
               : Array.isArray(obj.items) ? obj.items as Equipment[]
               : [data as Equipment];
        } else {
          list = [];
        }
        setEquipment(list);
        setEquipmentStatus("loaded");
      })
      .catch(() => setEquipmentStatus("error"));
  }, [activeTab, equipmentStatus]);

  async function loadLogoPreview(path: string) {
    try {
      const bytes: number[] = await invoke("load_logo", { path });
      const ext = path.split(".").pop()?.toLowerCase() || "png";
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
      const blob = new Blob([new Uint8Array(bytes)], { type: mime });
      setLogoPreview(URL.createObjectURL(blob));
    } catch {
      setLogoPreview(null);
    }
  }

  async function handleSelectLogo() {
    if (androidMode) {
      logoInputRef.current?.click();
      return;
    }
    const selected = await open({
      multiple: false,
      filters: [{ name: t("ear.imageFilterName"), extensions: ["png", "jpg", "jpeg"] }],
    });
    if (selected) {
      const path = selected as string;
      const bytes: number[] = await invoke("load_logo", { path });
      const ext = path.split(".").pop()?.toLowerCase() || "png";
      const savedPath = await invoke<string>("save_logo", { data: bytes, extension: ext });
      setForm((f) => ({ ...f, logo_path: savedPath }));
    }
  }

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const savedPath = await invoke<string>("save_logo", { data: bytes, extension: ext });
    setForm((f) => ({ ...f, logo_path: savedPath }));
    e.target.value = "";
  }


  async function handleSave() {
    await updateConfig(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updateField(field: keyof WorkspaceConfig, value: string | boolean | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleFindingsChange(categories: FindingsCategoryConfig[]) {
    setForm((f) => ({ ...f, findings_categories: categories }));
  }

  return (
    <>
      <Header title={t("settings.title")} />
      <div className="flex-1 overflow-auto">
        {/* Tabs */}
        <div className="border-b border-border-secondary bg-bg-secondary px-6">
          <nav className="mx-auto flex max-w-5xl gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-accent text-accent-text"
                      : "border-transparent text-text-tertiary hover:border-border-primary hover:text-text-secondary"
                  }`}
                >
                  <Icon size={16} />
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Tab: General */}
          {activeTab === "general" && (
            <div className="mx-auto max-w-3xl space-y-6">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleLogoFileChange}
              />

              {/* Apariencia */}
              <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
                <h3 className="mb-4 text-lg font-semibold text-text-primary">
                  {t("settings.appearance.title")}
                </h3>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {APP_THEMES.map((themeItem) => {
                    const Icon = themeItem.icon;
                    const isActive = (form.app_theme || theme) === themeItem.id;
                    return (
                      <button
                        key={themeItem.id}
                        type="button"
                        onClick={() => { setTheme(themeItem.id); setForm((f) => ({ ...f, app_theme: themeItem.id })); }}
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors ${
                          isActive
                            ? "border-accent bg-accent-subtle"
                            : "border-border-secondary hover:border-border-primary"
                        }`}
                      >
                        {/* Mini preview */}
                        <div
                          className="flex w-full overflow-hidden rounded-lg border"
                          style={{ borderColor: themeItem.colors.bg, height: 48 }}
                        >
                          <div style={{ backgroundColor: themeItem.colors.sidebar, width: "30%" }} className="flex items-center justify-center">
                            <div className="h-1.5 w-4 rounded-full" style={{ backgroundColor: themeItem.colors.accent }} />
                          </div>
                          <div style={{ backgroundColor: themeItem.colors.bg, width: "70%" }} className="flex flex-col justify-center gap-1 px-2">
                            <div className="h-1 w-8 rounded-full" style={{ backgroundColor: themeItem.colors.text, opacity: 0.7 }} />
                            <div className="h-1 w-5 rounded-full" style={{ backgroundColor: themeItem.colors.text, opacity: 0.3 }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Icon size={14} className={isActive ? "text-accent-text" : "text-text-tertiary"} />
                          <span className={`text-sm font-medium ${isActive ? "text-accent-text" : "text-text-secondary"}`}>
                            {t(themeItem.labelKey)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tipo de identificación */}
              <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
                <h3 className="mb-1 text-lg font-semibold text-text-primary">
                  {t("settings.idType.title")}
                </h3>
                <p className="mb-4 text-sm text-text-tertiary">{t("settings.idType.description")}</p>
                <div className="grid grid-cols-4 gap-3">
                  {(["rut_id_dni", "rut", "id", "dni"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateField("id_type", type)}
                      className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                        (form.id_type || "rut_id_dni") === type
                          ? "border-accent bg-accent-subtle text-accent-text"
                          : "border-border-secondary text-text-secondary hover:border-border-primary"
                      }`}
                    >
                      {t(`settings.idType.${type}`)}
                    </button>
                  ))}
                </div>
              </div>

              {!androidMode && (
                <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
                  <h3 className="mb-4 text-lg font-semibold text-text-primary">
                    {t("settings.workspace.title")}
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 rounded-lg bg-bg-tertiary px-3 py-2 text-sm text-text-secondary">
                      {workspacePath || t("settings.workspace.notConfigured")}
                    </div>
                    <Button variant="secondary" onClick={() => selectWorkspace()}>
                      <FolderOpen size={16} />
                      {t("settings.workspace.change")}
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
                <h3 className="mb-4 text-lg font-semibold text-text-primary">
                  {t("settings.center.title")}
                </h3>
                <div className="space-y-4">
                  <Input
                    label={t("settings.center.name")}
                    id="center_name"
                    value={form.center_name}
                    onChange={(e) => updateField("center_name", e.target.value)}
                    placeholder="Centro Auditivo Konami"
                  />
                  <Input
                    label={t("settings.center.address")}
                    id="center_address"
                    value={form.center_address}
                    onChange={(e) => updateField("center_address", e.target.value)}
                    placeholder="Av. Libertador 1234, Puerto Montt"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label={t("settings.center.phone")}
                      id="center_phone"
                      value={form.center_phone}
                      onChange={(e) => updateField("center_phone", e.target.value)}
                      placeholder="+56 9 1234 5678"
                    />
                    <Input
                      label={t("settings.center.email")}
                      id="center_email"
                      value={form.center_email}
                      onChange={(e) => updateField("center_email", e.target.value)}
                      placeholder="contacto@centro.cl"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-text-secondary">
                      {t("settings.center.logo")}
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={logoPreview || "/tecmedhub.jpeg"}
                          alt="Logo"
                          className="h-16 w-16 rounded-lg border border-border-secondary object-contain"
                        />
                      </div>
                      <Button variant="secondary" size="sm" onClick={handleSelectLogo}>
                        <ImageIcon size={14} />
                        {t("settings.center.changeLogo")}
                      </Button>
                    </div>
                  </div>

                  <hr className="border-border-secondary" />

                  <Input
                    label={t("settings.center.examiner")}
                    id="examiner"
                    value={form.examiner}
                    onChange={(e) => updateField("examiner", e.target.value)}
                    placeholder="TM ORL; DR.; FGLO; Jaime García"
                  />
                  <Input
                    label={t("settings.center.equipment")}
                    id="equipment"
                    value={form.equipment}
                    onChange={(e) => updateField("equipment", e.target.value)}
                    placeholder="Otoscopio digital DZ450"
                  />
                </div>
              </div>

              {/* Beta features */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <FlaskConical size={18} className="text-amber-400" />
                  <h3 className="text-lg font-semibold text-text-primary">
                    {t("settings.beta.title")}
                  </h3>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">Beta</span>
                </div>
                <p className="mb-4 text-sm text-text-tertiary">{t("settings.beta.subtitle")}</p>
                <label className="flex items-center justify-between rounded-lg bg-bg-tertiary px-4 py-3 cursor-pointer">
                  <div>
                    <div className="text-sm font-medium text-text-primary">{t("settings.beta.education")}</div>
                    <div className="text-xs text-text-tertiary">{t("settings.beta.educationDesc")}</div>
                  </div>
                  <div
                    role="switch"
                    aria-checked={betaFeatures.education}
                    onClick={() => toggleBeta("education")}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      betaFeatures.education ? "bg-accent" : "bg-bg-primary"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        betaFeatures.education ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </div>
                </label>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave}>
                  <Save size={16} />
                  {saved ? t("settings.saved") : t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {/* Tab: Informe */}
          {activeTab === "informe" && (
            <div className="mx-auto flex max-w-5xl gap-6">
              <div className="flex-1 space-y-6">
                <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
                  <h3 className="mb-4 text-lg font-semibold text-text-primary">
                    {t("settings.reportPrefs.title")}
                  </h3>
                  <div className="space-y-4">
                    <Input
                      label={t("settings.reportPrefs.otoscopyTitle")}
                      id="report_title"
                      value={form.report_title}
                      onChange={(e) => updateField("report_title", e.target.value)}
                      placeholder="Informe de Otoscopía"
                    />

                    <Input
                      label={t("settings.reportPrefs.earWashTitle")}
                      id="ear_wash_report_title"
                      value={form.ear_wash_report_title}
                      onChange={(e) => updateField("ear_wash_report_title", e.target.value)}
                      placeholder="Informe de Lavado de Oído"
                    />

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="block text-sm font-medium text-text-secondary">
                          {t("settings.reportPrefs.sections")}
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
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-tertiary hover:bg-bg-tertiary hover:text-text-secondary"
                        >
                          <RotateCcw size={12} />
                          {t("settings.reportPrefs.reset")}
                        </button>
                      </div>
                      <SectionOrderList
                        sectionOrder={getSectionOrder(form.section_order)}
                        form={form}
                        onReorder={(order) => setForm((f) => ({ ...f, section_order: order }))}
                        onToggle={(field, value) => updateField(field, value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Select
                        label={t("settings.reportPrefs.imageSize")}
                        id="image_size"
                        value={form.image_size}
                        onChange={(e) => updateField("image_size", e.target.value)}
                        options={[
                          { value: "small", label: t("settings.reportPrefs.sizes.small") },
                          { value: "medium", label: t("settings.reportPrefs.sizes.medium") },
                          { value: "large", label: t("settings.reportPrefs.sizes.large") },
                        ]}
                      />
                      <Select
                        label={t("settings.reportPrefs.imagesPerRow")}
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
                      <label className="mb-2 block text-sm font-medium text-text-secondary">
                        {t("settings.reportPrefs.reportColor")}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(THEMES).map(([value, t]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => updateField("theme_color", value)}
                            className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm transition-colors ${
                              form.theme_color === value
                                ? "border-text-primary bg-bg-tertiary font-medium"
                                : "border-border-secondary hover:border-border-primary"
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
                    {saved ? t("settings.saved") : t("settings.save")}
                  </Button>
                </div>
              </div>

              {/* Columna derecha: Vista previa */}
              <div className="w-64 shrink-0">
                <div className="sticky top-6 space-y-2">
                  <h3 className="text-sm font-medium text-text-tertiary">{t("settings.reportPrefs.preview")}</h3>
                  <PdfMockup form={form} logoPreview={logoPreview} />
                </div>
              </div>
            </div>
          )}

          {/* Tab: Hallazgos */}
          {activeTab === "hallazgos" && (
            <div className="mx-auto max-w-3xl space-y-6">
              <FindingsConfigTab
                categories={findingsCategories}
                onChange={handleFindingsChange}
              />
              <div className="flex justify-end">
                <Button onClick={handleSave}>
                  <Save size={16} />
                  {saved ? t("settings.saved") : t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {/* Tab: Perfiles */}
          {activeTab === "perfiles" && (
            <ProfilesTab
              profiles={profiles}
              activeProfile={activeProfile}
              onAdd={addProfile}
              onUpdate={updateProfile}
              onRemove={removeProfile}
              onSwitch={clearProfileSelection}
            />
          )}

          {/* Tab: Acerca de */}
          {activeTab === "acerca" && (
            <div className="mx-auto max-w-3xl space-y-6">
              <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6 text-center">
                <div className="mb-4 flex justify-center">
                  <img src="/logo.png" alt="OtoReport" className="h-24 w-24" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary">{t("settings.about.title")}</h2>
                <p className="mt-1 text-sm text-text-tertiary">{t("settings.about.subtitle")}</p>
                <p className="mt-1 text-xs text-text-tertiary">{t("settings.about.version")} {APP_VERSION}</p>
                <div className="mt-3">
                  {update.checking ? (
                    <span className="inline-flex items-center gap-2 text-xs text-text-tertiary">
                      <Loader2 size={14} className="animate-spin" />
                      {t("update.checking")}
                    </span>
                  ) : update.error ? (
                    <span className="text-xs text-red-500">{t("update.checkError")}</span>
                  ) : update.latestVersion && !update.updateAvailable ? (
                    <span className="text-xs text-emerald-500">{t("update.upToDate")}</span>
                  ) : update.updateAvailable && update.releaseUrl ? (
                    <button
                      onClick={() => openUrl(update.releaseUrl!)}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      {t("update.newVersion")}: {update.latestVersion} — {t("update.download")}
                    </button>
                  ) : null}
                  <div className="mt-2">
                    <Button variant="secondary" size="sm" onClick={update.check} disabled={update.checking}>
                      <RefreshCw size={14} />
                      {t("update.checkNow")}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
                <h3 className="mb-3 text-lg font-semibold text-text-primary">{t("settings.about.projectTitle")}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {t("settings.about.projectDescription")}
                </p>
              </div>

              <div className="rounded-xl border border-accent/30 bg-accent/5 p-6">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles size={20} className="text-accent" />
                  <h3 className="text-lg font-semibold text-text-primary">{t("settings.about.aiTitle")}</h3>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {t("settings.about.aiDescription")}
                </p>
              </div>

              <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
                <h3 className="mb-4 text-lg font-semibold text-text-primary">{t("settings.about.teamTitle")}</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-accent">{t("settings.about.teamLeader")}</h4>
                    <p className="text-sm text-text-secondary">TM Nicolás Baier — UACh</p>
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-accent">{t("settings.about.mandator")}</h4>
                    <p className="text-sm text-text-secondary">TM Carlos Moreira — Hospital de Angol</p>
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-accent">{t("settings.about.teamWork")}</h4>
                    <ul className="space-y-1 text-sm text-text-secondary">
                      <li>TM Vanessa Uribe — UACh</li>
                      <li>TM Fernanda López — UACh</li>
                      <li>TM Cristina Vargas — UACh</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-accent">{t("settings.about.reviewers")}</h4>
                    <ul className="space-y-1 text-sm text-text-secondary">
                      <li>TM Pablo Poza — Escuela de Tecnología Médica, UACh</li>
                      <li>TM Geovana Casanova — Escuela de Tecnología Médica, UACh</li>
                      <li>TM María Paz Latorre — Centro de Salud La Colina, UACh</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* TecMedHub lab card */}
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-6">
                <div className="mb-3 flex items-center gap-2">
                  <MapPin size={20} className="text-violet-500" />
                  <h3 className="text-lg font-semibold text-text-primary">{t("settings.about.labTitle")}</h3>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {t("settings.about.labOrigin")}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {t("settings.about.labLocation")}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {t("settings.about.labCoffee")}
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => openUrl("https://maps.app.goo.gl/XvExh11Wb3LaT5WY8")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-400 transition hover:bg-violet-500/20"
                  >
                    <MapPin size={12} />
                    {t("settings.about.labMapButton")}
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6 text-center space-y-3">
                <div className="flex items-center justify-center gap-3 text-xs text-text-tertiary">
                  <button onClick={() => openUrl("https://github.com/TecMedHub/OtoReport")} className="inline-flex items-center gap-1 hover:text-accent">
                    <Github size={12} /> OtoReport <ExternalLink size={10} />
                  </button>
                  <span>·</span>
                  <button onClick={() => openUrl("https://github.com/TecMedHub/Otoreports_findings")} className="inline-flex items-center gap-1 hover:text-accent">
                    <Github size={12} /> Findings Library <ExternalLink size={10} />
                  </button>
                </div>
                <div className="flex items-center justify-center gap-3 text-xs text-text-tertiary">
                  <button onClick={() => openUrl("https://www.instagram.com/tecmedhub")} className="inline-flex items-center gap-1 hover:text-accent">
                    TecMedHub <ExternalLink size={10} />
                  </button>
                  <span>·</span>
                  <button onClick={() => openUrl("http://tmeduca.org")} className="inline-flex items-center gap-1 hover:text-accent">
                    tmeduca.org <ExternalLink size={10} />
                  </button>
                  <span>·</span>
                  <button onClick={() => openUrl("https://uach.cl")} className="inline-flex items-center gap-1 hover:text-accent">
                    UACh <ExternalLink size={10} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Contribuir */}
          {activeTab === "contribuir" && (
            <div className="mx-auto max-w-3xl space-y-6">
              {/* Ko-fi */}
              <div className="rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                    <Coffee size={22} className="text-amber-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">{t("settings.contribute.kofiTitle")}</h3>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {t("settings.contribute.kofiDescription")}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {t("settings.contribute.kofiCoffee")}
                </p>
                <div className="mt-5 flex justify-center">
                  <button
                    onClick={() => openUrl("https://ko-fi.com/tecmedhub")}
                    className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-amber-400 active:scale-95"
                  >
                    <Coffee size={16} />
                    {t("settings.contribute.kofiButton")}
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>

              {/* Biblioteca de hallazgos */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
                <div className="mb-3 flex items-center gap-2">
                  <BookOpen size={20} className="text-emerald-500" />
                  <h3 className="text-lg font-semibold text-text-primary">{t("settings.about.findingsLibraryTitle")}</h3>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {t("settings.about.findingsLibraryDescription")}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {t("settings.about.findingsLibraryContribute")}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {t("settings.about.findingsLibraryEthics1")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {t("settings.about.findingsLibraryEthics2")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {t("settings.about.findingsLibraryEthics3")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {t("settings.about.findingsLibraryEthics4")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {t("settings.about.findingsLibraryEthics5")}
                  </li>
                </ul>
                <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary">
                  <span>{t("settings.about.findingsLibraryContact")}</span>
                  <button onClick={() => openUrl("https://www.instagram.com/tecmedhub")} className="inline-flex items-center gap-1 font-semibold text-emerald-500 hover:underline">
                    @tecmedhub <ExternalLink size={12} />
                  </button>
                </div>
              </div>

              {/* Equipos recomendados */}
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-6">
                <div className="mb-3 flex items-center gap-2">
                  <Camera size={20} className="text-sky-500" />
                  <h3 className="text-lg font-semibold text-text-primary">{t("settings.about.equipmentTitle")}</h3>
                </div>
                <p className="mb-4 text-sm text-text-secondary">{t("settings.about.equipmentDescription")}</p>

                {equipmentStatus === "loading" && (
                  <div className="flex items-center gap-2 py-6 justify-center text-sm text-text-tertiary">
                    <Loader2 size={16} className="animate-spin" />
                    {t("settings.about.equipmentLoading")}
                  </div>
                )}

                {equipmentStatus === "error" && (
                  <div className="flex flex-col items-center gap-3 py-6 text-text-tertiary">
                    <WifiOff size={24} />
                    <p className="text-sm">{t("settings.about.equipmentOffline")}</p>
                    <button
                      onClick={() => setEquipmentStatus("idle")}
                      className="inline-flex items-center gap-1 text-sm font-medium text-sky-500 hover:underline"
                    >
                      <RefreshCw size={14} />
                      {t("settings.about.equipmentRetry")}
                    </button>
                  </div>
                )}

                {equipmentStatus === "loaded" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {equipment.map((item) => (
                      <EquipmentCard key={item.name} item={item} lang={i18n.language} />
                    ))}
                  </div>
                )}

                <div className="mt-5 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-sky-500">{t("settings.contribute.equipmentSubmitTitle")}</p>
                  <ul className="space-y-1.5 text-sm text-text-secondary">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                      {t("settings.contribute.equipmentField1")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                      {t("settings.contribute.equipmentField2")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                      {t("settings.contribute.equipmentField3")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                      {t("settings.contribute.equipmentField4")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                      {t("settings.contribute.equipmentField5")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                      {t("settings.contribute.equipmentField6")}
                    </li>
                  </ul>
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary">
                  <MessageCircle size={14} className="shrink-0 text-sky-500" />
                  <span>{t("settings.about.equipmentShareExperience")}</span>
                  <button onClick={() => openUrl("https://www.instagram.com/tecmedhub")} className="inline-flex items-center gap-1 font-semibold text-sky-500 hover:underline">
                    @tecmedhub <ExternalLink size={12} />
                  </button>
                </div>
              </div>

              {/* GitHub */}
              <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6 text-center space-y-3">
                <div className="mb-1 flex items-center justify-center gap-2 text-sm font-medium text-text-secondary">
                  <Heart size={14} className="text-rose-500" />
                  {t("settings.contribute.githubTitle")}
                </div>
                <div className="flex items-center justify-center gap-3 text-xs text-text-tertiary">
                  <button onClick={() => openUrl("https://github.com/TecMedHub/OtoReport")} className="inline-flex items-center gap-1 hover:text-accent">
                    <Github size={12} /> OtoReport <ExternalLink size={10} />
                  </button>
                  <span>·</span>
                  <button onClick={() => openUrl("https://github.com/TecMedHub/Otoreports_findings")} className="inline-flex items-center gap-1 hover:text-accent">
                    <Github size={12} /> Findings Library <ExternalLink size={10} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ProfilesTab({
  profiles,
  activeProfile,
  onAdd,
  onUpdate,
  onRemove,
  onSwitch,
}: {
  profiles: UserProfile[];
  activeProfile: UserProfile | null;
  onAdd: (name: string, color: string, avatar?: number) => Promise<UserProfile>;
  onUpdate: (profile: UserProfile) => Promise<void>;
  onRemove: (profileId: string) => Promise<void>;
  onSwitch: () => void;
}) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PROFILE_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editAvatar, setEditAvatar] = useState<number | undefined>();
  const [newAvatar, setNewAvatar] = useState<number | undefined>();
  const [showEditor, setShowEditor] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) return;
    await onAdd(newName.trim(), selectedColor, newAvatar);
    setNewName("");
    setNewAvatar(undefined);
    setShowAdd(false);
  }

  function startEdit(profile: UserProfile) {
    setEditingId(profile.id);
    setEditName(profile.name);
    setEditColor(profile.color);
    setEditAvatar(profile.avatar);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    const profile = profiles.find((p) => p.id === editingId);
    if (profile) {
      await onUpdate({ ...profile, name: editName.trim(), color: editColor, avatar: editAvatar, examiner: editName.trim() });
    }
    setEditingId(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Perfil activo */}
      {activeProfile && (
        <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
          <h3 className="mb-4 text-lg font-semibold text-text-primary">{t("settings.profiles.activeTitle")}</h3>
          <div className="flex items-center gap-4">
            <SpriteAvatar
              avatar={activeProfile.avatar}
              name={activeProfile.name}
              color={activeProfile.color}
              size={64}
            />
            <div className="flex-1">
              <p className="text-lg font-medium text-text-primary">{activeProfile.name}</p>
              <p className="text-sm text-text-tertiary">{t("settings.profiles.examinerSubtitle")}</p>
            </div>
            {profiles.length > 1 && (
              <Button variant="secondary" onClick={onSwitch}>
                <LogOut size={16} />
                {t("settings.profiles.changeProfile")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Lista de perfiles */}
      <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">{t("settings.profiles.listTitle")}</h3>
          <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} />
            {t("settings.profiles.addProfile")}
          </Button>
        </div>

        <div className="space-y-3">
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded-lg border border-border-secondary p-3">
              <div className="flex items-center gap-3">
              <SpriteAvatar
                avatar={editingId === profile.id ? editAvatar : profile.avatar}
                name={editingId === profile.id ? editName : profile.name}
                color={editingId === profile.id ? editColor : profile.color}
                size={40}
              />

              {editingId === profile.id ? (
                <div className="flex flex-1 flex-col gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    autoFocus
                    className="rounded border border-border-secondary bg-bg-primary px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none"
                  />
                  {editAvatar == null && (
                    <div className="flex gap-1">
                      {PROFILE_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setEditColor(color)}
                          className={`h-5 w-5 rounded-full ${editColor === color ? "ring-2 ring-accent ring-offset-1 ring-offset-bg-secondary" : ""}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="text-xs text-accent hover:underline">{t("settings.profiles.save")}</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-text-tertiary hover:underline">{t("settings.profiles.cancel")}</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-text-primary">{profile.name}</span>
                    {activeProfile?.id === profile.id && (
                      <span className="ml-2 rounded-full bg-accent-subtle px-2 py-0.5 text-xs text-accent-text">
                        {t("settings.profiles.active")}
                      </span>
                    )}
                  </div>
                  <button onClick={() => startEdit(profile)} className="text-xs text-text-tertiary hover:text-accent">
                    {t("settings.profiles.edit")}
                  </button>
                  {profiles.length > 1 && (
                    <button onClick={() => onRemove(profile.id)} className="text-xs text-text-tertiary hover:text-red-500">
                      {t("settings.profiles.delete")}
                    </button>
                  )}
                </>
              )}
              </div>

              {editingId === profile.id && (
                <div className="mt-3 border-t border-border-secondary pt-3">
                  <div className="mb-2 flex items-center justify-center">
                    <SpriteAvatar
                      avatar={editAvatar}
                      name={editName.trim() || "?"}
                      color={editColor}
                      size={64}
                    />
                  </div>
                  <AvatarPicker selected={editAvatar} onSelect={setEditAvatar} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Formulario agregar */}
        {showAdd && (
          <div className="mt-4 rounded-lg border border-border-secondary p-4">
            <h4 className="mb-3 text-sm font-medium text-text-primary">Nuevo perfil</h4>
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Nombre del examinador"
                autoFocus
                className="w-full rounded-lg border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
              {newAvatar == null && (
                <div className="flex gap-2">
                  {PROFILE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`h-7 w-7 rounded-full ${selectedColor === color ? "ring-2 ring-accent ring-offset-2 ring-offset-bg-secondary" : ""}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              )}
              <AvatarPicker selected={newAvatar} onSelect={setNewAvatar} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
                  Crear
                </Button>
                <Button variant="secondary" size="sm" onClick={() => { setShowAdd(false); setNewName(""); setNewAvatar(undefined); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2 text-right">
          <button
            onClick={() => setShowEditor(true)}
            className="text-[11px] text-text-tertiary hover:text-accent transition-colors"
          >
            {t("settings.findings.calibrateSprites")}
          </button>
        </div>
      </div>

      {showEditor && <SpriteEditor onClose={() => setShowEditor(false)} />}
    </div>
  );
}
