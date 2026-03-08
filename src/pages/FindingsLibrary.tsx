import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  ImageOff,
  Loader2,
  WifiOff,
  RefreshCw,
  Heart,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  ImagePlus,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { ImageAnnotator } from "@/components/annotation/ImageAnnotator";
import { getFindingsLibrary, type LibraryFinding } from "@/lib/findings-library";
import {
  syncFindingsCache,
  getCachedImageUrl,
  clearFindingsCache,
  type SyncProgress,
} from "@/lib/findings-cache";
import type { Annotation, FrameShape } from "@/types/annotation";

type ContributorEntry = { file: string; name: string };
type Contributors = Record<string, ContributorEntry[]>;

type ConnectionStatus = "checking" | "online" | "offline";
type CategoryFilter = "all" | "membrane" | "cae";

function FindingCard({
  finding,
  isOnline,
  entries,
  cachedUrls,
  onImageClick,
}: {
  finding: LibraryFinding;
  isOnline: boolean;
  entries?: ContributorEntry[];
  cachedUrls: Map<string, string>;
  onImageClick?: (finding: LibraryFinding, imageUrl: string) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const images = entries && entries.length > 0
    ? entries.map((e) => ({
        file: e.file,
        name: e.name,
      }))
    : [{ file: `${finding.key}.webp`, name: undefined as string | undefined }];

  const hasMultiple = images.length > 1;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [imgStatus, setImgStatus] = useState<"loading" | "loaded" | "error">("loading");

  const current = images[currentIdx];
  const cachedUrl = cachedUrls.get(current.file);
  const hasSrc = !!cachedUrl || isOnline;

  // Reset status when image changes
  useEffect(() => {
    if (hasSrc) setImgStatus("loading");
    else setImgStatus("error");
  }, [currentIdx, hasSrc]);

  // Use cached URL if available, otherwise fall back to GitHub
  const GITHUB_IMG_BASE =
    "https://raw.githubusercontent.com/TecMedHub/Otoreports_findings/main/img";
  const imgSrc = cachedUrl || `${GITHUB_IMG_BASE}/${current.file}`;

  return (
    <div className="group overflow-hidden rounded-xl border border-border-secondary bg-bg-secondary transition-colors hover:border-accent">
      {/* Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-bg-tertiary">
        {imgStatus === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-text-tertiary" />
          </div>
        )}
        {imgStatus === "error" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-text-tertiary">
            <ImageOff size={24} />
            <span className="text-xs">{t("findingsLibrary.noImages")}</span>
            <button
              type="button"
              onClick={() => navigate(`/contribute/${finding.key}`)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-accent-text transition-colors hover:bg-accent-subtle"
            >
              <Upload size={10} />
              {t("findingsLibrary.contribute")}
            </button>
          </div>
        ) : (
          <>
            <img
              src={imgSrc}
              alt={finding.label}
              loading="lazy"
              onLoad={() => setImgStatus("loaded")}
              onError={() => setImgStatus("error")}
              onClick={() => imgStatus === "loaded" && onImageClick?.(finding, imgSrc)}
              className={`h-full w-full object-cover transition-opacity cursor-pointer ${
                imgStatus === "loaded" ? "opacity-100" : "opacity-0"
              }`}
            />
            {/* Carousel arrows */}
            {hasMultiple && imgStatus === "loaded" && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIdx((i) => (i - 1 + images.length) % images.length);
                  }}
                  className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIdx((i) => (i + 1) % images.length);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <ChevronRight size={14} />
                </button>
                {/* Dots */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIdx(i);
                      }}
                      className={`h-1.5 w-1.5 rounded-full transition-colors ${
                        i === currentIdx ? "bg-white" : "bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {finding.label}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          {finding.description}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-block rounded-full bg-bg-tertiary px-2 py-0.5 text-[10px] font-medium text-text-tertiary">
              {finding.key}
            </span>
            {current.name && (
              <span className="flex items-center gap-1 text-[10px] text-text-tertiary truncate">
                <User size={10} className="shrink-0" />
                {current.name}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(`/contribute/${finding.key}`)}
            className="shrink-0 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-accent-text transition-colors hover:bg-accent-subtle"
            title={t("findingsLibrary.contribute")}
          >
            <Upload size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}

type EditorState = {
  finding: LibraryFinding;
  imageUrl: string;
};

type PostEditState = {
  finding: LibraryFinding;
  hasAnnotations: boolean;
};

export function FindingsLibrary() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [connection, setConnection] = useState<ConnectionStatus>("checking");
  const [contributors, setContributors] = useState<Contributors>({});
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [cachedUrls, setCachedUrls] = useState<Map<string, string>>(new Map());
  const isSyncing = useRef(false);

  // Editor state
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [postEdit, setPostEdit] = useState<PostEditState | null>(null);

  const handleImageClick = useCallback((finding: LibraryFinding, imageUrl: string) => {
    setEditorState({ finding, imageUrl });
  }, []);

  const handleEditorSave = useCallback(
    (annotations: Annotation[], _rotation: number, _frameShape?: FrameShape | null) => {
      if (!editorState) return;
      setPostEdit({
        finding: editorState.finding,
        hasAnnotations: annotations.length > 0,
      });
      setEditorState(null);
    },
    [editorState]
  );

  /** Resolve cached URLs for all contributor image files */
  const resolveCachedUrls = useCallback(async (contribs: Contributors) => {
    const urls = new Map<string, string>();
    const filenames = new Set<string>();
    for (const entries of Object.values(contribs)) {
      for (const entry of entries) {
        filenames.add(entry.file);
      }
    }
    await Promise.all(
      [...filenames].map(async (filename) => {
        const url = await getCachedImageUrl(filename);
        if (url) urls.set(filename, url);
      })
    );
    setCachedUrls(urls);
  }, []);

  const sync = useCallback(
    async (forceResync = false) => {
      if (isSyncing.current) return;
      isSyncing.current = true;
      setConnection("checking");

      try {
        if (forceResync) {
          try {
            await clearFindingsCache();
          } catch {
            // Ignore
          }
        }

        const result = await syncFindingsCache((progress) => {
          setSyncProgress(progress);
        });

        setConnection(result.ok ? "online" : "offline");
        setContributors(result.contributors);

        if (result.ok) {
          try {
            await resolveCachedUrls(result.contributors);
          } catch {
            // Cache URLs not available, will use GitHub direct
          }
        }
      } catch (err) {
        console.error("Sync error:", err);
        setConnection("offline");
      } finally {
        isSyncing.current = false;
      }
    },
    [resolveCachedUrls]
  );

  useEffect(() => {
    sync();
  }, [sync]);

  const library = useMemo(() => getFindingsLibrary(), [t]);

  const filtered = useMemo(() => {
    let items = library;
    if (category !== "all") {
      items = items.filter((f) => f.category === category);
    }
    if (query.trim()) {
      const q = query
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      items = items.filter((f) => {
        const label = f.label
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const desc = f.description
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        return label.includes(q) || desc.includes(q) || f.key.includes(q);
      });
    }
    return items;
  }, [library, query, category]);

  const membraneCount = library.filter((f) => f.category === "membrane").length;
  const caeCount = library.filter((f) => f.category === "cae").length;

  const categories: { value: CategoryFilter; label: string; count: number }[] =
    [
      { value: "all", label: t("findingsLibrary.all"), count: library.length },
      {
        value: "membrane",
        label: t("findingsLibrary.membrane"),
        count: membraneCount,
      },
      { value: "cae", label: t("findingsLibrary.cae"), count: caeCount },
    ];

  const isDownloading = syncProgress?.status === "downloading";

  // Fullscreen editor
  if (editorState) {
    return (
      <ImageAnnotator
        imageUrl={editorState.imageUrl}
        annotations={[]}
        rotation={0}
        onSave={handleEditorSave}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header title={t("findingsLibrary.title")} />

      {/* Post-edit contribute prompt */}
      {postEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border-secondary bg-bg-primary p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-text-primary">
              {postEdit.finding.label}
            </h3>

            {postEdit.hasAnnotations && (
              <div className="mt-3 rounded-lg bg-accent/10 border border-accent/30 p-3">
                <p className="text-sm text-text-primary font-medium">
                  {t("findingsLibrary.editContributeHint")}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {t("findingsLibrary.editContributeDesc")}
                </p>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  const key = postEdit.finding.key;
                  setPostEdit(null);
                  navigate(`/contribute/${key}`);
                }}
              >
                <Upload size={14} className="mr-2" />
                {t("findingsLibrary.contributeImage")}
              </Button>

              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  const key = postEdit.finding.key;
                  setPostEdit(null);
                  navigate(`/contribute/${key}`);
                }}
              >
                <ImagePlus size={14} className="mr-2" />
                {t("findingsLibrary.uploadNew")}
              </Button>
            </div>

            <button
              type="button"
              onClick={() => setPostEdit(null)}
              className="mt-3 w-full text-center text-xs text-text-tertiary hover:text-text-secondary"
            >
              {t("findingsLibrary.closePrompt")}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <p className="mb-4 text-sm text-text-secondary">
          {t("findingsLibrary.subtitle")}
        </p>

        {/* Offline banner */}
        {connection === "offline" && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
            <WifiOff size={18} className="shrink-0 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">
                {t("findingsLibrary.offline")}
              </p>
              <p className="text-xs text-text-secondary">
                {t("findingsLibrary.offlineHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => sync()}
              className="flex items-center gap-1.5 rounded-md bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-tertiary"
            >
              <RefreshCw size={12} />
              {t("findingsLibrary.retry")}
            </button>
          </div>
        )}

        {/* Sync progress */}
        {isDownloading && syncProgress && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3">
            <Download size={18} className="shrink-0 text-accent animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">
                {t("findingsLibrary.syncing", "Sincronizando imágenes...")}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{
                      width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-text-tertiary whitespace-nowrap">
                  {syncProgress.current}/{syncProgress.total}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Checking spinner */}
        {connection === "checking" && !isDownloading && (
          <div className="mb-4 flex items-center gap-2 text-sm text-text-tertiary">
            <Loader2 size={14} className="animate-spin" />
            {t("findingsLibrary.loadingImages")}
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("findingsLibrary.search")}
              className="w-full rounded-lg border border-border-secondary bg-bg-secondary py-2 pl-9 pr-8 text-sm text-text-primary placeholder-text-tertiary outline-none focus:border-accent"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-tertiary hover:text-text-secondary"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-bg-tertiary p-1">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === cat.value
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {cat.label} ({cat.count})
                </button>
              ))}
            </div>

            {/* Re-sync button */}
            {connection === "online" && (
              <button
                type="button"
                onClick={() => sync(true)}
                disabled={isSyncing.current}
                className="flex items-center gap-1.5 rounded-lg bg-bg-tertiary p-1.5 text-text-tertiary transition-colors hover:text-text-secondary"
                title={t("findingsLibrary.resync", "Re-sincronizar imágenes")}
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="mb-3 text-xs text-text-tertiary">
          {t("findingsLibrary.totalFindings", { count: filtered.length })}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Search size={32} className="mb-2 opacity-50" />
            <p className="text-sm">{t("findingsLibrary.noResults")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((finding) => (
              <FindingCard
                key={finding.key}
                finding={finding}
                isOnline={connection === "online"}
                entries={contributors[finding.key]}
                cachedUrls={cachedUrls}
                onImageClick={handleImageClick}
              />
            ))}
          </div>
        )}

        {/* Collaboration footer */}
        <div className="mt-8 flex items-center justify-center gap-2 border-t border-border-secondary pt-6 pb-4">
          <Heart size={14} className="text-accent" />
          <p className="text-xs text-text-tertiary">
            {t("findingsLibrary.collaborate")}
          </p>
          <button
            type="button"
            onClick={() => navigate("/settings?tab=about")}
            className="flex items-center gap-1 text-xs font-medium text-accent-text transition-colors hover:underline"
          >
            <Settings size={12} />
            {t("findingsLibrary.collaborateLink")}
          </button>
        </div>
      </div>
    </div>
  );
}
