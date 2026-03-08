import type {
  EasingConfig,
  KeyframeValue,
  Keyframe,
  BezierControlPoint,
} from "@/types/animation";

// --- Funciones de easing ---

function linear(t: number): number {
  return t;
}

function easeIn(t: number): number {
  return t * t * t;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function cubicBezier(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
): (t: number) => number {
  // Newton-Raphson para resolver t dado x, luego evaluar y
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x;
    for (let i = 0; i < 8; i++) {
      const cx =
        3 * p1x * (1 - t) * (1 - t) * t +
        3 * p2x * (1 - t) * t * t +
        t * t * t -
        x;
      if (Math.abs(cx) < 1e-6) break;
      const dx =
        3 * p1x * (1 - 2 * t + t * t - 2 * (1 - t) * t) +
        3 * p2x * (2 * (1 - t) * t - t * t) +
        3 * t * t;
      if (Math.abs(dx) < 1e-6) break;
      t -= cx / dx;
    }

    return (
      3 * p1y * (1 - t) * (1 - t) * t +
      3 * p2y * (1 - t) * t * t +
      t * t * t
    );
  };
}

/** Aplica easing a un progreso 0-1 */
export function applyEasing(progress: number, easing: EasingConfig): number {
  switch (easing.type) {
    case "linear":
      return linear(progress);
    case "ease-in":
      return easeIn(progress);
    case "ease-out":
      return easeOut(progress);
    case "ease-in-out":
      return easeInOut(progress);
    case "step":
      return progress < 1 ? 0 : 1;
    case "cubic-bezier": {
      const b = easing.bezier ?? [0.25, 0.1, 0.25, 1];
      return cubicBezier(b[0], b[1], b[2], b[3])(progress);
    }
  }
}

// --- Interpolacion de valores ---

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpNumberArray(a: number[], b: number[], t: number): number[] {
  const len = Math.min(a.length, b.length);
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = lerpNumber(a[i], b[i], t);
  }
  return result;
}

function lerpBezierPoints(
  a: BezierControlPoint[],
  b: BezierControlPoint[],
  t: number,
): BezierControlPoint[] {
  const len = Math.min(a.length, b.length);
  const result: BezierControlPoint[] = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = {
      x: lerpNumber(a[i].x, b[i].x, t),
      y: lerpNumber(a[i].y, b[i].y, t),
      handleIn: {
        x: lerpNumber(a[i].handleIn.x, b[i].handleIn.x, t),
        y: lerpNumber(a[i].handleIn.y, b[i].handleIn.y, t),
      },
      handleOut: {
        x: lerpNumber(a[i].handleOut.x, b[i].handleOut.x, t),
        y: lerpNumber(a[i].handleOut.y, b[i].handleOut.y, t),
      },
    };
  }
  return result;
}

/** Interpola colores hex */
function lerpColor(a: string, b: string, t: number): string {
  const parseHex = (hex: string) => {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16),
    };
  };
  const ca = parseHex(a);
  const cb = parseHex(b);
  const r = Math.round(lerpNumber(ca.r, cb.r, t));
  const g = Math.round(lerpNumber(ca.g, cb.g, t));
  const bl = Math.round(lerpNumber(ca.b, cb.b, t));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

/** Interpola entre dos KeyframeValues */
export function interpolateValue(
  a: KeyframeValue,
  b: KeyframeValue,
  t: number,
): KeyframeValue {
  // Numeros
  if (typeof a === "number" && typeof b === "number") {
    return lerpNumber(a, b, t);
  }

  // Colores hex
  if (
    typeof a === "string" &&
    typeof b === "string" &&
    a.startsWith("#") &&
    b.startsWith("#")
  ) {
    return lerpColor(a, b, t);
  }

  // Strings no interpolables
  if (typeof a === "string" || typeof b === "string") {
    return t < 0.5 ? a : b;
  }

  // Arrays de numeros
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length === 0) return b;
    if (typeof a[0] === "number" && typeof b[0] === "number") {
      return lerpNumberArray(a as number[], b as number[], t);
    }
    // Arrays de BezierControlPoint
    if (typeof a[0] === "object" && typeof b[0] === "object") {
      return lerpBezierPoints(
        a as BezierControlPoint[],
        b as BezierControlPoint[],
        t,
      );
    }
  }

  return t < 0.5 ? a : b;
}

/** Dado un track y un tiempo, calcula el valor interpolado */
export function evaluateTrack(
  keyframes: Keyframe[],
  time: number,
): KeyframeValue | undefined {
  if (keyframes.length === 0) return undefined;
  if (keyframes.length === 1) return keyframes[0].value;

  // Antes del primer keyframe
  if (time <= keyframes[0].time) return keyframes[0].value;

  // Despues del ultimo keyframe
  if (time >= keyframes[keyframes.length - 1].time) {
    return keyframes[keyframes.length - 1].value;
  }

  // Encontrar los dos keyframes adyacentes
  for (let i = 0; i < keyframes.length - 1; i++) {
    const kf0 = keyframes[i];
    const kf1 = keyframes[i + 1];
    if (time >= kf0.time && time <= kf1.time) {
      const duration = kf1.time - kf0.time;
      const rawProgress = duration > 0 ? (time - kf0.time) / duration : 0;
      const easedProgress = applyEasing(rawProgress, kf0.easing);
      return interpolateValue(kf0.value, kf1.value, easedProgress);
    }
  }

  return keyframes[keyframes.length - 1].value;
}
