import type { Annotation, CropData } from "./annotation";

export type EarSide = "left" | "right";

export interface EarImage {
  id: string;
  filename: string;
  thumbnail: string;
  source: "camera" | "file";
  selected: boolean;
  primary: boolean;
  sort_order: number;
  rotation: number;
  notes: string;
  annotations: Annotation[];
  crop?: CropData | null;
}
