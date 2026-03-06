export enum AnnotationType {
  Arrow = "arrow",
  Text = "text",
  Circle = "circle",
  Cross = "cross",
  Dot = "dot",
}

export type FrameShape = "circle" | "square" | "rectangle";

export type EditorTool = AnnotationType | "eraser" | "rotate" | "tympanic-map" | "pan" | "pointer";

export interface TympanicReference {
  umbo: { x: number; y: number };
  shortProcess: { x: number; y: number };
  annulusPoints: [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ];
  showOverlay: boolean;
}

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

export interface ViewportData {
  zoom: number;
  panX: number;
  panY: number;
}

export interface ImageAdjustments {
  brightness: number;
  contrast: number;
  saturate: number;
  temperature: number;
  clahe: boolean;
  claheClipLimit: number;
  invert: boolean;
  sharpen: number;
}
