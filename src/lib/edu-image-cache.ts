import { invoke } from "@tauri-apps/api/core";

const GITHUB_RAW =
  "https://raw.githubusercontent.com/TecMedHub/Otoreports_findings/main";
const EDU_IMAGES_INDEX = `${GITHUB_RAW}/edu/images/index.json`;
const EDU_IMAGES_BASE = `${GITHUB_RAW}/edu/images`;
const EDU_ANIMS_INDEX = `${GITHUB_RAW}/edu/animations/parts/index.json`;
const EDU_ANIMS_BASE = `${GITHUB_RAW}/edu/animations/parts`;

interface EduCacheMeta {
  version: string;
  last_sync: string;
  images: Record<string, string>;
  animations: Record<string, string>;
}

interface EduRemoteIndex {
  version: string;
  files: string[];
}

export interface EduSyncProgress {
  status: "checking" | "downloading" | "done" | "error";
  current: number;
  total: number;
  message?: string;
}

async function fetchJson<T>(url: string): Promise<{ ok: boolean; data?: T }> {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return { ok: false };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  }
}

async function downloadBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function isCacheAvailable(): Promise<boolean> {
  try {
    await invoke<EduCacheMeta>("get_edu_cache_meta");
    return true;
  } catch {
    return false;
  }
}

/**
 * Sync edu resources (images + animation parts) from GitHub.
 * Only downloads new or changed files based on version.
 */
export async function syncEduResources(
  onProgress?: (progress: EduSyncProgress) => void,
): Promise<{ ok: boolean; images: string[]; animations: string[] }> {
  const report = (p: Partial<EduSyncProgress>) =>
    onProgress?.({ status: "checking", current: 0, total: 0, ...p } as EduSyncProgress);

  report({ status: "checking" });

  const cacheAvailable = await isCacheAvailable();

  // Fetch both indexes in parallel
  const [imgIndex, animIndex] = await Promise.all([
    fetchJson<EduRemoteIndex>(EDU_IMAGES_INDEX),
    fetchJson<EduRemoteIndex>(EDU_ANIMS_INDEX),
  ]);

  const hasRemote = imgIndex.ok || animIndex.ok;

  if (!hasRemote) {
    // Offline — return cached files
    if (cacheAvailable) {
      const [images, animations] = await Promise.all([
        listCachedEduImages(),
        listCachedEduAnimations(),
      ]);
      report({ status: "done" });
      return { ok: true, images, animations };
    }
    report({ status: "error", message: "Sin conexión y sin caché local" });
    return { ok: false, images: [], animations: [] };
  }

  const remoteImages = imgIndex.data?.files ?? [];
  const remoteAnims = animIndex.data?.files ?? [];
  const imgVersion = imgIndex.data?.version ?? "";
  const animVersion = animIndex.data?.version ?? "";

  if (!cacheAvailable) {
    report({ status: "done" });
    return { ok: true, images: remoteImages, animations: remoteAnims };
  }

  // Read local meta
  let localMeta: EduCacheMeta = { version: "", last_sync: "", images: {}, animations: {} };
  try {
    localMeta = await invoke<EduCacheMeta>("get_edu_cache_meta");
  } catch {
    // No cache yet
  }

  // Determine what needs downloading
  const imgToDownload = remoteImages.filter(
    (f) => !localMeta.images[f] || localMeta.images[f] !== imgVersion,
  );
  const animToDownload = remoteAnims.filter(
    (f) => !localMeta.animations[f] || localMeta.animations[f] !== animVersion,
  );

  const total = imgToDownload.length + animToDownload.length;
  if (total === 0) {
    report({ status: "done" });
    return { ok: true, images: remoteImages, animations: remoteAnims };
  }

  report({ status: "downloading", current: 0, total });

  const newImages = { ...localMeta.images };
  const newAnims = { ...localMeta.animations };
  let done = 0;

  // Download images
  for (const filename of imgToDownload) {
    report({ status: "downloading", current: ++done, total });
    const data = await downloadBytes(`${EDU_IMAGES_BASE}/${filename}`);
    if (data) {
      try {
        await invoke("save_edu_image", { filename, imageData: Array.from(data) });
        newImages[filename] = imgVersion;
      } catch { /* skip */ }
    }
  }

  // Download animations
  for (const filename of animToDownload) {
    report({ status: "downloading", current: ++done, total });
    const data = await downloadBytes(`${EDU_ANIMS_BASE}/${filename}`);
    if (data) {
      try {
        await invoke("save_edu_animation", { filename, data: Array.from(data) });
        newAnims[filename] = animVersion;
      } catch { /* skip */ }
    }
  }

  // Save updated meta
  try {
    await invoke("save_edu_cache_meta", {
      meta: {
        version: `img:${imgVersion},anim:${animVersion}`,
        last_sync: new Date().toISOString(),
        images: newImages,
        animations: newAnims,
      },
    });
  } catch { /* meta save failed */ }

  report({ status: "done", current: total, total });
  return { ok: true, images: remoteImages, animations: remoteAnims };
}

// --- Images ---

export async function listCachedEduImages(): Promise<string[]> {
  try {
    return await invoke<string[]>("list_edu_images");
  } catch {
    return [];
  }
}

export async function getEduImageUrl(filename: string): Promise<string | null> {
  try {
    const data = await invoke<number[]>("load_edu_image", { filename });
    const bytes = new Uint8Array(data);
    const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
    const mimeMap: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp",
    };
    const blob = new Blob([bytes], { type: mimeMap[ext] ?? "image/png" });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// --- Animations ---

export async function listCachedEduAnimations(): Promise<string[]> {
  try {
    return await invoke<string[]>("list_edu_animations");
  } catch {
    return [];
  }
}

export async function loadEduAnimation(filename: string): Promise<string | null> {
  try {
    return await invoke<string>("load_edu_animation", { filename });
  } catch {
    return null;
  }
}
