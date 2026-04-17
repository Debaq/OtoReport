import { useState, useEffect } from "react";
import { pdf } from "@react-pdf/renderer";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { X, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { PdfReport } from "@/components/export/PdfReport";
import { useWorkspace } from "@/hooks/useWorkspace";
import { isAndroid } from "@/lib/platform";
import { renderDiagramToImage } from "@/lib/diagram-renderer";
import { compositeAnnotations } from "@/lib/annotation-renderer";

import type { Report, WorkspaceConfig, EarData } from "@/types";

const defaultConfig: WorkspaceConfig = {
  workspace_path: "",
  center_name: "",
  center_address: "",
  center_phone: "",
  center_email: "",
  logo_path: "",
  examiner: "",
  equipment: "",
  report_title: "Informe de Otoscopía",
  ear_wash_report_title: "Informe de Lavado de Oído",
  show_header: true,
  show_logo: true,
  show_patient_info: true,
  show_exam_info: true,
  show_diagram: true,
  show_annotations: true,
  show_findings: true,
  show_observations: true,
  show_images: true,
  show_conclusion: true,
  show_footer: true,
  image_size: "medium",
  images_per_row: 3,
  theme_color: "blue",
  section_order: [],
  app_theme: "dracula",
  id_type: "rut_id_dni",
  audiometry_symbol_set: "asha",
};

interface ReportPreviewProps {
  report: Report;
  loadImageUrl: (
    patientId: string,
    sessionId: string,
    side: string,
    filename: string
  ) => Promise<string>;
  onClose: () => void;
}

export function ReportPreview({
  report,
  loadImageUrl,
  onClose,
}: ReportPreviewProps) {
  const { config } = useWorkspace();
  const resolvedConfig = config ? { ...defaultConfig, ...config } : defaultConfig;

  const [status, setStatus] = useState<"generating" | "ready" | "exporting" | "error">("generating");
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const isEarWash = report.report_type === "ear_wash";

  // State for diagram pre-rendering
  const [rightDiagramUrl, setRightDiagramUrl] = useState<string | null>(null);
  const [leftDiagramUrl, setLeftDiagramUrl] = useState<string | null>(null);
  const [postRightDiagramUrl, setPostRightDiagramUrl] = useState<string | null>(null);
  const [postLeftDiagramUrl, setPostLeftDiagramUrl] = useState<string | null>(null);
  const [diagramsReady, setDiagramsReady] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!resolvedConfig.show_logo) {
      setLogoUrl(null);
      return;
    }
    (async () => {
      try {
        let blob: Blob;
        if (resolvedConfig.logo_path) {
          const bytes: number[] = await invoke("load_logo", { path: resolvedConfig.logo_path });
          const ext = resolvedConfig.logo_path.split(".").pop()?.toLowerCase() || "png";
          const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
          blob = new Blob([new Uint8Array(bytes)], { type: mime });
        } else {
          // Fallback: logo por defecto
          const res = await fetch("/tecmedhub.jpeg");
          blob = await res.blob();
        }
        const reader = new FileReader();
        reader.onloadend = () => setLogoUrl(reader.result as string);
        reader.onerror = () => setLogoUrl(null);
        reader.readAsDataURL(blob);
      } catch {
        setLogoUrl(null);
      }
    })();
  }, [resolvedConfig.logo_path, resolvedConfig.show_logo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const promises = [
        renderDiagramToImage("right", report.right_ear.marks),
        renderDiagramToImage("left", report.left_ear.marks),
      ];
      if (isEarWash && report.post_right_ear && report.post_left_ear) {
        promises.push(
          renderDiagramToImage("right", report.post_right_ear.marks),
          renderDiagramToImage("left", report.post_left_ear.marks),
        );
      }
      const results = await Promise.allSettled(promises);
      if (cancelled) return;
      setRightDiagramUrl(results[0].status === "fulfilled" ? results[0].value : null);
      setLeftDiagramUrl(results[1].status === "fulfilled" ? results[1].value : null);
      if (results.length > 2) {
        setPostRightDiagramUrl(results[2].status === "fulfilled" ? results[2].value : null);
        setPostLeftDiagramUrl(results[3].status === "fulfilled" ? results[3].value : null);
      }
      setDiagramsReady(true);
    })();
    return () => { cancelled = true; };
  }, [report.right_ear.marks, report.left_ear.marks, report.post_right_ear?.marks, report.post_left_ear?.marks, isEarWash]);

  async function loadProcessedUrl(img: typeof report.right_ear.images[0], side: string): Promise<string> {
    const rawUrl = await loadImageUrl(report.patient_id, report.session_id, side, img.filename);
    const hasAnnotations = resolvedConfig.show_annotations && img.annotations.length > 0;
    const hasRotation = img.rotation !== 0;
    const hasFrame = !!img.frameShape;
    const hasTympanic = !!img.tympanicRef?.showOverlay;
    const hasViewport = !!img.viewport && (img.viewport.zoom !== 1 || img.viewport.panX !== 0 || img.viewport.panY !== 0);
    const hasAdjustments = !!img.adjustments && (img.adjustments.brightness !== 100 || img.adjustments.contrast !== 100 || img.adjustments.saturate !== 100 || img.adjustments.temperature !== 0 || img.adjustments.clahe || img.adjustments.invert || img.adjustments.sharpen > 0);
    if (hasAnnotations || hasRotation || hasFrame || hasTympanic || hasViewport || hasAdjustments) {
      try {
        return await compositeAnnotations(
          rawUrl,
          hasAnnotations ? img.annotations : [],
          img.rotation,
          null,
          img.frameShape,
          img.background,
          img.tympanicRef,
          side as import("@/types/image").EarSide,
          img.viewport,
          img.adjustments,
        );
      } catch (err) {
        console.warn(`compositeAnnotations failed for ${img.filename}, using raw image:`, err);
        return rawUrl;
      }
    }
    return rawUrl;
  }

  async function getEarImages(side: string, earData?: EarData): Promise<{ primary: string | null; secondary: string[] }> {
    const data = earData ?? (side === "right" ? report.right_ear : report.left_ear);
    if (data.images.length === 0) return { primary: null, secondary: [] };

    const primaryImg = data.images.find((img) => img.primary) || data.images[0];
    const secondaryImgs = data.images.filter((img) => img.id !== primaryImg.id);
    let primaryUrl: string | null = null;
    const secondaryUrls: string[] = [];

    try {
      primaryUrl = await loadProcessedUrl(primaryImg, side);
    } catch (err) {
      console.error(`Error cargando imagen principal (${side}):`, err);
    }
    for (const img of secondaryImgs) {
      try {
        secondaryUrls.push(await loadProcessedUrl(img, side));
      } catch (err) {
        console.error(`Error cargando imagen secundaria ${img.filename} (${side}):`, err);
      }
    }
    return { primary: primaryUrl, secondary: secondaryUrls };
  }

  async function generateAndSave(): Promise<{ blob: Blob; path: string }> {
    const preSide = isEarWash ? "pre_right" : "right";
    const preSideLeft = isEarWash ? "pre_left" : "left";

    const imgPromises: Promise<{ primary: string | null; secondary: string[] }>[] = [
      getEarImages(preSide, report.right_ear),
      getEarImages(preSideLeft, report.left_ear),
    ];
    if (isEarWash && report.post_right_ear && report.post_left_ear) {
      imgPromises.push(
        getEarImages("post_right", report.post_right_ear),
        getEarImages("post_left", report.post_left_ear),
      );
    }

    const imgResults = await Promise.all(imgPromises);
    const rightImgs = imgResults[0];
    const leftImgs = imgResults[1];
    const postRightImgs = imgResults[2] ?? { primary: null, secondary: [] };
    const postLeftImgs = imgResults[3] ?? { primary: null, secondary: [] };

    const blob = await pdf(
      <PdfReport
        report={report}
        rightEarPrimary={rightImgs.primary}
        rightEarSecondary={rightImgs.secondary}
        leftEarPrimary={leftImgs.primary}
        leftEarSecondary={leftImgs.secondary}
        rightDiagramUrl={rightDiagramUrl ?? undefined}
        leftDiagramUrl={leftDiagramUrl ?? undefined}
        postRightEarPrimary={postRightImgs.primary}
        postRightEarSecondary={postRightImgs.secondary}
        postLeftEarPrimary={postLeftImgs.primary}
        postLeftEarSecondary={postLeftImgs.secondary}
        postRightDiagramUrl={postRightDiagramUrl ?? undefined}
        postLeftDiagramUrl={postLeftDiagramUrl ?? undefined}
        config={resolvedConfig}
        logoUrl={logoUrl}
      />
    ).toBlob();

    const buffer = await blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    const filename = `preview_${report.patient.name.replace(/\s+/g, "_")}.pdf`;
    const path = await invoke<string>("save_pdf_to_cache", { filename, data: bytes });
    return { blob, path };
  }

  // Auto-generate and open preview
  useEffect(() => {
    if (!diagramsReady) return;
    let cancelled = false;

    (async () => {
      try {
        const { path } = await generateAndSave();
        if (cancelled) return;
        setPreviewPath(path);
        setStatus("ready");
        await openPath(path);
      } catch (err) {
        console.error("Error generating preview:", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [diagramsReady, rightDiagramUrl, leftDiagramUrl, postRightDiagramUrl, postLeftDiagramUrl, logoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOpenPreview() {
    if (previewPath) {
      await openPath(previewPath);
    }
  }

  async function handleExport() {
    setStatus("exporting");
    try {
      const { blob } = await generateAndSave();
      const buffer = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      const filename = `informe_${report.patient.name.replace(/\s+/g, "_")}.pdf`;

      if (await isAndroid()) {
        const cachedPath = await invoke<string>("save_pdf_to_cache", { filename, data: bytes });
        await openPath(cachedPath);

      } else {
        const filePath = await save({
          defaultPath: filename,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (filePath) {
          await invoke("save_pdf", { path: filePath, data: bytes });
  
        }
      }
    } catch (err) {
      console.error("Error exporting PDF:", err);
    } finally {
      setStatus("ready");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <div className="flex w-[400px] flex-col rounded-xl bg-bg-secondary shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-secondary px-6 py-4">
          <h3 className="text-lg font-semibold text-text-primary">Informe PDF</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="flex flex-col gap-3 p-6">
          {status === "generating" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-text-tertiary">
              <Spinner />
              <span className="text-sm">Generando PDF...</span>
            </div>
          ) : status === "error" ? (
            <div className="py-6 text-center text-danger-text">
              Error al generar el PDF
            </div>
          ) : (
            <>
              <p className="text-sm text-text-secondary">
                El PDF se generó correctamente y se abrió en tu visor de PDF.
              </p>
              <Button onClick={handleOpenPreview} disabled={!previewPath}>
                <ExternalLink size={16} />
                Abrir vista previa
              </Button>
              <Button
                onClick={handleExport}
                disabled={status === "exporting"}
              >
                <Download size={16} />
                {status === "exporting" ? "Exportando..." : "Guardar como..."}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
