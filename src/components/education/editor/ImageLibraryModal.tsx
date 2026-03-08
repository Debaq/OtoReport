import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, RefreshCw } from "lucide-react";
import { listCachedEduImages, getEduImageUrl, syncEduResources, type EduSyncProgress } from "@/lib/edu-image-cache";

interface ImageLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (dataUrl: string) => void;
}

export function ImageLibraryModal({ open, onClose, onSelect }: ImageLibraryModalProps) {
  const { t } = useTranslation();
  const [images, setImages] = useState<string[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncProgress, setSyncProgress] = useState<EduSyncProgress | null>(null);

  const loadImages = async () => {
    setLoading(true);
    const files = await listCachedEduImages();
    setImages(files);
    setLoading(false);

    // Generate thumbnails
    const urls: Record<string, string> = {};
    for (const file of files) {
      const url = await getEduImageUrl(file);
      if (url) urls[file] = url;
    }
    setThumbs(urls);
  };

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setPreviewUrl(null);
    loadImages();
  }, [open]);

  // Load preview when selection changes
  useEffect(() => {
    if (!selected) {
      setPreviewUrl(null);
      return;
    }
    if (thumbs[selected]) {
      setPreviewUrl(thumbs[selected]);
    } else {
      getEduImageUrl(selected).then((url) => setPreviewUrl(url));
    }
  }, [selected, thumbs]);

  const handleSync = async () => {
    setSyncProgress({ status: "checking", current: 0, total: 0 });
    await syncEduResources((p) => setSyncProgress(p));
    setSyncProgress(null);
    await loadImages();
  };

  const handleSelect = () => {
    if (selected && thumbs[selected]) {
      onSelect(thumbs[selected]);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="flex h-[70vh] w-[700px] max-w-[90vw] overflow-hidden rounded-2xl border border-border-secondary bg-bg-primary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Previsualización (izquierda) */}
        <div className="flex flex-1 flex-col border-r border-border-secondary bg-bg-tertiary">
          <div className="border-b border-border-secondary px-4 py-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("education.editor.imageLibrary")}
            </h3>
          </div>
          <div className="flex flex-1 items-center justify-center p-4">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={selected ?? ""}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            ) : (
              <p className="text-xs text-text-tertiary">
                {t("education.editor.selectImageHint")}
              </p>
            )}
          </div>
          {selected && (
            <div className="border-t border-border-secondary px-4 py-3">
              <button
                type="button"
                onClick={handleSelect}
                className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
              >
                {t("education.editor.useImage")}
              </button>
            </div>
          )}
        </div>

        {/* Lista de imágenes (derecha) */}
        <div className="flex w-56 flex-col">
          <div className="flex items-center justify-between border-b border-border-secondary px-3 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {t("education.editor.images")}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncProgress !== null}
                className="rounded p-1 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-accent disabled:opacity-50"
                title={t("education.editor.syncImages")}
              >
                <RefreshCw size={13} className={syncProgress ? "animate-spin" : ""} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-0.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Sync progress bar */}
          {syncProgress && syncProgress.status === "downloading" && (
            <div className="border-b border-border-secondary px-3 py-2">
              <div className="mb-1 text-[10px] text-text-tertiary">
                {syncProgress.current}/{syncProgress.total}
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-bg-tertiary">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <p className="py-4 text-center text-xs text-text-tertiary">...</p>
            ) : images.length === 0 ? (
              <div className="space-y-2 py-4 text-center">
                <p className="text-xs text-text-tertiary">
                  {t("education.editor.noImages")}
                </p>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncProgress !== null}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent/10 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/20"
                >
                  <RefreshCw size={12} />
                  {t("education.editor.syncImages")}
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {images.map((name) => {
                  const isSelected = selected === name;
                  const displayName = name.replace(/\.[^.]+$/, "");
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelected(name)}
                      onDoubleClick={() => {
                        if (thumbs[name]) {
                          onSelect(thumbs[name]);
                          onClose();
                        }
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                        isSelected
                          ? "bg-accent/15 text-accent"
                          : "text-text-secondary hover:bg-bg-tertiary"
                      }`}
                    >
                      {thumbs[name] ? (
                        <img
                          src={thumbs[name]}
                          alt=""
                          className="h-8 w-8 flex-shrink-0 rounded border border-border-secondary object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border border-border-secondary bg-bg-tertiary">
                          <div className="h-3 w-3 animate-pulse rounded-full bg-text-tertiary/30" />
                        </div>
                      )}
                      <span className="truncate text-xs" title={name}>
                        {displayName}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
