import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { EarImage, EarSide } from "@/types/image";

interface UseEarImagesProps {
  patientId: string;
  sessionId: string;
  side: EarSide;
  images: EarImage[];
  onChange: (images: EarImage[]) => void;
}

export function useEarImages({
  patientId,
  sessionId,
  side,
  images,
  onChange,
}: UseEarImagesProps) {
  const addImage = useCallback(
    async (data: Uint8Array, source: "camera" | "file", ext: string) => {
      const [filename, thumbnail] = await invoke<[string, string]>(
        "save_image",
        {
          patientId,
          sessionId,
          side,
          imageData: Array.from(data),
          extension: ext,
        }
      );

      const isFirst = images.filter((i) => i.selected).length === 0;
      const newImage: EarImage = {
        id: filename.split(".")[0],
        filename,
        thumbnail,
        source,
        selected: true,
        primary: isFirst,
        sort_order: images.length,
        rotation: 0,
        notes: "",
        annotations: [],
      };

      onChange([...images, newImage]);
    },
    [patientId, sessionId, side, images, onChange]
  );

  const removeImage = useCallback(
    async (imageId: string) => {
      const img = images.find((i) => i.id === imageId);
      if (!img) return;

      await invoke("delete_image", {
        patientId,
        sessionId,
        side,
        filename: img.filename,
        thumbnail: img.thumbnail,
      });

      onChange(images.filter((i) => i.id !== imageId));
    },
    [patientId, sessionId, side, images, onChange]
  );

  const toggleSelected = useCallback(
    (_imageId: string) => {
      // All images are always selected — no-op
    },
    []
  );

  const setPrimary = useCallback(
    (imageId: string) => {
      onChange(
        images.map((i) => ({ ...i, primary: i.id === imageId }))
      );
    },
    [images, onChange]
  );

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const updated = [...images];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      onChange(updated.map((img, i) => ({ ...img, sort_order: i })));
    },
    [images, onChange]
  );

  const loadImageUrl = useCallback(
    async (filename: string): Promise<string> => {
      const data = await invoke<number[]>("load_image", {
        patientId,
        sessionId,
        side,
        filename,
      });
      const bytes = new Uint8Array(data);
      const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
      const mime =
        ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : "image/png";
      return new Promise<string>((resolve, reject) => {
        const blob = new Blob([bytes], { type: mime });
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    },
    [patientId, sessionId, side]
  );

  return { addImage, removeImage, toggleSelected, setPrimary, reorder, loadImageUrl };
}
