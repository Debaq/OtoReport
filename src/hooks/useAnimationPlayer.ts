import { useState, useRef, useCallback, useEffect } from "react";
import type { AnimationDefinition, LayerState } from "@/types/animation";
import { computeAnimationState } from "@/lib/animation/animation-engine";

export interface AnimationPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  layerStates: LayerState[];
}

export interface AnimationPlayerControls {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
}

export function useAnimationPlayer(
  animation: AnimationDefinition | null,
): [AnimationPlayerState, AnimationPlayerControls] {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [layerStates, setLayerStates] = useState<LayerState[]>([]);

  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const currentTimeRef = useRef(0);

  const duration = animation?.duration ?? 0;

  // Calcular estados cuando cambia el tiempo o la animacion
  useEffect(() => {
    if (!animation) {
      setLayerStates([]);
      return;
    }
    setLayerStates(computeAnimationState(animation, currentTime));
  }, [animation, currentTime]);

  // Loop de animacion
  const tick = useCallback(
    (timestamp: number) => {
      if (!animation) return;

      if (lastFrameRef.current === 0) {
        lastFrameRef.current = timestamp;
      }

      const delta = ((timestamp - lastFrameRef.current) / 1000) * speed;
      lastFrameRef.current = timestamp;

      let newTime = currentTimeRef.current + delta;

      if (newTime >= animation.duration) {
        if (animation.loop) {
          newTime = newTime % animation.duration;
        } else {
          newTime = animation.duration;
          setIsPlaying(false);
          currentTimeRef.current = newTime;
          setCurrentTime(newTime);
          return;
        }
      }

      currentTimeRef.current = newTime;
      setCurrentTime(newTime);
      rafRef.current = requestAnimationFrame(tick);
    },
    [animation, speed],
  );

  useEffect(() => {
    if (isPlaying) {
      lastFrameRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, tick]);

  const controls: AnimationPlayerControls = {
    play: useCallback(() => {
      if (!animation) return;
      if (currentTimeRef.current >= animation.duration && !animation.loop) {
        currentTimeRef.current = 0;
        setCurrentTime(0);
      }
      setIsPlaying(true);
    }, [animation]),

    pause: useCallback(() => setIsPlaying(false), []),

    toggle: useCallback(() => {
      setIsPlaying((p) => {
        if (!p && animation) {
          if (
            currentTimeRef.current >= animation.duration &&
            !animation.loop
          ) {
            currentTimeRef.current = 0;
            setCurrentTime(0);
          }
        }
        return !p;
      });
    }, [animation]),

    seek: useCallback((time: number) => {
      const clamped = Math.max(0, Math.min(time, duration));
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);
    }, [duration]),

    setSpeed: useCallback((s: number) => setSpeed(s), []),

    reset: useCallback(() => {
      setIsPlaying(false);
      currentTimeRef.current = 0;
      setCurrentTime(0);
    }, []),
  };

  return [
    { isPlaying, currentTime, duration, speed, layerStates },
    controls,
  ];
}
