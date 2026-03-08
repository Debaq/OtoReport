import type {
  AnimationDefinition,
  AnimationLayer,
  LayerState,
  LayerTransform,
  KeyframeValue,
} from "@/types/animation";
import { evaluateTrack } from "./interpolation";

/** Propiedades de transform que se pueden animar */
const TRANSFORM_PROPS = new Set([
  "x",
  "y",
  "scaleX",
  "scaleY",
  "rotation",
  "anchorX",
  "anchorY",
]);

/** Calcula el estado de una capa en un instante T */
function computeLayerState(layer: AnimationLayer, time: number): LayerState {
  const transform: LayerTransform = { ...layer.transform };
  const animatedProps: Record<string, KeyframeValue> = {};

  let opacity = layer.opacity;
  let backgroundColor = layer.backgroundColor;
  let fill = layer.fill;
  let stroke = layer.stroke;
  let strokeWidth = layer.strokeWidth;

  for (const track of layer.tracks) {
    const value = evaluateTrack(track.keyframes, time);
    if (value === undefined) continue;

    animatedProps[track.property] = value;

    // Aplicar a transform
    if (TRANSFORM_PROPS.has(track.property) && typeof value === "number") {
      (transform as unknown as Record<string, number>)[track.property] = value;
    }
    // Aplicar a propiedades directas
    else if (track.property === "opacity" && typeof value === "number") {
      opacity = value;
    } else if (track.property === "backgroundColor" && typeof value === "string") {
      backgroundColor = value;
    } else if (track.property === "fill" && typeof value === "string") {
      fill = value;
    } else if (track.property === "stroke" && typeof value === "string") {
      stroke = value;
    } else if (track.property === "strokeWidth" && typeof value === "number") {
      strokeWidth = value;
    }
  }

  return {
    id: layer.id,
    type: layer.type,
    visible: layer.visible,
    transform,
    opacity,
    backgroundColor,
    fill,
    stroke,
    strokeWidth,
    imageSrc: layer.imageSrc,
    svgType: layer.svgType,
    svgProps: layer.svgProps ? { ...layer.svgProps } : undefined,
    shapePoints: layer.shapePoints,
    effectType: layer.effectType,
    effectConfig: layer.effectConfig
      ? { ...layer.effectConfig }
      : undefined,
    effectClip: layer.effectClip,
    meshPoints: layer.meshPoints,
    meshImageSrc: layer.meshImageSrc,
    meshGrid: layer.meshGrid,
    animatedProps,
  };
}

/** Calcula el estado de todas las capas en un instante T */
export function computeAnimationState(
  animation: AnimationDefinition,
  time: number,
): LayerState[] {
  const effectiveTime = animation.loop
    ? time % animation.duration
    : Math.min(time, animation.duration);

  return animation.layers
    .filter((l) => {
      if (!l.visible) return false;
      const start = l.startTime ?? 0;
      const end = l.endTime ?? animation.duration;
      return effectiveTime >= start && effectiveTime <= end;
    })
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((layer) => computeLayerState(layer, effectiveTime));
}

/** Genera la cadena transform SVG para una capa */
export function buildSvgTransform(
  transform: LayerTransform,
  layerWidth?: number,
  layerHeight?: number,
): string {
  const w = layerWidth ?? 0;
  const h = layerHeight ?? 0;
  const ax = transform.anchorX * w;
  const ay = transform.anchorY * h;

  const parts: string[] = [];
  parts.push(`translate(${transform.x}, ${transform.y})`);
  if (transform.rotation !== 0) {
    parts.push(`rotate(${transform.rotation}, ${ax}, ${ay})`);
  }
  if (transform.scaleX !== 1 || transform.scaleY !== 1) {
    parts.push(
      `translate(${ax}, ${ay}) scale(${transform.scaleX}, ${transform.scaleY}) translate(${-ax}, ${-ay})`,
    );
  }

  return parts.join(" ");
}
