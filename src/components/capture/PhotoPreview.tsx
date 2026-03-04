import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { compositeAnnotations } from "@/lib/annotation-renderer";
import type { CropData } from "@/types/annotation";

interface PhotoPreviewProps {
  loadImage: () => Promise<string>;
  rotation: number;
  crop?: CropData | null;
  onClose: () => void;
  onAnnotate?: () => void;
}

export function PhotoPreview({
  loadImage,
  rotation,
  crop,
  onClose,
}: PhotoPreviewProps) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadImage().then(async (rawUrl) => {
      if (cancelled) return;
      if (crop || rotation !== 0) {
        const processed = await compositeAnnotations(rawUrl, [], rotation, null, crop);
        URL.revokeObjectURL(rawUrl);
        if (!cancelled) setUrl(processed);
      } else {
        if (!cancelled) setUrl(rawUrl);
      }
    });
    return () => {
      cancelled = true;
      if (url && !url.startsWith("data:")) URL.revokeObjectURL(url);
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
