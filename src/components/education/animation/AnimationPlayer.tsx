import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import type { AnimationDefinition } from "@/types/animation";
import { useAnimationPlayer } from "@/hooks/useAnimationPlayer";
import { loadAnimation } from "@/lib/animation/animation-io";
import { AnimationRenderer } from "./AnimationRenderer";
import { PlayerControls } from "./PlayerControls";

interface AnimationPlayerProps {
  /** Ruta al archivo JSON de animacion (relativa a public/) */
  src?: string;
  /** O pasar la definicion directamente */
  animation?: AnimationDefinition;
  className?: string;
}

export function AnimationPlayer({
  src,
  animation: animationProp,
  className,
}: AnimationPlayerProps) {
  const [animation, setAnimation] = useState<AnimationDefinition | null>(
    animationProp ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Cargar desde src si se proporciona
  useEffect(() => {
    if (animationProp) {
      setAnimation(animationProp);
      setError(null);
      return;
    }
    if (!src) return;

    setLoading(true);
    loadAnimation(src).then((result) => {
      setLoading(false);
      if (result.ok) {
        setAnimation(result.animation);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }, [src, animationProp]);

  const [state, controls] = useAnimationPlayer(animation);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className ?? ""}`}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 ${className ?? ""}`}>
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }

  if (!animation) return null;

  return (
    <div className={className}>
      <div className="rounded-xl border border-border-secondary bg-bg-tertiary p-2">
        <AnimationRenderer
          layers={state.layerStates}
          width={animation.width}
          height={animation.height}
          time={state.currentTime}
          className="rounded-lg"
        />
      </div>
      <div className="mt-2">
        <PlayerControls state={state} controls={controls} />
      </div>
      {animation.name && (
        <p className="mt-1 text-center text-xs text-text-tertiary">
          {animation.name}
        </p>
      )}
    </div>
  );
}
