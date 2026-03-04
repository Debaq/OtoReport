export enum AnnotationType {
  Arrow = "arrow",
  Text = "text",
  Circle = "circle",
  Cross = "cross",
  Dot = "dot",
}

export type EditorTool = AnnotationType | "eraser" | "crop-rect" | "crop-circle" | "rotate";

export interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  text?: string;
}

export interface CropData {
  start: { x: number; y: number };
  end: { x: number; y: number };
  type: "crop-rect" | "crop-circle";
  background?: "black" | "white" | "transparent";
}
