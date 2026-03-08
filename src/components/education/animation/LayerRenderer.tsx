import type { LayerState } from "@/types/animation";
import { buildSvgTransform } from "@/lib/animation/animation-engine";
import { resolveImageSrc } from "@/lib/animation/resolve-src";
import { EffectRenderer } from "./EffectRenderer";
import { MeshRenderer } from "./MeshRenderer";

interface LayerRendererProps {
  layer: LayerState;
  canvasWidth: number;
  canvasHeight: number;
  time: number;
}

function BackgroundLayer({ layer, canvasWidth, canvasHeight }: Omit<LayerRendererProps, "time">) {
  return (
    <rect
      x={0}
      y={0}
      width={canvasWidth}
      height={canvasHeight}
      fill={layer.backgroundColor ?? "#1a1a2e"}
      opacity={layer.opacity}
    />
  );
}

function ImageLayer({ layer, canvasWidth, canvasHeight }: Omit<LayerRendererProps, "time">) {
  if (!layer.imageSrc) return null;
  const transform = buildSvgTransform(layer.transform, canvasWidth, canvasHeight);

  return (
    <g transform={transform} opacity={layer.opacity}>
      <image
        href={resolveImageSrc(layer.imageSrc)}
        x={0}
        y={0}
        width={canvasWidth}
        height={canvasHeight}
        preserveAspectRatio="xMidYMid meet"
      />
    </g>
  );
}

function pointsToPolygonStr(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

function pointsToPathD(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function SvgShapeLayer({ layer }: Omit<LayerRendererProps, "time" | "canvasWidth" | "canvasHeight">) {
  const transform = buildSvgTransform(layer.transform);
  const baseProps = {
    fill: layer.fill ?? "none",
    stroke: layer.stroke ?? "none",
    strokeWidth: layer.strokeWidth ?? 1,
    opacity: layer.opacity,
    transform,
  };

  switch (layer.svgType) {
    case "ellipse":
      return <ellipse {...baseProps} {...(layer.svgProps as React.SVGProps<SVGEllipseElement>)} />;
    case "rect":
      return <rect {...baseProps} {...(layer.svgProps as React.SVGProps<SVGRectElement>)} />;
    case "circle":
      return <circle {...baseProps} {...(layer.svgProps as React.SVGProps<SVGCircleElement>)} />;
    case "line":
      return <line {...baseProps} {...(layer.svgProps as React.SVGProps<SVGLineElement>)} />;
    case "polygon": {
      const pts = layer.shapePoints;
      if (!pts || pts.length < 3) return null;
      return <polygon {...baseProps} points={pointsToPolygonStr(pts)} />;
    }
    case "path": {
      const pts = layer.shapePoints;
      if (!pts || pts.length < 2) return null;
      return <path {...baseProps} d={pointsToPathD(pts)} />;
    }
    default:
      return null;
  }
}

export function LayerRenderer({
  layer,
  canvasWidth,
  canvasHeight,
  time,
}: LayerRendererProps) {
  if (!layer.visible) return null;

  switch (layer.type) {
    case "background":
      return (
        <BackgroundLayer
          layer={layer}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />
      );
    case "image":
      return (
        <ImageLayer
          layer={layer}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />
      );
    case "svg-shape":
      return <SvgShapeLayer layer={layer} />;
    case "svg-effect":
      return (
        <EffectRenderer
          layer={layer}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          time={time}
        />
      );
    case "mesh-deformable":
      return (
        <MeshRenderer
          layer={layer}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />
      );
    default:
      return null;
  }
}
