export enum FindingType {
  Normal = "normal",
  Retraction = "retraction",
  Perforation = "perforation",
  Effusion = "effusion",
  Tympanoslerosis = "tympanosclerosis",
  Cholesteatoma = "cholesteatoma",
  Inflammation = "inflammation",
  Cerumen = "cerumen",
  ForeignBody = "foreign_body",
  Tube = "tube",
  Myringitis = "myringitis",
  Neomembrane = "neomembrane",
}

export enum QuadrantName {
  AnteriorSuperior = "anterior_superior",
  AnteriorInferior = "anterior_inferior",
  PosteriorSuperior = "posterior_superior",
  PosteriorInferior = "posterior_inferior",
  ParsFlaccida = "pars_flaccida",
}

export interface QuadrantMark {
  quadrant: QuadrantName;
  finding: FindingType;
}

export interface EarMarks {
  marks: QuadrantMark[];
}

/** Otoscopía neumática: movilidad de la membrana timpánica bajo insuflación. */
export type PneumaticMobility = "normal" | "reduced" | "absent";

export const PNEUMATIC_MOBILITY_OPTIONS: PneumaticMobility[] = ["normal", "reduced", "absent"];

export interface PneumaticOtoscopy {
  /** "" = no evaluada */
  mobility: PneumaticMobility | "";
  notes: string;
}

export function createEmptyPneumatic(): PneumaticOtoscopy {
  return { mobility: "", notes: "" };
}

export type EarFindings = Record<string, boolean>;

export const DEFAULT_EAR_FINDINGS: EarFindings = {
  normal: true,
  retraction: false,
  perforation: false,
  effusion: false,
  inflammation: false,
  cae_normal: true,
  cae_cerumen: false,
  cae_edema: false,
  cae_otorrhea: false,
  cae_exostosis: false,
};
