import type { LayerState } from "@/types/animation";
import { LayerRenderer } from "./LayerRenderer";

interface AnimationRendererProps {
  layers: LayerState[];
  width: number;
  height: number;
  time: number;
  className?: string;
}

export function AnimationRenderer({
  layers,
  width,
  height,
  time,
  className,
}: AnimationRendererProps) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ width: "100%", maxWidth: width }}
    >
      {layers.map((layer) => (
        <LayerRenderer
          key={layer.id}
          layer={layer}
          canvasWidth={width}
          canvasHeight={height}
          time={time}
        />
      ))}
    </svg>
  );
}
