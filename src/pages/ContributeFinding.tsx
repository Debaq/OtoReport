import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  ArrowLeft,
  ImagePlus,
  Pencil,
  Package,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ImageAnnotator } from "@/components/annotation/ImageAnnotator";
import { getFindingsLibrary } from "@/lib/findings-library";
import { compositeAnnotations } from "@/lib/annotation-renderer";
import type { Annotation, FrameShape } from "@/types/annotation";

const INDEX_URL =
  "https://raw.githubusercontent.com/TecMedHub/Otoreports_findings/main/json/index.json";

type ContributorEntry = { file: string; name: string };

/** Calcula el siguiente nombre de archivo disponible para un finding key */
function getNextFilename(
  findingKey: string,
  existingEntries: ContributorEntry[]
): string {
  if (existingEntries.length === 0) return `${findingKey}.webp`;
  // Siguiente número: contar existentes + 1 (la primera no tiene número)
  const nextNum = existingEntries.length + 1;
  return `${findingKey}_${nextNum}.webp`;
}

/** Agrega marca de agua con el nombre del contribuidor en la esquina inferior derecha */
function addWatermark(dataUrl: string, name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      const fontSize = Math.max(14, Math.round(img.width * 0.025));
      const padding = Math.round(fontSize * 0.6);
      const text = `© ${name}`;

      ctx.font = `${fontSize}px sans-serif`;
      const metrics = ctx.measureText(text);

      // Fondo semitransparente
      const bgHeight = fontSize + padding;
      const bgWidth = metrics.width + padding * 2;
      const x = img.width - bgWidth - padding;
      const y = img.height - bgHeight - padding;

      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.beginPath();
      ctx.roundRect(x, y, bgWidth, bgHeight, fontSize * 0.25);
      ctx.fill();

      // Texto blanco
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + padding, y + bgHeight / 2);

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function ContributeFinding() {
  const { findingKey } = useParams<{ findingKey: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProfile } = useWorkspace();

  const finding = getFindingsLibrary().find((f) => f.key === findingKey);

  const [contributorName, setContributorName] = useState(
    activeProfile?.name ?? ""
  );
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageBytes, setImageBytes] = useState<Uint8Array | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [rotation, setRotation] = useState(0);
  const [frameShape, setFrameShape] = useState<FrameShape | null>(null);
  const [background, setBackground] = useState<"black" | "white" | "transparent">("black");
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [existingEntries, setExistingEntries] = useState<ContributorEntry[]>([]);

  // Obtener contributors existentes del index remoto
  useEffect(() => {
    if (!findingKey) return;
    fetch(INDEX_URL, { cache: "no-cache" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.contributors?.[findingKey]) return;
        const raw = data.contributors[findingKey];
        if (typeof raw === "string") {
          setExistingEntries([{ file: `${findingKey}.webp`, name: raw }]);
        } else if (Array.isArray(raw)) {
          setExistingEntries(raw);
        }
      })
      .catch(() => {});
  }, [findingKey]);

  const selectImage = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [
        { name: t("ear.imageFilterName"), extensions: ["png", "jpg", "jpeg", "webp", "bmp"] },
      ],
    });
    if (!selected) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    const bytes = await readFile(path);
    setImageBytes(bytes);
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob);
    setImageDataUrl(url);
    // Reset annotations when new image selected
    setAnnotations([]);
    setRotation(0);
    setFrameShape(null);
  }, [t]);

  const handleAnnotatorSave = useCallback(
    (
      newAnnotations: Annotation[],
      newRotation: number,
      newFrameShape?: FrameShape | null,
      newBg?: "black" | "white" | "transparent"
    ) => {
      setAnnotations(newAnnotations);
      setRotation(newRotation);
      setFrameShape(newFrameShape ?? null);
      if (newBg) setBackground(newBg);
      setShowAnnotator(false);
    },
    []
  );

  const generateZip = useCallback(async () => {
    if (!imageBytes || !findingKey || !imageDataUrl) return;

    const imageFilename = getNextFilename(findingKey, existingEntries);

    const savePath = await save({
      defaultPath: `${findingKey}_contribution.zip`,
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    });
    if (!savePath) return;

    setGenerating(true);
    try {
      // Renderizar imagen con anotaciones
      const composited = await compositeAnnotations(
        imageDataUrl,
        annotations,
        rotation,
        null,
        frameShape,
        background,
      );

      // Agregar marca de agua con el nombre del contribuidor
      const watermarked = await addWatermark(composited, contributorName);

      // Convertir data URL a bytes
      const base64 = watermarked.split(",")[1];
      const binaryStr = atob(base64);
      const watermarkedBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        watermarkedBytes[i] = binaryStr.charCodeAt(i);
      }

      const metadata = {
        findingKey,
        file: imageFilename,
        contributorName,
        timestamp: new Date().toISOString(),
      };

      const annotationsData = {
        annotations,
        rotation,
        frameShape,
        background,
      };

      await invoke("create_contribution_zip", {
        imageData: Array.from(watermarkedBytes),
        imageFilename,
        annotationsJson: JSON.stringify(annotationsData, null, 2),
        metadataJson: JSON.stringify(metadata, null, 2),
        savePath: savePath,
      });

      toast(t("contribute.success"), "success");
    } catch (err) {
      toast(String(err), "error");
    } finally {
      setGenerating(false);
    }
  }, [imageBytes, imageDataUrl, findingKey, contributorName, existingEntries, annotations, rotation, frameShape, background, toast, t]);

  if (!finding) {
    return (
      <div className="flex h-full flex-col">
        <Header title={t("contribute.title")} />
        <div className="flex flex-1 items-center justify-center text-text-tertiary">
          {t("findingsLibrary.noResults")}
        </div>
      </div>
    );
  }

  if (showAnnotator && imageDataUrl) {
    return (
      <ImageAnnotator
        imageUrl={imageDataUrl}
        annotations={annotations}
        rotation={rotation}
        frameShape={frameShape}
        background={background}
        onSave={handleAnnotatorSave}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header title={t("contribute.title")} />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate("/findings-library")}
          className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          {t("contribute.back")}
        </button>

        <div className="mx-auto max-w-2xl space-y-6">
          {/* Finding info */}
          <div className="rounded-lg border border-border-secondary bg-bg-secondary p-4">
            <h2 className="text-lg font-semibold text-text-primary">
              {finding.label}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {finding.description}
            </p>
            <span className="mt-2 inline-block rounded-full bg-bg-tertiary px-2 py-0.5 text-[10px] font-medium text-text-tertiary">
              {finding.key}
            </span>
          </div>

          {/* Contributor name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">
              {t("contribute.contributorName")}
            </label>
            <Input
              value={contributorName}
              onChange={(e) => setContributorName(e.target.value)}
              placeholder={t("contribute.namePlaceholder")}
            />
          </div>

          {/* Image selection */}
          <div>
            <label className="mb-2 block text-sm font-medium text-text-primary">
              {t("contribute.image")}
            </label>
            {imageDataUrl ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-lg border border-border-secondary">
                  <img
                    src={imageDataUrl}
                    alt={finding.label}
                    className="max-h-64 w-full object-contain bg-bg-tertiary"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={selectImage}>
                    <ImagePlus size={14} className="mr-1" />
                    {t("contribute.changeImage")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAnnotator(true)}
                  >
                    <Pencil size={14} className="mr-1" />
                    {t("contribute.annotate")}
                  </Button>
                </div>
                {annotations.length > 0 && (
                  <p className="text-xs text-text-tertiary">
                    {t("contribute.annotationCount", {
                      count: annotations.length,
                    })}
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={selectImage}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-secondary py-12 text-text-tertiary transition-colors hover:border-accent hover:text-accent-text"
              >
                <ImagePlus size={32} />
                <span className="text-sm">{t("contribute.selectImage")}</span>
              </button>
            )}
          </div>

          {/* Ethics & terms */}
          <div className="rounded-lg border border-border-secondary bg-bg-secondary p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("contribute.ethicsTitle")}
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-xs text-text-secondary">
              <li>{t("contribute.ethicsWatermark")}</li>
              <li>{t("contribute.ethicsLicense")}</li>
              <li>{t("contribute.ethicsConsent")}</li>
              <li>{t("contribute.ethicsNoPersonalData")}</li>
            </ul>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border-secondary accent-accent"
              />
              <span className="text-xs text-text-secondary">
                {t("contribute.acceptTerms")}
              </span>
            </label>
          </div>

          {/* Generate ZIP */}
          <div className="rounded-lg border border-border-secondary bg-bg-secondary p-4">
            <Button
              variant="primary"
              onClick={generateZip}
              disabled={!imageBytes || !contributorName.trim() || !acceptedTerms || generating}
              className="w-full"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t("contribute.generating")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Package size={16} />
                  {t("contribute.generate")}
                </span>
              )}
            </Button>
            <p className="mt-3 text-xs text-text-tertiary">
              {t("contribute.instructions")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
