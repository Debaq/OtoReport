import { useRef, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Diamond, ChevronDown, ChevronRight } from "lucide-react";
import type {
  AnimationEditorState,
  AnimationEditorActions,
} from "@/hooks/useAnimationEditor";
import type { EasingType } from "@/types/animation";

interface EditorTimelineProps {
  state: AnimationEditorState;
  actions: AnimationEditorActions;
}

const ANIMATABLE_PROPS = [
  "x", "y", "scaleX", "scaleY", "rotation", "opacity",
  "fill", "stroke", "strokeWidth", "backgroundColor",
  "level", "cx", "cy", "rx", "ry", "size", "radius",
  "intensity", "count", "meshPoints",
];

const EASING_OPTIONS: EasingType[] = [
  "linear", "ease-in", "ease-out", "ease-in-out", "step", "cubic-bezier",
];

export function EditorTimeline({ state, actions }: EditorTimelineProps) {
  const { t } = useTranslation();
  const timeAreaRef = useRef<HTMLDivElement>(null);
  const { animation, selectedLayerId, selectedTrackProperty, selectedKeyframeIndex, currentTime } = state;
  const selectedLayer = animation.layers.find((l) => l.id === selectedLayerId);
  const [expandedTracks, setExpandedTracks] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const [barDrag, setBarDrag] = useState<{
    layerId: string;
    edge: "start" | "end" | "move";
    origStart: number;
    origEnd: number;
    startX: number;
  } | null>(null);

  const xToTime = useCallback(
    (x: number, width: number) =>
      Math.max(0, Math.min((x / width) * animation.duration, animation.duration)),
    [animation.duration],
  );

  const handleTimeAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle clicks directly on the time area background
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const time = xToTime(e.clientX - rect.left, rect.width);
    actions.setCurrentTime(Math.round(time * 20) / 20);
  };

  const handleAddKeyframe = (property: string) => {
    if (!selectedLayer) return;
    let defaultValue: number | string = 0;
    if (property === "opacity") defaultValue = selectedLayer.opacity;
    else if (property === "x") defaultValue = selectedLayer.transform.x;
    else if (property === "y") defaultValue = selectedLayer.transform.y;
    else if (property === "scaleX") defaultValue = selectedLayer.transform.scaleX;
    else if (property === "scaleY") defaultValue = selectedLayer.transform.scaleY;
    else if (property === "rotation") defaultValue = selectedLayer.transform.rotation;
    else if (property === "fill") defaultValue = selectedLayer.fill ?? "#ffffff";
    else if (property === "stroke") defaultValue = selectedLayer.stroke ?? "#000000";
    else if (property === "strokeWidth") defaultValue = selectedLayer.strokeWidth ?? 1;
    else if (property === "backgroundColor") defaultValue = selectedLayer.backgroundColor ?? "#1a1a2e";

    if (!selectedLayer.tracks.find((t) => t.property === property)) {
      actions.addTrack(selectedLayer.id, property);
    }
    actions.addKeyframe(selectedLayer.id, property, currentTime, defaultValue);
  };

  const getTimeAreaWidth = () => timeAreaRef.current?.getBoundingClientRect().width ?? 1;

  const handleBarMouseDown = (
    e: React.MouseEvent,
    layerId: string,
    edge: "start" | "end" | "move",
  ) => {
    e.stopPropagation();
    const layer = animation.layers.find((l) => l.id === layerId);
    if (!layer) return;
    setBarDrag({
      layerId,
      edge,
      origStart: layer.startTime ?? 0,
      origEnd: layer.endTime ?? animation.duration,
      startX: e.clientX,
    });
  };

  const handleBarMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!barDrag) return;
      const w = getTimeAreaWidth();
      const dx = e.clientX - barDrag.startX;
      const dt = (dx / w) * animation.duration;
      const snap = (v: number) => Math.round(v * 20) / 20;

      if (barDrag.edge === "start") {
        const newStart = snap(Math.max(0, Math.min(barDrag.origStart + dt, barDrag.origEnd - 0.05)));
        actions.updateLayer(barDrag.layerId, { startTime: newStart });
      } else if (barDrag.edge === "end") {
        const newEnd = snap(Math.max(barDrag.origStart + 0.05, Math.min(barDrag.origEnd + dt, animation.duration)));
        actions.updateLayer(barDrag.layerId, { endTime: newEnd });
      } else {
        const range = barDrag.origEnd - barDrag.origStart;
        let newStart = snap(barDrag.origStart + dt);
        if (newStart < 0) newStart = 0;
        if (newStart + range > animation.duration) newStart = snap(animation.duration - range);
        actions.updateLayer(barDrag.layerId, { startTime: newStart, endTime: newStart + range });
      }
    },
    [barDrag, animation.duration, actions],
  );

  const handleBarMouseUp = useCallback(() => setBarDrag(null), []);

  const playheadPct = `${(currentTime / animation.duration) * 100}%`;
  const sortedLayers = [...animation.layers].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div
      className="rounded-xl border border-border-secondary bg-bg-secondary"
      onMouseMove={barDrag ? handleBarMouseMove : undefined}
      onMouseUp={barDrag ? handleBarMouseUp : undefined}
      onMouseLeave={barDrag ? handleBarMouseUp : undefined}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex flex-shrink-0 items-center gap-1.5 text-text-tertiary hover:text-text-primary"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          <h4 className="text-xs font-semibold uppercase tracking-wider">Timeline</h4>
        </button>

        {collapsed ? (
          /* Mini timeline scrubber cuando está colapsado */
          <div className="flex flex-1 items-center gap-2">
            <span className="flex-shrink-0 text-xs tabular-nums text-text-tertiary">
              {currentTime.toFixed(1)}s
            </span>
            <div
              className="relative h-5 flex-1 cursor-pointer rounded-md bg-bg-tertiary"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const time = xToTime(e.clientX - rect.left, rect.width);
                actions.setCurrentTime(Math.round(time * 20) / 20);
              }}
            >
              {/* Time marks */}
              {Array.from({ length: Math.ceil(animation.duration) + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-border-secondary/50"
                  style={{ left: `${(i / animation.duration) * 100}%` }}
                >
                  {i > 0 && (
                    <span className="absolute left-0.5 top-0 text-[7px] text-text-tertiary/50">{i}</span>
                  )}
                </div>
              ))}
              {/* Playhead */}
              <div
                className="absolute top-0 h-full w-0.5 bg-accent"
                style={{ left: playheadPct }}
              >
                <div className="absolute -left-1 top-0 h-0 w-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-accent" />
              </div>
            </div>
            <span className="flex-shrink-0 text-xs tabular-nums text-text-tertiary">
              {animation.duration}s
            </span>
          </div>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs tabular-nums text-text-tertiary">
              {currentTime.toFixed(2)}s / {animation.duration}s
            </span>
            <label className="flex items-center gap-1">
              <span className="text-xs text-text-tertiary">{t("education.editor.duration")}</span>
              <input
                type="number"
                value={animation.duration}
                onChange={(e) =>
                  actions.updateAnimation({
                    duration: Math.max(0.1, parseFloat(e.target.value) || 1),
                  })
                }
                step={0.5}
                min={0.1}
                className="w-14 rounded-md border border-border-secondary bg-bg-tertiary px-1.5 py-0.5 text-xs text-text-primary"
              />
            </label>
          </div>
        )}
      </div>

      {!collapsed && <>
      {/* Timeline body: label column + time area with unified playhead */}
      <div className="flex border-t border-border-secondary">
        {/* Label column */}
        <div className="w-28 flex-shrink-0 border-r border-border-secondary">
          {/* Ruler label */}
          <div className="h-6 border-b border-border-secondary" />

          {/* Layer labels */}
          {sortedLayers.map((layer) => {
            const isSelected = selectedLayerId === layer.id;
            return (
              <div
                key={layer.id}
                className={`flex h-7 items-center border-b border-border-secondary px-2 cursor-pointer ${
                  isSelected ? "bg-accent-subtle/30" : "hover:bg-bg-tertiary"
                }`}
                onClick={() => actions.selectLayer(isSelected ? null : layer.id)}
              >
                <span className="truncate text-xs text-text-secondary">{layer.name}</span>
              </div>
            );
          })}

          {/* Track labels */}
          {selectedLayer && (
            <>
              <button
                type="button"
                onClick={() => setExpandedTracks(!expandedTracks)}
                className="flex h-6 w-full items-center gap-1 border-b border-border-secondary px-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-tertiary hover:bg-bg-tertiary"
              >
                {expandedTracks ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                Tracks
              </button>

              {expandedTracks && (
                <>
                  {selectedLayer.tracks.map((track) => (
                    <div
                      key={track.property}
                      className={`flex h-7 items-center justify-between border-b border-border-secondary px-2 cursor-pointer ${
                        selectedTrackProperty === track.property ? "bg-accent-subtle/50" : ""
                      }`}
                      onClick={() => actions.selectTrack(
                        selectedTrackProperty === track.property ? null : track.property,
                      )}
                    >
                      <span className="truncate text-xs text-text-secondary">{track.property}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          actions.removeTrack(selectedLayer.id, track.property);
                        }}
                        className="ml-1 text-text-tertiary hover:text-red-400"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}

                  {/* Add track row */}
                  <div className="flex h-7 items-center px-2">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddKeyframe(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      className="w-full rounded-md border border-border-secondary bg-bg-tertiary px-1 py-0.5 text-[10px] text-text-secondary"
                    >
                      <option value="" disabled>+ {t("education.editor.addTrack")}</option>
                      {ANIMATABLE_PROPS.filter(
                        (p) => !selectedLayer.tracks.find((t) => t.property === p),
                      ).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </>
          )}

          {!selectedLayer && (
            <div className="flex h-10 items-center px-2">
              <span className="text-[10px] text-text-tertiary">{t("education.editor.selectLayerForTimeline")}</span>
            </div>
          )}
        </div>

        {/* Time area — ruler + bars + tracks with one continuous playhead */}
        <div className="relative flex-1" ref={timeAreaRef}>
          {/* Playhead line — spans the entire time area height */}
          <div
            className="absolute top-0 bottom-0 z-10 w-0.5 bg-accent pointer-events-none"
            style={{ left: playheadPct }}
          >
            {/* Playhead head triangle */}
            <div className="absolute -left-1.5 -top-0.5 h-0 w-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-accent" />
          </div>

          {/* Ruler row */}
          <div
            className="relative h-6 cursor-pointer border-b border-border-secondary bg-bg-tertiary"
            onClick={handleTimeAreaClick}
          >
            {Array.from({ length: Math.ceil(animation.duration) + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full border-l border-border-secondary"
                style={{ left: `${(i / animation.duration) * 100}%` }}
              >
                <span className="absolute left-1 top-0.5 text-[9px] text-text-tertiary">{i}s</span>
              </div>
            ))}
          </div>

          {/* Layer time bars */}
          {sortedLayers.map((layer) => {
            const start = layer.startTime ?? 0;
            const end = layer.endTime ?? animation.duration;
            const leftPct = (start / animation.duration) * 100;
            const widthPct = ((end - start) / animation.duration) * 100;
            const isSelected = selectedLayerId === layer.id;

            return (
              <div
                key={layer.id}
                className={`relative h-7 border-b border-border-secondary ${
                  isSelected ? "bg-accent-subtle/30" : ""
                }`}
                onClick={handleTimeAreaClick}
              >
                <div
                  className={`absolute top-1 h-5 rounded-md cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? "bg-accent/40 border border-accent/60"
                      : "bg-text-tertiary/20 border border-text-tertiary/30"
                  }`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  onMouseDown={(e) => handleBarMouseDown(e, layer.id, "move")}
                  onClick={(e) => { e.stopPropagation(); actions.selectLayer(layer.id); }}
                >
                  <div
                    className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize rounded-l-md hover:bg-accent/60"
                    onMouseDown={(e) => handleBarMouseDown(e, layer.id, "start")}
                  />
                  <div
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize rounded-r-md hover:bg-accent/60"
                    onMouseDown={(e) => handleBarMouseDown(e, layer.id, "end")}
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] tabular-nums text-text-tertiary">
                    {start.toFixed(1)}–{end.toFixed(1)}s
                  </span>
                </div>
              </div>
            );
          })}

          {/* Tracks for selected layer */}
          {selectedLayer && (
            <>
              {/* Toggle row (matching label height) */}
              <div className="h-6 border-b border-border-secondary" />

              {expandedTracks && (
                <>
                  {selectedLayer.tracks.map((track) => (
                    <div
                      key={track.property}
                      className={`relative h-7 border-b border-border-secondary ${
                        selectedTrackProperty === track.property ? "bg-accent-subtle/50" : ""
                      }`}
                      onClick={(e) => {
                        if (e.target === e.currentTarget) handleAddKeyframe(track.property);
                      }}
                    >
                      {track.keyframes.map((kf, kfIdx) => {
                        const isKfSelected =
                          selectedTrackProperty === track.property &&
                          selectedKeyframeIndex === kfIdx;
                        return (
                          <button
                            key={kfIdx}
                            type="button"
                            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-colors ${
                              isKfSelected ? "text-accent" : "text-amber-400 hover:text-amber-300"
                            }`}
                            style={{ left: `${(kf.time / animation.duration) * 100}%` }}
                            onClick={(e) => {
                              e.stopPropagation();
                              actions.selectTrack(track.property);
                              actions.selectKeyframe(kfIdx);
                            }}
                          >
                            <Diamond size={isKfSelected ? 12 : 10} fill="currentColor" />
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {/* Add track row spacer */}
                  <div className="h-7" />
                </>
              )}
            </>
          )}

          {!selectedLayer && <div className="h-10" />}
        </div>
      </div>

      {/* Keyframe editor */}
      {selectedLayer &&
        selectedTrackProperty &&
        selectedKeyframeIndex !== null && (() => {
          const track = selectedLayer.tracks.find((t) => t.property === selectedTrackProperty);
          const kf = track?.keyframes[selectedKeyframeIndex];
          if (!track || !kf) return null;

          return (
            <div className="border-t border-border-secondary px-3 py-2">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1">
                  <span className="text-xs text-text-tertiary">T:</span>
                  <input
                    type="number"
                    value={kf.time}
                    onChange={(e) =>
                      actions.updateKeyframe(
                        selectedLayer.id, selectedTrackProperty, selectedKeyframeIndex,
                        { time: parseFloat(e.target.value) || 0 },
                      )
                    }
                    step={0.05}
                    min={0}
                    max={animation.duration}
                    className="w-16 rounded-md border border-border-secondary bg-bg-tertiary px-1.5 py-0.5 text-xs text-text-primary"
                  />
                </label>

                <label className="flex items-center gap-1">
                  <span className="text-xs text-text-tertiary">Val:</span>
                  {typeof kf.value === "number" ? (
                    <input
                      type="number"
                      value={kf.value}
                      onChange={(e) =>
                        actions.updateKeyframe(
                          selectedLayer.id, selectedTrackProperty, selectedKeyframeIndex,
                          { value: parseFloat(e.target.value) || 0 },
                        )
                      }
                      step={selectedTrackProperty === "opacity" ? 0.05 : 1}
                      className="w-20 rounded-md border border-border-secondary bg-bg-tertiary px-1.5 py-0.5 text-xs text-text-primary"
                    />
                  ) : typeof kf.value === "string" ? (
                    <input
                      type="text"
                      value={kf.value}
                      onChange={(e) =>
                        actions.updateKeyframe(
                          selectedLayer.id, selectedTrackProperty, selectedKeyframeIndex,
                          { value: e.target.value },
                        )
                      }
                      className="w-20 rounded-md border border-border-secondary bg-bg-tertiary px-1.5 py-0.5 text-xs text-text-primary"
                    />
                  ) : (
                    <span className="text-xs text-text-tertiary">[complejo]</span>
                  )}
                </label>

                <label className="flex items-center gap-1">
                  <span className="text-xs text-text-tertiary">Easing:</span>
                  <select
                    value={kf.easing.type}
                    onChange={(e) =>
                      actions.updateKeyframe(
                        selectedLayer.id, selectedTrackProperty, selectedKeyframeIndex,
                        { easing: { type: e.target.value as EasingType } },
                      )
                    }
                    className="rounded-md border border-border-secondary bg-bg-tertiary px-1.5 py-0.5 text-xs text-text-primary"
                  >
                    {EASING_OPTIONS.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() =>
                    actions.removeKeyframe(selectedLayer.id, selectedTrackProperty, selectedKeyframeIndex)
                  }
                  className="ml-auto text-text-tertiary hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })()}
      </>}
    </div>
  );
}
