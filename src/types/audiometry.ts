import type { Patient } from "./patient";

export type AudiogramEarSide = "right" | "left";

export const AUDIOGRAM_FREQUENCIES = [125, 250, 500, 1000, 2000, 3000, 4000, 6000, 8000] as const;
export type Frequency = typeof AUDIOGRAM_FREQUENCIES[number];

export type Conduction = "air" | "bone";

export interface AudiogramPoint {
  frequency: Frequency;
  threshold: number;
  masked: boolean;
  noResponse: boolean;
}

export interface AudiogramEar {
  air: AudiogramPoint[];
  bone: AudiogramPoint[];
  ldl: AudiogramPoint[];
}

export interface LogoPoint {
  intensity: number;
  percent: number;
}

export interface LogoaudiometryEar {
  srt: number | null;
  discrimination: number | null;
  discrimination_intensity: number | null;
  curve: LogoPoint[];
  observations: string;
}

export type AcumetryResult = "normal" | "lateralized_right" | "lateralized_left" | "central" | "not_performed";
export type RinneResult = "positive" | "negative" | "neutral" | "not_performed";
export type SchwabachResult = "normal" | "shortened" | "lengthened" | "not_performed";

export interface Acumetry {
  weber: AcumetryResult;
  rinne_right: RinneResult;
  rinne_left: RinneResult;
  schwabach: SchwabachResult;
  observations: string;
}

export interface SupraliminarEar {
  sisi: number | null;
  tone_decay: string;
  fowler: string;
  reflex: string;
  observations: string;
}

export type SupraliminarTestType =
  | "sisi"
  | "tone_decay"
  | "fowler"
  | "reger"
  | "langenbeck"
  | "luscher"
  | "bekesy"
  | "other";

export type SupraliminarEarScope = "right" | "left" | "bilateral";

export interface FowlerData {
  frequency: Frequency;
  /** Peor oído: el que tiene la escalera fija (arranca en su umbral). */
  reference_ear: AudiogramEarSide;
  /** Umbral del peor oído a esa frecuencia (dB HL). */
  threshold_db: number;
  /** Incremento entre pasos (dB). Tradicionalmente 20. */
  step_db: number;
  /** Intensidades en el oído mejor donde el paciente igualó la sonoridad.
   *  Índice i corresponde al paso threshold + i·step en el peor oído.
   *  null = paso aún no medido. */
  matches: (number | null)[];
  /** Paciente reporta tono percibido a distinta altura entre oídos. */
  diplacusia?: boolean;
}

export interface SisiData {
  ear: AudiogramEarSide;
  frequency: Frequency;
  /** Umbral tonal del oído a esa frecuencia (dB HL). Auto desde audiograma. */
  threshold_db: number;
  /** Sensation Level sobre el umbral (dB). Tradicional: 20. */
  sl_db: number;
  /** Nivel de presentación = threshold + SL (editable). */
  presentation_db: number;
  /** Paso usado en familiarización (5 / 2 / 1 dB). Informativo. */
  familiarization_step_db: number;
  /** Incremento del test (dB). Tradicional: 1. */
  test_increment_db: number;
  /** 20 presentaciones. true = paciente detectó. */
  trials: boolean[];
}

export interface CarhartStep {
  /** Nivel presentado en dB HL. */
  level_db: number;
  /** Segundos que el paciente oyó antes de decaer (0–60). 60 = sostuvo completo. */
  seconds_heard: number;
}

export interface CarhartData {
  ear: AudiogramEarSide;
  frequency: Frequency;
  /** Umbral tonal (dB HL) en la frecuencia elegida. Auto desde audiograma. */
  threshold_db: number;
  /** Sensation Level inicial (dB). Tradicional: 5. */
  start_sl_db: number;
  /** Incremento por paso (dB). Tradicional: 5. */
  step_db: number;
  /** Tope de decay según Carhart (dB sobre umbral). Tradicional: 30. */
  max_decay_db: number;
  /** Pasos realizados, orden ascendente en nivel. */
  steps: CarhartStep[];
}

/** Decay total = nivel del último paso que el paciente sostuvo 60s - umbral.
 *  Si ningún paso llegó a 60s, devuelve el decay máximo alcanzado (último nivel - umbral). */
export function carhartDecayDb(data: CarhartData): number {
  if (!data.steps.length) return 0;
  const held = [...data.steps].reverse().find((s) => s.seconds_heard >= 60);
  const ref = held ?? data.steps[data.steps.length - 1];
  return Math.max(0, ref.level_db - data.threshold_db);
}

export type CarhartClass = "normal" | "mild" | "moderate" | "marked";

export function classifyCarhart(decay: number): CarhartClass {
  if (decay <= 5) return "normal";
  if (decay <= 15) return "mild";
  if (decay <= 25) return "moderate";
  return "marked";
}

export const CARHART_CLASS_LABELS: Record<CarhartClass, string> = {
  normal: "0–5 dB · Normal / conductivo",
  mild: "10–15 dB · Leve (coclear)",
  moderate: "20–25 dB · Moderado (coclear)",
  marked: "≥30 dB · Marcado · sospecha retrococlear",
};

export const CARHART_CLASS_COLORS: Record<CarhartClass, string> = {
  normal: "#059669",
  mild: "#65a30d",
  moderate: "#d97706",
  marked: "#dc2626",
};

export interface RegerData {
  ear: AudiogramEarSide;
  /** Frecuencia peor (umbral más elevado). */
  reference_frequency: Frequency;
  /** Frecuencia mejor (umbral cercano al normal). */
  comparison_frequency: Frequency;
  /** Umbral en la frecuencia peor (dB HL). */
  threshold_db: number;
  step_db: number;
  /** Intensidades en la frecuencia mejor donde el paciente iguala. */
  matches: (number | null)[];
  diplacusia?: boolean;
}

export type BalanceClass =
  | "insufficient"
  | "no_recruitment"
  | "recruitment"
  | "over_recruitment";

export const BALANCE_CLASS_LABELS: Record<BalanceClass, string> = {
  insufficient: "Datos insuficientes",
  no_recruitment: "No recluta",
  recruitment: "Recluta",
  over_recruitment: "Sobre-recluta",
};

export const BALANCE_CLASS_COLORS: Record<BalanceClass, string> = {
  insufficient: "#6b7280",
  no_recruitment: "#059669",
  recruitment: "#d97706",
  over_recruitment: "#dc2626",
};

/** Clasifica una prueba de igualación de sonoridad (Fowler/Reger).
 *  - No recluta: diferencia ref-match se mantiene ~constante (líneas paralelas).
 *  - Recluta: diferencia converge hacia 0 al aumentar intensidad.
 *  - Sobre-recluta: la diferencia se invierte (match < ref) al aumentar intensidad. */
export function classifyBalance(referenceLevels: number[], matches: (number | null)[]): BalanceClass {
  const pairs: { r: number; m: number }[] = [];
  for (let i = 0; i < referenceLevels.length; i++) {
    const m = matches[i];
    if (m !== null && m !== undefined) pairs.push({ r: referenceLevels[i], m });
  }
  if (pairs.length < 2) return "insufficient";
  const diffInit = pairs[0].r - pairs[0].m;
  const diffFinal = pairs[pairs.length - 1].r - pairs[pairs.length - 1].m;
  const TOL = 5;
  if (diffFinal < -TOL) return "over_recruitment";
  if (Math.abs(diffFinal - diffInit) <= TOL) return "no_recruitment";
  if (diffFinal < diffInit) return "recruitment";
  return "no_recruitment";
}

export interface SupraliminarTest {
  id: string;
  type: SupraliminarTestType;
  custom_name?: string;
  ear: SupraliminarEarScope;
  result: string;
  observations: string;
  fowler?: FowlerData;
  reger?: RegerData;
  sisi?: SisiData;
  carhart?: CarhartData;
}

export function sisiScore(data: SisiData): number {
  if (!data.trials.length) return 0;
  const hits = data.trials.filter(Boolean).length;
  return Math.round((hits / data.trials.length) * 100);
}

export function classifySisi(score: number): "low" | "intermediate" | "high" {
  if (score <= 20) return "low";
  if (score >= 70) return "high";
  return "intermediate";
}

export interface Supraliminar {
  tests: SupraliminarTest[];
}

export const SUPRALIMINAR_TEST_LABELS: Record<SupraliminarTestType, string> = {
  sisi: "SISI",
  tone_decay: "Tone Decay (Carhart)",
  fowler: "Fowler (ABLB)",
  reger: "Reger (MBLB)",
  langenbeck: "Langenbeck",
  luscher: "Lüscher (DLI)",
  bekesy: "Békésy",
  other: "Otra",
};

export const SUPRALIMINAR_DESCRIPTION: Record<SupraliminarTestType, string> = {
  sisi: "20 incrementos de 1 dB sobre 20 dB SL. % de incrementos percibidos. >70% sugiere reclutamiento.",
  tone_decay: "Tono continuo a 5 dB SL; sube 5 dB cuando deja de oírse. dB totales para mantener 60s.",
  fowler: "Igualación alterna de sonoridad binaural. Hipoacusia asimétrica. Detecta reclutamiento.",
  reger: "Igualación de sonoridad en un mismo oído a dos frecuencias (hipoacusia simétrica).",
  langenbeck: "Audiometría tonal con ruido blanco enmascarador. Unión de curvas = reclutamiento.",
  luscher: "Umbral diferencial de intensidad. DL < 1 dB sugiere reclutamiento.",
  bekesy: "Trazado automático continuo vs pulsátil. Tipos I-V (Jerger).",
  other: "Prueba personalizada.",
};

export const SUPRALIMINAR_RESULT_HINT: Record<SupraliminarTestType, string> = {
  sisi: "% (ej: 80%)",
  tone_decay: "Interpretación (opcional — datos en tabla)",
  fowler: "Interpretación (opcional — datos en diagrama)",
  reger: "Interpretación",
  langenbeck: "Resultado",
  luscher: "DL en dB (ej: 0.5 dB)",
  bekesy: "Tipo I / II / III / IV / V",
  other: "Resultado",
};

export interface PTA {
  right_air: number | null;
  left_air: number | null;
  right_bone: number | null;
  left_bone: number | null;
  right_air_4: number | null;
  left_air_4: number | null;
  right_bone_4: number | null;
  left_bone_4: number | null;
}

export type AudiometryStatus = "in_progress" | "completed";

export interface AudiometryReport {
  id: string;
  patient_id: string;
  patient: Patient;
  session_id: string;
  status: AudiometryStatus;
  report_type: "audiometry";
  examiner: string;
  equipment: string;
  right_audiogram: AudiogramEar;
  left_audiogram: AudiogramEar;
  logo_right: LogoaudiometryEar;
  logo_left: LogoaudiometryEar;
  supraliminar: Supraliminar;
  acumetry: Acumetry;
  pta: PTA;
  conclusion: string;
  created_at: string;
  updated_at: string;
}

export function emptyAudiogramEar(): AudiogramEar {
  return { air: [], bone: [], ldl: [] };
}

export function emptyLogoEar(): LogoaudiometryEar {
  return { srt: null, discrimination: null, discrimination_intensity: null, curve: [], observations: "" };
}

export function emptySupraliminarEar(): SupraliminarEar {
  return { sisi: null, tone_decay: "", fowler: "", reflex: "", observations: "" };
}

export function emptyAcumetry(): Acumetry {
  return {
    weber: "not_performed",
    rinne_right: "not_performed",
    rinne_left: "not_performed",
    schwabach: "not_performed",
    observations: "",
  };
}

/** Pure Tone Average sobre frecuencias dadas. */
export function computePTA(audiogram: AudiogramEar, conduction: Conduction = "air", freqs: Frequency[] = [500, 1000, 2000]): number | null {
  const pts = conduction === "air" ? audiogram.air : audiogram.bone;
  const vals = freqs
    .map((f) => pts.find((p) => p.frequency === f && !p.noResponse)?.threshold)
    .filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

const PTA_3: Frequency[] = [500, 1000, 2000];
const PTA_4: Frequency[] = [500, 1000, 2000, 4000];

export function computeAllPTA(right: AudiogramEar, left: AudiogramEar): PTA {
  return {
    right_air: computePTA(right, "air", PTA_3),
    left_air: computePTA(left, "air", PTA_3),
    right_bone: computePTA(right, "bone", PTA_3),
    left_bone: computePTA(left, "bone", PTA_3),
    right_air_4: computePTA(right, "air", PTA_4),
    left_air_4: computePTA(left, "air", PTA_4),
    right_bone_4: computePTA(right, "bone", PTA_4),
    left_bone_4: computePTA(left, "bone", PTA_4),
  };
}

/** Clasificación según OMS por PTA aéreo. */
export function classifyHearingLoss(pta: number | null): string {
  if (pta === null) return "—";
  if (pta <= 25) return "normal";
  if (pta <= 40) return "mild";
  if (pta <= 55) return "moderate";
  if (pta <= 70) return "moderate_severe";
  if (pta <= 90) return "severe";
  return "profound";
}
