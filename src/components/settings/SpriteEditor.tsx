import { useState, useRef, useEffect, useCallback } from "react";
import { X, RotateCcw } from "lucide-react";
import {
  type SpriteCalibration,
  loadCalibration,
  saveCalibrationData,
  getSpriteStyleForCal,
  DEFAULT_CALIBRATION,
  SPRITE_COLS,
  SPRITE_ROWS,
  SPRITES_PER_SHEET,
  useSheetCount,
} from "@/components/ui/SpriteAvatar";

type HandleKey = "first" | "lastCol" | "lastRow";

const HANDLE_META: Record<HandleKey, { color: string; label: string }> = {
  first: { color: "#EF4444", label: "1°" },
  lastCol: { color: "#3B82F6", label: "Col" },
  lastRow: { color: "#10B981", label: "Fila" },
};

export function SpriteEditor({ onClose }: { onClose: () => void }) {
  const sheetCount = useSheetCount();
  const [cal, setCal] = useState<SpriteCalibration>(() => ({ ...loadCalibration() }));
  const [originalCal] = useState<SpriteCalibration>(() => ({ ...loadCalibration() }));
  const [sheet, setSheet] = useState(1);
  const [dragging, setDragging] = useState<HandleKey | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      setDims({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setCal((prev) => {
        switch (dragging) {
          case "first":
            return { ...prev, firstX: x, firstY: y };
          case "lastCol":
            return { ...prev, lastColX: x, lastColY: y };
          case "lastRow":
            return { ...prev, lastRowX: x, lastRowY: y };
          default:
            return prev;
        }
      });
    },
    [dragging],
  );

  useEffect(() => {
    if (!dragging) return;
    const up = () => setDragging(null);
    document.addEventListener("pointerup", up);
    return () => document.removeEventListener("pointerup", up);
  }, [dragging]);

  function handleSave() {
    saveCalibrationData(cal);
    onClose();
  }

  function handleCancel() {
    saveCalibrationData(originalCal);
    onClose();
  }

  const dPx = cal.diameter * dims.w;

  // Grilla calculada
  const gridCircles: { cx: number; cy: number }[] = [];
  for (let r = 0; r < SPRITE_ROWS; r++) {
    for (let c = 0; c < SPRITE_COLS; c++) {
      gridCircles.push({
        cx: cal.firstX + (c / (SPRITE_COLS - 1)) * (cal.lastColX - cal.firstX),
        cy: cal.firstY + (r / (SPRITE_ROWS - 1)) * (cal.lastRowY - cal.firstY),
      });
    }
  }

  const previewIndices = [0, 3, 7, 24, 31].map((i) =>
    sheet === 2 ? i + SPRITES_PER_SHEET : i,
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-3xl flex-col rounded-xl bg-bg-secondary shadow-xl max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-secondary px-4 py-3">
          <h2 className="text-base font-semibold text-text-primary">Calibrar sprites</h2>
          <button onClick={handleCancel} className="text-text-tertiary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-3">
          {/* Sheet + grid toggle */}
          <div className="flex items-center gap-2">
            {Array.from({ length: sheetCount }, (_, i) => i + 1).map((s) => (
              <button
                key={s}
                onClick={() => setSheet(s)}
                className={`rounded px-3 py-1 text-xs ${
                  sheet === s ? "bg-accent text-text-inverted" : "text-text-tertiary hover:bg-bg-tertiary"
                }`}
              >
                Hoja {s}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1.5 text-xs text-text-tertiary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="rounded"
              />
              Grilla
            </label>
          </div>

          {/* Image + overlays */}
          <div
            ref={containerRef}
            className="relative select-none overflow-hidden rounded-lg"
            onPointerMove={handlePointerMove}
            style={{ cursor: dragging ? "grabbing" : "default" }}
          >
            <img src={`/profile_${sheet}.png`} className="block w-full" draggable={false} />

            {/* Grid circles */}
            {showGrid &&
              dims.w > 0 &&
              gridCircles.map(({ cx, cy }, idx) => (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    left: cx * dims.w - dPx / 2,
                    top: cy * dims.h - dPx / 2,
                    width: dPx,
                    height: dPx,
                    borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.35)",
                    pointerEvents: "none",
                  }}
                />
              ))}

            {/* Draggable handles */}
            {dims.w > 0 &&
              (Object.keys(HANDLE_META) as HandleKey[]).map((key) => {
                const pos =
                  key === "first"
                    ? { x: cal.firstX, y: cal.firstY }
                    : key === "lastCol"
                      ? { x: cal.lastColX, y: cal.lastColY }
                      : { x: cal.lastRowX, y: cal.lastRowY };
                const meta = HANDLE_META[key];
                return (
                  <div
                    key={key}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setDragging(key);
                    }}
                    style={{
                      position: "absolute",
                      left: pos.x * dims.w - dPx / 2,
                      top: pos.y * dims.h - dPx / 2,
                      width: dPx,
                      height: dPx,
                      borderRadius: "50%",
                      border: `2.5px solid ${meta.color}`,
                      cursor: dragging === key ? "grabbing" : "grab",
                      zIndex: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: meta.color,
                        fontWeight: "bold",
                        textShadow: "0 0 4px rgba(0,0,0,0.9)",
                        pointerEvents: "none",
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Valores numéricos */}
          <div className="grid grid-cols-4 gap-2 text-[11px]">
            {/* Header */}
            <div className="text-text-tertiary font-medium">Punto</div>
            <div className="text-text-tertiary font-medium">X</div>
            <div className="text-text-tertiary font-medium">Y</div>
            <div />

            {/* First */}
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: HANDLE_META.first.color }} />
              <span className="text-text-secondary">1° (origen)</span>
            </div>
            <input
              type="number"
              step={0.001}
              value={parseFloat(cal.firstX.toFixed(4))}
              onChange={(e) => setCal((prev) => ({ ...prev, firstX: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded border border-border-secondary bg-bg-primary px-1.5 py-0.5 text-text-primary text-[11px] font-mono focus:border-accent focus:outline-none"
            />
            <input
              type="number"
              step={0.001}
              value={parseFloat(cal.firstY.toFixed(4))}
              onChange={(e) => setCal((prev) => ({ ...prev, firstY: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded border border-border-secondary bg-bg-primary px-1.5 py-0.5 text-text-primary text-[11px] font-mono focus:border-accent focus:outline-none"
            />
            <div />

            {/* LastCol */}
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: HANDLE_META.lastCol.color }} />
              <span className="text-text-secondary">Últ. col</span>
            </div>
            <input
              type="number"
              step={0.001}
              value={parseFloat(cal.lastColX.toFixed(4))}
              onChange={(e) => setCal((prev) => ({ ...prev, lastColX: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded border border-border-secondary bg-bg-primary px-1.5 py-0.5 text-text-primary text-[11px] font-mono focus:border-accent focus:outline-none"
            />
            <input
              type="number"
              step={0.001}
              value={parseFloat(cal.lastColY.toFixed(4))}
              onChange={(e) => setCal((prev) => ({ ...prev, lastColY: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded border border-border-secondary bg-bg-primary px-1.5 py-0.5 text-text-primary text-[11px] font-mono focus:border-accent focus:outline-none"
            />
            <div />

            {/* LastRow */}
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: HANDLE_META.lastRow.color }} />
              <span className="text-text-secondary">Últ. fila</span>
            </div>
            <input
              type="number"
              step={0.001}
              value={parseFloat(cal.lastRowX.toFixed(4))}
              onChange={(e) => setCal((prev) => ({ ...prev, lastRowX: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded border border-border-secondary bg-bg-primary px-1.5 py-0.5 text-text-primary text-[11px] font-mono focus:border-accent focus:outline-none"
            />
            <input
              type="number"
              step={0.001}
              value={parseFloat(cal.lastRowY.toFixed(4))}
              onChange={(e) => setCal((prev) => ({ ...prev, lastRowY: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded border border-border-secondary bg-bg-primary px-1.5 py-0.5 text-text-primary text-[11px] font-mono focus:border-accent focus:outline-none"
            />
            <div />

            {/* Diameter */}
            <div className="flex items-center gap-1">
              <span className="text-text-secondary">Diámetro</span>
            </div>
            <input
              type="number"
              step={0.001}
              value={parseFloat(cal.diameter.toFixed(4))}
              onChange={(e) => setCal((prev) => ({ ...prev, diameter: parseFloat(e.target.value) || 0.05 }))}
              className="w-full rounded border border-border-secondary bg-bg-primary px-1.5 py-0.5 text-text-primary text-[11px] font-mono focus:border-accent focus:outline-none"
            />
            <div className="col-span-2">
              <input
                type="range"
                min={0.04}
                max={0.2}
                step={0.001}
                value={cal.diameter}
                onChange={(e) =>
                  setCal((prev) => ({ ...prev, diameter: parseFloat(e.target.value) }))
                }
                className="w-full accent-accent"
              />
            </div>
          </div>

          {/* Píxeles equivalentes (referencia) */}
          <div className="text-[10px] text-text-tertiary font-mono leading-relaxed bg-bg-primary rounded-lg px-3 py-2">
            Imagen: 2816×1536 | 1° px: ({Math.round(cal.firstX * 2816)}, {Math.round(cal.firstY * 1536)}) | Col px: ({Math.round(cal.lastColX * 2816)}, {Math.round(cal.lastColY * 1536)}) | Fila px: ({Math.round(cal.lastRowX * 2816)}, {Math.round(cal.lastRowY * 1536)}) | ⌀ {Math.round(cal.diameter * 2816)}px
          </div>

          {/* Preview */}
          <div>
            <span className="text-xs text-text-secondary">Vista previa</span>
            <div className="mt-1 flex gap-2">
              {previewIndices.map((i) => (
                <div
                  key={i}
                  className="rounded-full flex-shrink-0"
                  style={{ width: 52, height: 52, ...getSpriteStyleForCal(i, 52, cal) }}
                />
              ))}
            </div>
          </div>

          {/* Instructions */}
          <p className="text-[11px] text-text-tertiary leading-relaxed">
            Arrastra los 3 círculos o edita los valores. {" "}
            <span className="font-semibold" style={{ color: HANDLE_META.first.color }}>1°</span> = primer avatar, {" "}
            <span className="font-semibold" style={{ color: HANDLE_META.lastCol.color }}>Col</span> = último de la fila, {" "}
            <span className="font-semibold" style={{ color: HANDLE_META.lastRow.color }}>Fila</span> = último de la columna.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border-secondary px-4 py-3">
          <button
            onClick={handleSave}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-text-inverted hover:bg-accent-hover"
          >
            Guardar
          </button>
          <button
            onClick={() => setCal({ ...DEFAULT_CALIBRATION })}
            className="inline-flex items-center gap-1 rounded-lg border border-border-secondary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary"
          >
            <RotateCcw size={12} />
            Resetear
          </button>
          <button
            onClick={handleCancel}
            className="rounded-lg border border-border-secondary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
