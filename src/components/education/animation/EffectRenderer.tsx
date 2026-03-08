import type { LayerState } from "@/types/animation";
import { renderEffect, type SvgElement } from "@/lib/animation/effect-renderers";
import { shapeToSvgPath, getShapeBounds } from "@/lib/animation/clip-shapes";

interface EffectRendererProps {
  layer: LayerState;
  canvasWidth: number;
  canvasHeight: number;
  time: number;
}

function SvgElementNode({ element }: { element: SvgElement }) {
  const { tag, props, children, text } = element;
  const Tag = tag as React.ElementType;

  return (
    <Tag {...(props as Record<string, unknown>)}>
      {text}
      {children?.map((child, i) => (
        <SvgElementNode key={i} element={child} />
      ))}
    </Tag>
  );
}

export function EffectRenderer({
  layer,
  canvasWidth,
  canvasHeight,
  time,
}: EffectRendererProps) {
  if (!layer.effectType) return null;

  const clip = layer.effectClip;
  const bounds = clip ? getShapeBounds(clip) : null;
  const clipPathId = `effect-clip-${layer.id}`;

  // El efecto se renderiza en espacio local (0,0 → w,h)
  // y luego se traslada al origen del bounding box del clip
  const w = bounds ? bounds.width : canvasWidth;
  const h = bounds ? bounds.height : canvasHeight;

  const localConfig: Record<string, unknown> = {
    ...(layer.effectConfig ?? {}),
    cx: w / 2,
    cy: h / 2,
    radius: Math.min(w, h) / 2,
    areaX: 0,
    areaY: 0,
    areaW: w,
    areaH: h,
  };

  const elements = renderEffect({
    effectType: layer.effectType,
    effectConfig: localConfig,
    animatedProps: layer.animatedProps,
    width: w,
    height: h,
    time,
  });

  if (elements.length === 0) return null;

  const offsetX = bounds ? bounds.x : 0;
  const offsetY = bounds ? bounds.y : 0;

  return (
    <g opacity={layer.opacity}>
      {clip && (
        <defs>
          <clipPath id={clipPathId}>
            <path d={shapeToSvgPath(clip)} />
          </clipPath>
        </defs>
      )}

      <g clipPath={clip ? `url(#${clipPathId})` : undefined}>
        <g transform={`translate(${offsetX}, ${offsetY})`}>
          {elements.map((el, i) => (
            <SvgElementNode key={i} element={el} />
          ))}
        </g>
      </g>
    </g>
  );
}
