import type { EarFindings, EarMarks } from "./findings";
import type { EarImage } from "./image";
import type { Patient } from "./patient";

export interface EarData {
  findings: EarFindings;
  marks: EarMarks;
  images: EarImage[];
  observations: string;
}

export type ReportStatus = "in_progress" | "completed";

export interface Report {
  id: string;
  patient_id: string;
  patient: Patient;
  session_id: string;
  status: ReportStatus;
  examiner: string;
  equipment: string;
  right_ear: EarData;
  left_ear: EarData;
  conclusion: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceConfig {
  workspace_path: string;
  // Centro de salud
  center_name: string;
  center_address: string;
  center_phone: string;
  center_email: string;
  logo_path: string;
  // Examinador
  examiner: string;
  equipment: string;
  // Preferencias del informe
  report_title: string;
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
}

export interface SessionInfo {
  id: string;
  patient_id: string;
  patient_name: string;
  created_at: string;
  status: ReportStatus;
}
