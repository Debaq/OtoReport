import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { X, Circle, Square, RectangleHorizontal, Trash2, Type, Move, ArrowUp, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { renderAnnotation } from "./SymbolStamps";
import { renderTympanicOverlay, hitTestTympanicHandle } from "./TympanicOverlay";
import type { TympanicHandleId } from "./TympanicOverlay";
import { useAnnotation } from "@/hooks/useAnnotation";
import type { Annotation, FrameShape, TympanicReference, ViewportData, ImageAdjustments } from "@/types/annotation";
import { AnnotationType } from "@/types/annotation";
import type { EarSide } from "@/types/image";
import { cn } from "@/lib/utils";
import { applyPixelFilters } from "@/lib/image-filters";
import { useTranslation } from "react-i18next";

const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  temperature: 0,
  clahe: false,
  claheClipLimit: 2,
  invert: false,
  sharpen: 0,
};

const DEFAULT_VIEWPORT: ViewportData = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

interface ImageAnnotatorProps {
  imageUrl: string;
  annotations: Annotation[];
  rotation: number;
  frameShape?: FrameShape | null;
  background?: "black" | "white" | "transparent";
  side?: EarSide;
  tympanicRef?: TympanicReference | null;
  viewport?: ViewportData | null;
  adjustments?: ImageAdjustments | null;
  onSave: (annotations: Annotation[], rotation: number, frameShape?: FrameShape | null, background?: "black" | "white" | "transparent", tympanicRef?: TympanicReference | null, viewport?: ViewportData | null, adjustments?: ImageAdjustments | null) => void;
}

interface HistoryEntry {
  annotations: Annotation[];
  rotation: number;
  pivot: { x: number; y: number } | null;
  frameShape: FrameShape | null;
  tympanicRef: TympanicReference | null;
  viewport: ViewportData;
  adjustments: ImageAdjustments;
}

function computeRotatedBounds(
  w: number, h: number, rot: number,
  px: number, py: number,
): { lw: number; lh: number; offsetX: number; offsetY: number } {
  if (rot === 0) return { lw: w, lh: h, offsetX: 0, offsetY: 0 };
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => ({
    x: px + (x - px) * cos - (y - py) * sin,
    y: py + (x - px) * sin + (y - py) * cos,
  }));
  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    lw: Math.ceil(Math.max(...xs) - minX),
    lh: Math.ceil(Math.max(...ys) - minY),
    offsetX: -minX,
    offsetY: -minY,
  };
}

const TYMPANIC_STEP_KEYS = [
  "editor.tpiUmbo",
  "editor.tpiShortProcess",
  "editor.tpiAnnulus1",
  "editor.tpiAnnulus2",
  "editor.tpiAnnulus3",
  "editor.tpiAnnulus4",
  "editor.tpiAnnulus5",
];

export function ImageAnnotator({
  imageUrl,
  annotations: initialAnnotations,
  rotation: initialRotation,
  frameShape: initialFrameShape,
  background: initialBackground,
  side,
  tympanicRef: initialTympanicRef,
  viewport: initialViewport,
  adjustments: initialAdjustments,
  onSave,
}: ImageAnnotatorProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Viewport (zoom & pan)
  const [viewport, setViewport] = useState<ViewportData>({ ...DEFAULT_VIEWPORT });
  const viewportInitializedRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [frameSize, setFrameSize] = useState<{ w: number; h: number } | null>(null);

  // Image adjustments
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(initialAdjustments ?? { ...DEFAULT_ADJUSTMENTS });
  const [showAdjustments, setShowAdjustments] = useState(false);

  // Frame shape
  const [frameShape, setFrameShape] = useState<FrameShape | null>(initialFrameShape ?? null);
  const [frameBg, setFrameBg] = useState<"black" | "white" | "transparent">(
    initialBackground ?? "black"
  );

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

  // Pivot drag state
  const [isDraggingPivot, setIsDraggingPivot] = useState(false);

  // Tympanic reference state
  const [tympanicRef, setTympanicRef] = useState<TympanicReference | null>(initialTympanicRef ?? null);
  const [tympanicStep, setTympanicStep] = useState<number | null>(null);
  const [draggingTympanicHandle, setDraggingTympanicHandle] = useState<TympanicHandleId | null>(null);

  // Annotation selection & drag state (pointer tool)
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [draggingAnnotation, setDraggingAnnotation] = useState<string | null>(null);
  const dragAnnotationStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  // Pending text input (replaces native prompt)
  const [pendingText, setPendingText] = useState<{ x: number; y: number } | null>(null);
  const [pendingTextValue, setPendingTextValue] = useState("");
  const pendingTextRef = useRef<HTMLInputElement>(null);

  // Interactive rotation drag state
  const [isRotating, setIsRotating] = useState(false);
  const rotateStartAngleRef = useRef(0);
  const rotationBeforeDragRef = useRef(0);

  // Undo history
  const historyRef = useRef<HistoryEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const pushHistory = useCallback(() => {
    historyRef.current.push({
      annotations: [...localAnnotations],
      rotation,
      pivot: pivot ? { ...pivot } : null,
      frameShape,
      tympanicRef: tympanicRef ? JSON.parse(JSON.stringify(tympanicRef)) : null,
      viewport: { ...viewport },
      adjustments: { ...adjustments },
    });
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
    setCanUndo(true);
  }, [localAnnotations, rotation, pivot, frameShape, tympanicRef, viewport, adjustments]);

  const undo = useCallback(() => {
    const entry = historyRef.current.pop();
    if (!entry) return;
    setLocalAnnotations(entry.annotations);
    setRotation(entry.rotation);
    setPivot(entry.pivot);
    setFrameShape(entry.frameShape);
    setTympanicRef(entry.tympanicRef);
    setViewport(entry.viewport);
    setAdjustments(entry.adjustments);
    setTympanicStep(null);
    setCanUndo(historyRef.current.length > 0);
  }, [setRotation, setPivot]);

  const handleAddAnnotation = useCallback(
    (x: number, y: number, text?: string) => {
      if (!activeTool || activeTool === "eraser" || activeTool === "rotate" || activeTool === "tympanic-map" || activeTool === "pan" || activeTool === "pointer") return;
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

  // Keyboard handlers for space (pan mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        // Don't hijack space when typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceHeld(false);
        setIsPanning(false);
        panStartRef.current = null;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Wheel handler for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setViewport((prev) => {
        const newZoom = Math.min(Math.max(prev.zoom * zoomFactor, 1), 10);
        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left - rect.width / 2;
        const my = e.clientY - rect.top - rect.height / 2;
        const scale = newZoom / prev.zoom;
        return {
          zoom: newZoom,
          panX: mx - scale * (mx - prev.panX),
          panY: my - scale * (my - prev.panY),
        };
      });
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Helper to get normalized coords in image space from mouse event
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return null;
    const rect = canvas.getBoundingClientRect();

    // Convert to image-normalized coords (accounting for expansion offset)
    const pivotX = pivot ? pivot.x * img.width : img.width / 2;
    const pivotY = pivot ? pivot.y * img.height : img.height / 2;
    const { lw, lh, offsetX, offsetY } = computeRotatedBounds(img.width, img.height, rotation, pivotX, pivotY);

    const logicalX = (e.clientX - rect.left) * lw / rect.width;
    const logicalY = (e.clientY - rect.top) * lh / rect.height;

    return {
      x: (logicalX - offsetX) / img.width,
      y: (logicalY - offsetY) / img.height,
    };
  }, [rotation, pivot]);

  // Check if mouse is near pivot
  const isNearPivot = useCallback((x: number, y: number) => {
    const px = pivot ? pivot.x : 0.5;
    const py = pivot ? pivot.y : 0.5;
    const threshold = 0.025 / viewport.zoom;
    return Math.abs(x - px) < threshold && Math.abs(y - py) < threshold;
  }, [pivot, viewport.zoom]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderScale = Math.min(viewport.zoom, 4);

    // Expand canvas to fit rotated image
    const imgW = img.width;
    const imgH = img.height;
    const pivotX = pivot ? pivot.x * imgW : imgW / 2;
    const pivotY = pivot ? pivot.y * imgH : imgH / 2;
    const { lw, lh, offsetX, offsetY } = computeRotatedBounds(imgW, imgH, rotation, pivotX, pivotY);

    canvas.width = lw * renderScale;
    canvas.height = lh * renderScale;
    ctx.scale(renderScale, renderScale);
    ctx.clearRect(0, 0, lw, lh);

    // Draw rotated image in expanded canvas
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.translate(pivotX, pivotY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-pivotX, -pivotY);
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    // Annotations and overlays in image space (with offset, not rotated)
    ctx.save();
    ctx.translate(offsetX, offsetY);
    localAnnotations.forEach((a) => {
      renderAnnotation(ctx, a, imgW, imgH);
    });
    if (tympanicRef && side) {
      renderTympanicOverlay(ctx, tympanicRef, side, imgW, imgH);
    }
    // Selection highlight
    if (selectedAnnotation) {
      const sel = localAnnotations.find((a) => a.id === selectedAnnotation);
      if (sel) {
        const sx = sel.x * imgW;
        const sy = sel.y * imgH;
        const uiScale = imgW / ((frameSize?.w || imgW) * viewport.zoom);
        const r = 14 * uiScale;
        ctx.save();
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2 * uiScale;
        ctx.setLineDash([4 * uiScale, 3 * uiScale]);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();

    // Draw rotation overlay when rotate tool is active
    if (activeTool === "rotate") {
      const { offsetX: rotOffX, offsetY: rotOffY } = computeRotatedBounds(imgW, imgH, rotation, pivotX, pivotY);
      const rad = (rotation * Math.PI) / 180;
      const uiScale = imgW / ((frameSize?.w || imgW) * viewport.zoom);

      // Compute rotated bounding box corners
      const corners = [
        { x: 0, y: 0 },
        { x: imgW, y: 0 },
        { x: imgW, y: imgH },
        { x: 0, y: imgH },
      ].map((c) => {
        const dx = c.x - pivotX;
        const dy = c.y - pivotY;
        return {
          x: rotOffX + pivotX + dx * Math.cos(rad) - dy * Math.sin(rad),
          y: rotOffY + pivotY + dx * Math.sin(rad) + dy * Math.cos(rad),
        };
      });

      // Dashed bounding box
      ctx.save();
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 2 * uiScale;
      ctx.setLineDash([8 * uiScale, 4 * uiScale]);
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // Corner handles
      const handleSize = 5 * uiScale;
      corners.forEach((c) => {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2 * uiScale;
        ctx.fillRect(c.x - handleSize, c.y - handleSize, handleSize * 2, handleSize * 2);
        ctx.strokeRect(c.x - handleSize, c.y - handleSize, handleSize * 2, handleSize * 2);
      });
      ctx.restore();

      // Pivot indicator
      const pvX = rotOffX + pivotX;
      const pvY = rotOffY + pivotY;
      ctx.save();
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 2 * uiScale;
      const pSize = 12 * uiScale;
      ctx.beginPath();
      ctx.moveTo(pvX - pSize, pvY);
      ctx.lineTo(pvX + pSize, pvY);
      ctx.moveTo(pvX, pvY - pSize);
      ctx.lineTo(pvX, pvY + pSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pvX, pvY, 8 * uiScale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Angle overlay
      if (rotation !== 0) {
        const fontSize = Math.round(14 * uiScale);
        const angleText = `${rotation.toFixed(1)}°`;
        ctx.save();
        ctx.font = `bold ${fontSize}px sans-serif`;
        const metrics = ctx.measureText(angleText);
        const tw = metrics.width + 12 * uiScale;
        const th = 22 * uiScale;
        const vcx = canvas.width / (2 * renderScale);
        const vcy = 12 * uiScale + 12 * uiScale;
        const tx = vcx - tw / 2;
        const ty = Math.max(4 * uiScale, vcy - th);
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 4 * uiScale);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(angleText, vcx, ty + th / 2);
        ctx.restore();
      }
    }

    // Apply pixel-level filters
    applyPixelFilters(ctx, canvas.width, canvas.height, adjustments);
  }, [rotation, localAnnotations, loaded, activeTool, pivot, tympanicRef, side, viewport.zoom, viewport.panX, viewport.panY, adjustments, frameSize, selectedAnnotation]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Compute frame size based on image dimensions and available container space
  useEffect(() => {
    if (!loaded || !imageRef.current || !containerRef.current) return;
    const measure = () => {
      const img = imageRef.current;
      const container = containerRef.current;
      if (!img || !container) return;
      const rect = container.getBoundingClientRect();
      const availW = rect.width - 32;
      const availH = rect.height - 32;

      const contentW = img.width;
      const contentH = img.height;

      const aspect = contentW / contentH;
      let displayW = contentW;
      let displayH = contentH;
      if (displayW > availW) {
        displayW = availW;
        displayH = displayW / aspect;
      }
      if (displayH > availH) {
        displayH = availH;
        displayW = displayH * aspect;
      }
      setFrameSize((prev) => {
        if (prev && Math.abs(prev.w - displayW) < 1 && Math.abs(prev.h - displayH) < 1) return prev;
        return { w: displayW, h: displayH };
      });
    };
    requestAnimationFrame(measure);
  }, [loaded]);

  // Canvas CSS size: expands with rotation while frameSize (printable area) stays fixed
  const canvasDisplaySize = useMemo(() => {
    const img = imageRef.current;
    if (!frameSize || !img || !loaded) return { width: frameSize?.w, height: frameSize?.h };

    const pvX = pivot ? pivot.x * img.width : img.width / 2;
    const pvY = pivot ? pivot.y * img.height : img.height / 2;
    const { lw, lh } = computeRotatedBounds(img.width, img.height, rotation, pvX, pvY);

    const scale = frameSize.w / img.width;
    return { width: lw * scale, height: lh * scale };
  }, [frameSize, loaded, rotation, pivot]);

  // Restore viewport from saved normalized values once frameSize is known
  useEffect(() => {
    if (frameSize && initialViewport && !viewportInitializedRef.current) {
      viewportInitializedRef.current = true;
      setViewport({
        zoom: initialViewport.zoom,
        panX: initialViewport.panX * frameSize.w,
        panY: initialViewport.panY * frameSize.h,
      });
    }
  }, [frameSize, initialViewport]);

  // Hit-test: find annotation near coords
  const hitTestAnnotation = useCallback((x: number, y: number): string | null => {
    const threshold = 0.03;
    for (let i = localAnnotations.length - 1; i >= 0; i--) {
      const a = localAnnotations[i];
      if (Math.abs(a.x - x) < threshold && Math.abs(a.y - y) < threshold) {
        return a.id;
      }
    }
    return null;
  }, [localAnnotations]);

  // Mouse handlers
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    // Pan with middle mouse button, space+left click, or pan tool
    if (e.button === 1 || (e.button === 0 && (spaceHeld || activeTool === "pan"))) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
      return;
    }

    const coords = getCanvasCoords(e);
    if (!coords) return;

    // Tympanic handle drag
    if (tympanicRef && tympanicStep === null && activeTool === "tympanic-map") {
      const handle = hitTestTympanicHandle(coords.x, coords.y, tympanicRef, 0.025);
      if (handle) {
        pushHistory();
        setDraggingTympanicHandle(handle);
        return;
      }
    }

    // Pointer tool: grab annotation to drag
    if (activeTool === "pointer") {
      const hitId = hitTestAnnotation(coords.x, coords.y);
      if (hitId) {
        pushHistory();
        setDraggingAnnotation(hitId);
        setSelectedAnnotation(hitId);
        dragAnnotationStartRef.current = { x: coords.x, y: coords.y };
        didDragRef.current = false;
        return;
      }
      // Click on empty area deselects
      setSelectedAnnotation(null);
    }

    // Rotate tool interactions
    if (activeTool === "rotate") {
      if (isNearPivot(coords.x, coords.y)) {
        if (!pivot) setPivot({ x: 0.5, y: 0.5 });
        setIsDraggingPivot(true);
        return;
      }
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
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    // Pan drag
    if (isPanning && panStartRef.current) {
      const start = panStartRef.current;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      setViewport((prev) => ({
        ...prev,
        panX: start.panX + dx,
        panY: start.panY + dy,
      }));
      return;
    }

    const coords = getCanvasCoords(e);
    if (!coords) return;

    // Tympanic handle drag
    if (draggingTympanicHandle && tympanicRef) {
      if (draggingTympanicHandle === "umbo") {
        setTympanicRef({ ...tympanicRef, umbo: { x: coords.x, y: coords.y } });
      } else if (draggingTympanicHandle === "shortProcess") {
        setTympanicRef({ ...tympanicRef, shortProcess: { x: coords.x, y: coords.y } });
      } else {
        const idx = parseInt(draggingTympanicHandle.replace("annulus", ""));
        const newAnnulus = [...tympanicRef.annulusPoints] as TympanicReference["annulusPoints"];
        newAnnulus[idx] = { x: coords.x, y: coords.y };
        setTympanicRef({ ...tympanicRef, annulusPoints: newAnnulus });
      }
      return;
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

    // Annotation drag
    if (draggingAnnotation && dragAnnotationStartRef.current) {
      const dx = coords.x - dragAnnotationStartRef.current.x;
      const dy = coords.y - dragAnnotationStartRef.current.y;
      didDragRef.current = true;
      setLocalAnnotations((prev) =>
        prev.map((a) =>
          a.id === draggingAnnotation ? { ...a, x: a.x + dx, y: a.y + dy } : a
        )
      );
      dragAnnotationStartRef.current = { x: coords.x, y: coords.y };
      return;
    }
  }

  function handleMouseUp() {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      return;
    }

    if (draggingTympanicHandle) {
      setDraggingTympanicHandle(null);
      return;
    }

    if (isRotating) {
      setIsRotating(false);
      return;
    }

    if (isDraggingPivot) {
      setIsDraggingPivot(false);
      return;
    }

    if (draggingAnnotation) {
      setDraggingAnnotation(null);
      dragAnnotationStartRef.current = null;
      // didDragRef is consumed in handleCanvasClick
      return;
    }
  }

  // Tympanic map: place point for current step
  const handleTympanicClick = useCallback((x: number, y: number) => {
    if (tympanicStep === null) return;

    pushHistory();

    if (tympanicStep === 0) {
      setTympanicRef({
        umbo: { x, y },
        shortProcess: { x, y },
        annulusPoints: [{ x, y }, { x, y }, { x, y }, { x, y }, { x, y }],
        showOverlay: true,
      });
      setTympanicStep(1);
    } else if (tympanicStep === 1 && tympanicRef) {
      setTympanicRef({ ...tympanicRef, shortProcess: { x, y } });
      setTympanicStep(2);
    } else if (tympanicStep >= 2 && tympanicStep <= 6 && tympanicRef) {
      const idx = tympanicStep - 2;
      const newAnnulus = [...tympanicRef.annulusPoints] as TympanicReference["annulusPoints"];
      newAnnulus[idx] = { x, y };
      setTympanicRef({ ...tympanicRef, annulusPoints: newAnnulus });
      if (tympanicStep < 6) {
        setTympanicStep(tympanicStep + 1);
      } else {
        setTympanicStep(null);
      }
    }
  }, [tympanicStep, tympanicRef, pushHistory]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    // Skip click if we just finished dragging an annotation
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    if (activeTool === "rotate" || activeTool === "pan" || activeTool === "pointer") return;

    // Tympanic map placement
    if (activeTool === "tympanic-map" && tympanicStep !== null) {
      const coords = getCanvasCoords(e);
      if (coords) handleTympanicClick(coords.x, coords.y);
      return;
    }

    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (activeTool === "eraser") {
      handleRemoveAt(coords.x, coords.y);
    } else if (activeTool === AnnotationType.Text) {
      setPendingText(coords);
      setPendingTextValue("");
      setTimeout(() => pendingTextRef.current?.focus(), 50);
      return;
    } else if (activeTool) {
      handleAddAnnotation(coords.x, coords.y);
    }
  }

  const confirmPendingText = useCallback(() => {
    if (pendingText && pendingTextValue.trim()) {
      handleAddAnnotation(pendingText.x, pendingText.y, pendingTextValue.trim());
    }
    setPendingText(null);
    setPendingTextValue("");
  }, [pendingText, pendingTextValue, handleAddAnnotation]);

  const cancelPendingText = useCallback(() => {
    setPendingText(null);
    setPendingTextValue("");
  }, []);

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    pushHistory();
    setLocalAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, [pushHistory]);

  const removeAnnotation = useCallback((id: string) => {
    pushHistory();
    setLocalAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, [pushHistory]);

  const textAnnotations = localAnnotations.filter((a) => a.type === AnnotationType.Text);
  const markAnnotations = localAnnotations.filter((a) => a.type !== AnnotationType.Text);

  // Color picker popover state
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const PALETTE = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ffffff", "#000000"];

  // Arrow key movement for selected annotation
  useEffect(() => {
    if (!selectedAnnotation) return;
    const handleArrowKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const step = e.shiftKey ? 0.01 : 0.002;
      let dx = 0, dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else if (e.key === "Escape") { setSelectedAnnotation(null); return; }
      else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeAnnotation(selectedAnnotation);
        setSelectedAnnotation(null);
        return;
      }
      else return;
      e.preventDefault();
      setLocalAnnotations((prev) =>
        prev.map((a) =>
          a.id === selectedAnnotation ? { ...a, x: a.x + dx, y: a.y + dy } : a
        )
      );
    };
    window.addEventListener("keydown", handleArrowKey);
    return () => window.removeEventListener("keydown", handleArrowKey);
  }, [selectedAnnotation, removeAnnotation]);

  // Get cursor style
  const getCursorStyle = () => {
    if (isPanning) return "grabbing";
    if (draggingAnnotation) return "grabbing";
    if (spaceHeld || activeTool === "pan") return "grab";
    if (activeTool === "rotate") return isRotating ? "grabbing" : "grab";
    if (activeTool === "pointer") return "default";
    return "crosshair";
  };

  const hasViewportChanges = viewport.zoom !== 1 || viewport.panX !== 0 || viewport.panY !== 0;
  const hasAdjustmentChanges = adjustments.brightness !== 100 || adjustments.contrast !== 100 || adjustments.saturate !== 100 || adjustments.temperature !== 0 || adjustments.clahe || adjustments.invert || adjustments.sharpen > 0;

  const resetViewport = useCallback(() => {
    setViewport({ ...DEFAULT_VIEWPORT });
  }, []);

  const resetAdjustments = useCallback(() => {
    setAdjustments({ ...DEFAULT_ADJUSTMENTS });
  }, []);

  // Compute visible area overlay dimensions for different frame shapes
  const visibleAreaStyle = useMemo(() => {
    if (!frameSize) return null;
    const shape = frameShape ?? "rectangle";
    if (shape === "rectangle") {
      return {
        width: frameSize.w,
        height: frameSize.h,
        borderRadius: "4px",
      };
    }
    // Square or circle: use the smaller dimension
    const side = Math.min(frameSize.w, frameSize.h);
    return {
      width: side,
      height: side,
      borderRadius: shape === "circle" ? "9999px" : "4px",
    };
  }, [frameSize, frameShape]);

  // For circle with black/white bg: show a dotted square border around the circle
  const showDottedSquare = frameShape === "circle" && frameBg !== "transparent";
  const dottedSquareSize = useMemo(() => {
    if (!showDottedSquare || !frameSize) return null;
    const side = Math.min(frameSize.w, frameSize.h);
    return { width: side, height: side };
  }, [showDottedSquare, frameSize]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      {/* Fila 1: Herramientas de anotación + colores + deshacer */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-1.5 border-b border-gray-700">
        <AnnotationToolbar
          activeTool={activeTool}
          activeColor={activeColor}
          onSelectTool={(tool) => {
            setActiveTool(tool);
            if (tool === "tympanic-map") {
              if (!tympanicRef) {
                setTympanicStep(0);
              } else {
                setTympanicStep(null);
              }
            } else {
              setTympanicStep(null);
            }
          }}
          onSelectColor={setActiveColor}
          onClear={() => {
            pushHistory();
            setLocalAnnotations([]);
          }}
          onUndo={undo}
          canUndo={canUndo}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const savedViewport = hasViewportChanges && frameSize
              ? { zoom: viewport.zoom, panX: viewport.panX / frameSize.w, panY: viewport.panY / frameSize.h }
              : hasViewportChanges ? viewport : null;
            onSave(
              localAnnotations,
              rotation,
              frameShape,
              frameBg,
              tympanicRef,
              savedViewport,
              hasAdjustmentChanges ? adjustments : null,
            );
          }}
          className="text-white"
        >
          <X size={18} />
        </Button>
      </div>
      {/* Fila 2: Zoom, forma visible, fondo, ajustes */}
      <div className="flex items-center gap-2 bg-gray-800/80 px-4 py-1">
        {/* Zoom controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setViewport((v) => ({ ...v, zoom: Math.max(1, v.zoom / 1.2) }))}
            className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
            title={t("editor.zoomOut")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <span className="text-[11px] text-gray-400 min-w-[2.5rem] text-center select-none tabular-nums">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <button
            onClick={() => setViewport((v) => ({ ...v, zoom: Math.min(10, v.zoom * 1.2) }))}
            className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
            title={t("editor.zoomIn")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          {hasViewportChanges && (
            <button
              onClick={resetViewport}
              className="rounded p-1 text-orange-400 hover:bg-gray-700 hover:text-orange-300 text-[11px]"
              title={t("editor.resetView")}
            >
              1:1
            </button>
          )}
        </div>

        <div className="h-5 w-px bg-gray-600" />

        {/* Frame shape selector */}
        <div className="flex items-center gap-0.5">
          <span className="text-[11px] text-gray-500 mr-1">{t("editor.shape")}</span>
          {([
            { shape: "rectangle" as const, icon: RectangleHorizontal, key: "rectangular" },
            { shape: "square" as const, icon: Square, key: "square" },
            { shape: "circle" as const, icon: Circle, key: "circular" },
          ]).map(({ shape, icon: Icon, key }) => (
            <button
              key={shape}
              onClick={() => {
                pushHistory();
                setFrameShape(shape === "rectangle" ? null : shape);
              }}
              title={t(`editor.${key}`)}
              className={cn(
                "rounded p-1 transition-colors",
                (frameShape ?? "rectangle") === shape
                  ? "bg-cyan-600/30 text-cyan-300"
                  : "text-gray-400 hover:bg-gray-700 hover:text-white"
              )}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        {/* Background selector — circle or rotate */}
        {(frameShape === "circle" || activeTool === "rotate") && (
          <>
            <div className="h-5 w-px bg-gray-600" />
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-500">{t("editor.background")}</span>
              {([
                { value: "black" as const, color: "#000000" },
                { value: "white" as const, color: "#ffffff" },
                { value: "transparent" as const, color: "" },
              ]).map(({ value, color }) => (
                <button
                  key={value}
                  onClick={() => setFrameBg(value)}
                  title={t(`editor.${value}`)}
                  className={cn(
                    "h-4 w-4 rounded-full border-2 transition-transform",
                    frameBg === value ? "scale-110 border-blue-400" : "border-gray-500"
                  )}
                  style={
                    value === "transparent"
                      ? { background: "repeating-conic-gradient(#808080 0% 25%, #c0c0c0 0% 50%) 50%/6px 6px" }
                      : { backgroundColor: color }
                  }
                />
              ))}
            </div>
          </>
        )}

        <div className="h-5 w-px bg-gray-600" />

        {/* Adjustments toggle */}
        <button
          onClick={() => setShowAdjustments((v) => !v)}
          className={cn(
            "rounded p-1 transition-colors",
            showAdjustments ? "bg-cyan-600/30 text-cyan-300" : "text-gray-400 hover:bg-gray-700 hover:text-white"
          )}
          title={t("editor.imageAdjustments")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        </button>
      </div>
      <div ref={containerRef} className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {/* Canvas with zoom/pan */}
        <div
          style={{
            transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
            transformOrigin: "center center",
            willChange: "transform",
          }}
          className="flex items-center justify-center"
        >
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              imageRendering: "auto",
              cursor: getCursorStyle(),
              ...canvasDisplaySize,
              filter: `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%)${adjustments.temperature !== 0 ? ` sepia(${Math.abs(adjustments.temperature)}%) hue-rotate(${adjustments.temperature > 0 ? -20 : 180}deg)` : ""}`,
            }}
          />
        </div>
        {/* Visible area indicator */}
        {visibleAreaStyle && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            {/* Dotted square around circle when bg is black/white */}
            {dottedSquareSize && (
              <div
                className="absolute"
                style={{
                  width: dottedSquareSize.width,
                  height: dottedSquareSize.height,
                  border: "2px dashed rgba(255, 255, 255, 0.4)",
                }}
              />
            )}
            <div
              className="relative"
              style={{
                width: visibleAreaStyle.width,
                height: visibleAreaStyle.height,
                borderRadius: visibleAreaStyle.borderRadius,
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
              }}
            >
              <span className="absolute -top-5 left-1 text-[10px] text-white/50">
                {t("editor.visibleArea")}
              </span>
            </div>
          </div>
        )}
        {/* Tympanic map step indicator */}
        {activeTool === "tympanic-map" && tympanicStep !== null && (
          <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2 flex items-center gap-3 rounded-lg bg-gray-800 px-4 py-2 shadow-lg">
            <span className="text-sm font-medium text-cyan-300">
              {t("editor.step", { current: tympanicStep + 1, total: 7 })}
            </span>
            <span className="text-sm text-white">
              {t(TYMPANIC_STEP_KEYS[tympanicStep])}
            </span>
          </div>
        )}
        {/* Tympanic map action bar */}
        {activeTool === "tympanic-map" && tympanicRef && tympanicStep === null && (
          <div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 flex items-center gap-3 rounded-lg bg-gray-800 px-4 py-2 shadow-lg">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={tympanicRef.showOverlay}
                onChange={(e) => setTympanicRef({ ...tympanicRef, showOverlay: e.target.checked })}
                className="accent-cyan-400"
              />
              {t("editor.includeInExport")}
            </label>
            <Button
              variant="ghost"
              size="sm"
              className="text-cyan-400 hover:text-cyan-300"
              onClick={() => {
                setTympanicStep(0);
              }}
            >
              {t("editor.redoPoints")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-orange-400 hover:text-orange-300"
              onClick={() => {
                pushHistory();
                setTympanicRef(null);
                setTympanicStep(null);
              }}
            >
              {t("editor.deleteMap")}
            </Button>
          </div>
        )}
        {/* Pending text input */}
        {pendingText && (
          <div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 shadow-lg">
            <Type size={14} className="text-gray-400 shrink-0" />
            <input
              ref={pendingTextRef}
              type="text"
              value={pendingTextValue}
              onChange={(e) => setPendingTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmPendingText();
                if (e.key === "Escape") cancelPendingText();
              }}
              placeholder={t("editor.textPlaceholder")}
              className="w-48 rounded bg-gray-700 px-2 py-1 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-cyan-400"
              autoFocus
            />
            <Button variant="primary" size="sm" onClick={confirmPendingText} disabled={!pendingTextValue.trim()}>
              {t("editor.addText")}
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelPendingText} className="text-gray-400 hover:text-white">
              <X size={14} />
            </Button>
          </div>
        )}
        {/* Annotations list panel */}
        {localAnnotations.length > 0 && (
          <div className="absolute left-4 top-4 z-20 flex flex-col gap-1 rounded-lg bg-gray-800/95 backdrop-blur px-3 py-2.5 shadow-lg w-56 max-h-[calc(100%-2rem)] overflow-y-auto">
            {textAnnotations.length > 0 && (
              <>
                <span className="text-[11px] font-medium text-gray-400">{t("editor.texts")}</span>
                {textAnnotations.map((a) => (
                  <div key={a.id} className="flex flex-col">
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded px-1 py-0.5 -mx-1",
                        selectedAnnotation === a.id && "bg-cyan-900/40 ring-1 ring-cyan-500/50"
                      )}
                    >
                      <button
                        onClick={() => setColorPickerFor(colorPickerFor === a.id ? null : a.id)}
                        className="h-4 w-4 shrink-0 rounded-sm border border-gray-500 cursor-pointer"
                        style={{ backgroundColor: a.color }}
                        title={t("editor.changeColor")}
                      />
                      <input
                        type="text"
                        value={a.text || ""}
                        onChange={(e) => updateAnnotation(a.id, { text: e.target.value })}
                        className="flex-1 min-w-0 rounded bg-gray-700 px-1.5 py-0.5 text-[11px] text-white outline-none focus:ring-1 focus:ring-cyan-400"
                      />
                      <button
                        onClick={() => {
                          if (selectedAnnotation === a.id) {
                            setSelectedAnnotation(null);
                          } else {
                            setSelectedAnnotation(a.id);
                            setActiveTool("pointer");
                          }
                        }}
                        className={cn(
                          "shrink-0 rounded p-0.5",
                          selectedAnnotation === a.id
                            ? "text-cyan-400 bg-cyan-900/50"
                            : "text-gray-500 hover:bg-gray-700 hover:text-cyan-400"
                        )}
                        title={t("editor.selectMove")}
                      >
                        <Move size={11} />
                      </button>
                      <button
                        onClick={() => {
                          if (selectedAnnotation === a.id) setSelectedAnnotation(null);
                          removeAnnotation(a.id);
                        }}
                        className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-700 hover:text-red-400"
                        title={t("editor.deleteItem")}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    {colorPickerFor === a.id && (
                      <div className="flex items-center gap-1 py-1 pl-1">
                        {PALETTE.map((c) => (
                          <button
                            key={c}
                            onClick={() => { updateAnnotation(a.id, { color: c }); setColorPickerFor(null); }}
                            className={cn(
                              "h-4 w-4 rounded-full border transition-transform",
                              a.color === c ? "border-cyan-400 scale-110" : "border-gray-500"
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <input
                          type="color"
                          value={a.color}
                          onChange={(e) => updateAnnotation(a.id, { color: e.target.value })}
                          className="h-4 w-4 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 ml-1"
                          title={t("editor.customColor")}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
            {markAnnotations.length > 0 && (
              <>
                {textAnnotations.length > 0 && <div className="h-px bg-gray-700 my-1" />}
                <span className="text-[11px] font-medium text-gray-400">{t("editor.marks")}</span>
                {markAnnotations.map((a) => {
                  const typeLabel =
                    a.type === AnnotationType.Arrow ? t("editor.tools.arrow") :
                    a.type === AnnotationType.Circle ? t("editor.tools.circle") :
                    a.type === AnnotationType.Cross ? t("editor.tools.cross") :
                    a.type === AnnotationType.Dot ? t("editor.tools.dot") : a.type;
                  const TypeIcon =
                    a.type === AnnotationType.Arrow ? ArrowUp :
                    a.type === AnnotationType.Circle ? Circle :
                    a.type === AnnotationType.Cross ? X :
                    Crosshair;
                  return (
                    <div key={a.id} className="flex flex-col">
                      <div
                        className={cn(
                          "flex items-center gap-1.5 rounded px-1 py-0.5 -mx-1",
                          selectedAnnotation === a.id && "bg-cyan-900/40 ring-1 ring-cyan-500/50"
                        )}
                      >
                        <button
                          onClick={() => setColorPickerFor(colorPickerFor === a.id ? null : a.id)}
                          className="h-4 w-4 shrink-0 rounded-sm border border-gray-500 cursor-pointer"
                          style={{ backgroundColor: a.color }}
                          title={t("editor.changeColor")}
                        />
                        <TypeIcon size={11} style={{ color: a.color }} className="shrink-0" />
                        <span className="flex-1 text-[11px] text-gray-300 truncate">{typeLabel}</span>
                        <button
                          onClick={() => {
                            if (selectedAnnotation === a.id) {
                              setSelectedAnnotation(null);
                            } else {
                              setSelectedAnnotation(a.id);
                              setActiveTool("pointer");
                            }
                          }}
                          className={cn(
                            "shrink-0 rounded p-0.5",
                            selectedAnnotation === a.id
                              ? "text-cyan-400 bg-cyan-900/50"
                              : "text-gray-500 hover:bg-gray-700 hover:text-cyan-400"
                          )}
                          title={t("editor.selectMove")}
                        >
                          <Move size={11} />
                        </button>
                        <button
                          onClick={() => {
                            if (selectedAnnotation === a.id) setSelectedAnnotation(null);
                            removeAnnotation(a.id);
                          }}
                          className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-700 hover:text-red-400"
                          title={t("editor.deleteItem")}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                      {colorPickerFor === a.id && (
                        <div className="flex items-center gap-1 py-1 pl-1">
                          {PALETTE.map((c) => (
                            <button
                              key={c}
                              onClick={() => { updateAnnotation(a.id, { color: c }); setColorPickerFor(null); }}
                              className={cn(
                                "h-4 w-4 rounded-full border transition-transform",
                                a.color === c ? "border-cyan-400 scale-110" : "border-gray-500"
                              )}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                          <input
                            type="color"
                            value={a.color}
                            onChange={(e) => updateAnnotation(a.id, { color: e.target.value })}
                            className="h-4 w-4 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 ml-1"
                            title={t("editor.customColor")}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
        {/* Image adjustments panel */}
        {showAdjustments && (
          <div className="absolute right-4 top-4 flex flex-col gap-3 rounded-lg bg-gray-800/95 backdrop-blur px-4 py-3 shadow-lg w-56 z-20 max-h-[calc(100%-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-300">{t("editor.imageAdjustments")}</span>
              {hasAdjustmentChanges && (
                <button onClick={resetAdjustments} className="text-[10px] text-orange-400 hover:text-orange-300">
                  {t("editor.reset")}
                </button>
              )}
            </div>
            {([
              { key: "brightness" as const, i18nKey: "brightness", min: 0, max: 200 },
              { key: "contrast" as const, i18nKey: "contrast", min: 0, max: 200 },
              { key: "saturate" as const, i18nKey: "saturation", min: 0, max: 200 },
              { key: "sharpen" as const, i18nKey: "sharpness", min: 0, max: 100 },
              { key: "temperature" as const, i18nKey: "temperature", min: -100, max: 100 },
            ]).map(({ key, i18nKey, min, max }) => (
              <div key={key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">{t(`editor.${i18nKey}`)}</span>
                  <span className="text-[11px] text-gray-500 tabular-nums w-8 text-right">
                    {adjustments[key]}
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={adjustments[key]}
                  onChange={(e) => setAdjustments((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="w-full h-1 accent-cyan-400 bg-gray-600 rounded-full cursor-pointer"
                />
              </div>
            ))}
            <div className="h-px bg-gray-700" />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={adjustments.clahe}
                onChange={(e) => setAdjustments((prev) => ({ ...prev, clahe: e.target.checked }))}
                className="accent-cyan-400"
              />
              <span className="text-[11px] text-gray-400">{t("editor.clahe")}</span>
            </label>
            {adjustments.clahe && (
              <div className="flex flex-col gap-1 pl-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">{t("editor.clipLimit")}</span>
                  <span className="text-[11px] text-gray-500 tabular-nums w-8 text-right">
                    {adjustments.claheClipLimit.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={8}
                  step={0.5}
                  value={adjustments.claheClipLimit}
                  onChange={(e) => setAdjustments((prev) => ({ ...prev, claheClipLimit: Number(e.target.value) }))}
                  className="w-full h-1 accent-cyan-400 bg-gray-600 rounded-full cursor-pointer"
                />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={adjustments.invert}
                onChange={(e) => setAdjustments((prev) => ({ ...prev, invert: e.target.checked }))}
                className="accent-cyan-400"
              />
              <span className="text-[11px] text-gray-400">{t("editor.invert")}</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
