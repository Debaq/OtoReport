import type { Annotation, FrameShape, TympanicReference, ViewportData, ImageAdjustments } from "./annotation";

export type EarSide = "left" | "right" | "pre_left" | "pre_right" | "post_left" | "post_right";

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
  frameShape?: FrameShape | null;
  background?: "black" | "white" | "transparent";
  tympanicRef?: TympanicReference | null;
  viewport?: ViewportData | null;
  adjustments?: ImageAdjustments | null;
}
