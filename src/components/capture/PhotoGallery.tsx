import { useState, useEffect, useRef } from "react";
import { Check, Trash2, Star, Pencil, EraserIcon, ArrowRightLeft, Crop, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { compositeAnnotations } from "@/lib/annotation-renderer";
import type { EarImage } from "@/types/image";

interface PhotoGalleryProps {
  images: EarImage[];
  loadImageUrl: (filename: string) => Promise<string>;
  onToggleSelected: (id: string) => void;
  onSetPrimary: (id: string) => void;
  onRemove: (id: string) => void;
  onPreview: (image: EarImage) => void;
  onAnnotate?: (image: EarImage) => void;
  onClearAnnotations?: (id: string) => void;
  onMoveToOtherEar?: (image: EarImage) => void;
  onDownload?: (image: EarImage) => void;
}

export function PhotoGallery({
  images,
  loadImageUrl,
  onToggleSelected,
  onSetPrimary,
  onRemove,
  onPreview,
  onAnnotate,
  onClearAnnotations,
  onMoveToOtherEar,
  onDownload,
}: PhotoGalleryProps) {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  // Track a cache key per image to detect when crop/rotation/annotations change
  const cacheKeysRef = useRef<Record<string, string>>({});

  useEffect(() => {
    images.forEach(async (img) => {
      const key = `${img.rotation}|${img.annotations.length}|${JSON.stringify(img.crop ?? null)}`;
      if (thumbnails[img.id] && cacheKeysRef.current[img.id] === key) return;

      try {
        const rawUrl = await loadImageUrl(img.thumbnail);
        const hasEdits = img.rotation !== 0 || img.annotations.length > 0 || !!img.crop;

        if (hasEdits) {
          const processed = await compositeAnnotations(rawUrl, img.annotations, img.rotation, null, img.crop, img.background);
          cacheKeysRef.current[img.id] = key;
          setThumbnails((prev) => ({ ...prev, [img.id]: processed }));
        } else {
          cacheKeysRef.current[img.id] = key;
          setThumbnails((prev) => ({ ...prev, [img.id]: rawUrl }));
        }
      } catch {
        // Thumbnail might not exist yet
      }
    });
  }, [images, loadImageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (images.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      {images.map((img) => (
        <div
          key={img.id}
          className={cn(
            "overflow-hidden rounded-lg border-2 bg-bg-secondary",
            img.primary && img.selected
              ? "border-amber-400"
              : img.selected
                ? "border-accent"
                : "border-border-secondary"
          )}
        >
          {/* Thumbnail — click to open annotator */}
          <div
            className="relative aspect-[4/3] cursor-pointer bg-bg-tertiary"
            onClick={() => onAnnotate ? onAnnotate(img) : onPreview(img)}
          >
            {thumbnails[img.id] ? (
              <img
                src={thumbnails[img.id]}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            )}

            {/* Badge */}
            {img.primary && img.selected && (
              <div className="absolute left-1.5 top-1.5 rounded-full bg-amber-500 p-0.5 shadow-sm">
                <Star size={10} className="fill-white text-white" />
              </div>
            )}
            {img.selected && !img.primary && (
              <div className="absolute left-1.5 top-1.5 rounded-full bg-accent p-0.5 shadow-sm">
                <Check size={10} className="text-text-inverted" />
              </div>
            )}
            {img.annotations.length > 0 && (
              <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded bg-black/50 px-1 py-0.5 text-[8px] text-white">
                <Pencil size={7} />
                {img.annotations.length}
              </div>
            )}
            {img.crop && (
              <div className="absolute right-1.5 bottom-1.5 flex items-center rounded bg-black/50 p-0.5 text-white">
                <Crop size={9} />
              </div>
            )}
          </div>

          {/* Action bar — always visible */}
          <div className="flex items-center border-t border-border-secondary px-1 py-1">
            <button
              onClick={() => onSetPrimary(img.id)}
              className={cn(
                "rounded p-1 transition-colors",
                img.primary
                  ? "bg-amber-100 text-amber-600"
                  : "text-text-tertiary hover:bg-bg-tertiary hover:text-amber-500"
              )}
              title="Imagen principal"
            >
              <Star size={14} className={img.primary ? "fill-current" : ""} />
            </button>
            <button
              onClick={() => onToggleSelected(img.id)}
              className={cn(
                "rounded p-1 transition-colors",
                img.selected
                  ? "bg-accent-subtle text-accent-text"
                  : "text-text-tertiary hover:bg-bg-tertiary hover:text-accent"
              )}
              title={img.selected ? "Deseleccionar" : "Seleccionar"}
            >
              <Check size={14} />
            </button>
            {onClearAnnotations && img.annotations.length > 0 && (
              <button
                onClick={() => onClearAnnotations(img.id)}
                className="rounded p-1 text-text-tertiary transition-colors hover:bg-warning-subtle hover:text-warning-text"
                title="Borrar todas las anotaciones"
              >
                <EraserIcon size={14} />
              </button>
            )}
            {onMoveToOtherEar && (
              <button
                onClick={() => onMoveToOtherEar(img)}
                className="rounded p-1 text-text-tertiary transition-colors hover:bg-accent-subtle hover:text-accent-text"
                title="Mover al otro oído"
              >
                <ArrowRightLeft size={14} />
              </button>
            )}
            <div className="flex-1" />
            {onDownload && (
              <button
                onClick={() => onDownload(img)}
                className="rounded p-1 text-text-tertiary transition-colors hover:bg-accent-subtle hover:text-accent-text"
                title="Descargar"
              >
                <Download size={14} />
              </button>
            )}
            <button
              onClick={() => onRemove(img.id)}
              className="rounded p-1 text-text-tertiary transition-colors hover:bg-danger-subtle hover:text-danger-text"
              title="Eliminar"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
