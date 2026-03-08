import { useTranslation } from "react-i18next";
import {
  MousePointer2,
  Move,
  Spline,
  Plus,
  Undo2,
  Redo2,
  Download,
  Upload,
  Play,
  Pause,
} from "lucide-react";
import type {
  AnimationEditorState,
  AnimationEditorActions,
  EditorTool,
} from "@/hooks/useAnimationEditor";

interface EditorToolbarProps {
  state: AnimationEditorState;
  actions: AnimationEditorActions;
  onExport: () => void;
  onImport: () => void;
}

const TOOLS: { id: EditorTool; icon: typeof MousePointer2; labelKey: string }[] = [
  { id: "select", icon: MousePointer2, labelKey: "education.editor.toolSelect" },
  { id: "move", icon: Move, labelKey: "education.editor.toolMove" },
  { id: "bezier", icon: Spline, labelKey: "education.editor.toolBezier" },
  { id: "add-point", icon: Plus, labelKey: "education.editor.toolAddPoint" },
];

export function EditorToolbar({
  state,
  actions,
  onExport,
  onImport,
}: EditorToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border-secondary bg-bg-secondary px-2 py-1.5">
      {/* Tools */}
      <div className="flex items-center gap-0.5 border-r border-border-secondary pr-2">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => actions.setTool(tool.id)}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                state.tool === tool.id
                  ? "bg-accent text-white"
                  : "text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
              title={t(tool.labelKey)}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>

      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5 border-r border-border-secondary px-2">
        <button
          type="button"
          onClick={actions.undo}
          disabled={!state.canUndo}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-30"
          title={t("education.editor.undo")}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          onClick={actions.redo}
          disabled={!state.canRedo}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-30"
          title={t("education.editor.redo")}
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* Play preview */}
      <div className="flex items-center gap-0.5 border-r border-border-secondary px-2">
        <button
          type="button"
          onClick={() => actions.setIsPlaying(!state.isPlaying)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          title={state.isPlaying ? t("education.editor.pause") : t("education.editor.play")}
        >
          {state.isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>

      {/* Import/Export */}
      <div className="flex items-center gap-0.5 pl-2">
        <button
          type="button"
          onClick={onImport}
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          title={t("education.editor.import")}
        >
          <Upload size={14} />
          {t("education.editor.import")}
        </button>
        <button
          type="button"
          onClick={onExport}
          className="flex h-8 items-center gap-1.5 rounded-md bg-accent/10 px-2 text-xs text-accent transition-colors hover:bg-accent/20"
          title={t("education.editor.export")}
        >
          <Download size={14} />
          {t("education.editor.export")}
        </button>
      </div>

      {/* Animation name */}
      <div className="ml-auto">
        <input
          type="text"
          value={state.animation.name}
          onChange={(e) => actions.updateAnimation({ name: e.target.value })}
          className="rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1 text-sm text-text-primary"
          placeholder="Nombre..."
        />
      </div>
    </div>
  );
}
