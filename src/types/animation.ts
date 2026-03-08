/** Punto de control Bezier para deformacion mesh */
export interface BezierControlPoint {
  x: number; // 0-1 normalizado
  y: number;
  handleIn: { x: number; y: number }; // relativo al punto
  handleOut: { x: number; y: number };
}

/** Tipos de interpolacion */
export type EasingType =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "cubic-bezier"
  | "step";

export interface EasingConfig {
  type: EasingType;
  bezier?: [number, number, number, number]; // solo para cubic-bezier
}

/** Valor posible de un keyframe */
export type KeyframeValue =
  | number
  | string
  | number[]
  | BezierControlPoint[];

/** Un keyframe individual */
export interface Keyframe {
  time: number; // segundos
  value: KeyframeValue;
  easing: EasingConfig;
}

/** Track de animacion: una propiedad animable */
export interface AnimationTrack {
  property: string; // "opacity", "x", "y", "scaleX", "scaleY", "rotation", "fill", "meshPoints", "pathD", "level", etc.
  keyframes: Keyframe[];
}

/** Tipos de capa */
export type LayerType = "background" | "image" | "svg-shape" | "svg-effect" | "mesh-deformable";

/** Tipos de efecto SVG medico */
export type MedicalEffectType =
  | "fluid-level"
  | "perforation"
  | "cholesteatoma"
  | "wind-lines"
  | "bacteria"
  | "inflammation"
  | "calcification"
  | "custom-path";

/** Tipos de forma SVG */
export type SvgShapeType = "ellipse" | "rect" | "path" | "circle" | "polygon" | "line";

/** Tipos de forma para clip de efectos */
export type ClipShapeType = "ellipse" | "rect" | "circle" | "polygon";

/** Forma que delimita el area de un efecto */
export interface EffectClipShape {
  type: ClipShapeType;
  /** Vertices/puntos de control de la forma (coordenadas absolutas px) */
  points: { x: number; y: number }[];
}


/** Transform de una capa */
export interface LayerTransform {
  x: number; // px
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number; // grados
  anchorX: number; // 0-1
  anchorY: number;
}

/** Definicion de una capa */
export interface AnimationLayer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  zIndex: number;

  // Para type "background"
  backgroundColor?: string;

  // Para type "image"
  imageSrc?: string; // ruta relativa desde /edu/

  // Para type "svg-shape"
  svgType?: SvgShapeType;
  svgProps?: Record<string, string | number>;
  /** Puntos para polygon/path (se generan a points/d automáticamente) */
  shapePoints?: { x: number; y: number }[];

  // Para type "svg-effect"
  effectType?: MedicalEffectType;
  effectConfig?: Record<string, unknown>;
  effectClip?: EffectClipShape;

  // Para type "mesh-deformable"
  meshGrid?: { cols: number; rows: number };
  meshPoints?: BezierControlPoint[];
  meshImageSrc?: string;

  // Rango de visibilidad temporal
  startTime?: number; // segundos, default 0
  endTime?: number;   // segundos, default = duration de la animación

  // Propiedades base
  transform: LayerTransform;
  opacity: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;

  // Tracks de animacion
  tracks: AnimationTrack[];
}

/** Definicion completa de una animacion */
export interface AnimationDefinition {
  version: 1;
  name: string;
  description?: string;
  duration: number; // segundos
  fps: number;
  width: number;
  height: number;
  loop: boolean;
  layers: AnimationLayer[];
  metadata?: {
    author?: string;
    createdAt?: string;
    updatedAt?: string;
    tags?: string[];
  };
}

/** Estado calculado de una capa en un instante T */
export interface LayerState {
  id: string;
  type: LayerType;
  visible: boolean;
  transform: LayerTransform;
  opacity: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;

  backgroundColor?: string;
  imageSrc?: string;
  svgType?: SvgShapeType;
  svgProps?: Record<string, string | number>;
  shapePoints?: { x: number; y: number }[];
  effectType?: MedicalEffectType;
  effectConfig?: Record<string, unknown>;
  effectClip?: EffectClipShape;
  meshPoints?: BezierControlPoint[];
  meshImageSrc?: string;
  meshGrid?: { cols: number; rows: number };

  // Propiedades animadas calculadas
  animatedProps: Record<string, KeyframeValue>;
}
