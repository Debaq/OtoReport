import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { compositeAnnotations } from "@/lib/annotation-renderer";
import type { Annotation, FrameShape, TympanicReference, ViewportData, ImageAdjustments } from "@/types/annotation";
import type { EarSide } from "@/types/image";

interface PhotoPreviewProps {
  loadImage: () => Promise<string>;
  rotation: number;
  annotations?: Annotation[];
  frameShape?: FrameShape | null;
  background?: "black" | "white" | "transparent";
  side?: EarSide;
  tympanicRef?: TympanicReference | null;
  viewport?: ViewportData | null;
  adjustments?: ImageAdjustments | null;
  onClose: () => void;
  onAnnotate?: () => void;
}

function hasEdits(
  rotation: number,
  annotations?: Annotation[],
  frameShape?: FrameShape | null,
  tympanicRef?: TympanicReference | null,
  viewport?: ViewportData | null,
  adjustments?: ImageAdjustments | null,
): boolean {
  return rotation !== 0
    || (annotations != null && annotations.length > 0)
    || !!frameShape
    || !!tympanicRef?.showOverlay
    || !!(viewport && (viewport.zoom !== 1 || viewport.panX !== 0 || viewport.panY !== 0))
    || !!(adjustments && (
      adjustments.brightness !== 100 || adjustments.contrast !== 100
      || adjustments.saturate !== 100 || adjustments.temperature !== 0
      || adjustments.clahe || adjustments.invert || adjustments.sharpen > 0
    ));
}

export function PhotoPreview({
  loadImage,
  rotation,
  annotations,
  frameShape,
  background,
  side,
  tympanicRef,
  viewport,
  adjustments,
  onClose,
}: PhotoPreviewProps) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadImage().then(async (rawUrl) => {
      if (cancelled) return;
      if (hasEdits(rotation, annotations, frameShape, tympanicRef, viewport, adjustments)) {
        const processed = await compositeAnnotations(rawUrl, annotations ?? [], rotation, null, frameShape, background, tympanicRef, side, viewport, adjustments);
        if (!cancelled) setUrl(processed);
      } else {
        if (!cancelled) setUrl(rawUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadImage]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative max-h-[90vh] max-w-[90vw]">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 text-white hover:bg-white/20"
        >
          <X size={20} />
        </Button>
        {url ? (
          <img
            src={url}
            alt="Preview"
            className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-white border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
