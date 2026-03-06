import { cn } from "@/lib/utils";
import { AnnotationType } from "@/types/annotation";
import type { EditorTool } from "@/types/annotation";
import { ArrowUp, Type, Circle, X, Crosshair, Eraser, Undo2, RotateCw, Target, Hand, MousePointer2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AnnotationToolbarProps {
  activeTool: EditorTool | null;
  activeColor: string;
  onSelectTool: (tool: EditorTool | null) => void;
  onSelectColor: (color: string) => void;
  onClear: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

const toolDefs: { type: EditorTool; icon: typeof ArrowUp; key: string }[] = [
  { type: "pointer", icon: MousePointer2, key: "pointer" },
  { type: AnnotationType.Arrow, icon: ArrowUp, key: "arrow" },
  { type: AnnotationType.Text, icon: Type, key: "text" },
  { type: AnnotationType.Circle, icon: Circle, key: "circle" },
  { type: AnnotationType.Cross, icon: X, key: "cross" },
  { type: AnnotationType.Dot, icon: Crosshair, key: "dot" },
  { type: "eraser", icon: Eraser, key: "eraser" },
  { type: "pan", icon: Hand, key: "pan" },
  { type: "rotate", icon: RotateCw, key: "rotate" },
  { type: "tympanic-map", icon: Target, key: "tympanicMap" },
];

const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ffffff", "#000000"];

export function AnnotationToolbar({
  activeTool,
  activeColor,
  onSelectTool,
  onSelectColor,
  onClear,
  onUndo,
  canUndo,
}: AnnotationToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {toolDefs.map(({ type, icon: Icon, key }) => (
          <span key={type} className="contents">
            {(type === AnnotationType.Arrow || type === "pan" || type === "tympanic-map") && (
              <div className="mx-0.5 h-6 w-px bg-border-secondary" />
            )}
            <button
              onClick={() => onSelectTool(activeTool === type ? null : type)}
              title={t(`editor.tools.${key}`)}
              className={cn(
                "rounded p-1.5 transition-colors",
                activeTool === type
                  ? "bg-accent-subtle text-accent-text"
                  : "text-text-tertiary hover:bg-bg-tertiary"
              )}
            >
              <Icon size={16} />
            </button>
          </span>
        ))}
      </div>

      <div className="h-6 w-px bg-border-secondary" />

      <div className="flex gap-1">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => onSelectColor(c)}
            className={cn(
              "h-5 w-5 rounded-full border-2 transition-transform",
              activeColor === c ? "border-text-primary scale-110" : "border-border-primary"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="h-6 w-px bg-border-secondary" />

      {onUndo && (
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={cn(
            "rounded p-1.5 transition-colors",
            canUndo
              ? "text-text-tertiary hover:bg-bg-tertiary"
              : "text-text-tertiary/50 cursor-not-allowed"
          )}
          title={t("editor.undo")}
        >
          <Undo2 size={16} />
        </button>
      )}

      <button
        onClick={onClear}
        className="text-xs text-danger-text hover:text-danger"
      >
        {t("editor.clearAll")}
      </button>
    </div>
  );
}
