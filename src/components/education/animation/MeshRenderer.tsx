import { useMemo } from "react";
import type { LayerState, BezierControlPoint } from "@/types/animation";
import { generateMeshPaths, createUniformGrid } from "@/lib/animation/mesh-warp";
import { resolveImageSrc } from "@/lib/animation/resolve-src";

interface MeshRendererProps {
  layer: LayerState;
  canvasWidth: number;
  canvasHeight: number;
}

export function MeshRenderer({
  layer,
  canvasWidth,
  canvasHeight,
}: MeshRendererProps) {
  const cols = layer.meshGrid?.cols ?? 4;
  const rows = layer.meshGrid?.rows ?? 4;

  const points: BezierControlPoint[] = useMemo(() => {
    // Usar puntos animados si existen, sino los de la capa, sino grid uniforme
    const animated = layer.animatedProps.meshPoints as BezierControlPoint[] | undefined;
    if (animated && animated.length > 0) return animated;
    if (layer.meshPoints && layer.meshPoints.length > 0) return layer.meshPoints;
    return createUniformGrid(cols, rows, canvasWidth, canvasHeight);
  }, [layer.animatedProps.meshPoints, layer.meshPoints, cols, rows, canvasWidth, canvasHeight]);

  const paths = useMemo(
    () => generateMeshPaths(points, cols, rows),
    [points, cols, rows],
  );

  if (!layer.meshImageSrc) return null;

  const clipIds = useMemo(
    () => paths.map((_, i) => `mesh-clip-${layer.id}-${i}`),
    [paths, layer.id],
  );

  return (
    <g opacity={layer.opacity}>
      <defs>
        {paths.map((d, i) => (
          <clipPath key={clipIds[i]} id={clipIds[i]}>
            <path d={d} />
          </clipPath>
        ))}
      </defs>

      {paths.map((_, i) => (
        <g key={i} clipPath={`url(#${clipIds[i]})`}>
          <image
            href={resolveImageSrc(layer.meshImageSrc!)}
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            preserveAspectRatio="none"
          />
        </g>
      ))}
    </g>
  );
}
