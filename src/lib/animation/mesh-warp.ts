import type { BezierControlPoint } from "@/types/animation";

/** Evalua un punto en una curva bezier cubica en t (0-1) */
function bezierPoint(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

/** Genera un path SVG para el contorno de una celda del mesh */
export function meshCellPath(
  topLeft: BezierControlPoint,
  topRight: BezierControlPoint,
  bottomRight: BezierControlPoint,
  bottomLeft: BezierControlPoint,
  steps = 8,
): string {
  const points: string[] = [];

  // Borde superior (topLeft -> topRight)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = bezierPoint(
      topLeft.x,
      topLeft.x + topLeft.handleOut.x,
      topRight.x + topRight.handleIn.x,
      topRight.x,
      t,
    );
    const y = bezierPoint(
      topLeft.y,
      topLeft.y + topLeft.handleOut.y,
      topRight.y + topRight.handleIn.y,
      topRight.y,
      t,
    );
    points.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }

  // Borde derecho (topRight -> bottomRight)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = bezierPoint(
      topRight.x,
      topRight.x + topRight.handleOut.x,
      bottomRight.x + bottomRight.handleIn.x,
      bottomRight.x,
      t,
    );
    const y = bezierPoint(
      topRight.y,
      topRight.y + topRight.handleOut.y,
      bottomRight.y + bottomRight.handleIn.y,
      bottomRight.y,
      t,
    );
    points.push(`L ${x} ${y}`);
  }

  // Borde inferior (bottomRight -> bottomLeft, reverso)
  for (let i = steps - 1; i >= 0; i--) {
    const t = i / steps;
    const x = bezierPoint(
      bottomLeft.x,
      bottomLeft.x + bottomLeft.handleOut.x,
      bottomRight.x + bottomRight.handleIn.x,
      bottomRight.x,
      t,
    );
    const y = bezierPoint(
      bottomLeft.y,
      bottomLeft.y + bottomLeft.handleOut.y,
      bottomRight.y + bottomRight.handleIn.y,
      bottomRight.y,
      t,
    );
    points.push(`L ${x} ${y}`);
  }

  // Borde izquierdo (bottomLeft -> topLeft, reverso)
  for (let i = steps - 1; i >= 1; i--) {
    const t = i / steps;
    const x = bezierPoint(
      topLeft.x,
      topLeft.x + topLeft.handleOut.x,
      bottomLeft.x + bottomLeft.handleIn.x,
      bottomLeft.x,
      t,
    );
    const y = bezierPoint(
      topLeft.y,
      topLeft.y + topLeft.handleOut.y,
      bottomLeft.y + bottomLeft.handleIn.y,
      bottomLeft.y,
      t,
    );
    points.push(`L ${x} ${y}`);
  }

  points.push("Z");
  return points.join(" ");
}

/** Crea un grid de puntos de control uniforme */
export function createUniformGrid(
  cols: number,
  rows: number,
  width: number,
  height: number,
): BezierControlPoint[] {
  const points: BezierControlPoint[] = [];
  const cellW = width / cols;
  const cellH = height / rows;
  const handleLen = 0.3; // longitud relativa de handles

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = c * cellW;
      const y = r * cellH;
      points.push({
        x,
        y,
        handleIn: { x: -cellW * handleLen, y: 0 },
        handleOut: { x: cellW * handleLen, y: 0 },
      });
    }
  }

  return points;
}

/** Obtiene un punto del grid por columna y fila */
export function getGridPoint(
  points: BezierControlPoint[],
  col: number,
  row: number,
  cols: number,
): BezierControlPoint {
  return points[row * (cols + 1) + col];
}

/** Genera todos los paths de celdas del mesh */
export function generateMeshPaths(
  points: BezierControlPoint[],
  cols: number,
  rows: number,
): string[] {
  const paths: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tl = getGridPoint(points, c, r, cols);
      const tr = getGridPoint(points, c + 1, r, cols);
      const br = getGridPoint(points, c + 1, r + 1, cols);
      const bl = getGridPoint(points, c, r + 1, cols);
      paths.push(meshCellPath(tl, tr, br, bl));
    }
  }

  return paths;
}

/** Calcula la transformacion afin aproximada para una celda del mesh.
 *  Retorna los valores para el atributo `transform` SVG que mapea
 *  la region original de la imagen a la region deformada.
 */
export function computeCellTransform(
  origCol: number,
  origRow: number,
  cols: number,
  rows: number,
  origWidth: number,
  origHeight: number,
  points: BezierControlPoint[],
): {
  clipPath: string;
  viewBox: { x: number; y: number; w: number; h: number };
} {
  const cellW = origWidth / cols;
  const cellH = origHeight / rows;

  const tl = getGridPoint(points, origCol, origRow, cols);
  const tr = getGridPoint(points, origCol + 1, origRow, cols);
  const bl = getGridPoint(points, origCol, origRow + 1, cols);
  const br = getGridPoint(points, origCol + 1, origRow + 1, cols);

  const clipPath = meshCellPath(tl, tr, br, bl);
  const viewBox = {
    x: origCol * cellW,
    y: origRow * cellH,
    w: cellW,
    h: cellH,
  };

  return { clipPath, viewBox };
}
