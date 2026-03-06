import type { TympanicReference } from "@/types/annotation";
import type { EarSide } from "@/types/image";

export type QuadrantLabel = "AS" | "AI" | "PS" | "PI" | "PF";
export type TympanicHandleId = "umbo" | "shortProcess" | "annulus0" | "annulus1" | "annulus2" | "annulus3" | "annulus4";

interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation: number;
}

// Algebraic ellipse fit using 5 points (Bookstein method)
// Solves Ax² + Bxy + Cy² + Dx + Ey + F = 0 with constraint A + C = 1
export function fitEllipse(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
  p5: { x: number; y: number },
): Ellipse {
  const pts = [p1, p2, p3, p4, p5];

  // Build the system: for each point (x,y) → x², xy, y², x, y, 1
  // We use the constraint A + C = 1 (Bookstein)
  // Rewrite: A*x² + B*xy + (1-A)*y² + D*x + E*y + F = 0
  // → A*(x²-y²) + B*xy + D*x + E*y + F = -y²
  // 5 equations, 5 unknowns (A, B, D, E, F)

  const M: number[][] = [];
  const rhs: number[] = [];

  for (const p of pts) {
    const x = p.x, y = p.y;
    M.push([x * x - y * y, x * y, x, y, 1]);
    rhs.push(-y * y);
  }

  const sol = solve5x5(M, rhs);
  if (!sol) {
    // Fallback: use centroid + average radius
    return fallbackCircle(pts);
  }

  const [A, B, D, E, F] = sol;
  const C = 1 - A;

  return conicToEllipse(A, B, C, D, E, F);
}

// Solve 5x5 linear system via Gaussian elimination with partial pivoting
function solve5x5(M: number[][], rhs: number[]): number[] | null {
  const n = 5;
  const aug = M.map((row, i) => [...row, rhs[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) return null;
    if (maxRow !== col) {
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    }

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(aug[i][i]) < 1e-12) return null;
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    x[i] /= aug[i][i];
  }
  return x;
}

function fallbackCircle(pts: { x: number; y: number }[]): Ellipse {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const r = pts.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / pts.length;
  return { cx, cy, rx: Math.max(r, 0.01), ry: Math.max(r, 0.01), rotation: 0 };
}

// Convert general conic Ax² + Bxy + Cy² + Dx + Ey + F = 0 to ellipse params
function conicToEllipse(A: number, B: number, C: number, D: number, E: number, F: number): Ellipse {
  // Check discriminant: B²-4AC < 0 for ellipse
  const disc = B * B - 4 * A * C;
  if (disc >= 0) {
    // Not an ellipse — degenerate, use fallback won't work here
    // Just compute center from linear part and use small radii
    const cx = -D / (2 * A || 1);
    const cy = -E / (2 * C || 1);
    return { cx, cy, rx: 0.05, ry: 0.05, rotation: 0 };
  }

  // Center: solve [2A B; B 2C] * [cx; cy] = [-D; -E]
  const det = 4 * A * C - B * B;
  const cx = (B * E - 2 * C * D) / det;
  const cy = (B * D - 2 * A * E) / det;

  // Translate to center: F' = A*cx² + B*cx*cy + C*cy² + D*cx + E*cy + F
  const Fp = A * cx * cx + B * cx * cy + C * cy * cy + D * cx + E * cy + F;

  if (Math.abs(Fp) < 1e-14) {
    return { cx, cy, rx: 0.05, ry: 0.05, rotation: 0 };
  }

  // Normalize: A'/Fp*x² + B'/Fp*xy + C'/Fp*y² = -1
  const An = -A / Fp;
  const Bn = -B / Fp;
  const Cn = -C / Fp;

  // Eigenvalues of [[An, Bn/2],[Bn/2, Cn]] give 1/rx², 1/ry²
  const avg = (An + Cn) / 2;
  const diff = (An - Cn) / 2;
  const sqrtTerm = Math.sqrt(diff * diff + (Bn / 2) * (Bn / 2));

  const lambda1 = avg + sqrtTerm;
  const lambda2 = avg - sqrtTerm;

  if (lambda1 <= 0 || lambda2 <= 0) {
    return { cx, cy, rx: 0.05, ry: 0.05, rotation: 0 };
  }

  const rx = 1 / Math.sqrt(lambda1);
  const ry = 1 / Math.sqrt(lambda2);

  // Rotation angle
  const rotation = Math.abs(Bn) < 1e-10
    ? (An < Cn ? 0 : Math.PI / 2)
    : Math.atan2(lambda1 - An, Bn / 2);

  return {
    cx,
    cy,
    rx: Math.max(rx, 0.005),
    ry: Math.max(ry, 0.005),
    rotation,
  };
}

function isSideRight(side: EarSide): boolean {
  return side === "right" || side === "pre_right" || side === "post_right";
}

// Determine which quadrant a point falls in
export function getQuadrantForPoint(
  px: number,
  py: number,
  ref: TympanicReference,
  side: EarSide,
): QuadrantLabel | null {
  const malleus = {
    x: ref.shortProcess.x - ref.umbo.x,
    y: ref.shortProcess.y - ref.umbo.y,
  };
  const len = Math.hypot(malleus.x, malleus.y);
  if (len < 1e-10) return null;

  const norm = { x: malleus.x / len, y: malleus.y / len };
  const perp = { x: -norm.y, y: norm.x };

  const delta = { x: px - ref.umbo.x, y: py - ref.umbo.y };
  const projMalleus = delta.x * norm.x + delta.y * norm.y;
  const projPerp = delta.x * perp.x + delta.y * perp.y;

  // Check if in pars flaccida region (beyond short process along malleus axis)
  const spDist = Math.hypot(ref.shortProcess.x - ref.umbo.x, ref.shortProcess.y - ref.umbo.y);
  if (projMalleus > spDist * 0.7) {
    const ellipse = fitEllipse(...ref.annulusPoints);
    const dx = px - ellipse.cx;
    const dy = py - ellipse.cy;
    const cosR = Math.cos(-ellipse.rotation);
    const sinR = Math.sin(-ellipse.rotation);
    const rx = dx * cosR - dy * sinR;
    const ry = dx * sinR + dy * cosR;
    if ((rx / ellipse.rx) ** 2 + (ry / ellipse.ry) ** 2 <= 1.1) {
      return "PF";
    }
  }

  const isSuperior = projMalleus > 0;
  const isRight = isSideRight(side);

  // For right ear: perp positive = anterior; for left ear: perp positive = posterior
  const isAnterior = isRight ? projPerp > 0 : projPerp < 0;

  if (isSuperior && isAnterior) return "AS";
  if (!isSuperior && isAnterior) return "AI";
  if (isSuperior && !isAnterior) return "PS";
  return "PI";
}

// Hit test for draggable handles
export function hitTestTympanicHandle(
  x: number,
  y: number,
  ref: TympanicReference,
  threshold: number,
): TympanicHandleId | null {
  if (Math.hypot(x - ref.umbo.x, y - ref.umbo.y) < threshold) return "umbo";
  if (Math.hypot(x - ref.shortProcess.x, y - ref.shortProcess.y) < threshold) return "shortProcess";
  for (let i = 0; i < 5; i++) {
    if (Math.hypot(x - ref.annulusPoints[i].x, y - ref.annulusPoints[i].y) < threshold) {
      return `annulus${i}` as TympanicHandleId;
    }
  }
  return null;
}

// Clip a line (from p1 to p2, extended infinitely) to the ellipse boundary
function clipLineToEllipse(
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  ellipse: Ellipse,
): [{ x: number; y: number }, { x: number; y: number }] | null {
  const cosR = Math.cos(-ellipse.rotation);
  const sinR = Math.sin(-ellipse.rotation);

  const dx1 = p1x - ellipse.cx;
  const dy1 = p1y - ellipse.cy;
  const lx1 = dx1 * cosR - dy1 * sinR;
  const ly1 = dx1 * sinR + dy1 * cosR;

  const dx2 = p2x - ellipse.cx;
  const dy2 = p2y - ellipse.cy;
  const lx2 = dx2 * cosR - dy2 * sinR;
  const ly2 = dx2 * sinR + dy2 * cosR;

  const nx1 = lx1 / ellipse.rx, ny1 = ly1 / ellipse.ry;
  const nx2 = lx2 / ellipse.rx, ny2 = ly2 / ellipse.ry;

  const ddx = nx2 - nx1, ddy = ny2 - ny1;
  const a = ddx * ddx + ddy * ddy;
  const b = 2 * (nx1 * ddx + ny1 * ddy);
  const c = nx1 * nx1 + ny1 * ny1 - 1;

  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  const cosRi = Math.cos(ellipse.rotation);
  const sinRi = Math.sin(ellipse.rotation);

  function toWorld(t: number) {
    const lx = lx1 + (lx2 - lx1) * t;
    const ly = ly1 + (ly2 - ly1) * t;
    return {
      x: ellipse.cx + lx * cosRi - ly * sinRi,
      y: ellipse.cy + lx * sinRi + ly * cosRi,
    };
  }

  return [toWorld(t1), toWorld(t2)];
}

// Render the full tympanic overlay on a canvas context (editor mode, with handles)
export function renderTympanicOverlay(
  ctx: CanvasRenderingContext2D,
  ref: TympanicReference,
  side: EarSide,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.55;

  const ellipse = fitEllipse(...ref.annulusPoints);

  const eCx = ellipse.cx * w;
  const eCy = ellipse.cy * h;
  const eRx = ellipse.rx * w;
  const eRy = ellipse.ry * h;

  // 1. Annulus ellipse (dashed)
  ctx.save();
  ctx.strokeStyle = "rgba(0, 200, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.beginPath();
  ctx.ellipse(eCx, eCy, eRx, eRy, ellipse.rotation, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // 2. Malleus axis and perpendicular, clipped to ellipse
  const umboX = ref.umbo.x, umboY = ref.umbo.y;
  const spX = ref.shortProcess.x, spY = ref.shortProcess.y;

  const malleusClip = clipLineToEllipse(umboX, umboY, spX, spY, ellipse);
  if (malleusClip) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 100, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(malleusClip[0].x * w, malleusClip[0].y * h);
    ctx.lineTo(malleusClip[1].x * w, malleusClip[1].y * h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  const mDx = spX - umboX;
  const mDy = spY - umboY;
  const perpX = umboX - mDy;
  const perpY = umboY + mDx;

  const perpClip = clipLineToEllipse(umboX, umboY, perpX, perpY, ellipse);
  if (perpClip) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 100, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(perpClip[0].x * w, perpClip[0].y * h);
    ctx.lineTo(perpClip[1].x * w, perpClip[1].y * h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 3. Quadrant labels
  const malleus = { x: spX - umboX, y: spY - umboY };
  const mLen = Math.hypot(malleus.x, malleus.y);
  if (mLen > 1e-10) {
    const mn = { x: malleus.x / mLen, y: malleus.y / mLen };
    const pp = { x: -mn.y, y: mn.x };
    const isRight = isSideRight(side);

    const labelOffset = 0.06;
    const labels: { label: QuadrantLabel; dx: number; dy: number }[] = [
      { label: isRight ? "AS" : "PS", dx: mn.x * labelOffset + pp.x * labelOffset, dy: mn.y * labelOffset + pp.y * labelOffset },
      { label: isRight ? "AI" : "PI", dx: -mn.x * labelOffset + pp.x * labelOffset, dy: -mn.y * labelOffset + pp.y * labelOffset },
      { label: isRight ? "PS" : "AS", dx: mn.x * labelOffset - pp.x * labelOffset, dy: mn.y * labelOffset - pp.y * labelOffset },
      { label: isRight ? "PI" : "AI", dx: -mn.x * labelOffset - pp.x * labelOffset, dy: -mn.y * labelOffset - pp.y * labelOffset },
    ];

    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.font = `bold ${Math.max(12, Math.min(w, h) * 0.025)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.lineWidth = 3;

    for (const { label, dx, dy } of labels) {
      const lx = (umboX + dx) * w;
      const ly = (umboY + dy) * h;
      ctx.strokeText(label, lx, ly);
      ctx.fillText(label, lx, ly);
    }

    const pfX = (spX + mn.x * 0.03) * w;
    const pfY = (spY + mn.y * 0.03) * h;
    ctx.strokeText("PF", pfX, pfY);
    ctx.fillText("PF", pfX, pfY);
    ctx.restore();
  }

  // 4. Pars flaccida region
  ctx.save();
  ctx.strokeStyle = "rgba(255, 150, 50, 0.6)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  const pfRx = eRx * 0.35;
  const pfRy = eRy * 0.18;
  ctx.beginPath();
  ctx.ellipse(spX * w, spY * h, pfRx, pfRy, ellipse.rotation, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.globalAlpha = 1;

  // 5. Reference point handles
  drawHandle(ctx, umboX * w, umboY * h, 6, "#00e5ff", "U");
  drawHandle(ctx, spX * w, spY * h, 6, "#ff9800", "PC");
  for (const p of ref.annulusPoints) {
    drawHandle(ctx, p.x * w, p.y * h, 4, "#76ff03", null);
  }

  ctx.restore();
}

function drawHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  label: string | null,
): void {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (label) {
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;
    ctx.strokeText(label, x, y - radius - 2);
    ctx.fillText(label, x, y - radius - 2);
  }
  ctx.restore();
}

// Render overlay for export (without handles, cleaner look)
export function renderTympanicOverlayForExport(
  ctx: CanvasRenderingContext2D,
  ref: TympanicReference,
  side: EarSide,
  w: number,
  h: number,
): void {
  if (!ref.showOverlay) return;

  ctx.save();
  ctx.globalAlpha = 0.45;

  const ellipse = fitEllipse(...ref.annulusPoints);
  const eCx = ellipse.cx * w;
  const eCy = ellipse.cy * h;
  const eRx = ellipse.rx * w;
  const eRy = ellipse.ry * h;

  ctx.strokeStyle = "rgba(0, 200, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.beginPath();
  ctx.ellipse(eCx, eCy, eRx, eRy, ellipse.rotation, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const malleusClip = clipLineToEllipse(ref.umbo.x, ref.umbo.y, ref.shortProcess.x, ref.shortProcess.y, ellipse);
  if (malleusClip) {
    ctx.strokeStyle = "rgba(255, 255, 100, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(malleusClip[0].x * w, malleusClip[0].y * h);
    ctx.lineTo(malleusClip[1].x * w, malleusClip[1].y * h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const mDx = ref.shortProcess.x - ref.umbo.x;
  const mDy = ref.shortProcess.y - ref.umbo.y;
  const perpClip = clipLineToEllipse(ref.umbo.x, ref.umbo.y, ref.umbo.x - mDy, ref.umbo.y + mDx, ellipse);
  if (perpClip) {
    ctx.strokeStyle = "rgba(255, 255, 100, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(perpClip[0].x * w, perpClip[0].y * h);
    ctx.lineTo(perpClip[1].x * w, perpClip[1].y * h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const malleus = { x: ref.shortProcess.x - ref.umbo.x, y: ref.shortProcess.y - ref.umbo.y };
  const mLen = Math.hypot(malleus.x, malleus.y);
  if (mLen > 1e-10) {
    const mn = { x: malleus.x / mLen, y: malleus.y / mLen };
    const pp = { x: -mn.y, y: mn.x };
    const isRight = isSideRight(side);
    const labelOffset = 0.06;
    const labels: { label: string; dx: number; dy: number }[] = [
      { label: isRight ? "AS" : "PS", dx: mn.x * labelOffset + pp.x * labelOffset, dy: mn.y * labelOffset + pp.y * labelOffset },
      { label: isRight ? "AI" : "PI", dx: -mn.x * labelOffset + pp.x * labelOffset, dy: -mn.y * labelOffset + pp.y * labelOffset },
      { label: isRight ? "PS" : "AS", dx: mn.x * labelOffset - pp.x * labelOffset, dy: mn.y * labelOffset - pp.y * labelOffset },
      { label: isRight ? "PI" : "AI", dx: -mn.x * labelOffset - pp.x * labelOffset, dy: -mn.y * labelOffset - pp.y * labelOffset },
    ];

    ctx.globalAlpha = 0.7;
    ctx.font = `bold ${Math.max(12, Math.min(w, h) * 0.025)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.lineWidth = 3;

    for (const { label, dx, dy } of labels) {
      ctx.strokeText(label, (ref.umbo.x + dx) * w, (ref.umbo.y + dy) * h);
      ctx.fillText(label, (ref.umbo.x + dx) * w, (ref.umbo.y + dy) * h);
    }

    ctx.strokeText("PF", (ref.shortProcess.x + mn.x * 0.03) * w, (ref.shortProcess.y + mn.y * 0.03) * h);
    ctx.fillText("PF", (ref.shortProcess.x + mn.x * 0.03) * w, (ref.shortProcess.y + mn.y * 0.03) * h);
  }

  ctx.restore();
}
