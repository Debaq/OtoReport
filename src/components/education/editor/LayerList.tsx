import { useTranslation } from "react-i18next";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Plus,
  Image,
  Shapes,
  Sparkles,
  Grid3X3,
  PaintBucket,
} from "lucide-react";
import type {
  AnimationEditorState,
  AnimationEditorActions,
} from "@/hooks/useAnimationEditor";
import type { AnimationLayer } from "@/types/animation";
import { useState } from "react";

interface LayerListProps {
  state: AnimationEditorState;
  actions: AnimationEditorActions;
}

const LAYER_TYPE_ICONS: Record<AnimationLayer["type"], typeof Image> = {
  background: PaintBucket,
  image: Image,
  "svg-shape": Shapes,
  "svg-effect": Sparkles,
  "mesh-deformable": Grid3X3,
};

const LAYER_TYPE_LABELS: Record<AnimationLayer["type"], string> = {
  background: "education.editor.layerBackground",
  image: "education.editor.layerImage",
  "svg-shape": "education.editor.layerShape",
  "svg-effect": "education.editor.layerEffect",
  "mesh-deformable": "education.editor.layerMesh",
};

export function LayerList({ state, actions }: LayerListProps) {
  const { t } = useTranslation();
  const [showAddMenu, setShowAddMenu] = useState(false);

  const layers = [...state.animation.layers].sort(
    (a, b) => b.zIndex - a.zIndex,
  );

  const handleAdd = (type: AnimationLayer["type"]) => {
    const names: Record<AnimationLayer["type"], string> = {
      background: "Fondo",
      image: "Imagen",
      "svg-shape": "Forma",
      "svg-effect": "Efecto",
      "mesh-deformable": "Mesh",
    };
    actions.addLayer(type, `${names[type]} ${state.animation.layers.length + 1}`);
    setShowAddMenu(false);
  };

  return (
    <div className="flex flex-col rounded-xl border border-border-secondary bg-bg-secondary">
      <div className="flex items-center justify-between border-b border-border-secondary px-3 py-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          {t("education.editor.layers")}
        </h4>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          >
            <Plus size={14} />
          </button>
          {showAddMenu && (
            <div className="absolute right-0 top-full z-10 mt-1 rounded-lg border border-border-secondary bg-bg-primary p-1 shadow-lg">
              {(
                Object.keys(LAYER_TYPE_ICONS) as AnimationLayer["type"][]
              ).map((type) => {
                const Icon = LAYER_TYPE_ICONS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleAdd(type)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                  >
                    <Icon size={14} />
                    {t(LAYER_TYPE_LABELS[type])}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {layers.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-text-tertiary">
            {t("education.editor.noLayers")}
          </p>
        )}
        {layers.map((layer) => {
          const Icon = LAYER_TYPE_ICONS[layer.type];
          const isSelected = state.selectedLayerId === layer.id;

          return (
            <div
              key={layer.id}
              className={`flex items-center gap-1.5 border-b border-border-secondary px-2 py-1.5 last:border-b-0 ${
                isSelected
                  ? "bg-accent-subtle"
                  : "hover:bg-bg-tertiary"
              }`}
            >
              {/* Select */}
              <button
                type="button"
                onClick={() => actions.selectLayer(isSelected ? null : layer.id)}
                className="flex flex-1 items-center gap-1.5 text-left"
              >
                <Icon
                  size={12}
                  className={isSelected ? "text-accent" : "text-text-tertiary"}
                />
                <span
                  className={`truncate text-xs ${
                    isSelected ? "text-accent-text font-medium" : "text-text-secondary"
                  }`}
                >
                  {layer.name}
                </span>
              </button>

              {/* Visibility */}
              <button
                type="button"
                onClick={() =>
                  actions.updateLayer(layer.id, { visible: !layer.visible })
                }
                className="flex h-5 w-5 items-center justify-center text-text-tertiary hover:text-text-primary"
              >
                {layer.visible ? <Eye size={11} /> : <EyeOff size={11} />}
              </button>

              {/* Lock */}
              <button
                type="button"
                onClick={() =>
                  actions.updateLayer(layer.id, { locked: !layer.locked })
                }
                className="flex h-5 w-5 items-center justify-center text-text-tertiary hover:text-text-primary"
              >
                {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
              </button>

              {/* Duplicate */}
              <button
                type="button"
                onClick={() => actions.duplicateLayer(layer.id)}
                className="flex h-5 w-5 items-center justify-center text-text-tertiary hover:text-text-primary"
              >
                <Copy size={11} />
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={() => actions.removeLayer(layer.id)}
                className="flex h-5 w-5 items-center justify-center text-text-tertiary hover:text-red-400"
              >
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
