import type { EffectClipShape, ClipShapeType } from "@/types/animation";

/** Bounding box de una forma */
export interface ShapeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

/** Calcula el bounding box de una clip shape */
export function getShapeBounds(shape: EffectClipShape): ShapeBounds {
  const pts = shape.points;
  if (pts.length === 0) return { x: 0, y: 0, width: 0, height: 0, cx: 0, cy: 0 };

  switch (shape.type) {
    case "ellipse": {
      // points: [center, radiusHandle]
      const [c, r] = pts;
      const rx = Math.abs(r.x - c.x);
      const ry = Math.abs(r.y - c.y);
      return { x: c.x - rx, y: c.y - ry, width: rx * 2, height: ry * 2, cx: c.x, cy: c.y };
    }
    case "circle": {
      // points: [center, radiusHandle]
      const [c, r] = pts;
      const rad = Math.sqrt((r.x - c.x) ** 2 + (r.y - c.y) ** 2);
      return { x: c.x - rad, y: c.y - rad, width: rad * 2, height: rad * 2, cx: c.x, cy: c.y };
    }
    case "rect": {
      // points: [topLeft, bottomRight]
      const [tl, br] = pts;
      const x = Math.min(tl.x, br.x);
      const y = Math.min(tl.y, br.y);
      const w = Math.abs(br.x - tl.x);
      const h = Math.abs(br.y - tl.y);
      return { x, y, width: w, height: h, cx: x + w / 2, cy: y + h / 2 };
    }
    case "polygon": {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      const w = maxX - minX;
      const h = maxY - minY;
      return { x: minX, y: minY, width: w, height: h, cx: minX + w / 2, cy: minY + h / 2 };
    }
  }
}

/** Genera el SVG path string para usar como clipPath */
export function shapeToSvgPath(shape: EffectClipShape): string {
  const pts = shape.points;

  switch (shape.type) {
    case "ellipse": {
      const [c, r] = pts;
      const rx = Math.abs(r.x - c.x);
      const ry = Math.abs(r.y - c.y);
      // Aproximacion de elipse con arcos
      return `M ${c.x - rx} ${c.y} A ${rx} ${ry} 0 1 1 ${c.x + rx} ${c.y} A ${rx} ${ry} 0 1 1 ${c.x - rx} ${c.y} Z`;
    }
    case "circle": {
      const [c, r] = pts;
      const rad = Math.sqrt((r.x - c.x) ** 2 + (r.y - c.y) ** 2);
      return `M ${c.x - rad} ${c.y} A ${rad} ${rad} 0 1 1 ${c.x + rad} ${c.y} A ${rad} ${rad} 0 1 1 ${c.x - rad} ${c.y} Z`;
    }
    case "rect": {
      const [tl, br] = pts;
      const x = Math.min(tl.x, br.x);
      const y = Math.min(tl.y, br.y);
      const w = Math.abs(br.x - tl.x);
      const h = Math.abs(br.y - tl.y);
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    }
    case "polygon": {
      if (pts.length < 3) return "";
      return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
    }
  }
}

/** Genera el elemento SVG React (para previsualizar la forma en el editor) */
export function shapeToSvgElement(shape: EffectClipShape): {
  tag: string;
  props: Record<string, string | number>;
} {
  const pts = shape.points;

  switch (shape.type) {
    case "ellipse": {
      const [c, r] = pts;
      return {
        tag: "ellipse",
        props: { cx: c.x, cy: c.y, rx: Math.abs(r.x - c.x), ry: Math.abs(r.y - c.y) },
      };
    }
    case "circle": {
      const [c, r] = pts;
      const rad = Math.sqrt((r.x - c.x) ** 2 + (r.y - c.y) ** 2);
      return { tag: "circle", props: { cx: c.x, cy: c.y, r: rad } };
    }
    case "rect": {
      const [tl, br] = pts;
      return {
        tag: "rect",
        props: {
          x: Math.min(tl.x, br.x),
          y: Math.min(tl.y, br.y),
          width: Math.abs(br.x - tl.x),
          height: Math.abs(br.y - tl.y),
        },
      };
    }
    case "polygon": {
      return {
        tag: "polygon",
        props: { points: pts.map((p) => `${p.x},${p.y}`).join(" ") },
      };
    }
  }
}

/** Crea una forma clip por defecto centrada en el canvas */
export function createDefaultClipShape(
  type: ClipShapeType,
  canvasWidth: number,
  canvasHeight: number,
): EffectClipShape {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const size = Math.min(canvasWidth, canvasHeight) * 0.3;

  switch (type) {
    case "ellipse":
      return {
        type: "ellipse",
        points: [
          { x: cx, y: cy },           // centro
          { x: cx + size, y: cy + size * 0.7 }, // handle radio
        ],
      };
    case "circle":
      return {
        type: "circle",
        points: [
          { x: cx, y: cy },           // centro
          { x: cx + size, y: cy },     // handle radio
        ],
      };
    case "rect":
      return {
        type: "rect",
        points: [
          { x: cx - size, y: cy - size * 0.7 },   // top-left
          { x: cx + size, y: cy + size * 0.7 },   // bottom-right
        ],
      };
    case "polygon":
      // Pentagono por defecto
      return {
        type: "polygon",
        points: Array.from({ length: 5 }, (_, i) => {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
          return {
            x: cx + Math.cos(angle) * size,
            y: cy + Math.sin(angle) * size,
          };
        }),
      };
  }
}
