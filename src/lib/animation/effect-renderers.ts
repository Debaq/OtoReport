import type { MedicalEffectType, KeyframeValue } from "@/types/animation";

/** Configuracion base de un efecto para renderizar */
export interface EffectRenderConfig {
  effectType: MedicalEffectType;
  effectConfig: Record<string, unknown>;
  animatedProps: Record<string, KeyframeValue>;
  width: number;
  height: number;
  time: number;
}

/** Estructura de un elemento SVG generado por un efecto */
export interface SvgElement {
  tag: string;
  props: Record<string, string | number>;
  children?: SvgElement[];
  text?: string;
}

// --- Efecto: Nivel de fluido ---
export function renderFluidLevel(config: EffectRenderConfig): SvgElement[] {
  const level = (config.animatedProps.level as number) ?? (config.effectConfig.level as number) ?? 0.5;
  const color = (config.animatedProps.color as string) ?? (config.effectConfig.color as string) ?? "rgba(116,185,255,0.4)";
  const waveAmplitude = (config.effectConfig.waveAmplitude as number) ?? 5;
  const waveSpeed = (config.effectConfig.waveSpeed as number) ?? 2;

  const fluidY = config.height * (1 - level);
  const waveOffset = Math.sin(config.time * waveSpeed) * waveAmplitude;
  const waveOffset2 = Math.cos(config.time * waveSpeed * 1.3) * waveAmplitude * 0.7;

  const w = config.width;

  const wavePath = `M 0 ${fluidY + waveOffset} Q ${w * 0.25} ${fluidY + waveOffset2} ${w * 0.5} ${fluidY + waveOffset} Q ${w * 0.75} ${fluidY - waveOffset2} ${w} ${fluidY + waveOffset} L ${w} ${config.height} L 0 ${config.height} Z`;

  const elements: SvgElement[] = [
    {
      tag: "path",
      props: {
        d: wavePath,
        fill: color,
        opacity: 0.6,
      },
    },
  ];

  // Burbujas
  const bubbleCount = (config.effectConfig.bubbles as number) ?? 3;
  for (let i = 0; i < bubbleCount; i++) {
    const bx = w * (0.2 + (i * 0.3));
    const baseY = fluidY + (config.height - fluidY) * 0.3;
    const by = baseY + Math.sin(config.time * (1.5 + i * 0.5)) * 10;
    elements.push({
      tag: "circle",
      props: {
        cx: bx,
        cy: by,
        r: 2 + i * 0.5,
        fill: "rgba(255,255,255,0.3)",
        opacity: 0.5 + Math.sin(config.time * 2 + i) * 0.3,
      },
    });
  }

  return elements;
}

// --- Efecto: Perforacion ---
export function renderPerforation(config: EffectRenderConfig): SvgElement[] {
  const cx = (config.animatedProps.cx as number) ?? (config.effectConfig.cx as number) ?? config.width * 0.4;
  const cy = (config.animatedProps.cy as number) ?? (config.effectConfig.cy as number) ?? config.height * 0.6;
  const rx = (config.animatedProps.rx as number) ?? (config.effectConfig.rx as number) ?? 20;
  const ry = (config.animatedProps.ry as number) ?? (config.effectConfig.ry as number) ?? 15;
  const edgeColor = (config.effectConfig.edgeColor as string) ?? "#8b7355";

  return [
    {
      tag: "ellipse",
      props: {
        cx,
        cy,
        rx: rx + 2,
        ry: ry + 2,
        fill: edgeColor,
        opacity: 0.5,
      },
    },
    {
      tag: "ellipse",
      props: {
        cx,
        cy,
        rx,
        ry,
        fill: "#1a1210",
        stroke: edgeColor,
        "stroke-width": 1,
      },
    },
  ];
}

// --- Efecto: Colesteatoma ---
export function renderCholesteatoma(config: EffectRenderConfig): SvgElement[] {
  const cx = (config.animatedProps.cx as number) ?? (config.effectConfig.cx as number) ?? config.width * 0.5;
  const cy = (config.animatedProps.cy as number) ?? (config.effectConfig.cy as number) ?? config.height * 0.4;
  const size = (config.animatedProps.size as number) ?? (config.effectConfig.size as number) ?? 30;
  const color = (config.effectConfig.color as string) ?? "#e8d5b7";
  const lobes = (config.effectConfig.lobes as number) ?? 5;

  const elements: SvgElement[] = [];

  // Masa principal con lobulos
  for (let i = 0; i < lobes; i++) {
    const angle = (i / lobes) * Math.PI * 2 + config.time * 0.2;
    const lx = cx + Math.cos(angle) * size * 0.4;
    const ly = cy + Math.sin(angle) * size * 0.35;
    const lr = size * (0.4 + Math.sin(config.time * 0.5 + i) * 0.05);
    elements.push({
      tag: "ellipse",
      props: {
        cx: lx,
        cy: ly,
        rx: lr,
        ry: lr * 0.85,
        fill: color,
        opacity: 0.7,
        stroke: "#c4a46c",
        "stroke-width": 0.5,
      },
    });
  }

  // Nucleo
  elements.push({
    tag: "ellipse",
    props: {
      cx,
      cy,
      rx: size * 0.5,
      ry: size * 0.45,
      fill: color,
      opacity: 0.9,
      stroke: "#b8960a",
      "stroke-width": 1,
    },
  });

  return elements;
}

// --- Efecto: Lineas de viento ---
export function renderWindLines(config: EffectRenderConfig): SvgElement[] {
  const cx = (config.animatedProps.cx as number) ?? (config.effectConfig.cx as number) ?? config.width * 0.5;
  const cy = (config.animatedProps.cy as number) ?? (config.effectConfig.cy as number) ?? config.height * 0.5;
  const radius = (config.animatedProps.radius as number) ?? (config.effectConfig.radius as number) ?? 40;
  const lineCount = (config.effectConfig.lineCount as number) ?? 6;
  const color = (config.effectConfig.color as string) ?? "rgba(255,255,255,0.6)";
  const speed = (config.effectConfig.speed as number) ?? 3;

  const elements: SvgElement[] = [];
  const baseAngle = config.time * speed;

  for (let i = 0; i < lineCount; i++) {
    const angle = baseAngle + (i / lineCount) * Math.PI * 2;
    const innerR = radius * 0.3;
    const outerR = radius * (0.7 + Math.sin(config.time * 2 + i) * 0.15);

    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = cy + Math.sin(angle) * innerR;
    const x2 = cx + Math.cos(angle) * outerR;
    const y2 = cy + Math.sin(angle) * outerR;

    // Curva
    const ctrlAngle = angle + 0.3;
    const ctrlR = (innerR + outerR) * 0.55;
    const ctrlX = cx + Math.cos(ctrlAngle) * ctrlR;
    const ctrlY = cy + Math.sin(ctrlAngle) * ctrlR;

    elements.push({
      tag: "path",
      props: {
        d: `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`,
        fill: "none",
        stroke: color,
        "stroke-width": 1.5,
        "stroke-linecap": "round",
        opacity: 0.4 + Math.sin(config.time * 3 + i * 1.2) * 0.3,
      },
    });
  }

  return elements;
}

// --- Efecto: Bacterias ---
export function renderBacteria(config: EffectRenderConfig): SvgElement[] {
  const count = (config.animatedProps.count as number) ?? (config.effectConfig.count as number) ?? 8;
  const color = (config.effectConfig.color as string) ?? "#8bc34a";
  const areaX = (config.effectConfig.areaX as number) ?? 0;
  const areaY = (config.effectConfig.areaY as number) ?? 0;
  const areaW = (config.effectConfig.areaW as number) ?? config.width;
  const areaH = (config.effectConfig.areaH as number) ?? config.height;
  const seed = (config.effectConfig.seed as number) ?? 42;

  const elements: SvgElement[] = [];

  // Pseudoaleatorio reproducible
  const rng = (i: number) => {
    const x = Math.sin(seed * 9301 + i * 49297 + 233280) * 49297;
    return x - Math.floor(x);
  };

  for (let i = 0; i < Math.floor(count); i++) {
    const bx = areaX + rng(i * 3) * areaW + Math.sin(config.time * (0.5 + rng(i * 3 + 1)) + i) * 5;
    const by = areaY + rng(i * 3 + 2) * areaH + Math.cos(config.time * (0.4 + rng(i * 3 + 3)) + i) * 5;
    const size = 3 + rng(i * 3 + 4) * 3;
    const rot = config.time * (20 + rng(i * 3 + 5) * 40) + i * 60;

    // Forma de bacteria (capsula o coco)
    const isCoccus = rng(i * 3 + 6) > 0.5;

    if (isCoccus) {
      elements.push({
        tag: "circle",
        props: {
          cx: bx,
          cy: by,
          r: size * 0.5,
          fill: color,
          opacity: 0.7,
          stroke: color,
          "stroke-width": 0.3,
        },
      });
    } else {
      elements.push({
        tag: "ellipse",
        props: {
          cx: bx,
          cy: by,
          rx: size,
          ry: size * 0.35,
          fill: color,
          opacity: 0.7,
          stroke: color,
          "stroke-width": 0.3,
          transform: `rotate(${rot}, ${bx}, ${by})`,
        },
      });
      // Flagelos
      const fx = bx + Math.cos((rot * Math.PI) / 180) * size;
      const fy = by + Math.sin((rot * Math.PI) / 180) * size;
      const fWave = Math.sin(config.time * 8 + i) * 3;
      elements.push({
        tag: "path",
        props: {
          d: `M ${fx} ${fy} q ${fWave} ${-size * 0.5} ${fWave * 0.5} ${-size}`,
          fill: "none",
          stroke: color,
          "stroke-width": 0.5,
          opacity: 0.5,
        },
      });
    }
  }

  return elements;
}

// --- Efecto: Inflamacion ---
export function renderInflammation(config: EffectRenderConfig): SvgElement[] {
  const cx = (config.animatedProps.cx as number) ?? (config.effectConfig.cx as number) ?? config.width * 0.5;
  const cy = (config.animatedProps.cy as number) ?? (config.effectConfig.cy as number) ?? config.height * 0.5;
  const radius = (config.animatedProps.radius as number) ?? (config.effectConfig.radius as number) ?? 50;
  const intensity = (config.animatedProps.intensity as number) ?? (config.effectConfig.intensity as number) ?? 0.5;
  const vesselCount = (config.effectConfig.vessels as number) ?? 4;

  const elements: SvgElement[] = [];

  // Enrojecimiento radial
  const pulse = intensity * (0.8 + Math.sin(config.time * 2) * 0.2);
  elements.push({
    tag: "circle",
    props: {
      cx,
      cy,
      r: radius,
      fill: `rgba(255,80,80,${pulse * 0.3})`,
      opacity: 1,
    },
  });

  // Vasos sanguineos
  for (let i = 0; i < vesselCount; i++) {
    const angle = (i / vesselCount) * Math.PI * 2;
    const x1 = cx + Math.cos(angle) * radius * 0.3;
    const y1 = cy + Math.sin(angle) * radius * 0.3;
    const x2 = cx + Math.cos(angle) * radius * 0.9;
    const y2 = cy + Math.sin(angle) * radius * 0.9;
    const cp1x = cx + Math.cos(angle + 0.2) * radius * 0.6;
    const cp1y = cy + Math.sin(angle + 0.2) * radius * 0.6;

    elements.push({
      tag: "path",
      props: {
        d: `M ${x1} ${y1} Q ${cp1x} ${cp1y} ${x2} ${y2}`,
        fill: "none",
        stroke: `rgba(255,80,80,${intensity * 0.6})`,
        "stroke-width": 0.8 + pulse * 0.5,
        "stroke-linecap": "round",
      },
    });
  }

  return elements;
}

// --- Efecto: Calcificacion ---
export function renderCalcification(config: EffectRenderConfig): SvgElement[] {
  const patches = (config.effectConfig.patches as Array<{ cx: number; cy: number; rx: number; ry: number }>) ?? [
    { cx: config.width * 0.35, cy: config.height * 0.55, rx: 12, ry: 10 },
    { cx: config.width * 0.6, cy: config.height * 0.4, rx: 10, ry: 8 },
    { cx: config.width * 0.5, cy: config.height * 0.65, rx: 8, ry: 6 },
  ];
  const opacity = (config.animatedProps.opacity as number) ?? 0.7;

  return patches.map((p, i) => ({
    tag: "ellipse",
    props: {
      cx: p.cx,
      cy: p.cy,
      rx: p.rx,
      ry: p.ry,
      fill: "rgba(255,255,255,0.8)",
      stroke: "#ccc",
      "stroke-width": 0.5,
      opacity: opacity * (0.6 + i * 0.15),
    },
  }));
}

/** Mapa de renderizadores por tipo de efecto */
const EFFECT_RENDERERS: Record<
  MedicalEffectType,
  (config: EffectRenderConfig) => SvgElement[]
> = {
  "fluid-level": renderFluidLevel,
  perforation: renderPerforation,
  cholesteatoma: renderCholesteatoma,
  "wind-lines": renderWindLines,
  bacteria: renderBacteria,
  inflammation: renderInflammation,
  calcification: renderCalcification,
  "custom-path": () => [],
};

/** Renderiza un efecto medico dado su tipo y configuracion */
export function renderEffect(config: EffectRenderConfig): SvgElement[] {
  const renderer = EFFECT_RENDERERS[config.effectType];
  if (!renderer) return [];
  return renderer(config);
}
