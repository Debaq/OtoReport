import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { Report, EarData, WorkspaceConfig, FindingsCategoryConfig } from "@/types";
import type { EarFindings, QuadrantMark } from "@/types/findings";
import { FindingType, getDefaultFindingsCategories, translateFindingsCategories } from "@/types";
import i18n from "@/i18n/config";

const DEFAULT_SECTION_ORDER = ["header", "logo", "patient_info", "exam_info", "diagram", "findings", "observations", "images", "annotations", "conclusion", "footer"];

const EAR_CONTENT_KEYS = new Set(["diagram", "findings", "observations", "images", "annotations"]);

function getSectionOrder(order: string[] | undefined): string[] {
  if (!order || order.length === 0) return DEFAULT_SECTION_ORDER;
  const missing = DEFAULT_SECTION_ORDER.filter((s) => !order.includes(s));
  return [...order.filter((s) => DEFAULT_SECTION_ORDER.includes(s)), ...missing];
}

function getMainSections(order: string[]): { mainOrder: string[]; earContentOrder: string[] } {
  const earContentOrder: string[] = [];
  const mainOrder: string[] = [];
  let earAdded = false;
  for (const key of order) {
    if (EAR_CONTENT_KEYS.has(key)) {
      earContentOrder.push(key);
      if (!earAdded) { mainOrder.push("__ear__"); earAdded = true; }
    } else if (key !== "logo") {
      mainOrder.push(key);
    }
  }
  return { mainOrder, earContentOrder };
}

const IMAGE_SIZES = {
  small: { width: 80, height: 60 },
  medium: { width: 120, height: 90 },
  large: { width: 200, height: 150 },
} as const;

const PRIMARY_SIZE = { width: 200, height: 150 };

const THEMES: Record<string, { primary: string; dark: string }> = {
  blue: { primary: "#2563eb", dark: "#1e3a5f" },
  green: { primary: "#059669", dark: "#064e3b" },
  teal: { primary: "#0d9488", dark: "#134e4a" },
  purple: { primary: "#7c3aed", dark: "#4c1d95" },
  rose: { primary: "#e11d48", dark: "#881337" },
  gray: { primary: "#6b7280", dark: "#1f2937" },
};

const EAR_COLORS = {
  right: "#dc2626",
  left: "#2563eb",
};

function getTheme(name: string) {
  return THEMES[name] || THEMES.blue;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerLogo: {
    width: 60,
    height: 60,
    objectFit: "contain",
  },
  headerInfo: {
    flex: 1,
  },
  centerName: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 2,
  },
  centerDetail: {
    fontSize: 9,
    color: "#6b7280",
  },
  subtitle: {
    fontSize: 10,
    color: "#6b7280",
  },
  section: {
    marginBottom: 15,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: 120,
    fontWeight: "bold",
    color: "#374151",
  },
  value: {
    flex: 1,
    color: "#4b5563",
  },
  earContainer: {
    flexDirection: "row",
    gap: 20,
  },
  earColumn: {
    flex: 1,
  },
  findingItem: {
    fontSize: 9,
    color: "#4b5563",
    marginBottom: 2,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#9ca3af",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function buildFindingLabels(categories?: FindingsCategoryConfig[]): Record<string, string> {
  const cats = translateFindingsCategories(categories && categories.length > 0 ? categories : getDefaultFindingsCategories());
  const labels: Record<string, string> = {};
  for (const cat of cats) {
    const prefix = cat.id === "cae" ? "CAE " : "";
    for (const check of cat.checks) {
      labels[check.key] = prefix + check.label;
    }
  }
  return labels;
}

function ActiveFindings({ findings, categories }: { findings: EarFindings; categories?: FindingsCategoryConfig[] }) {
  const labels = buildFindingLabels(categories);
  const active = Object.keys(findings).filter((k) => findings[k]);

  if (active.length === 0) return <Text style={styles.findingItem}>{i18n.t("common.noFindings", "Sin hallazgos")}</Text>;

  return (
    <>
      {active.map((k) => (
        <Text key={k} style={styles.findingItem}>
          • {labels[k] || k}
        </Text>
      ))}
    </>
  );
}

const diagramSymbols: Record<string, string> = {
  [FindingType.Retraction]: "///",
  [FindingType.Perforation]: "ooo",
  [FindingType.Effusion]: "~~~",
  [FindingType.Tympanoslerosis]: "...",
  [FindingType.Cholesteatoma]: "###",
  [FindingType.Inflammation]: "xxx",
  [FindingType.Tube]: "+++",
  [FindingType.Myringitis]: "***",
};

function getDiagramLabels(): Record<string, string> {
  return {
    [FindingType.Retraction]: i18n.t("findings.labels.retraction", "Retracción"),
    [FindingType.Perforation]: i18n.t("findings.labels.perforation", "Perforación"),
    [FindingType.Effusion]: i18n.t("findings.labels.effusion", "Efusión"),
    [FindingType.Tympanoslerosis]: i18n.t("findings.labels.tympanosclerosis", "Timpanoesclerosis"),
    [FindingType.Cholesteatoma]: i18n.t("findings.labels.cholesteatoma", "Colesteatoma"),
    [FindingType.Inflammation]: i18n.t("findings.labels.inflammation", "Inflamación"),
    [FindingType.Tube]: i18n.t("findings.labels.tube", "Tubo"),
    [FindingType.Myringitis]: i18n.t("findings.labels.myringitis", "Miringitis"),
  };
}

const diagramColors: Record<string, string> = {
  [FindingType.Retraction]: "#f59e0b",
  [FindingType.Perforation]: "#ef4444",
  [FindingType.Effusion]: "#3b82f6",
  [FindingType.Tympanoslerosis]: "#8b5cf6",
  [FindingType.Cholesteatoma]: "#f97316",
  [FindingType.Inflammation]: "#dc2626",
  [FindingType.Tube]: "#10b981",
  [FindingType.Myringitis]: "#ec4899",
};


function DiagramsRow({
  rightData,
  leftData,
  rightDiagramUrl,
  leftDiagramUrl,
}: {
  rightData: EarData;
  leftData: EarData;
  rightDiagramUrl?: string;
  leftDiagramUrl?: string;
}) {
  const diagLabels = getDiagramLabels();
  const rightFindings = rightData.marks.marks.map((m: QuadrantMark) => m.finding);
  const leftFindings = leftData.marks.marks.map((m: QuadrantMark) => m.finding);
  const allFindings = [...new Set([...rightFindings, ...leftFindings])];

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 12, marginBottom: 6 }}>
      {rightDiagramUrl && (
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 8, fontWeight: "bold", color: EAR_COLORS.right, marginBottom: 3 }}>
            {i18n.t("pdf.labels.rightEar")}
          </Text>
          <Image src={rightDiagramUrl} style={{ width: 100, height: 100 }} />
        </View>
      )}
      {allFindings.length > 0 && (
        <View style={{ justifyContent: "center", paddingTop: 14 }}>
          {allFindings.map((f) => (
            <View key={f} style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
              <Text style={{ fontSize: 7, color: diagramColors[f] || "#888", fontFamily: "Courier", width: 22 }}>
                {diagramSymbols[f] || "?"}
              </Text>
              <Text style={{ fontSize: 7, color: "#4b5563" }}>
                {diagLabels[f] || f}
              </Text>
            </View>
          ))}
        </View>
      )}
      {leftDiagramUrl && (
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 8, fontWeight: "bold", color: EAR_COLORS.left, marginBottom: 3 }}>
            {i18n.t("pdf.labels.leftEar")}
          </Text>
          <Image src={leftDiagramUrl} style={{ width: 100, height: 100 }} />
        </View>
      )}
    </View>
  );
}

function EarSection({
  title,
  side,
  data,
  primaryImage,
  secondaryImages,
  config,
  contentOrder,
  reportCategories,
}: {
  title: string;
  side: "right" | "left";
  data: EarData;
  primaryImage: string | null;
  secondaryImages: string[];
  config: WorkspaceConfig;
  contentOrder: string[];
  reportCategories?: FindingsCategoryConfig[];
}) {
  const secSize = IMAGE_SIZES[config.image_size] || IMAGE_SIZES.medium;
  const earColor = EAR_COLORS[side];

  return (
    <View style={styles.earColumn}>
      <Text style={{ fontSize: 11, fontWeight: "bold", color: earColor, marginBottom: 6 }}>
        {title}
      </Text>
      {contentOrder.map((key) => {
        switch (key) {
          case "findings":
            return config.show_findings ? (
              <View key={key}><ActiveFindings findings={data.findings} categories={reportCategories} /></View>
            ) : null;
          case "observations":
            return config.show_observations && data.observations ? (
              <Text key={key} style={[styles.findingItem, { marginTop: 4 }]}>
                {i18n.t("pdf.labels.observations")}: {data.observations}
              </Text>
            ) : null;
          case "images":
            return config.show_images && primaryImage ? (
              <View key={key} style={{ marginTop: 6 }}>
                <Image
                  src={primaryImage}
                  style={{
                    width: PRIMARY_SIZE.width,
                    height: PRIMARY_SIZE.height,
                    objectFit: "cover" as const,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                  }}
                />
                {secondaryImages.length > 0 && (
                  <View style={styles.imageGrid}>
                    {secondaryImages.map((url, i) => (
                      <Image
                        key={i}
                        src={url}
                        style={{
                          width: secSize.width,
                          height: secSize.height,
                          objectFit: "cover" as const,
                          borderRadius: 4,
                          border: "1px solid #e5e7eb",
                        }}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : null;
          default:
            return null;
        }
      })}
    </View>
  );
}

interface PdfReportProps {
  report: Report;
  rightEarPrimary: string | null;
  rightEarSecondary: string[];
  leftEarPrimary: string | null;
  leftEarSecondary: string[];
  rightDiagramUrl?: string;
  leftDiagramUrl?: string;
  postRightEarPrimary?: string | null;
  postRightEarSecondary?: string[];
  postLeftEarPrimary?: string | null;
  postLeftEarSecondary?: string[];
  postRightDiagramUrl?: string;
  postLeftDiagramUrl?: string;
  config: WorkspaceConfig;
  logoUrl: string | null;
}

export function PdfReport({
  report,
  rightEarPrimary,
  rightEarSecondary,
  leftEarPrimary,
  leftEarSecondary,
  rightDiagramUrl,
  leftDiagramUrl,
  postRightEarPrimary,
  postRightEarSecondary,
  postLeftEarPrimary,
  postLeftEarSecondary,
  postRightDiagramUrl,
  postLeftDiagramUrl,
  config,
  logoUrl,
}: PdfReportProps) {
  const isEarWash = report.report_type === "ear_wash";
  const theme = getTheme(config.theme_color);
  const locale = i18n.language.startsWith("es") ? "es-CL" : "en-US";
  const date = new Date(report.created_at).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const reportTitle = isEarWash
    ? (config.ear_wash_report_title || i18n.t("report.earWash.types.ear_wash"))
    : (config.report_title || i18n.t("report.earWash.types.otoscopy"));

  const showLogo = config.show_logo && logoUrl;
  const hasCenterInfo = config.center_name || config.center_address || config.center_phone || config.center_email;
  const sectionOrder = getSectionOrder(config.section_order);
  const { mainOrder, earContentOrder } = getMainSections(sectionOrder);
  const hasEarContent = earContentOrder.some((k) =>
    (k === "diagram" && config.show_diagram) ||
    (k === "findings" && config.show_findings) ||
    (k === "observations" && config.show_observations) ||
    (k === "images" && config.show_images)
  );

  const sectionRenderers: Record<string, () => React.ReactNode> = {
    header: () =>
      config.show_header ? (
        <View key="header" style={[styles.header, { borderBottom: `2px solid ${theme.primary}` }]}>
          {showLogo && (
            <Image src={logoUrl} style={styles.headerLogo} />
          )}
          <View style={styles.headerInfo}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.dark, marginBottom: 4 }}>
              {reportTitle}
            </Text>
            {hasCenterInfo && (
              <>
                {config.center_name && (
                  <Text style={styles.centerName}>{config.center_name}</Text>
                )}
                {config.center_address && (
                  <Text style={styles.centerDetail}>{config.center_address}</Text>
                )}
                {(config.center_phone || config.center_email) && (
                  <Text style={styles.centerDetail}>
                    {[config.center_phone, config.center_email].filter(Boolean).join(" • ")}
                  </Text>
                )}
              </>
            )}
            <Text style={styles.subtitle}>OtoReport — {date}</Text>
          </View>
        </View>
      ) : null,
    patient_info: () =>
      config.show_patient_info ? (
        <View key="patient_info" style={styles.section}>
          <Text style={{ fontSize: 12, fontWeight: "bold", color: theme.dark, marginBottom: 6, borderBottom: "1px solid #e5e7eb", paddingBottom: 3 }}>
            {i18n.t("pdf.labels.patientData")}
          </Text>
          <View style={styles.row}>
            <Text style={styles.label}>{i18n.t("patients.name")}:</Text>
            <Text style={styles.value}>{report.patient.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{i18n.t(`patients.idLabel.${config.id_type || "rut_id_dni"}`)}:</Text>
            <Text style={styles.value}>{report.patient.rut}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{i18n.t("patients.age")}:</Text>
            <Text style={styles.value}>{report.patient.age} {i18n.t("patients.ageYears")}</Text>
          </View>
        </View>
      ) : null,
    exam_info: () =>
      config.show_exam_info ? (
        <View key="exam_info" style={styles.section}>
          <Text style={{ fontSize: 12, fontWeight: "bold", color: theme.dark, marginBottom: 6, borderBottom: "1px solid #e5e7eb", paddingBottom: 3 }}>
            {i18n.t("pdf.labels.examData")}
          </Text>
          <View style={styles.row}>
            <Text style={styles.label}>{i18n.t("pdf.labels.examiner")}:</Text>
            <Text style={styles.value}>{report.examiner}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{i18n.t("pdf.labels.equipment")}:</Text>
            <Text style={styles.value}>{report.equipment}</Text>
          </View>
        </View>
      ) : null,
    "__ear__": () => {
      if (!hasEarContent) return null;
      const nonDiagramOrder = earContentOrder.filter((k) => k !== "diagram");
      const showDiagrams = config.show_diagram && (rightDiagramUrl || leftDiagramUrl);

      if (isEarWash && report.post_right_ear && report.post_left_ear) {
        return (
          <View key="ear_content">
            {/* Pre-Lavado */}
            <View style={styles.section}>
              <Text style={{ fontSize: 12, fontWeight: "bold", color: theme.dark, marginBottom: 6, borderBottom: "1px solid #e5e7eb", paddingBottom: 3 }}>
                {i18n.t("report.earWash.pre")}
              </Text>
              {showDiagrams && (
                <DiagramsRow
                  rightData={report.right_ear}
                  leftData={report.left_ear}
                  rightDiagramUrl={rightDiagramUrl}
                  leftDiagramUrl={leftDiagramUrl}
                />
              )}
              <View style={styles.earContainer}>
                <EarSection
                  title={i18n.t("pdf.labels.rightEar")}
                  side="right"
                  data={report.right_ear}
                  primaryImage={rightEarPrimary}
                  secondaryImages={rightEarSecondary}
                  config={config}
                  contentOrder={nonDiagramOrder}
                  reportCategories={report.findings_categories}
                />
                <EarSection
                  title={i18n.t("pdf.labels.leftEar")}
                  side="left"
                  data={report.left_ear}
                  primaryImage={leftEarPrimary}
                  secondaryImages={leftEarSecondary}
                  config={config}
                  contentOrder={nonDiagramOrder}
                  reportCategories={report.findings_categories}
                />
              </View>
            </View>
            {/* Post-Lavado */}
            <View style={styles.section}>
              <Text style={{ fontSize: 12, fontWeight: "bold", color: theme.dark, marginBottom: 6, borderBottom: "1px solid #e5e7eb", paddingBottom: 3 }}>
                {i18n.t("report.earWash.post")}
              </Text>
              {config.show_diagram && (postRightDiagramUrl || postLeftDiagramUrl) && (
                <DiagramsRow
                  rightData={report.post_right_ear}
                  leftData={report.post_left_ear}
                  rightDiagramUrl={postRightDiagramUrl}
                  leftDiagramUrl={postLeftDiagramUrl}
                />
              )}
              <View style={styles.earContainer}>
                <EarSection
                  title={i18n.t("pdf.labels.rightEar")}
                  side="right"
                  data={report.post_right_ear}
                  primaryImage={postRightEarPrimary ?? null}
                  secondaryImages={postRightEarSecondary ?? []}
                  config={config}
                  contentOrder={nonDiagramOrder}
                  reportCategories={report.findings_categories}
                />
                <EarSection
                  title={i18n.t("pdf.labels.leftEar")}
                  side="left"
                  data={report.post_left_ear}
                  primaryImage={postLeftEarPrimary ?? null}
                  secondaryImages={postLeftEarSecondary ?? []}
                  config={config}
                  contentOrder={nonDiagramOrder}
                  reportCategories={report.findings_categories}
                />
              </View>
            </View>
          </View>
        );
      }

      return (
        <View key="ear_content" style={styles.section}>
          <Text style={{ fontSize: 12, fontWeight: "bold", color: theme.dark, marginBottom: 6, borderBottom: "1px solid #e5e7eb", paddingBottom: 3 }}>
            {i18n.t("pdf.sections.findings")}
          </Text>
          {showDiagrams && (
            <DiagramsRow
              rightData={report.right_ear}
              leftData={report.left_ear}
              rightDiagramUrl={rightDiagramUrl}
              leftDiagramUrl={leftDiagramUrl}
            />
          )}
          <View style={styles.earContainer}>
            <EarSection
              title={i18n.t("pdf.labels.rightEar")}
              side="right"
              data={report.right_ear}
              primaryImage={rightEarPrimary}
              secondaryImages={rightEarSecondary}
              config={config}
              contentOrder={nonDiagramOrder}
              reportCategories={report.findings_categories}
            />
            <EarSection
              title={i18n.t("pdf.labels.leftEar")}
              side="left"
              data={report.left_ear}
              primaryImage={leftEarPrimary}
              secondaryImages={leftEarSecondary}
              config={config}
              contentOrder={nonDiagramOrder}
              reportCategories={report.findings_categories}
            />
          </View>
        </View>
      );
    },
    conclusion: () =>
      config.show_conclusion && report.conclusion ? (
        <View key="conclusion" style={styles.section}>
          <Text style={{ fontSize: 12, fontWeight: "bold", color: theme.dark, marginBottom: 6, borderBottom: "1px solid #e5e7eb", paddingBottom: 3 }}>
            {i18n.t("pdf.labels.conclusion")}
          </Text>
          <View style={{ marginTop: 10, padding: 10, backgroundColor: "#f9fafb", borderRadius: 4, borderLeft: `3px solid ${theme.primary}` }}>
            <Text>{report.conclusion}</Text>
          </View>
        </View>
      ) : null,
    footer: () =>
      config.show_footer ? (
        <View style={styles.footer} fixed>
          <Text>OtoReport v1.0.0</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              i18n.t("pdf.labels.page", { current: pageNumber, total: totalPages })
            }
          />
        </View>
      ) : null,
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {mainOrder.map((key) => sectionRenderers[key]?.())}
      </Page>
    </Document>
  );
}
