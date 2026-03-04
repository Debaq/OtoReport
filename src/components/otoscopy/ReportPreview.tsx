import { useState, useEffect } from "react";
import { pdf } from "@react-pdf/renderer";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { PdfReport } from "@/components/export/PdfReport";
import { useWorkspace } from "@/hooks/useWorkspace";
import { renderDiagramToImage } from "@/lib/diagram-renderer";
import { compositeAnnotations } from "@/lib/annotation-renderer";
import { blobUrlToDataUrl } from "@/lib/image-utils";
import type { Report, WorkspaceConfig } from "@/types";

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
  onStatusComplete?: () => void;
}

export function ReportPreview({
  report,
  loadImageUrl,
  onClose,
  onStatusComplete,
}: ReportPreviewProps) {
  const { config } = useWorkspace();
  const resolvedConfig = config ? { ...defaultConfig, ...config } : defaultConfig;

  const [exporting, setExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [rightDiagramUrl, setRightDiagramUrl] = useState<string | null>(null);
  const [leftDiagramUrl, setLeftDiagramUrl] = useState<string | null>(null);
  const [diagramsReady, setDiagramsReady] = useState(false);

  useEffect(() => {
    if (resolvedConfig.logo_path && resolvedConfig.show_logo) {
      (async () => {
        try {
          const bytes: number[] = await invoke("load_logo", { path: resolvedConfig.logo_path });
          const blob = new Blob([new Uint8Array(bytes)]);
          const reader = new FileReader();
          reader.onloadend = () => setLogoUrl(reader.result as string);
          reader.onerror = () => setLogoUrl(null);
          reader.readAsDataURL(blob);
        } catch {
          setLogoUrl(null);
        }
      })();
    } else {
      setLogoUrl(null);
    }
  }, [resolvedConfig.logo_path, resolvedConfig.show_logo]);

  useEffect(() => {
    (async () => {
      try {
        const [rightDiag, leftDiag] = await Promise.all([
          renderDiagramToImage("right", report.right_ear.marks),
          renderDiagramToImage("left", report.left_ear.marks),
        ]);
        setRightDiagramUrl(rightDiag);
        setLeftDiagramUrl(leftDiag);
      } catch (err) {
        console.error("Error rendering diagrams:", err);
      } finally {
        setDiagramsReady(true);
      }
    })();
  }, [report.right_ear.marks, report.left_ear.marks]);

  async function loadProcessedUrl(img: typeof report.right_ear.images[0], side: string, retries = 2): Promise<string> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const rawUrl = await loadImageUrl(
          report.patient_id,
          report.session_id,
          side,
          img.filename
        );
        const hasAnnotations = resolvedConfig.show_annotations && img.annotations.length > 0;
        const hasRotation = img.rotation !== 0;
        const hasCrop = !!img.crop;
        if (hasAnnotations || hasRotation || hasCrop) {
          const composited = await compositeAnnotations(
            rawUrl,
            hasAnnotations ? img.annotations : [],
            img.rotation,
            null,
            img.crop
          );
          URL.revokeObjectURL(rawUrl);
          return composited; // ya es data URL (canvas.toDataURL)
        }
        // Convertir blob URL a data URL para que @react-pdf/renderer lo cargue correctamente
        const dataUrl = await blobUrlToDataUrl(rawUrl);
        URL.revokeObjectURL(rawUrl);
        return dataUrl;
      } catch (err) {
        console.warn(`Error cargando imagen ${img.filename} (intento ${attempt + 1}):`, err);
        if (attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    throw new Error("Unreachable");
  }

  async function getEarImages(side: "right" | "left"): Promise<{ primary: string | null; secondary: string[] }> {
    const earData = side === "right" ? report.right_ear : report.left_ear;
    const selected = earData.images.filter((img) => img.selected);
    if (selected.length === 0) return { primary: null, secondary: [] };

    const primaryImg = selected.find((img) => img.primary) || selected[0];
    const secondaryImgs = selected.filter((img) => img.id !== primaryImg.id);

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

  async function generatePdf(): Promise<Blob> {
    const rightImgs = await getEarImages("right");
    const leftImgs = await getEarImages("left");
    return pdf(
      <PdfReport
        report={report}
        rightEarPrimary={rightImgs.primary}
        rightEarSecondary={rightImgs.secondary}
        leftEarPrimary={leftImgs.primary}
        leftEarSecondary={leftImgs.secondary}
        rightDiagramUrl={rightDiagramUrl ?? undefined}
        leftDiagramUrl={leftDiagramUrl ?? undefined}
        config={resolvedConfig}
        logoUrl={logoUrl}
      />
    ).toBlob();
  }

  useEffect(() => {
    if (!diagramsReady) return;

    let cancelled = false;
    setGenerating(true);
    const timer = setTimeout(async () => {
      try {
        const blob = await generatePdf();
        if (!cancelled) {
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
        }
      } catch (err) {
        console.error("Error generating preview:", err);
      } finally {
        if (!cancelled) setGenerating(false);
      }
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [logoUrl, diagramsReady, rightDiagramUrl, leftDiagramUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await generatePdf();
      const buffer = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));

      const filePath = await save({
        defaultPath: `informe_${report.patient.name.replace(/\s+/g, "_")}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      if (filePath) {
        await invoke("save_pdf", { path: filePath, data: bytes });
        onStatusComplete?.();
      }
    } catch (err) {
      console.error("Error exporting PDF:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex h-[90vh] w-[80vw] flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <h3 className="text-lg font-semibold text-gray-800">
            Vista Previa del Informe
          </h3>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleExport} disabled={exporting || generating}>
              <Download size={16} />
              {exporting ? "Exportando..." : "Exportar PDF"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X size={18} />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-100 p-6">
          {generating ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500">
              <Spinner />
              <span className="text-sm">Generando vista previa...</span>
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              className="mx-auto h-full w-full max-w-3xl rounded-lg border border-gray-200 bg-white shadow-sm"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-red-400">
              Error al generar la vista previa
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
