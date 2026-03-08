import { Play, Pause, RotateCcw } from "lucide-react";
import type { AnimationPlayerState, AnimationPlayerControls } from "@/hooks/useAnimationPlayer";

interface PlayerControlsProps {
  state: AnimationPlayerState;
  controls: AnimationPlayerControls;
}

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

export function PlayerControls({ state, controls }: PlayerControlsProps) {
  const { isPlaying, currentTime, duration, speed } = state;

  const formatTime = (t: number) => {
    const s = Math.floor(t);
    const ms = Math.floor((t % 1) * 10);
    return `${s}.${ms}`;
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-secondary bg-bg-secondary px-3 py-2">
      {/* Play/Pause */}
      <button
        type="button"
        onClick={controls.toggle}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent/80"
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>

      {/* Reset */}
      <button
        type="button"
        onClick={controls.reset}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
      >
        <RotateCcw size={14} />
      </button>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={duration}
        step={0.01}
        value={currentTime}
        onChange={(e) => controls.seek(parseFloat(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-bg-tertiary accent-accent"
      />

      {/* Time */}
      <span className="min-w-[4rem] text-xs tabular-nums text-text-tertiary">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {/* Speed */}
      <select
        value={speed}
        onChange={(e) => controls.setSpeed(parseFloat(e.target.value))}
        className="rounded-md border border-border-secondary bg-bg-tertiary px-1.5 py-1 text-xs text-text-secondary"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>
    </div>
  );
}
