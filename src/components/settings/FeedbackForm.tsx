import { useState } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { MessageSquare, Github, ExternalLink } from "lucide-react";
import { getPlatform } from "@/lib/platform";

type FeedbackType = "query" | "bug" | "suggestion";

const TYPES: FeedbackType[] = ["query", "bug", "suggestion"];

const GITHUB_NEW_ISSUE = "https://github.com/TecMedHub/OtoReport/issues/new";
const INSTAGRAM_URL = "https://www.instagram.com/tecmedhub";

interface FeedbackFormProps {
  appVersion: string;
}

/** Sección de consultas, errores y sugerencias. Arma un issue de GitHub prellenado (sin backend). */
export function FeedbackForm({ appVersion }: FeedbackFormProps) {
  const { t } = useTranslation();
  const [type, setType] = useState<FeedbackType>("query");
  const [message, setMessage] = useState("");

  async function buildBody(): Promise<string> {
    let platform = "unknown";
    try {
      platform = await getPlatform();
    } catch {
      // ignore
    }
    return `${message}\n\n---\nOtoReport ${appVersion} · ${platform}`;
  }

  async function submitGithub() {
    if (!message.trim()) return;
    const labelMap: Record<FeedbackType, string> = {
      query: "question",
      bug: "bug",
      suggestion: "enhancement",
    };
    const title = `[${t(`settings.feedback.types.${type}`)}] ${message.trim().split("\n")[0].slice(0, 60)}`;
    const body = await buildBody();
    const url = `${GITHUB_NEW_ISSUE}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent(labelMap[type])}`;
    openUrl(url);
  }

  return (
    <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
      <div className="mb-2 flex items-center gap-2">
        <MessageSquare size={20} className="text-accent" />
        <h3 className="text-base font-semibold text-text-primary">{t("settings.feedback.title")}</h3>
      </div>
      <p className="text-sm leading-relaxed text-text-secondary">{t("settings.feedback.intro")}</p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-tertiary">
            {t("settings.feedback.typeLabel")}
          </label>
          <div className="flex gap-2">
            {TYPES.map((ty) => (
              <button
                key={ty}
                type="button"
                onClick={() => setType(ty)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  type === ty
                    ? "border-accent bg-accent-subtle text-accent-text"
                    : "border-border-secondary bg-bg-tertiary text-text-secondary hover:border-border-primary"
                }`}
              >
                {t(`settings.feedback.types.${ty}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-tertiary">
            {t("settings.feedback.messageLabel")}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder={t("settings.feedback.messagePlaceholder")}
            className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="mt-1 text-xs text-text-tertiary">{t("settings.feedback.diagnosticsNote")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={submitGithub}
            disabled={!message.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-inverted transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            title={!message.trim() ? t("settings.feedback.emptyHint") : undefined}
          >
            <Github size={15} />
            {t("settings.feedback.submitGithub")}
          </button>
          <button
            type="button"
            onClick={() => openUrl(INSTAGRAM_URL)}
            className="inline-flex items-center gap-2 rounded-lg border border-border-secondary px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary"
          >
            <ExternalLink size={15} />
            {t("settings.feedback.submitInstagram")}
          </button>
        </div>
      </div>
    </div>
  );
}
