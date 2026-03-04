import { useRef, useEffect, useCallback, useState } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { renderAnnotation } from "./SymbolStamps";
import { useAnnotation } from "@/hooks/useAnnotation";
import type { Annotation, CropData } from "@/types/annotation";
import { AnnotationType } from "@/types/annotation";
import { cn } from "@/lib/utils";

interface ImageAnnotatorProps {
  imageUrl: string;
  annotations: Annotation[];
  rotation: number;
  crop?: CropData | null;
  onSave: (annotations: Annotation[], rotation: number, crop?: CropData | null) => void;
  onClose: () => void;
}

interface CropRegion {
  start: { x: number; y: number };
  end: { x: number; y: number };
  type: "crop-rect" | "crop-circle";
}

interface HistoryEntry {
  annotations: Annotation[];
  rotation: number;
  pivot: { x: number; y: number } | null;
  crop: CropData | null;
}

export function ImageAnnotator({
  imageUrl,
  annotations: initialAnnotations,
  rotation: initialRotation,
  crop: initialCrop,
  onSave,
  onClose,
}: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  const {
    activeTool,
    setActiveTool,
    activeColor,
    setActiveColor,
    rotation,
    setRotation,
    pivot,
    setPivot,
  } = useAnnotation({
    annotations: initialAnnotations,
    onChange: () => {},
  });

  const [localAnnotations, setLocalAnnotations] = useState(initialAnnotations);

  // Saved crop (non-destructive)
  const [savedCrop, setSavedCrop] = useState<CropData | null>(initialCrop ?? null);

  // Crop state (in-progress selection)
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [cropPending, setCropPending] = useState<CropRegion | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Circular crop background
  const [cropBg, setCropBg] = useState<"black" | "white" | "transparent">(
    initialCrop?.background ?? "black"
  );

  // Pivot drag state
  const [isDraggingPivot, setIsDraggingPivot] = useState(false);

  // Interactive rotation drag state
  const [isRotating, setIsRotating] = useState(false);
  const rotateStartAngleRef = useRef(0);
  const rotationBeforeDragRef = useRef(0);

  // Resize handle drag state
  type HandleType = "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br";
  const [draggingHandle, setDraggingHandle] = useState<HandleType | null>(null);

  // Crop region drag (move) state
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const cropDragOriginRef = useRef<{ x: number; y: number } | null>(null);

  // Undo history
  const historyRef = useRef<HistoryEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const pushHistory = useCallback(() => {
    historyRef.current.push({
      annotations: [...localAnnotations],
      rotation,
      pivot: pivot ? { ...pivot } : null,
      crop: savedCrop ? { ...savedCrop } : null,
    });
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
    setCanUndo(true);
  }, [localAnnotations, rotation, pivot, savedCrop]);

  const undo = useCallback(() => {
    const entry = historyRef.current.pop();
    if (!entry) return;
    setLocalAnnotations(entry.annotations);
    setRotation(entry.rotation);
    setPivot(entry.pivot);
    setSavedCrop(entry.crop);
    setCanUndo(historyRef.current.length > 0);
  }, [setRotation, setPivot]);

  const isCropTool = activeTool === "crop-rect" || activeTool === "crop-circle";

  const handleAddAnnotation = useCallback(
    (x: number, y: number, text?: string) => {
      if (!activeTool || activeTool === "eraser" || activeTool === "crop-rect" || activeTool === "crop-circle" || activeTool === "rotate") return;
      pushHistory();
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        type: activeTool,
        x,
        y,
        color: activeColor,
        size: 20,
        rotation: 0,
        text,
      };
      setLocalAnnotations((prev) => [...prev, annotation]);
    },
    [activeTool, activeColor, pushHistory]
  );

  const handleRemoveAt = useCallback(
    (x: number, y: number) => {
      const threshold = 0.03;
      setLocalAnnotations((prev) => {
        const idx = prev.findIndex(
          (a) => Math.abs(a.x - x) < threshold && Math.abs(a.y - y) < threshold
        );
        if (idx >= 0) {
          pushHistory();
          const next = [...prev];
          next.splice(idx, 1);
          return next;
        }
        return prev;
      });
    },
    [pushHistory]
  );

  useEffect(() => {
    setRotation(initialRotation);
  }, [initialRotation, setRotation]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Helper to get normalized coords from mouse event
  // Returns canvas-space coords (for crop/rotate UI interactions)
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: ((e.clientX - rect.left) * scaleX) / canvas.width,
      y: ((e.clientY - rect.top) * scaleY) / canvas.height,
    };
  }, []);

  // Get coords in rotated image space (for annotations that follow rotation)
  const getImageCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    // Apply inverse rotation around pivot
    const px = pivot ? pivot.x * canvas.width : canvas.width / 2;
    const py = pivot ? pivot.y * canvas.height : canvas.height / 2;
    const rad = -(rotation * Math.PI) / 180;
    const dx = cx - px;
    const dy = cy - py;
    const ix = px + dx * Math.cos(rad) - dy * Math.sin(rad);
    const iy = py + dx * Math.sin(rad) + dy * Math.cos(rad);

    return {
      x: ix / canvas.width,
      y: iy / canvas.height,
    };
  }, [pivot, rotation]);

  // Check if mouse is near pivot (null pivot = center)
  const isNearPivot = useCallback((x: number, y: number) => {
    const px = pivot ? pivot.x : 0.5;
    const py = pivot ? pivot.y : 0.5;
    const threshold = 0.025;
    return Math.abs(x - px) < threshold && Math.abs(y - py) < threshold;
  }, [pivot]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (savedCrop) {
      // Draw with crop applied: first render rotated image, then extract crop region
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = img.width;
      tmpCanvas.height = img.height;
      const tmpCtx = tmpCanvas.getContext("2d")!;

      const pivotX = pivot ? pivot.x * tmpCanvas.width : tmpCanvas.width / 2;
      const pivotY = pivot ? pivot.y * tmpCanvas.height : tmpCanvas.height / 2;
      tmpCtx.save();
      tmpCtx.translate(pivotX, pivotY);
      tmpCtx.rotate((rotation * Math.PI) / 180);
      tmpCtx.drawImage(img, -pivotX, -pivotY);
      tmpCtx.restore();

      const sx = Math.min(savedCrop.start.x, savedCrop.end.x) * img.width;
      const sy = Math.min(savedCrop.start.y, savedCrop.end.y) * img.height;
      const sw = Math.abs(savedCrop.end.x - savedCrop.start.x) * img.width;
      const sh = Math.abs(savedCrop.end.y - savedCrop.start.y) * img.height;

      if (savedCrop.type === "crop-circle") {
        const side = Math.min(sw, sh);
        const cx = sx + sw / 2;
        const cy = sy + sh / 2;

        canvas.width = side;
        canvas.height = side;
        ctx.clearRect(0, 0, side, side);

        const bg = savedCrop.background || "black";
        if (bg !== "transparent") {
          ctx.fillStyle = bg === "black" ? "#000000" : "#ffffff";
          ctx.fillRect(0, 0, side, side);
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(tmpCanvas, cx - side / 2, cy - side / 2, side, side, 0, 0, side, side);
        ctx.restore();
      } else {
        canvas.width = sw;
        canvas.height = sh;
        ctx.clearRect(0, 0, sw, sh);
        ctx.drawImage(tmpCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
      }

      // Annotations on cropped image
      localAnnotations.forEach((a) => {
        renderAnnotation(ctx, a, canvas.width, canvas.height);
      });
    } else {
      // No crop — original behavior
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const pivotX = pivot ? pivot.x * canvas.width : canvas.width / 2;
      const pivotY = pivot ? pivot.y * canvas.height : canvas.height / 2;
      ctx.save();
      ctx.translate(pivotX, pivotY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-pivotX, -pivotY);
      // Draw image and annotations in the same rotated space
      ctx.drawImage(img, 0, 0);
      localAnnotations.forEach((a) => {
        renderAnnotation(ctx, a, canvas.width, canvas.height);
      });
      ctx.restore();

      // Draw crop overlay
      if ((cropStart && cropEnd) || cropPending) {
        const region = cropPending || {
          start: cropStart!,
          end: cropEnd!,
          type: activeTool as "crop-rect" | "crop-circle",
        };

        const sx = region.start.x * canvas.width;
        const sy = region.start.y * canvas.height;
        const ex = region.end.x * canvas.width;
        const ey = region.end.y * canvas.height;

        // For circle: compute square in pixel space
        let drawSx = sx, drawSy = sy, drawEx = ex, drawEy = ey;
        if (region.type === "crop-circle") {
          const midPx = (sx + ex) / 2;
          const midPy = (sy + ey) / 2;
          const rPx = Math.abs(ex - sx) / 2;
          const rPy = Math.abs(ey - sy) / 2;
          const r = Math.min(rPx, rPy);
          drawSx = midPx - r;
          drawSy = midPy - r;
          drawEx = midPx + r;
          drawEy = midPy + r;
        }

        // Dark overlay
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.globalCompositeOperation = "destination-out";
        if (region.type === "crop-rect") {
          const rx = Math.min(drawSx, drawEx);
          const ry = Math.min(drawSy, drawEy);
          const rw = Math.abs(drawEx - drawSx);
          const rh = Math.abs(drawEy - drawSy);
          ctx.fillRect(rx, ry, rw, rh);
        } else {
          const cxPx = (drawSx + drawEx) / 2;
          const cyPx = (drawSy + drawEy) / 2;
          const r = Math.abs(drawEx - drawSx) / 2;
          ctx.beginPath();
          ctx.arc(cxPx, cyPx, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Draw border around selection
        ctx.save();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        if (region.type === "crop-rect") {
          const rx = Math.min(drawSx, drawEx);
          const ry = Math.min(drawSy, drawEy);
          const rw = Math.abs(drawEx - drawSx);
          const rh = Math.abs(drawEy - drawSy);
          ctx.strokeRect(rx, ry, rw, rh);
        } else {
          const cxPx = (drawSx + drawEx) / 2;
          const cyPx = (drawSy + drawEy) / 2;
          const r = Math.abs(drawEx - drawSx) / 2;
          ctx.beginPath();
          ctx.arc(cxPx, cyPx, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw resize handles on crop region
      if (cropPending) {
        const region = cropPending;
        let bsx: number, bsy: number, bsw: number, bsh: number;
        if (region.type === "crop-circle") {
          const sx2 = region.start.x * canvas.width;
          const sy2 = region.start.y * canvas.height;
          const ex2 = region.end.x * canvas.width;
          const ey2 = region.end.y * canvas.height;
          const midPx = (sx2 + ex2) / 2;
          const midPy = (sy2 + ey2) / 2;
          const rPx = Math.abs(ex2 - sx2) / 2;
          const rPy = Math.abs(ey2 - sy2) / 2;
          const r = Math.min(rPx, rPy);
          bsx = midPx - r;
          bsy = midPy - r;
          bsw = r * 2;
          bsh = r * 2;
        } else {
          bsx = Math.min(region.start.x, region.end.x) * canvas.width;
          bsy = Math.min(region.start.y, region.end.y) * canvas.height;
          bsw = Math.abs(region.end.x - region.start.x) * canvas.width;
          bsh = Math.abs(region.end.y - region.start.y) * canvas.height;
        }

        const handles = [
          { x: bsx, y: bsy },
          { x: bsx + bsw / 2, y: bsy },
          { x: bsx + bsw, y: bsy },
          { x: bsx, y: bsy + bsh / 2 },
          { x: bsx + bsw, y: bsy + bsh / 2 },
          { x: bsx, y: bsy + bsh },
          { x: bsx + bsw / 2, y: bsy + bsh },
          { x: bsx + bsw, y: bsy + bsh },
        ];

        const handleSize = 6;
        ctx.save();
        handles.forEach((h) => {
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#0066ff";
          ctx.lineWidth = 2;
          ctx.fillRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2);
          ctx.strokeRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2);
        });
        ctx.restore();
      }
    }

    // Draw rotation overlay when rotate tool is active (no crop)
    if (activeTool === "rotate" && !savedCrop) {
      const pivotX = pivot ? pivot.x * canvas.width : canvas.width / 2;
      const pivotY = pivot ? pivot.y * canvas.height : canvas.height / 2;
      const rad = (rotation * Math.PI) / 180;

      // Compute rotated bounding box corners
      const corners = [
        { x: 0, y: 0 },
        { x: canvas.width, y: 0 },
        { x: canvas.width, y: canvas.height },
        { x: 0, y: canvas.height },
      ].map((c) => {
        const dx = c.x - pivotX;
        const dy = c.y - pivotY;
        return {
          x: pivotX + dx * Math.cos(rad) - dy * Math.sin(rad),
          y: pivotY + dx * Math.sin(rad) + dy * Math.cos(rad),
        };
      });

      // Dashed bounding box
      ctx.save();
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // Corner handles
      const handleSize = 5;
      corners.forEach((c) => {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2;
        ctx.fillRect(c.x - handleSize, c.y - handleSize, handleSize * 2, handleSize * 2);
        ctx.strokeRect(c.x - handleSize, c.y - handleSize, handleSize * 2, handleSize * 2);
      });
      ctx.restore();

      // Pivot indicator (crosshair + circle)
      ctx.save();
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 2;
      const pSize = 12;
      // Crosshair +
      ctx.beginPath();
      ctx.moveTo(pivotX - pSize, pivotY);
      ctx.lineTo(pivotX + pSize, pivotY);
      ctx.moveTo(pivotX, pivotY - pSize);
      ctx.lineTo(pivotX, pivotY + pSize);
      ctx.stroke();
      // Circle
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Angle overlay
      if (rotation !== 0) {
        const angleText = `${rotation.toFixed(1)}°`;
        ctx.save();
        ctx.font = "bold 14px sans-serif";
        const metrics = ctx.measureText(angleText);
        const tw = metrics.width + 12;
        const th = 22;
        const tx = canvas.width / 2 - tw / 2;
        const ty = 12;
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 4);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(angleText, canvas.width / 2, ty + th / 2);
        ctx.restore();
      }
    }
  }, [rotation, localAnnotations, loaded, cropStart, cropEnd, cropPending, activeTool, pivot, savedCrop]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Apply crop — non-destructive: saves params instead of replacing image
  const applyCrop = useCallback(() => {
    if (!cropPending || !imageRef.current) return;
    pushHistory();

    const img = imageRef.current;
    const { start, end, type } = cropPending;

    // For circle: recalculate to make square in pixel space
    if (type === "crop-circle") {
      const sx = Math.min(start.x, end.x) * img.width;
      const sy = Math.min(start.y, end.y) * img.height;
      const sw = Math.abs(end.x - start.x) * img.width;
      const sh = Math.abs(end.y - start.y) * img.height;
      const side = Math.min(sw, sh);
      const cx = sx + sw / 2;
      const cy = sy + sh / 2;

      // Convert back to normalized coords
      const normStart = {
        x: (cx - side / 2) / img.width,
        y: (cy - side / 2) / img.height,
      };
      const normEnd = {
        x: (cx + side / 2) / img.width,
        y: (cy + side / 2) / img.height,
      };

      setSavedCrop({
        start: normStart,
        end: normEnd,
        type: "crop-circle",
        background: cropBg,
      });
    } else {
      setSavedCrop({
        start: { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
        end: { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) },
        type: "crop-rect",
      });
    }

    // Clear annotations since coords would be invalid on cropped view
    setLocalAnnotations([]);
    setCropPending(null);
    setCropStart(null);
    setCropEnd(null);
    setActiveTool(null);
  }, [cropPending, cropBg, pushHistory, setActiveTool]);

  const cancelCrop = useCallback(() => {
    setCropPending(null);
    setCropStart(null);
    setCropEnd(null);
  }, []);

  // Detect which resize handle is under the cursor (normalized coords)
  const getHandleAt = useCallback((x: number, y: number): HandleType | null => {
    if (!cropPending) return null;
    const region = cropPending;
    const minX = Math.min(region.start.x, region.end.x);
    const minY = Math.min(region.start.y, region.end.y);
    const maxX = Math.max(region.start.x, region.end.x);
    const maxY = Math.max(region.start.y, region.end.y);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const handles: { type: HandleType; hx: number; hy: number }[] = [
      { type: "tl", hx: minX, hy: minY },
      { type: "tc", hx: midX, hy: minY },
      { type: "tr", hx: maxX, hy: minY },
      { type: "ml", hx: minX, hy: midY },
      { type: "mr", hx: maxX, hy: midY },
      { type: "bl", hx: minX, hy: maxY },
      { type: "bc", hx: midX, hy: maxY },
      { type: "br", hx: maxX, hy: maxY },
    ];

    const threshold = 0.015;
    for (const h of handles) {
      if (Math.abs(x - h.hx) < threshold && Math.abs(y - h.hy) < threshold) {
        return h.type;
      }
    }
    return null;
  }, [cropPending]);

  // Check if point is inside crop region
  const isInsideCrop = useCallback((x: number, y: number): boolean => {
    if (!cropPending) return false;
    const minX = Math.min(cropPending.start.x, cropPending.end.x);
    const minY = Math.min(cropPending.start.y, cropPending.end.y);
    const maxX = Math.max(cropPending.start.x, cropPending.end.x);
    const maxY = Math.max(cropPending.start.y, cropPending.end.y);

    if (cropPending.type === "crop-circle" && imageRef.current) {
      const imgW = imageRef.current.width;
      const imgH = imageRef.current.height;
      const cxPx = ((minX + maxX) / 2) * imgW;
      const cyPx = ((minY + maxY) / 2) * imgH;
      const rPx = Math.min((maxX - minX) * imgW, (maxY - minY) * imgH) / 2;
      const dx = x * imgW - cxPx;
      const dy = y * imgH - cyPx;
      return dx * dx + dy * dy <= rPx * rPx;
    }

    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  }, [cropPending]);

  // Resize crop region by dragging a handle
  const resizeCrop = useCallback((handle: HandleType, x: number, y: number) => {
    if (!cropPending) return;

    const region = cropPending;
    let minX = Math.min(region.start.x, region.end.x);
    let minY = Math.min(region.start.y, region.end.y);
    let maxX = Math.max(region.start.x, region.end.x);
    let maxY = Math.max(region.start.y, region.end.y);

    const isCircle = region.type === "crop-circle";

    // Update bounds based on handle
    if (handle === "tl") { minX = x; minY = y; }
    else if (handle === "tc") { minY = y; }
    else if (handle === "tr") { maxX = x; minY = y; }
    else if (handle === "ml") { minX = x; }
    else if (handle === "mr") { maxX = x; }
    else if (handle === "bl") { minX = x; maxY = y; }
    else if (handle === "bc") { maxY = y; }
    else if (handle === "br") { maxX = x; maxY = y; }

    // For circle: force square in pixel space
    if (isCircle && imageRef.current) {
      const imgW = imageRef.current.width;
      const imgH = imageRef.current.height;
      const wPx = (maxX - minX) * imgW;
      const hPx = (maxY - minY) * imgH;
      const sizePx = Math.max(wPx, hPx);
      const sizeNormW = sizePx / imgW;
      const sizeNormH = sizePx / imgH;

      if (handle === "tl") {
        minX = maxX - sizeNormW;
        minY = maxY - sizeNormH;
      } else if (handle === "tc") {
        const cx = (minX + maxX) / 2;
        minX = cx - sizeNormW / 2;
        maxX = cx + sizeNormW / 2;
        minY = maxY - sizeNormH;
      } else if (handle === "tr") {
        maxX = minX + sizeNormW;
        minY = maxY - sizeNormH;
      } else if (handle === "ml") {
        const cy = (minY + maxY) / 2;
        minY = cy - sizeNormH / 2;
        maxY = cy + sizeNormH / 2;
        minX = maxX - sizeNormW;
      } else if (handle === "mr") {
        const cy = (minY + maxY) / 2;
        minY = cy - sizeNormH / 2;
        maxY = cy + sizeNormH / 2;
        maxX = minX + sizeNormW;
      } else if (handle === "bl") {
        minX = maxX - sizeNormW;
        maxY = minY + sizeNormH;
      } else if (handle === "bc") {
        const cx = (minX + maxX) / 2;
        minX = cx - sizeNormW / 2;
        maxX = cx + sizeNormW / 2;
        maxY = minY + sizeNormH;
      } else if (handle === "br") {
        maxX = minX + sizeNormW;
        maxY = minY + sizeNormH;
      }
    }

    setCropPending({
      start: { x: minX, y: minY },
      end: { x: maxX, y: maxY },
      type: region.type,
    });
  }, [cropPending]);

  // Mouse handlers
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    // Rotate tool interactions
    if (activeTool === "rotate" && !savedCrop) {
      // Check if clicking on pivot to drag it
      if (isNearPivot(coords.x, coords.y)) {
        // Initialize pivot if null (was at center)
        if (!pivot) setPivot({ x: 0.5, y: 0.5 });
        setIsDraggingPivot(true);
        return;
      }
      // Start rotation drag
      const canvas = canvasRef.current;
      if (canvas) {
        const pivotX = pivot ? pivot.x : 0.5;
        const pivotY = pivot ? pivot.y : 0.5;
        const dx = coords.x - pivotX;
        const dy = coords.y - pivotY;
        rotateStartAngleRef.current = Math.atan2(dy, dx);
        rotationBeforeDragRef.current = rotation;
        pushHistory();
        setIsRotating(true);
      }
      return;
    }

    // Handle resize or drag on pending crop
    if (cropPending) {
      const handle = getHandleAt(coords.x, coords.y);
      if (handle) {
        setDraggingHandle(handle);
        return;
      }
      // If clicking inside the crop region, start dragging it
      if (isInsideCrop(coords.x, coords.y)) {
        cropDragOriginRef.current = { x: coords.x, y: coords.y };
        setIsDraggingCrop(true);
        return;
      }
    }

    // Crop drag start
    if (isCropTool && !cropPending && !savedCrop) {
      setCropStart(coords);
      setCropEnd(coords);
      setIsDragging(true);
      return;
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    // Update hover handle and inside-crop for cursor
    if (cropPending && !isDragging && !draggingHandle && !isDraggingPivot && !isRotating && !isDraggingCrop) {
      const handle = getHandleAt(coords.x, coords.y);
      setHoverHandle(handle);
      if (!handle) {
        setHoverInsideCrop(isInsideCrop(coords.x, coords.y));
      } else {
        setHoverInsideCrop(false);
      }
    } else if (!draggingHandle) {
      setHoverHandle(null);
      setHoverInsideCrop(false);
    }

    // Interactive rotation drag
    if (isRotating) {
      const pivotX = pivot ? pivot.x : 0.5;
      const pivotY = pivot ? pivot.y : 0.5;
      const dx = coords.x - pivotX;
      const dy = coords.y - pivotY;
      const currentAngle = Math.atan2(dy, dx);
      const delta = (currentAngle - rotateStartAngleRef.current) * (180 / Math.PI);
      setRotation(((rotationBeforeDragRef.current + delta) % 360 + 360) % 360);
      return;
    }

    if (isDraggingPivot) {
      setPivot({ x: coords.x, y: coords.y });
      return;
    }

    if (isDraggingCrop && cropPending && cropDragOriginRef.current) {
      const dx = coords.x - cropDragOriginRef.current.x;
      const dy = coords.y - cropDragOriginRef.current.y;
      setCropPending({
        start: { x: cropPending.start.x + dx, y: cropPending.start.y + dy },
        end: { x: cropPending.end.x + dx, y: cropPending.end.y + dy },
        type: cropPending.type,
      });
      cropDragOriginRef.current = { x: coords.x, y: coords.y };
      return;
    }

    if (draggingHandle) {
      resizeCrop(draggingHandle, coords.x, coords.y);
      return;
    }

    if (isDragging && isCropTool) {
      if (activeTool === "crop-circle" && cropStart && imageRef.current) {
        // Force square in pixel space during drag
        const imgW = imageRef.current.width;
        const imgH = imageRef.current.height;
        const dxPx = (coords.x - cropStart.x) * imgW;
        const dyPx = (coords.y - cropStart.y) * imgH;
        const sizePx = Math.max(Math.abs(dxPx), Math.abs(dyPx));
        setCropEnd({
          x: cropStart.x + (sizePx * Math.sign(dxPx || 1)) / imgW,
          y: cropStart.y + (sizePx * Math.sign(dyPx || 1)) / imgH,
        });
      } else {
        setCropEnd(coords);
      }
    }
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isRotating) {
      setIsRotating(false);
      return;
    }

    if (isDraggingPivot) {
      setIsDraggingPivot(false);
      return;
    }

    if (isDraggingCrop) {
      setIsDraggingCrop(false);
      cropDragOriginRef.current = null;
      return;
    }

    if (draggingHandle) {
      setDraggingHandle(null);
      return;
    }

    if (isDragging && isCropTool && cropStart && cropEnd) {
      const coords = getCanvasCoords(e);
      if (coords) {
        let finalEnd = coords;
        if (activeTool === "crop-circle" && imageRef.current) {
          const imgW = imageRef.current.width;
          const imgH = imageRef.current.height;
          const dxPx = (coords.x - cropStart.x) * imgW;
          const dyPx = (coords.y - cropStart.y) * imgH;
          const sizePx = Math.max(Math.abs(dxPx), Math.abs(dyPx));
          finalEnd = {
            x: cropStart.x + (sizePx * Math.sign(dxPx || 1)) / imgW,
            y: cropStart.y + (sizePx * Math.sign(dyPx || 1)) / imgH,
          };
        }
        setCropEnd(finalEnd);
        setCropPending({
          start: cropStart,
          end: finalEnd,
          type: activeTool as "crop-rect" | "crop-circle",
        });
      }
      setIsDragging(false);
      return;
    }
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    // Don't process clicks during crop/rotate modes or if already handled by mousedown
    if (isCropTool || activeTool === "rotate" || cropPending) return;

    // Use image-space coords so annotations follow rotation
    const coords = savedCrop ? getCanvasCoords(e) : getImageCoords(e);
    if (!coords) return;

    if (activeTool === "eraser") {
      handleRemoveAt(coords.x, coords.y);
    } else if (activeTool === AnnotationType.Text) {
      const text = prompt("Texto:");
      if (text) handleAddAnnotation(coords.x, coords.y, text);
    } else if (activeTool) {
      handleAddAnnotation(coords.x, coords.y);
    }
  }

  // Get cursor style
  const [hoverHandle, setHoverHandle] = useState<HandleType | null>(null);

  // Track if hovering inside crop region for cursor
  const [hoverInsideCrop, setHoverInsideCrop] = useState(false);

  const getCursorStyle = () => {
    if (isDraggingCrop) return "grabbing";
    if (draggingHandle || hoverHandle) {
      const h = draggingHandle || hoverHandle;
      if (h === "tl" || h === "br") return "nwse-resize";
      if (h === "tr" || h === "bl") return "nesw-resize";
      if (h === "tc" || h === "bc") return "ns-resize";
      if (h === "ml" || h === "mr") return "ew-resize";
    }
    if (cropPending && hoverInsideCrop) return "grab";
    if (activeTool === "rotate") return isRotating ? "grabbing" : "grab";
    if (isCropTool) return "crosshair";
    return "crosshair";
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2">
        <AnnotationToolbar
          activeTool={activeTool}
          activeColor={activeColor}
          onSelectTool={(tool) => {
            setActiveTool(tool);
            cancelCrop();
          }}
          onSelectColor={setActiveColor}
          onClear={() => {
            pushHistory();
            setLocalAnnotations([]);
          }}
          onUndo={undo}
          canUndo={canUndo}
        />
        <div className="flex gap-2">
          {savedCrop && (
            <Button
              variant="ghost"
              size="sm"
              className="text-orange-400 hover:text-orange-300"
              onClick={() => {
                pushHistory();
                setSavedCrop(null);
              }}
            >
              Quitar recorte
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSave(localAnnotations, rotation, savedCrop)}
          >
            Guardar
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white">
            <X size={18} />
          </Button>
        </div>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-auto p-4">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="max-h-full max-w-full"
          style={{ imageRendering: "auto", cursor: getCursorStyle() }}
        />
        {/* Crop action bar */}
        {cropPending && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-lg bg-gray-800 px-4 py-2 shadow-lg">
            {cropPending.type === "crop-circle" && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Fondo:</span>
                {([
                  { value: "black" as const, color: "#000000", border: "border-gray-500" },
                  { value: "white" as const, color: "#ffffff", border: "border-gray-500" },
                  { value: "transparent" as const, color: "", border: "border-gray-500" },
                ]).map(({ value, color, border }) => (
                  <button
                    key={value}
                    onClick={() => setCropBg(value)}
                    title={value === "black" ? "Negro" : value === "white" ? "Blanco" : "Transparente"}
                    className={cn(
                      "h-5 w-5 rounded-full border-2 transition-transform",
                      cropBg === value ? "scale-110 border-blue-400" : border
                    )}
                    style={
                      value === "transparent"
                        ? { background: "repeating-conic-gradient(#808080 0% 25%, #c0c0c0 0% 50%) 50%/8px 8px" }
                        : { backgroundColor: color }
                    }
                  />
                ))}
              </div>
            )}
            <Button variant="primary" size="sm" onClick={applyCrop}>
              <Check size={14} className="mr-1" />
              Aplicar recorte
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelCrop} className="text-white">
              <X size={14} className="mr-1" />
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
