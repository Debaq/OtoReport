import type { EarFindings, EarMarks } from "./findings";
import type { EarImage } from "./image";
import type { Patient } from "./patient";
import i18n from "@/i18n/config";

export interface EarData {
  findings: EarFindings;
  marks: EarMarks;
  images: EarImage[];
  observations: string;
}

export type ReportStatus = "in_progress" | "completed";
export type ReportType = "otoscopy" | "ear_wash";

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  otoscopy: "Otoscopía",
  ear_wash: "Lavado de Oído",
};

export interface Report {
  id: string;
  patient_id: string;
  patient: Patient;
  session_id: string;
  status: ReportStatus;
  report_type: ReportType;
  examiner: string;
  equipment: string;
  right_ear: EarData;
  left_ear: EarData;
  post_right_ear?: EarData;
  post_left_ear?: EarData;
  conclusion: string;
  created_at: string;
  updated_at: string;
  findings_categories?: FindingsCategoryConfig[];
}

export interface UserProfile {
  id: string;
  name: string;
  color: string;
  avatar?: number;
  center_name: string;
  center_address: string;
  center_phone: string;
  center_email: string;
  logo_path: string;
  examiner: string;
  equipment: string;
  report_title: string;
  ear_wash_report_title: string;
  show_header: boolean;
  show_logo: boolean;
  show_patient_info: boolean;
  show_exam_info: boolean;
  show_diagram: boolean;
  show_annotations: boolean;
  show_findings: boolean;
  show_observations: boolean;
  show_images: boolean;
  show_conclusion: boolean;
  show_footer: boolean;
  image_size: string;
  images_per_row: number;
  theme_color: string;
  section_order: string[];
  findings_categories?: FindingsCategoryConfig[];
  app_theme: string;
}

export const PROFILE_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B",
  "#8B5CF6", "#EC4899", "#06B6D4", "#F97316",
];

export interface WorkspaceConfig {
  workspace_path: string;
  center_name: string;
  center_address: string;
  center_phone: string;
  center_email: string;
  logo_path: string;
  examiner: string;
  equipment: string;
  report_title: string;
  ear_wash_report_title: string;
  show_header: boolean;
  show_logo: boolean;
  show_patient_info: boolean;
  show_exam_info: boolean;
  show_diagram: boolean;
  show_annotations: boolean;
  show_findings: boolean;
  show_observations: boolean;
  show_images: boolean;
  show_conclusion: boolean;
  show_footer: boolean;
  image_size: "small" | "medium" | "large";
  images_per_row: number;
  theme_color: string;
  section_order: string[];
  findings_categories?: FindingsCategoryConfig[];
  app_theme: string;
}

export interface FindingCheckConfig {
  key: string;
  label: string;
  enabled: boolean;
  description?: string;
}

export interface FindingsCategoryConfig {
  id: string;
  name: string;
  checks: FindingCheckConfig[];
}

export function getDefaultFindingsCategories(): FindingsCategoryConfig[] {
  const tf = (key: string) => i18n.t(key, { ns: 'findings' });
  return [
    {
      id: "membrane",
      name: tf("categories.membrane"),
      checks: [
        { key: "normal", label: tf("findings.normal.label"), enabled: true, description: tf("findings.normal.description") },
        { key: "retraction", label: tf("findings.retraction.label"), enabled: true, description: tf("findings.retraction.description") },
        { key: "perforation", label: tf("findings.perforation.label"), enabled: true, description: tf("findings.perforation.description") },
        { key: "effusion", label: tf("findings.effusion.label"), enabled: true, description: tf("findings.effusion.description") },
        { key: "inflammation", label: tf("findings.inflammation.label"), enabled: true, description: tf("findings.inflammation.description") },
      ],
    },
    {
      id: "cae",
      name: tf("categories.cae"),
      checks: [
        { key: "cae_normal", label: tf("findings.cae_normal.label"), enabled: true, description: tf("findings.cae_normal.description") },
        { key: "cae_cerumen", label: tf("findings.cae_cerumen.label"), enabled: true, description: tf("findings.cae_cerumen.description") },
        { key: "cae_edema", label: tf("findings.cae_edema.label"), enabled: true, description: tf("findings.cae_edema.description") },
        { key: "cae_otorrhea", label: tf("findings.cae_otorrhea.label"), enabled: true, description: tf("findings.cae_otorrhea.description") },
        { key: "cae_exostosis", label: tf("findings.cae_exostosis.label"), enabled: true, description: tf("findings.cae_exostosis.description") },
      ],
    },
  ];
}

/** Re-translate findings categories using current i18n language.
 *  Known keys get their label/description from i18n; custom ones stay as-is. */
export function translateFindingsCategories(categories: FindingsCategoryConfig[]): FindingsCategoryConfig[] {
  const KNOWN_CATEGORY_IDS = ["membrane", "cae"];
  return categories.map((cat) => {
    const catName = KNOWN_CATEGORY_IDS.includes(cat.id)
      ? i18n.t(`categories.${cat.id}`, { ns: 'findings', defaultValue: cat.name })
      : cat.name;
    return {
      ...cat,
      name: catName,
      checks: cat.checks.map((ch) => {
        const translatedLabel = i18n.t(`findings.${ch.key}.label`, { ns: 'findings', defaultValue: '' });
        if (translatedLabel) {
          const translatedDesc = i18n.t(`findings.${ch.key}.description`, { ns: 'findings', defaultValue: ch.description || '' });
          return { ...ch, label: translatedLabel, description: translatedDesc };
        }
        return ch;
      }),
    };
  });
}

export interface SessionInfo {
  id: string;
  patient_id: string;
  patient_name: string;
  created_at: string;
  status: ReportStatus;
  report_type: ReportType;
}
