import { useState, useCallback, useRef } from "react";
import type {
  AnimationDefinition,
  AnimationLayer,
  Keyframe,
  KeyframeValue,
} from "@/types/animation";
import {
  createEmptyAnimation,
  createDefaultLayer,
} from "@/lib/animation/animation-io";
import { v4 as uuid } from "uuid";

interface UndoEntry {
  animation: AnimationDefinition;
  description: string;
}

export interface AnimationEditorState {
  animation: AnimationDefinition;
  selectedLayerId: string | null;
  selectedTrackProperty: string | null;
  selectedKeyframeIndex: number | null;
  currentTime: number;
  isPlaying: boolean;
  canUndo: boolean;
  canRedo: boolean;
  tool: EditorTool;
}

export type EditorTool = "select" | "move" | "bezier" | "add-point";

export interface AnimationEditorActions {
  // Animacion
  setAnimation: (anim: AnimationDefinition) => void;
  updateAnimation: (partial: Partial<AnimationDefinition>) => void;

  // Capas
  addLayer: (type: AnimationLayer["type"], name: string) => string;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, partial: Partial<AnimationLayer>) => void;
  reorderLayer: (id: string, newZIndex: number) => void;
  selectLayer: (id: string | null) => void;
  duplicateLayer: (id: string) => string;

  // Tracks y Keyframes
  addTrack: (layerId: string, property: string) => void;
  removeTrack: (layerId: string, property: string) => void;
  addKeyframe: (
    layerId: string,
    property: string,
    time: number,
    value: KeyframeValue,
  ) => void;
  updateKeyframe: (
    layerId: string,
    property: string,
    index: number,
    partial: Partial<Keyframe>,
  ) => void;
  removeKeyframe: (
    layerId: string,
    property: string,
    index: number,
  ) => void;
  selectTrack: (property: string | null) => void;
  selectKeyframe: (index: number | null) => void;

  // Timeline
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;

  // Herramientas
  setTool: (tool: EditorTool) => void;

  // Historial
  undo: () => void;
  redo: () => void;
}

const MAX_UNDO = 50;

export function useAnimationEditor(
  initial?: AnimationDefinition,
): [AnimationEditorState, AnimationEditorActions] {
  const [animation, setAnimationRaw] = useState<AnimationDefinition>(
    initial ?? createEmptyAnimation("Nueva Animacion"),
  );
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedTrackProperty, setSelectedTrackProperty] = useState<string | null>(null);
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tool, setTool] = useState<EditorTool>("select");

  const undoStack = useRef<UndoEntry[]>([]);
  const redoStack = useRef<UndoEntry[]>([]);

  const pushUndo = useCallback(
    (description: string) => {
      undoStack.current.push({
        animation: JSON.parse(JSON.stringify(animation)),
        description,
      });
      if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
      redoStack.current = [];
    },
    [animation],
  );

  const setAnimation = useCallback(
    (anim: AnimationDefinition) => {
      pushUndo("Cambiar animacion");
      setAnimationRaw(anim);
    },
    [pushUndo],
  );

  const updateAnimation = useCallback(
    (partial: Partial<AnimationDefinition>) => {
      pushUndo("Actualizar animacion");
      setAnimationRaw((prev) => ({ ...prev, ...partial }));
    },
    [pushUndo],
  );

  // --- Capas ---

  const addLayer = useCallback(
    (type: AnimationLayer["type"], name: string): string => {
      const id = uuid();
      const layer = createDefaultLayer(type, id, name, animation.width, animation.height);
      layer.zIndex = animation.layers.length;
      pushUndo("Agregar capa");
      setAnimationRaw((prev) => ({
        ...prev,
        layers: [...prev.layers, layer],
      }));
      setSelectedLayerId(id);
      return id;
    },
    [animation.layers.length, pushUndo],
  );

  const removeLayer = useCallback(
    (id: string) => {
      pushUndo("Eliminar capa");
      setAnimationRaw((prev) => ({
        ...prev,
        layers: prev.layers.filter((l) => l.id !== id),
      }));
      if (selectedLayerId === id) setSelectedLayerId(null);
    },
    [pushUndo, selectedLayerId],
  );

  const updateLayer = useCallback(
    (id: string, partial: Partial<AnimationLayer>) => {
      pushUndo("Actualizar capa");
      setAnimationRaw((prev) => ({
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === id ? { ...l, ...partial } : l,
        ),
      }));
    },
    [pushUndo],
  );

  const reorderLayer = useCallback(
    (id: string, newZIndex: number) => {
      pushUndo("Reordenar capa");
      setAnimationRaw((prev) => ({
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === id ? { ...l, zIndex: newZIndex } : l,
        ),
      }));
    },
    [pushUndo],
  );

  const duplicateLayer = useCallback(
    (id: string): string => {
      const layer = animation.layers.find((l) => l.id === id);
      if (!layer) return "";
      const newId = uuid();
      const newLayer: AnimationLayer = {
        ...JSON.parse(JSON.stringify(layer)),
        id: newId,
        name: `${layer.name} (copia)`,
        zIndex: animation.layers.length,
      };
      pushUndo("Duplicar capa");
      setAnimationRaw((prev) => ({
        ...prev,
        layers: [...prev.layers, newLayer],
      }));
      setSelectedLayerId(newId);
      return newId;
    },
    [animation.layers, pushUndo],
  );

  // --- Tracks y Keyframes ---

  const addTrack = useCallback(
    (layerId: string, property: string) => {
      pushUndo("Agregar track");
      setAnimationRaw((prev) => ({
        ...prev,
        layers: prev.layers.map((l) => {
          if (l.id !== layerId) return l;
          if (l.tracks.find((t) => t.property === property)) return l;
          return {
            ...l,
            tracks: [...l.tracks, { property, keyframes: [] }],
          };
        }),
      }));
    },
    [pushUndo],
  );

  const removeTrack = useCallback(
    (layerId: string, property: string) => {
      pushUndo("Eliminar track");
      setAnimationRaw((prev) => ({
        ...prev,
        layers: prev.layers.map((l) => {
          if (l.id !== layerId) return l;
          return {
            ...l,
            tracks: l.tracks.filter((t) => t.property !== property),
          };
        }),
      }));
    },
    [pushUndo],
  );

  const addKeyframe = useCallback(
    (
      layerId: string,
      property: string,
      time: number,
      value: KeyframeValue,
    ) => {
      pushUndo("Agregar keyframe");
      setAnimationRaw((prev) => ({
        ...prev,
        layers: prev.layers.map((l) => {
          if (l.id !== layerId) return l;
          return {
            ...l,
            tracks: l.tracks.map((t) => {
              if (t.property !== property) return t;
              const kfs = [...t.keyframes];
              // Insertar ordenado por tiempo
              const idx = kfs.findIndex((k) => k.time >= time);
              const kf: Keyframe = {
                time,
                value,
                easing: { type: "ease-in-out" },
              };
              if (idx === -1) kfs.push(kf);
              else if (kfs[idx].time === time) kfs[idx] = kf;
              else kfs.splice(idx, 0, kf);
              return { ...t, keyframes: kfs };
            }),
          };
        }),
      }));
    },
    [pushUndo],
  );

  const updateKeyframe = useCallback(
    (
      layerId: string,
      property: string,
      index: number,
      partial: Partial<Keyframe>,
    ) => {
      pushUndo("Actualizar keyframe");
      setAnimationRaw((prev) => ({
        ...prev,
        layers: prev.layers.map((l) => {
          if (l.id !== layerId) return l;
          return {
            ...l,
            tracks: l.tracks.map((t) => {
              if (t.property !== property) return t;
              const kfs = t.keyframes.map((k, i) =>
                i === index ? { ...k, ...partial } : k,
              );
              return { ...t, keyframes: kfs };
            }),
          };
        }),
      }));
    },
    [pushUndo],
  );

  const removeKeyframe = useCallback(
    (layerId: string, property: string, index: number) => {
      pushUndo("Eliminar keyframe");
      setAnimationRaw((prev) => ({
        ...prev,
        layers: prev.layers.map((l) => {
          if (l.id !== layerId) return l;
          return {
            ...l,
            tracks: l.tracks.map((t) => {
              if (t.property !== property) return t;
              return {
                ...t,
                keyframes: t.keyframes.filter((_, i) => i !== index),
              };
            }),
          };
        }),
      }));
    },
    [pushUndo],
  );

  // --- Undo/Redo ---

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    redoStack.current.push({
      animation: JSON.parse(JSON.stringify(animation)),
      description: entry.description,
    });
    setAnimationRaw(entry.animation);
  }, [animation]);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    undoStack.current.push({
      animation: JSON.parse(JSON.stringify(animation)),
      description: entry.description,
    });
    setAnimationRaw(entry.animation);
  }, [animation]);

  const state: AnimationEditorState = {
    animation,
    selectedLayerId,
    selectedTrackProperty,
    selectedKeyframeIndex,
    currentTime,
    isPlaying,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    tool,
  };

  const actions: AnimationEditorActions = {
    setAnimation,
    updateAnimation,
    addLayer,
    removeLayer,
    updateLayer,
    reorderLayer,
    selectLayer: setSelectedLayerId,
    duplicateLayer,
    addTrack,
    removeTrack,
    addKeyframe,
    updateKeyframe,
    removeKeyframe,
    selectTrack: setSelectedTrackProperty,
    selectKeyframe: setSelectedKeyframeIndex,
    setCurrentTime,
    setIsPlaying,
    setTool,
    undo,
    redo,
  };

  return [state, actions];
}
