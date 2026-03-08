import { v4 as uuidv4 } from "uuid";
import type { AnimationDefinition, AnimationLayer, LayerTransform, MedicalEffectType } from "@/types/animation";
import { createDefaultClipShape } from "./clip-shapes";

/** Valores por defecto de transform */
export const DEFAULT_TRANSFORM: LayerTransform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  anchorX: 0.5,
  anchorY: 0.5,
};

/** Crea una definicion de animacion vacia */
export function createEmptyAnimation(
  name: string,
  width = 600,
  height = 400,
): AnimationDefinition {
  return {
    version: 1,
    name,
    duration: 5,
    fps: 30,
    width,
    height,
    loop: false,
    layers: [
      createDefaultLayer("background", uuidv4(), "Fondo", width, height),
    ],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

/** Configs por defecto para cada tipo de efecto médico */
export const DEFAULT_EFFECT_CONFIGS: Record<MedicalEffectType, Record<string, unknown>> = {
  "fluid-level": {
    color: "rgba(116,185,255,0.4)",
    level: 0.4,
    waveAmplitude: 5,
    waveSpeed: 2,
    bubbles: 3,
  },
  perforation: {
    cx: 200,
    cy: 180,
    rx: 20,
    ry: 15,
    edgeColor: "#8b7355",
  },
  cholesteatoma: {
    cx: 200,
    cy: 150,
    size: 30,
    color: "#e8d5b7",
    lobes: 5,
  },
  "wind-lines": {
    cx: 200,
    cy: 150,
    radius: 50,
    lineCount: 6,
    color: "rgba(255,255,255,0.6)",
    speed: 3,
  },
  bacteria: {
    color: "#8bc34a",
    count: 6,
    areaX: 50,
    areaY: 50,
    areaW: 300,
    areaH: 200,
    seed: 42,
  },
  inflammation: {
    cx: 200,
    cy: 150,
    radius: 80,
    intensity: 0.5,
    vessels: 5,
  },
  calcification: {
    patches: [
      { cx: 150, cy: 170, rx: 12, ry: 10 },
      { cx: 220, cy: 130, rx: 10, ry: 8 },
      { cx: 180, cy: 190, rx: 8, ry: 6 },
    ],
  },
  "custom-path": {},
};

/** Crea una capa por defecto */
export function createDefaultLayer(
  type: AnimationLayer["type"],
  id: string,
  name: string,
  canvasWidth = 600,
  canvasHeight = 400,
): AnimationLayer {
  const base: AnimationLayer = {
    id,
    name,
    type,
    visible: true,
    locked: false,
    zIndex: 0,
    transform: { ...DEFAULT_TRANSFORM },
    opacity: 1,
    tracks: [],
  };

  if (type === "background") {
    base.backgroundColor = "#1a1a2e";
    base.opacity = 1;
  } else if (type === "svg-effect") {
    base.effectType = "inflammation";
    base.effectConfig = { ...DEFAULT_EFFECT_CONFIGS["inflammation"] };
    base.effectClip = createDefaultClipShape("ellipse", canvasWidth, canvasHeight);
  } else if (type === "svg-shape") {
    base.svgType = "ellipse";
    base.svgProps = { cx: canvasWidth / 2, cy: canvasHeight / 2, rx: 60, ry: 50 };
    base.fill = "#f5deb3";
    base.stroke = "#c4a46c";
    base.strokeWidth = 2;
  } else if (type === "mesh-deformable") {
    base.meshGrid = { cols: 4, rows: 4 };
  }

  return base;
}

/** Valida una definicion de animacion */
export function validateAnimation(
  data: unknown,
): { ok: true; animation: AnimationDefinition } | { ok: false; error: string } {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Datos invalidos" };
  }

  const d = data as Record<string, unknown>;

  if (d.version !== 1) {
    return { ok: false, error: `Version no soportada: ${d.version}` };
  }
  if (typeof d.name !== "string" || d.name.length === 0) {
    return { ok: false, error: "Nombre requerido" };
  }
  if (typeof d.duration !== "number" || d.duration <= 0) {
    return { ok: false, error: "Duracion debe ser > 0" };
  }
  if (typeof d.width !== "number" || typeof d.height !== "number") {
    return { ok: false, error: "Ancho y alto requeridos" };
  }
  if (!Array.isArray(d.layers)) {
    return { ok: false, error: "Layers debe ser un array" };
  }

  // Validar cada capa
  for (let i = 0; i < d.layers.length; i++) {
    const layer = d.layers[i] as Record<string, unknown>;
    if (!layer.id || !layer.name || !layer.type) {
      return { ok: false, error: `Capa ${i}: id, name y type requeridos` };
    }
    const validTypes = ["background", "image", "svg-shape", "svg-effect", "mesh-deformable"];
    if (!validTypes.includes(layer.type as string)) {
      return { ok: false, error: `Capa ${i}: type invalido "${layer.type}"` };
    }
  }

  return { ok: true, animation: data as AnimationDefinition };
}

/** Serializa una animacion a JSON */
export function serializeAnimation(animation: AnimationDefinition): string {
  const updated = {
    ...animation,
    metadata: {
      ...animation.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
  return JSON.stringify(updated, null, 2);
}

/** Parsea JSON a AnimationDefinition */
export function parseAnimation(
  json: string,
): { ok: true; animation: AnimationDefinition } | { ok: false; error: string } {
  try {
    const data = JSON.parse(json);
    return validateAnimation(data);
  } catch (e) {
    return { ok: false, error: `JSON invalido: ${e}` };
  }
}

/** Descubre animaciones disponibles en /edu/animations/ */
export async function discoverAnimations(): Promise<string[]> {
  try {
    const response = await fetch("/edu/animations/index.json");
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Carga una animacion desde un archivo */
export async function loadAnimation(
  path: string,
): Promise<{ ok: true; animation: AnimationDefinition } | { ok: false; error: string }> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      return { ok: false, error: `Error cargando ${path}: ${response.status}` };
    }
    const json = await response.text();
    return parseAnimation(json);
  } catch (e) {
    return { ok: false, error: `Error cargando animacion: ${e}` };
  }
}
