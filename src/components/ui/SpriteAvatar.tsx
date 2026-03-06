import { useState, useEffect } from "react";

export const SPRITE_COLS = 8;
export const SPRITE_ROWS = 4;
export const SPRITES_PER_SHEET = SPRITE_COLS * SPRITE_ROWS;

/** Número de hojas detectadas en /public (profile_1.png, profile_2.png, ...) */
let _detectedSheets = 2; // fallback mínimo
let _detectionDone = false;
const _listeners = new Set<() => void>();

/** Prueba si una imagen existe intentando cargarla */
function probeImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

/** Detecta cuántas hojas profile_N.png existen */
async function detectSheetCount(): Promise<number> {
  let count = 0;
  for (let i = 1; ; i++) {
    if (await probeImage(`/profile_${i}.png`)) {
      count = i;
    } else {
      break;
    }
  }
  return Math.max(count, 1);
}

// Iniciar detección al cargar el módulo
detectSheetCount().then((n) => {
  _detectedSheets = n;
  _detectionDone = true;
  _listeners.forEach((fn) => fn());
  _listeners.clear();
});

export function useSheetCount(): number {
  const [count, setCount] = useState(_detectedSheets);
  useEffect(() => {
    if (_detectionDone) {
      setCount(_detectedSheets);
      return;
    }
    const listener = () => setCount(_detectedSheets);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);
  return count;
}

export function getTotalSprites(): number {
  return SPRITES_PER_SHEET * _detectedSheets;
}

// Aspect ratio conocido de los sprite sheets
const IMG_W = 2816;
const IMG_H = 1536;

export interface SpriteCalibration {
  firstX: number;
  firstY: number;
  lastColX: number;
  lastColY: number;
  lastRowX: number;
  lastRowY: number;
  diameter: number;
}

const STORAGE_KEY = "otoreport-sprite-calibration";

export const DEFAULT_CALIBRATION: SpriteCalibration = {
  firstX: 226 / 2816,
  firstY: 215 / 1536,
  lastColX: 2590 / 2816,
  lastColY: 211 / 1536,
  lastRowX: 230 / 2816,
  lastRowY: 1321 / 1536,
  diameter: 251 / 2816,
};

let _cal: SpriteCalibration | null = null;

export function loadCalibration(): SpriteCalibration {
  if (_cal) return _cal;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      _cal = JSON.parse(s);
      return _cal!;
    }
  } catch {}
  _cal = { ...DEFAULT_CALIBRATION };
  return _cal;
}

export function saveCalibrationData(cal: SpriteCalibration) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cal));
  _cal = cal;
}

export function getSpriteStyleForCal(
  index: number,
  size: number,
  cal: SpriteCalibration,
): React.CSSProperties {
  const sheet = Math.floor(index / SPRITES_PER_SHEET) + 1;
  const localIndex = index % SPRITES_PER_SHEET;
  const col = localIndex % SPRITE_COLS;
  const row = Math.floor(localIndex / SPRITE_COLS);

  const cx = cal.firstX + (col / (SPRITE_COLS - 1)) * (cal.lastColX - cal.firstX);
  const cy = cal.firstY + (row / (SPRITE_ROWS - 1)) * (cal.lastRowY - cal.firstY);

  const bgW = size / cal.diameter;
  const bgH = bgW * (IMG_H / IMG_W);

  const offX = -(cx * bgW - size / 2);
  const offY = -(cy * bgH - size / 2);

  return {
    backgroundImage: `url(/profile_${sheet}.png)`,
    backgroundSize: `${bgW}px ${bgH}px`,
    backgroundPosition: `${offX}px ${offY}px`,
    backgroundRepeat: "no-repeat",
  };
}

function getSpriteStyle(index: number, size: number): React.CSSProperties {
  return getSpriteStyleForCal(index, size, loadCalibration());
}

export function SpriteAvatar({
  avatar,
  name,
  color,
  size = 40,
  className = "",
}: {
  avatar?: number;
  name: string;
  color: string;
  size?: number;
  className?: string;
}) {
  if (avatar != null && avatar >= 0 && avatar < getTotalSprites()) {
    return (
      <div
        className={`flex-shrink-0 rounded-full ${className}`}
        style={{ width: size, height: size, ...getSpriteStyle(avatar, size) }}
      />
    );
  }

  const initial = name.charAt(0).toUpperCase() || "?";
  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold text-white flex-shrink-0 ${className}`}
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}

export function AvatarPicker({
  selected,
  onSelect,
}: {
  selected?: number;
  onSelect: (index: number | undefined) => void;
}) {
  const sheetCount = useSheetCount();
  const [page, setPage] = useState(selected != null ? Math.floor(selected / SPRITES_PER_SHEET) : 0);

  const start = page * SPRITES_PER_SHEET;
  const indices = Array.from({ length: SPRITES_PER_SHEET }, (_, i) => start + i);
  const pages = Array.from({ length: sheetCount }, (_, i) => i);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">Avatar</span>
        {sheetCount > 1 && (
          <div className="flex gap-1">
            {pages.map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`rounded px-2 py-0.5 text-xs ${
                  page === p ? "bg-accent text-text-inverted" : "text-text-tertiary hover:bg-bg-tertiary"
                }`}
              >
                {p + 1}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-8 gap-1.5">
        {indices.map((i) => (
          <button
            key={i}
            onClick={() => onSelect(selected === i ? undefined : i)}
            className={`rounded-full transition-transform hover:scale-110 ${
              selected === i ? "ring-2 ring-accent ring-offset-1 ring-offset-bg-secondary" : ""
            }`}
            style={{ width: 44, height: 44, ...getSpriteStyle(i, 44) }}
          />
        ))}
      </div>
      {selected != null && (
        <button
          onClick={() => onSelect(undefined)}
          className="mt-2 text-xs text-text-tertiary hover:text-text-primary"
        >
          Quitar avatar
        </button>
      )}
    </div>
  );
}
