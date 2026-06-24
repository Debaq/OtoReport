/** Anamnesis clínica registrada por sesión (snapshot dentro del Report). */
export interface Anamnesis {
  /** Síntomas asociados (prurito, otalgia, tinnitus, plenitud, etc.) */
  symptoms: Record<string, boolean>;
  symptoms_other: string;
  /** Antecedentes respiratorios relevantes */
  respiratory: Record<string, boolean>;
  respiratory_other: string;
  /** Factores de riesgo asociados a OME (otitis media con efusión) */
  ome_risk: Record<string, boolean>;
  ome_risk_other: string;
  /** Factores predisponentes para otitis externa */
  oe_factors: Record<string, boolean>;
  oe_factors_other: string;
  /** Comorbilidades y condiciones de inmunocompromiso */
  comorbidities: Record<string, boolean>;
  comorbidities_other: string;
  /** Opciones terapéuticas seleccionadas */
  treatment: Record<string, boolean>;
  treatment_other: string;
}

/** Claves de grupo de checkboxes dentro de Anamnesis (Record<string,boolean>). */
export type AnamnesisGroupId =
  | "symptoms"
  | "respiratory"
  | "ome_risk"
  | "oe_factors"
  | "comorbidities"
  | "treatment";

export interface AnamnesisGroup {
  /** id del grupo (también campo Record en Anamnesis) */
  id: AnamnesisGroupId;
  /** campo de texto libre "otros" asociado en Anamnesis */
  other: keyof Anamnesis & string;
  /** claves de opciones; se traducen vía report.anamnesis.{id}.{key} */
  options: string[];
}

/** Catálogo de grupos y sus opciones. Ampliable agregando claves + i18n. */
export const ANAMNESIS_GROUPS: AnamnesisGroup[] = [
  {
    id: "symptoms",
    other: "symptoms_other",
    options: ["pruritus", "otalgia", "tinnitus", "fullness", "hypoacusis", "otorrhea", "vertigo"],
  },
  {
    id: "respiratory",
    other: "respiratory_other",
    options: ["allergic_rhinitis", "chronic_sinusitis", "asthma", "adenoid_hypertrophy", "recurrent_uri", "nasal_polyps"],
  },
  {
    id: "ome_risk",
    other: "ome_risk_other",
    options: ["daycare", "tobacco_smoke", "bottle_feeding", "allergies", "family_history", "craniofacial_anomaly", "gerd"],
  },
  {
    id: "oe_factors",
    other: "oe_factors_other",
    options: ["swimming", "humidity", "local_trauma", "hearing_aids", "dermatitis", "cerumen_absence", "narrow_canal"],
  },
  {
    id: "comorbidities",
    other: "comorbidities_other",
    options: ["diabetes", "immunosuppression", "hiv", "chemotherapy", "chronic_corticosteroids", "radiotherapy"],
  },
  {
    id: "treatment",
    other: "treatment_other",
    options: ["observation", "topical_antibiotic", "oral_antibiotic", "topical_corticosteroid", "analgesia", "ear_cleaning", "ent_referral", "audiometry"],
  },
];

export function createEmptyAnamnesis(): Anamnesis {
  return {
    symptoms: {},
    symptoms_other: "",
    respiratory: {},
    respiratory_other: "",
    ome_risk: {},
    ome_risk_other: "",
    oe_factors: {},
    oe_factors_other: "",
    comorbidities: {},
    comorbidities_other: "",
    treatment: {},
    treatment_other: "",
  };
}

/** Normaliza un anamnesis posiblemente nulo/parcial (reportes antiguos). */
export function normalizeAnamnesis(a?: Anamnesis | null): Anamnesis {
  return { ...createEmptyAnamnesis(), ...(a ?? {}) };
}

/** ¿Tiene algún ítem marcado o texto en "otros"? */
export function hasAnamnesisContent(a?: Anamnesis | null): boolean {
  if (!a) return false;
  for (const g of ANAMNESIS_GROUPS) {
    const rec = a[g.id] as Record<string, boolean> | undefined;
    if (rec && Object.values(rec).some(Boolean)) return true;
    const other = a[g.other] as string | undefined;
    if (other && other.trim()) return true;
  }
  return false;
}
