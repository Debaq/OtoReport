import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { compositeAnnotations } from "@/lib/annotation-renderer";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import type { EarData, FindingsCategoryConfig } from "@/types";
import type { EarSide, EarImage } from "@/types/image";
import { FindingType, QuadrantName } from "@/types/findings";
import { FindingsChecklist } from "./FindingsChecklist";
import { TympanicDiagram } from "./TympanicDiagram";
import { SymbolPalette } from "./SymbolPalette";
import { ImageActions } from "@/components/capture/ImageActions";
import { PhotoGallery } from "@/components/capture/PhotoGallery";
import { CameraCapture } from "@/components/capture/CameraCapture";
import { PhotoPreview } from "@/components/capture/PhotoPreview";
import { ImageAnnotator } from "@/components/annotation/ImageAnnotator";
import { useEarImages } from "@/hooks/useEarImages";

interface EarPanelProps {
  side: EarSide;
  data: EarData;
  patientId: string;
  sessionId: string;
  patientName?: string;
  reportDate?: string;
  onChange: (data: EarData) => void;
  onMoveImage?: (image: EarImage) => void;
  readOnly?: boolean;
  categoriesConfig?: FindingsCategoryConfig[];
}

export function EarPanel({ side, data, patientId, sessionId, patientName, reportDate, onChange, onMoveImage, readOnly, categoriesConfig }: EarPanelProps) {
  const { t } = useTranslation();
  const isRight = side === "right" || side === "pre_right" || side === "post_right";
  const title = isRight ? t("ear.right") : t("ear.left");
  const diagramSide: "right" | "left" = isRight ? "right" : "left";
  const [selectedFinding, setSelectedFinding] = useState<FindingType | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [previewImage, setPreviewImage] = useState<EarImage | null>(null);
  const [annotatingImage, setAnnotatingImage] = useState<EarImage | null>(null);
  const [annotatingUrl, setAnnotatingUrl] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingAnnotator, setLoadingAnnotator] = useState(false);

  const { addImage, removeImage, toggleSelected, setPrimary, loadImageUrl } =
    useEarImages({
      patientId,
      sessionId,
      side,
      images: data.images,
      onChange: (images) => onChange({ ...data, images }),
    });

  function handleMarkQuadrant(quadrant: QuadrantName) {
    const existingIdx = data.marks.marks.findIndex(
      (m) => m.quadrant === quadrant
    );
    let newMarks = [...data.marks.marks];

    if (selectedFinding) {
      if (existingIdx >= 0) {
        if (newMarks[existingIdx].finding === selectedFinding) {
          newMarks.splice(existingIdx, 1);
        } else {
          newMarks[existingIdx] = { quadrant, finding: selectedFinding };
        }
      } else {
        newMarks.push({ quadrant, finding: selectedFinding });
      }
    } else if (existingIdx >= 0) {
      newMarks.splice(existingIdx, 1);
    }

    onChange({ ...data, marks: { marks: newMarks } });
  }

  async function handleCapture(frameData: Uint8Array) {
    await addImage(frameData, "camera", "png");
  }

  async function handleLoadFile() {
    const selected = await open({
      multiple: true,
      filters: [
        { name: t("ear.imageFilterName"), extensions: ["png", "jpg", "jpeg", "bmp", "webp"] },
      ],
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      setLoadingFiles(true);
      try {
        for (const filePath of paths) {
          const data = await readFile(filePath);
          const ext = filePath.split(".").pop() || "png";
          await addImage(new Uint8Array(data), "file", ext);
        }
      } finally {
        setLoadingFiles(false);
      }
    }
  }

  async function handleDownload(img: EarImage) {
    try {
      const rawUrl = await loadImageUrl(img.filename);
      const hasEdits = img.rotation !== 0 || img.annotations.length > 0 || !!img.frameShape || !!img.tympanicRef?.showOverlay || (img.viewport && (img.viewport.zoom !== 1 || img.viewport.panX !== 0 || img.viewport.panY !== 0)) || (img.adjustments && (img.adjustments.brightness !== 100 || img.adjustments.contrast !== 100 || img.adjustments.saturate !== 100 || img.adjustments.temperature !== 0 || img.adjustments.clahe || img.adjustments.invert || img.adjustments.sharpen > 0));
      const finalUrl = hasEdits
        ? await compositeAnnotations(rawUrl, img.annotations, img.rotation, null, img.frameShape, img.background, img.tympanicRef, side, img.viewport, img.adjustments)
        : rawUrl;

      const sideLabel = isRight ? "derecho" : "izquierdo";
      const name = (patientName || "paciente").replace(/\s+/g, "_");
      const date = (reportDate || new Date().toISOString().slice(0, 10)).replace(/\//g, "-");
      const filename = `${name}_${sideLabel}_${img.id.slice(0, 8)}_${date}.png`;

      const a = document.createElement("a");
      a.href = finalUrl;
      a.download = filename;
      a.click();
    } catch (err) {
      console.error("Error descargando imagen:", err);
    }
  }

  const loadPreviewImage = useCallback(() => {
    if (!previewImage) return Promise.resolve("");
    return loadImageUrl(previewImage.filename);
  }, [previewImage, loadImageUrl]);

  return (
    <div className="rounded-xl border border-border-secondary bg-bg-secondary p-4">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">{title}</h3>

      <div className="space-y-4">
        <div className={`flex items-start gap-4${readOnly ? " pointer-events-none opacity-75" : ""}`}>
          <TympanicDiagram
            side={diagramSide}
            marks={data.marks}
            selectedFinding={selectedFinding}
            onMarkQuadrant={handleMarkQuadrant}
          />
          <div className="flex-1">
            <p className="mb-2 text-xs font-medium text-text-tertiary">
              {t("ear.findingToMark")}
            </p>
            <SymbolPalette
              selected={selectedFinding}
              onSelect={setSelectedFinding}
            />
          </div>
        </div>

        <div className={readOnly ? "pointer-events-none opacity-75" : ""}>
          <FindingsChecklist
            findings={data.findings}
            onChange={(findings) => onChange({ ...data, findings })}
            categoriesConfig={categoriesConfig}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-secondary">
            {t("ear.observations")}
          </label>
          <textarea
            value={data.observations}
            onChange={(e) =>
              onChange({ ...data, observations: e.target.value })
            }
            disabled={readOnly}
            rows={3}
            className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-bg-tertiary disabled:text-text-tertiary"
            placeholder={t("ear.observationsPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-text-secondary">{t("ear.images")}</h4>
            {!readOnly && (
              <ImageActions
                onCapture={() => setShowCamera(true)}
                onLoad={handleLoadFile}
              />
            )}
          </div>
          <PhotoGallery
            images={data.images}
            loadImageUrl={loadImageUrl}
            onToggleSelected={toggleSelected}
            onSetPrimary={setPrimary}
            onRemove={removeImage}
            onPreview={setPreviewImage}
            onAnnotate={async (img) => {
              setLoadingAnnotator(true);
              try {
                const url = await loadImageUrl(img.filename);
                setAnnotatingUrl(url);
                setAnnotatingImage(img);
              } finally {
                setLoadingAnnotator(false);
              }
            }}
            onDownload={handleDownload}
            onMoveToOtherEar={!readOnly ? onMoveImage : undefined}
            onClearAnnotations={(id) => {
              const updated = data.images.map((img) =>
                img.id === id ? { ...img, annotations: [] } : img
              );
              onChange({ ...data, images: updated });
            }}
          />
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={(frame) => {
            handleCapture(frame);
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {previewImage && (
        <PhotoPreview
          loadImage={loadPreviewImage}
          rotation={previewImage.rotation}
          annotations={previewImage.annotations}
          frameShape={previewImage.frameShape}
          background={previewImage.background}
          side={side}
          tympanicRef={previewImage.tympanicRef}
          viewport={previewImage.viewport}
          adjustments={previewImage.adjustments}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {(loadingFiles || loadingAnnotator) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-bg-secondary px-8 py-6 shadow-lg">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-accent border-t-transparent" />
            <p className="text-sm font-medium text-text-secondary">
              {loadingFiles ? t("ear.loadingImages") : t("ear.openingEditor")}
            </p>
          </div>
        </div>
      )}

      {annotatingImage && annotatingUrl && (
        <ImageAnnotator
          imageUrl={annotatingUrl}
          annotations={annotatingImage.annotations}
          rotation={annotatingImage.rotation}
          frameShape={annotatingImage.frameShape}
          background={annotatingImage.background}
          side={side}
          tympanicRef={annotatingImage.tympanicRef}
          viewport={annotatingImage.viewport}
          adjustments={annotatingImage.adjustments}
          onSave={(annotations, rotation, frameShape, background, tympanicRef, viewport, adjustments) => {
            const updated = data.images.map((img) =>
              img.id === annotatingImage.id
                ? { ...img, annotations, rotation, frameShape, background, tympanicRef, viewport, adjustments }
                : img
            );
            onChange({ ...data, images: updated });
            setAnnotatingImage(null);
            setAnnotatingUrl("");
          }}
        />
      )}
    </div>
  );
}
