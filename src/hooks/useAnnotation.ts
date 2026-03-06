import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Annotation, EditorTool } from "@/types/annotation";

interface UseAnnotationProps {
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
}

export function useAnnotation({ annotations, onChange }: UseAnnotationProps) {
  const [activeTool, setActiveTool] = useState<EditorTool | null>(null);
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [activeSize, setActiveSize] = useState(20);
  const [rotation, setRotation] = useState(0);
  const [pivot, setPivot] = useState<{ x: number; y: number } | null>(null);


  const addAnnotation = useCallback(
    (x: number, y: number, text?: string) => {
      if (!activeTool || activeTool === "eraser" || activeTool === "rotate" || activeTool === "tympanic-map" || activeTool === "pan" || activeTool === "pointer") return;
      const annotation: Annotation = {
        id: uuidv4(),
        type: activeTool,
        x,
        y,
        color: activeColor,
        size: activeSize,
        rotation: 0,
        text,
      };
      onChange([...annotations, annotation]);
    },
    [activeTool, activeColor, activeSize, annotations, onChange]
  );

  const removeAnnotation = useCallback(
    (id: string) => {
      onChange(annotations.filter((a) => a.id !== id));
    },
    [annotations, onChange]
  );

  const removeAnnotationAt = useCallback(
    (x: number, y: number, threshold: number = 0.03) => {
      const idx = annotations.findIndex(
        (a) =>
          Math.abs(a.x - x) < threshold && Math.abs(a.y - y) < threshold
      );
      if (idx >= 0) {
        const next = [...annotations];
        next.splice(idx, 1);
        onChange(next);
      }
    },
    [annotations, onChange]
  );

  const clearAnnotations = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const rotate = useCallback((degrees: number) => {
    setRotation((prev) => (prev + degrees + 360) % 360);
  }, []);

  const resetRotation = useCallback(() => {
    setRotation(0);
    setPivot(null);
  }, []);

  return {
    activeTool,
    setActiveTool,
    activeColor,
    setActiveColor,
    activeSize,
    setActiveSize,
    rotation,
    setRotation,
    rotate,
    resetRotation,
    addAnnotation,
    removeAnnotation,
    removeAnnotationAt,
    clearAnnotations,
    pivot,
    setPivot,
  };
}
