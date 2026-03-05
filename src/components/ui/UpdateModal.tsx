import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Download, Tag } from "lucide-react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { APP_VERSION } from "@/hooks/useUpdateChecker";

interface UpdateModalProps {
  open: boolean;
  onClose: () => void;
  latestVersion: string;
  releaseNotes: string | null;
  releaseUrl: string;
}

function renderMarkdownSimple(text: string) {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <br key={i} />;
    if (trimmed.startsWith("### "))
      return (
        <h4 key={i} className="mt-3 mb-1 text-sm font-semibold text-text-primary">
          {trimmed.slice(4)}
        </h4>
      );
    if (trimmed.startsWith("## "))
      return (
        <h3 key={i} className="mt-4 mb-1 font-semibold text-text-primary">
          {trimmed.slice(3)}
        </h3>
      );
    if (trimmed.startsWith("- ") || trimmed.startsWith("* "))
      return (
        <li key={i} className="ml-4 list-disc text-sm text-text-secondary">
          {trimmed.slice(2)}
        </li>
      );
    return (
      <p key={i} className="text-sm text-text-secondary">
        {trimmed}
      </p>
    );
  });
}

export function UpdateModal({
  open,
  onClose,
  latestVersion,
  releaseNotes,
  releaseUrl,
}: UpdateModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} title={t("update.available")}>
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-xs text-text-tertiary">{t("update.currentVersion")}</p>
            <div className="flex items-center gap-1">
              <Tag size={14} className="text-text-tertiary" />
              <span className="font-mono text-sm text-text-secondary">{APP_VERSION}</span>
            </div>
          </div>
          <span className="text-xl text-text-tertiary">&rarr;</span>
          <div className="text-center">
            <p className="text-xs text-text-tertiary">{t("update.newVersion")}</p>
            <div className="flex items-center gap-1">
              <Tag size={14} className="text-accent" />
              <span className="font-mono text-sm font-semibold text-accent">
                {latestVersion}
              </span>
            </div>
          </div>
        </div>

        {releaseNotes && (
          <div className="max-h-60 overflow-y-auto rounded-lg border border-border-secondary bg-bg-primary p-3">
            <p className="mb-2 text-xs font-medium text-text-tertiary">
              {t("update.releaseNotes")}
            </p>
            <div>{renderMarkdownSimple(releaseNotes)}</div>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            {t("update.dismiss")}
          </Button>
          <Button
            className="flex-1"
            onClick={() => openUrl(releaseUrl)}
          >
            <Download size={16} />
            {t("update.download")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
