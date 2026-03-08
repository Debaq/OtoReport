import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnimationDefinition } from "@/types/animation";
import { useAnimationEditor } from "@/hooks/useAnimationEditor";
import { useAnimationPlayer } from "@/hooks/useAnimationPlayer";
import { serializeAnimation, parseAnimation } from "@/lib/animation/animation-io";
import { saveUserAnimation, nextAnimationFilename } from "@/lib/user-animations";
import { EditorToolbar } from "./EditorToolbar";
import { EditorCanvas } from "./EditorCanvas";
import { EditorTimeline } from "./EditorTimeline";
import { EditorProperties } from "./EditorProperties";
import { LayerList } from "./LayerList";

interface AnimationEditorProps {
  initial?: AnimationDefinition;
  /** Nombre de archivo si se carga una existente */
  filename?: string;
  onSave?: (animation: AnimationDefinition) => void;
}

export function AnimationEditor({ initial, filename: initialFilename, onSave }: AnimationEditorProps) {
  const [state, actions] = useAnimationEditor(initial);
  const [currentFilename, setCurrentFilename] = useState<string | null>(initialFilename ?? null);
  const loopedAnimation = useMemo(
    () => ({ ...state.animation, loop: true }),
    [state.animation],
  );
  const [playerState, playerControls] = useAnimationPlayer(
    state.isPlaying ? loopedAnimation : null,
  );

  // Auto-save con debounce de 2s
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const animationRef = useRef(state.animation);
  animationRef.current = state.animation;

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      let fname = currentFilename;
      if (!fname) {
        fname = await nextAnimationFilename();
        setCurrentFilename(fname);
      }
      await saveUserAnimation(fname, animationRef.current).catch(() => {});
    }, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [state.animation, currentFilename]);

  // Sincronizar tiempo del player con el editor
  useEffect(() => {
    if (state.isPlaying) {
      actions.setCurrentTime(playerState.currentTime);
    }
  }, [playerState.currentTime, state.isPlaying]);

  // Detener player cuando el editor para
  useEffect(() => {
    if (state.isPlaying) {
      playerControls.play();
    } else {
      playerControls.pause();
    }
  }, [state.isPlaying]);

  const handleExport = useCallback(() => {
    const json = serializeAnimation(state.animation);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.animation.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onSave?.(state.animation);
  }, [state.animation, onSave]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const result = parseAnimation(text);
      if (result.ok) {
        actions.setAnimation(result.animation);
        // Guardar como nuevo archivo
        const fname = await nextAnimationFilename();
        setCurrentFilename(fname);
      } else {
        alert(result.error);
      }
    };
    input.click();
  }, [actions]);

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Toolbar */}
      <EditorToolbar
        state={state}
        actions={actions}
        onExport={handleExport}
        onImport={handleImport}
      />

      {/* Main content */}
      <div className="flex flex-1 gap-2 overflow-hidden">
        {/* Left panel - Layers */}
        <div className="w-56 flex-shrink-0 space-y-2 overflow-y-auto">
          <LayerList state={state} actions={actions} />
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 overflow-auto">
          <EditorCanvas state={state} actions={actions} />
        </div>

        {/* Right panel - Properties */}
        <div className="w-64 flex-shrink-0 overflow-y-auto">
          <EditorProperties state={state} actions={actions} />
        </div>
      </div>

      {/* Bottom - Timeline */}
      <div className="flex-shrink-0">
        <EditorTimeline state={state} actions={actions} />
      </div>
    </div>
  );
}
