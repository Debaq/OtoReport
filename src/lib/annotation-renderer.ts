import { renderAnnotation } from "@/components/annotation/SymbolStamps";
import type { Annotation, CropData } from "@/types/annotation";

export function compositeAnnotations(
  imageUrl: string,
  annotations: Annotation[],
  rotation: number,
  pivot?: { x: number; y: number } | null,
  crop?: CropData | null
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      // Step 1: Draw rotated image on a full-size canvas
      const fullCanvas = document.createElement("canvas");
      fullCanvas.width = img.width;
      fullCanvas.height = img.height;
      const fullCtx = fullCanvas.getContext("2d")!;

      const pivotX = pivot ? pivot.x * fullCanvas.width : fullCanvas.width / 2;
      const pivotY = pivot ? pivot.y * fullCanvas.height : fullCanvas.height / 2;
      fullCtx.save();
      fullCtx.translate(pivotX, pivotY);
      fullCtx.rotate((rotation * Math.PI) / 180);
      fullCtx.translate(-pivotX, -pivotY);
      fullCtx.drawImage(img, 0, 0);
      // When no crop, draw annotations in rotated space so they follow the image
      if (!crop) {
        for (const annotation of annotations) {
          renderAnnotation(fullCtx, annotation, fullCanvas.width, fullCanvas.height);
        }
      }
      fullCtx.restore();

      // Step 2: Apply crop if present
      let baseCanvas: HTMLCanvasElement;
      if (crop) {
        const sx = Math.min(crop.start.x, crop.end.x) * fullCanvas.width;
        const sy = Math.min(crop.start.y, crop.end.y) * fullCanvas.height;
        const sw = Math.abs(crop.end.x - crop.start.x) * fullCanvas.width;
        const sh = Math.abs(crop.end.y - crop.start.y) * fullCanvas.height;

        if (crop.type === "crop-circle") {
          // Make output square using the smaller dimension for a perfect circle
          const side = Math.min(sw, sh);
          const cx = sx + sw / 2;
          const cy = sy + sh / 2;

          baseCanvas = document.createElement("canvas");
          baseCanvas.width = side;
          baseCanvas.height = side;
          const cropCtx = baseCanvas.getContext("2d")!;

          // Background
          const bg = crop.background || "black";
          if (bg !== "transparent") {
            cropCtx.fillStyle = bg === "black" ? "#000000" : "#ffffff";
            cropCtx.fillRect(0, 0, side, side);
          }

          // Clip to circle
          cropCtx.save();
          cropCtx.beginPath();
          cropCtx.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2);
          cropCtx.clip();
          cropCtx.drawImage(
            fullCanvas,
            cx - side / 2, cy - side / 2, side, side,
            0, 0, side, side
          );
          cropCtx.restore();
        } else {
          baseCanvas = document.createElement("canvas");
          baseCanvas.width = sw;
          baseCanvas.height = sh;
          const cropCtx = baseCanvas.getContext("2d")!;
          cropCtx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
        }
      } else {
        baseCanvas = fullCanvas;
      }

      // Step 3: Render annotations on top of cropped image (non-crop already drawn in step 1)
      if (crop) {
        const ctx = baseCanvas.getContext("2d")!;
        for (const annotation of annotations) {
          renderAnnotation(ctx, annotation, baseCanvas.width, baseCanvas.height);
        }
      }

      resolve(baseCanvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}
