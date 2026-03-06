import { renderAnnotation } from "@/components/annotation/SymbolStamps";
import { renderTympanicOverlayForExport } from "@/components/annotation/TympanicOverlay";
import { applyPixelFilters } from "@/lib/image-filters";
import type { Annotation, FrameShape, TympanicReference, ViewportData, ImageAdjustments } from "@/types/annotation";
import type { EarSide } from "@/types/image";

function computeRotatedBounds(
  w: number, h: number, rotation: number,
  pivotX: number, pivotY: number,
): { expandedW: number; expandedH: number; offsetX: number; offsetY: number } {
  if (rotation === 0) return { expandedW: w, expandedH: h, offsetX: 0, offsetY: 0 };
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => ({
    x: pivotX + (x - pivotX) * cos - (y - pivotY) * sin,
    y: pivotY + (x - pivotX) * sin + (y - pivotY) * cos,
  }));
  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    expandedW: Math.ceil(Math.max(...xs) - minX),
    expandedH: Math.ceil(Math.max(...ys) - minY),
    offsetX: -minX,
    offsetY: -minY,
  };
}

export function compositeAnnotations(
  imageUrl: string,
  annotations: Annotation[],
  rotation: number,
  pivot?: { x: number; y: number } | null,
  frameShape?: FrameShape | null,
  background?: "black" | "white" | "transparent",
  tympanicRef?: TympanicReference | null,
  side?: EarSide,
  viewport?: ViewportData | null,
  adjustments?: ImageAdjustments | null,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const timeout = setTimeout(() => {
      reject(new Error("compositeAnnotations: timeout loading image"));
    }, 10000);
    img.onload = () => {
      clearTimeout(timeout);
      try {
      // Step 1: Draw rotated image on expanded canvas
      const pivotX = pivot ? pivot.x * img.width : img.width / 2;
      const pivotY = pivot ? pivot.y * img.height : img.height / 2;
      const { expandedW, expandedH, offsetX, offsetY } = computeRotatedBounds(
        img.width, img.height, rotation, pivotX, pivotY,
      );

      const fullCanvas = document.createElement("canvas");
      fullCanvas.width = expandedW;
      fullCanvas.height = expandedH;
      const fullCtx = fullCanvas.getContext("2d")!;

      if (background && background !== "transparent") {
        fullCtx.fillStyle = background === "black" ? "#000000" : "#ffffff";
        fullCtx.fillRect(0, 0, expandedW, expandedH);
      }

      // Draw rotated image
      fullCtx.save();
      fullCtx.translate(offsetX, offsetY);
      fullCtx.translate(pivotX, pivotY);
      fullCtx.rotate((rotation * Math.PI) / 180);
      fullCtx.translate(-pivotX, -pivotY);
      fullCtx.drawImage(img, 0, 0);
      fullCtx.restore();

      // Draw annotations in image space (not rotated)
      fullCtx.save();
      fullCtx.translate(offsetX, offsetY);
      for (const annotation of annotations) {
        renderAnnotation(fullCtx, annotation, img.width, img.height);
      }
      if (tympanicRef?.showOverlay && side) {
        renderTympanicOverlayForExport(fullCtx, tympanicRef, side, img.width, img.height);
      }
      fullCtx.restore();

      // Step 2: Apply frame shape
      let baseCanvas = fullCanvas;
      const shape = frameShape ?? "rectangle";

      if (shape === "square" || shape === "circle") {
        // Compute the largest centered square that fits the original image
        const squareSide = Math.min(img.width, img.height);
        const srcX = offsetX + (img.width - squareSide) / 2;
        const srcY = offsetY + (img.height - squareSide) / 2;

        baseCanvas = document.createElement("canvas");
        baseCanvas.width = squareSide;
        baseCanvas.height = squareSide;
        const ctx = baseCanvas.getContext("2d")!;

        if (shape === "circle") {
          const bg = background || "black";
          if (bg !== "transparent") {
            ctx.fillStyle = bg === "black" ? "#000000" : "#ffffff";
            ctx.fillRect(0, 0, squareSide, squareSide);
          }
          ctx.save();
          ctx.beginPath();
          ctx.arc(squareSide / 2, squareSide / 2, squareSide / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(fullCanvas, srcX, srcY, squareSide, squareSide, 0, 0, squareSide, squareSide);
          ctx.restore();
        } else {
          // Square
          ctx.drawImage(fullCanvas, srcX, srcY, squareSide, squareSide, 0, 0, squareSide, squareSide);
        }
      }

      // Step 3: Apply image adjustments
      let adjustedCanvas = baseCanvas;
      if (adjustments) {
        const hasCssFilters = adjustments.brightness !== 100 || adjustments.contrast !== 100 || adjustments.saturate !== 100 || adjustments.temperature !== 0;
        const hasPixelFilters = adjustments.clahe || adjustments.invert || adjustments.sharpen > 0;

        if (hasCssFilters || hasPixelFilters) {
          adjustedCanvas = document.createElement("canvas");
          adjustedCanvas.width = baseCanvas.width;
          adjustedCanvas.height = baseCanvas.height;
          const adjCtx = adjustedCanvas.getContext("2d")!;

          if (hasCssFilters) {
            let filterStr = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%)`;
            if (adjustments.temperature !== 0) {
              filterStr += ` sepia(${Math.abs(adjustments.temperature)}%) hue-rotate(${adjustments.temperature > 0 ? -20 : 180}deg)`;
            }
            adjCtx.filter = filterStr;
          }
          adjCtx.drawImage(baseCanvas, 0, 0);
          adjCtx.filter = "none";

          if (hasPixelFilters) {
            applyPixelFilters(adjCtx, adjustedCanvas.width, adjustedCanvas.height, adjustments);
          }
        }
      }

      // Step 4: Apply viewport (zoom/pan) — extract visible region
      let finalCanvas = adjustedCanvas;
      if (viewport && (viewport.zoom !== 1 || viewport.panX !== 0 || viewport.panY !== 0)) {
        finalCanvas = document.createElement("canvas");
        finalCanvas.width = img.width;
        finalCanvas.height = img.height;
        const vpCtx = finalCanvas.getContext("2d")!;
        const visW = img.width / viewport.zoom;
        const visH = img.height / viewport.zoom;
        const panPxX = viewport.panX * img.width;
        const panPxY = viewport.panY * img.height;
        const srcX = offsetX + (img.width - visW) / 2 - panPxX / viewport.zoom;
        const srcY = offsetY + (img.height - visH) / 2 - panPxY / viewport.zoom;
        vpCtx.fillStyle = background === "white" ? "#ffffff" : "#000000";
        vpCtx.fillRect(0, 0, img.width, img.height);
        vpCtx.drawImage(adjustedCanvas, srcX, srcY, visW, visH, 0, 0, img.width, img.height);
      }

      resolve(finalCanvas.toDataURL("image/png"));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (e) => {
      clearTimeout(timeout);
      reject(e);
    };
    img.src = imageUrl;
  });
}
