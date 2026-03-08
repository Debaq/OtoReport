import { useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { ImagePlus, FolderOpen } from "lucide-react";
import { ImageLibraryModal } from "./ImageLibraryModal";
import type {
  AnimationEditorState,
  AnimationEditorActions,
} from "@/hooks/useAnimationEditor";
import type {
  AnimationLayer,
  MedicalEffectType,
  SvgShapeType,
  ClipShapeType,
} from "@/types/animation";
import { DEFAULT_EFFECT_CONFIGS } from "@/lib/animation/animation-io";
import { createDefaultClipShape } from "@/lib/animation/clip-shapes";

interface EditorPropertiesProps {
  state: AnimationEditorState;
  actions: AnimationEditorActions;
}

const EFFECT_TYPES: MedicalEffectType[] = [
  "fluid-level",
  "perforation",
  "cholesteatoma",
  "wind-lines",
  "bacteria",
  "inflammation",
  "calcification",
  "custom-path",
];

const SVG_SHAPES: SvgShapeType[] = [
  "ellipse",
  "rect",
  "circle",
  "path",
  "line",
  "polygon",
];

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-16 text-xs text-text-tertiary">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        step={step}
        min={min}
        max={max}
        className="w-full rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1 text-xs text-text-primary"
      />
    </label>
  );
}

/** Parsea cualquier formato de color a {r,g,b,a} */
function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
  // hex
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const h = hexMatch[1];
    if (h.length === 3) return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: 1 };
    if (h.length === 6) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
    if (h.length === 8) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: parseInt(h.slice(6, 8), 16) / 255 };
  }
  // rgba(r,g,b,a)
  const rgbaMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) return { r: +rgbaMatch[1], g: +rgbaMatch[2], b: +rgbaMatch[3], a: rgbaMatch[4] !== undefined ? +rgbaMatch[4] : 1 };
  return null;
}

function colorToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function colorToRgba(r: number, g: number, b: number, a: number): string {
  return a < 1 ? `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})` : colorToHex(r, g, b);
}

/** Detecta si un string parece un color */
function isColorString(val: string): boolean {
  return /^#[0-9a-f]{3,8}$/i.test(val) || /^rgba?\(/.test(val);
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const parsed = parseColor(value);
  const [showAlpha, setShowAlpha] = useState(false);
  const hexValue = parsed ? colorToHex(parsed.r, parsed.g, parsed.b) : "#000000";
  const alpha = parsed?.a ?? 1;

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2">
        <span className="w-16 flex-shrink-0 text-xs text-text-tertiary">{label}</span>
        <input
          type="color"
          value={hexValue}
          onChange={(e) => {
            const p = parseColor(e.target.value);
            if (p) onChange(colorToRgba(p.r, p.g, p.b, alpha));
          }}
          className="h-7 w-7 cursor-pointer rounded border border-border-secondary bg-transparent p-0.5"
        />
        <div
          className="h-5 w-5 rounded border border-border-secondary"
          style={{ backgroundColor: value }}
        />
        <button
          type="button"
          onClick={() => setShowAlpha(!showAlpha)}
          className="rounded px-1.5 py-0.5 text-[10px] text-text-tertiary hover:bg-bg-tertiary"
        >
          {Math.round(alpha * 100)}%
        </button>
      </label>
      {showAlpha && (
        <label className="ml-18 flex items-center gap-2 pl-18">
          <span className="w-16 flex-shrink-0 text-[10px] text-text-tertiary">Opacidad</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={alpha}
            onChange={(e) => {
              const a = parseFloat(e.target.value);
              const p = parsed ?? { r: 0, g: 0, b: 0 };
              onChange(colorToRgba(p.r, p.g, p.b, a));
            }}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-bg-tertiary accent-accent"
          />
          <span className="w-8 text-right text-[10px] tabular-nums text-text-tertiary">
            {Math.round(alpha * 100)}%
          </span>
        </label>
      )}
    </div>
  );
}

function ImageSrcInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [importing, setImporting] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: t("education.editor.imageFilter"),
            extensions: ["png", "jpg", "jpeg", "webp", "svg", "bmp"],
          },
        ],
      });
      if (!selected) return;
      const path = Array.isArray(selected) ? selected[0] : selected;
      setImporting(true);
      const bytes = await readFile(path);
      const ext = path.split(".").pop()?.toLowerCase() || "png";
      const mimeMap: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        svg: "image/svg+xml",
        bmp: "image/bmp",
      };
      const mime = mimeMap[ext] ?? "image/png";
      let base64 = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        base64 += String.fromCharCode(...bytes.slice(i, i + chunk));
      }
      const dataUrl = `data:${mime};base64,${btoa(base64)}`;
      onChange(dataUrl);
    } catch {
      // Usuario cancelo o error de lectura
    } finally {
      setImporting(false);
    }
  };

  const isDataUrl = value.startsWith("data:");
  const preview = isDataUrl ? value : value ? `/edu/${value}` : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-16 flex-shrink-0 text-xs text-text-tertiary">{label}</span>
        <input
          type="text"
          value={isDataUrl ? `[${t("education.editor.importedImage")}]` : value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={isDataUrl}
          placeholder="images/tympanum.png"
          className="w-full rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1 text-xs text-text-primary"
        />
        <button
          type="button"
          onClick={() => setShowLibrary(true)}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border-secondary bg-bg-tertiary text-text-tertiary transition-colors hover:bg-accent/10 hover:text-accent"
          title={t("education.editor.imageLibrary")}
        >
          <FolderOpen size={14} />
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={importing}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border-secondary bg-bg-tertiary text-text-tertiary transition-colors hover:bg-accent/10 hover:text-accent disabled:opacity-50"
          title={t("education.editor.importImage")}
        >
          {importing ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : (
            <ImagePlus size={14} />
          )}
        </button>
      </div>
      <ImageLibraryModal
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        onSelect={onChange}
      />
      {preview && (
        <div className="relative overflow-hidden rounded-lg border border-border-secondary bg-bg-tertiary">
          <img
            src={preview}
            alt=""
            className="h-24 w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          {isDataUrl && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80 hover:text-white"
            >
              {t("education.editor.removeImage")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function EditorProperties({ state, actions }: EditorPropertiesProps) {
  const { t } = useTranslation();
  const layer = state.animation.layers.find(
    (l) => l.id === state.selectedLayerId,
  );

  if (!layer) {
    return (
      <div className="rounded-xl border border-border-secondary bg-bg-secondary p-4">
        <p className="text-center text-xs text-text-tertiary">
          {t("education.editor.selectLayerHint")}
        </p>
      </div>
    );
  }

  const update = (partial: Partial<AnimationLayer>) => {
    actions.updateLayer(layer.id, partial);
  };

  const updateTransform = (key: string, value: number) => {
    update({
      transform: { ...layer.transform, [key]: value },
    });
  };

  return (
    <div className="space-y-3">
      {/* Name */}
      <div className="rounded-xl border border-border-secondary bg-bg-secondary p-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          {t("education.editor.properties")}
        </h4>
        <label className="flex items-center gap-2">
          <span className="w-16 text-xs text-text-tertiary">{t("education.editor.name")}</span>
          <input
            type="text"
            value={layer.name}
            onChange={(e) => update({ name: e.target.value })}
            className="w-full rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1 text-xs text-text-primary"
          />
        </label>
      </div>

      {/* Transform */}
      <div className="rounded-xl border border-border-secondary bg-bg-secondary p-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Transform
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="X" value={layer.transform.x} onChange={(v) => updateTransform("x", v)} />
          <NumberInput label="Y" value={layer.transform.y} onChange={(v) => updateTransform("y", v)} />
          <NumberInput label="Scale X" value={layer.transform.scaleX} onChange={(v) => updateTransform("scaleX", v)} step={0.1} />
          <NumberInput label="Scale Y" value={layer.transform.scaleY} onChange={(v) => updateTransform("scaleY", v)} step={0.1} />
          <NumberInput label="Rot." value={layer.transform.rotation} onChange={(v) => updateTransform("rotation", v)} />
          <NumberInput label="Opacity" value={layer.opacity} onChange={(v) => update({ opacity: v })} step={0.05} min={0} max={1} />
        </div>
      </div>

      {/* Type-specific properties */}
      {layer.type === "background" && (
        <div className="rounded-xl border border-border-secondary bg-bg-secondary p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            {t("education.editor.layerBackground")}
          </h4>
          <ColorInput
            label={t("education.editor.bgColor")}
            value={layer.backgroundColor ?? "#1a1a2e"}
            onChange={(v) => update({ backgroundColor: v })}
          />
        </div>
      )}

      {layer.type === "image" && (
        <div className="rounded-xl border border-border-secondary bg-bg-secondary p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            {t("education.editor.layerImage")}
          </h4>
          <ImageSrcInput
            label="Src"
            value={layer.imageSrc ?? ""}
            onChange={(v) => update({ imageSrc: v })}
          />
        </div>
      )}

      {layer.type === "svg-shape" && (
        <div className="rounded-xl border border-border-secondary bg-bg-secondary p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            {t("education.editor.layerShape")}
          </h4>
          <label className="mb-2 flex items-center gap-2">
            <span className="w-16 text-xs text-text-tertiary">Tipo</span>
            <select
              value={layer.svgType ?? "ellipse"}
              onChange={(e) => {
                const t = e.target.value as SvgShapeType;
                const w = state.animation.width;
                const h = state.animation.height;
                const defaults: Record<SvgShapeType, Record<string, string | number>> = {
                  ellipse: { cx: w / 2, cy: h / 2, rx: 60, ry: 50 },
                  circle: { cx: w / 2, cy: h / 2, r: 50 },
                  rect: { x: w / 2 - 50, y: h / 2 - 40, width: 100, height: 80 },
                  line: { x1: w / 2 - 50, y1: h / 2, x2: w / 2 + 50, y2: h / 2 },
                  polygon: {},
                  path: {},
                };
                const defaultPoints: Record<string, { x: number; y: number }[] | undefined> = {
                  polygon: [
                    { x: w / 2, y: h / 2 - 50 },
                    { x: w / 2 + 50, y: h / 2 + 30 },
                    { x: w / 2 - 50, y: h / 2 + 30 },
                  ],
                  path: [
                    { x: w / 2 - 60, y: h / 2 },
                    { x: w / 2, y: h / 2 - 50 },
                    { x: w / 2 + 60, y: h / 2 },
                  ],
                };
                update({
                  svgType: t,
                  svgProps: defaults[t],
                  shapePoints: defaultPoints[t] ?? undefined,
                });
              }}
              className="w-full rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1 text-xs text-text-primary"
            >
              {SVG_SHAPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          {/* Props editables de la forma */}
          <div className="mb-2 space-y-1">
            {Object.entries(layer.svgProps ?? {}).map(([key, val]) => (
              typeof val === "number" ? (
                <NumberInput
                  key={key}
                  label={key}
                  value={val}
                  onChange={(v) => update({ svgProps: { ...layer.svgProps, [key]: v } })}
                />
              ) : (
                <label key={key} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-text-tertiary">{key}</span>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => update({ svgProps: { ...layer.svgProps, [key]: e.target.value } })}
                    className="w-full rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1 text-xs text-text-primary"
                  />
                </label>
              )
            ))}
          </div>

          <ColorInput label="Fill" value={layer.fill ?? "#ffffff"} onChange={(v) => update({ fill: v })} />
          <ColorInput label="Stroke" value={layer.stroke ?? "#000000"} onChange={(v) => update({ stroke: v })} />
          <NumberInput label="Stroke W" value={layer.strokeWidth ?? 1} onChange={(v) => update({ strokeWidth: v })} step={0.5} />
        </div>
      )}

      {layer.type === "svg-effect" && (
        <div className="rounded-xl border border-border-secondary bg-bg-secondary p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            {t("education.editor.layerEffect")}
          </h4>

          {/* Tipo de efecto */}
          <label className="mb-2 flex items-center gap-2">
            <span className="w-16 text-xs text-text-tertiary">Efecto</span>
            <select
              value={layer.effectType ?? "inflammation"}
              onChange={(e) => {
                const newType = e.target.value as MedicalEffectType;
                update({
                  effectType: newType,
                  effectConfig: { ...DEFAULT_EFFECT_CONFIGS[newType] },
                });
              }}
              className="w-full rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1 text-xs text-text-primary"
            >
              {EFFECT_TYPES.map((et) => (
                <option key={et} value={et}>{et}</option>
              ))}
            </select>
          </label>

          {/* Forma del area (clip shape) */}
          <label className="mb-3 flex items-center gap-2">
            <span className="w-16 text-xs text-text-tertiary">{t("education.editor.clipShape")}</span>
            <select
              value={layer.effectClip?.type ?? "ellipse"}
              onChange={(e) => {
                const shapeType = e.target.value as ClipShapeType;
                update({
                  effectClip: createDefaultClipShape(
                    shapeType,
                    state.animation.width,
                    state.animation.height,
                  ),
                });
              }}
              className="w-full rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1 text-xs text-text-primary"
            >
              {(["ellipse", "circle", "rect", "polygon"] as ClipShapeType[]).map((st) => (
                <option key={st} value={st}>{t(`education.editor.shape_${st}`)}</option>
              ))}
            </select>
          </label>
          <p className="mb-3 text-[10px] text-text-tertiary">
            {t("education.editor.clipShapeHint")}
          </p>

          {/* Parametros del efecto */}
          {layer.effectConfig && Object.keys(layer.effectConfig).length > 0 && (
            <div className="space-y-1.5 border-t border-border-secondary pt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                {t("education.editor.effectParams")}
              </span>
              {Object.entries(layer.effectConfig).map(([key, val]) => {
                // Omitir props de posicion (vienen del clip shape ahora)
                if (["cx", "cy", "radius", "areaX", "areaY", "areaW", "areaH"].includes(key)) return null;
                if (Array.isArray(val)) return null;
                if (typeof val === "number") {
                  return (
                    <NumberInput
                      key={key}
                      label={key}
                      value={val}
                      onChange={(v) =>
                        update({
                          effectConfig: { ...layer.effectConfig, [key]: v },
                        })
                      }
                      step={key === "intensity" || key === "level" ? 0.05 : 1}
                    />
                  );
                }
                if (typeof val === "string") {
                  if (isColorString(val)) {
                    return (
                      <ColorInput
                        key={key}
                        label={key}
                        value={val}
                        onChange={(v) =>
                          update({
                            effectConfig: { ...layer.effectConfig, [key]: v },
                          })
                        }
                      />
                    );
                  }
                  return (
                    <label key={key} className="flex items-center gap-2">
                      <span className="w-16 text-xs text-text-tertiary">{key}</span>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) =>
                          update({
                            effectConfig: { ...layer.effectConfig, [key]: e.target.value },
                          })
                        }
                        className="w-full rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1 text-xs text-text-primary"
                      />
                    </label>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      )}

      {layer.type === "mesh-deformable" && (
        <div className="rounded-xl border border-border-secondary bg-bg-secondary p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            {t("education.editor.layerMesh")}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="Cols"
              value={layer.meshGrid?.cols ?? 4}
              onChange={(v) => update({ meshGrid: { cols: v, rows: layer.meshGrid?.rows ?? 4 } })}
              min={1}
              max={16}
            />
            <NumberInput
              label="Rows"
              value={layer.meshGrid?.rows ?? 4}
              onChange={(v) => update({ meshGrid: { cols: layer.meshGrid?.cols ?? 4, rows: v } })}
              min={1}
              max={16}
            />
          </div>
          <div className="mt-2">
            <ImageSrcInput
              label="Src"
              value={layer.meshImageSrc ?? ""}
              onChange={(v) => update({ meshImageSrc: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
