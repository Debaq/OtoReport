import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, ArrowRight } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SpriteAvatar, AvatarPicker } from "@/components/ui/SpriteAvatar";
import { PROFILE_COLORS } from "@/types/report";

export function WorkspaceSetup() {
  const { t } = useTranslation();
  const { selectWorkspace } = useWorkspace();
  const [step, setStep] = useState<"folder" | "name" | "avatar">("folder");
  const [userName, setUserName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<number | undefined>();

  async function handleSelectFolder() {
    setStep("name");
  }

  function handleNameContinue() {
    if (!userName.trim()) return;
    setStep("avatar");
  }

  async function handleFinish() {
    await selectWorkspace(userName.trim(), selectedAvatar);
  }

  if (step === "avatar") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-bg-primary">
        <div className="w-full max-w-md rounded-xl bg-bg-secondary p-8 shadow-lg max-h-[90vh] overflow-y-auto">
          <h1 className="mb-2 text-center text-3xl font-bold text-text-primary">
            OtoReport
          </h1>
          <p className="mb-4 text-center text-text-tertiary">
            {t("profileSelector.chooseAvatar")}
          </p>

          <div className="mb-4 flex justify-center">
            <SpriteAvatar
              avatar={selectedAvatar}
              name={userName.trim() || "?"}
              color={PROFILE_COLORS[0]}
              size={80}
            />
          </div>

          <div className="mb-4">
            <AvatarPicker selected={selectedAvatar} onSelect={setSelectedAvatar} />
          </div>

          <button
            onClick={handleFinish}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 font-medium text-text-inverted transition-colors hover:bg-accent-hover"
          >
            <FolderOpen size={20} />
            {t("setup.selectFolderAction")}
          </button>
        </div>
      </div>
    );
  }

  if (step === "name") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-bg-primary">
        <div className="w-full max-w-md rounded-xl bg-bg-secondary p-8 shadow-lg">
          <h1 className="mb-2 text-center text-3xl font-bold text-text-primary">
            OtoReport
          </h1>
          <p className="mb-6 text-center text-text-tertiary">
            {t("setup.whatIsYourName")}
          </p>
          <div className="mb-2">
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNameContinue()}
              placeholder={t("setup.namePlaceholder")}
              autoFocus
              className="w-full rounded-lg border border-border-secondary bg-bg-primary px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
            <p className="mt-2 text-xs text-text-tertiary">
              {t("setup.nameHelp")}
            </p>
          </div>
          <button
            onClick={handleNameContinue}
            disabled={!userName.trim()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 font-medium text-text-inverted transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            <ArrowRight size={20} />
            {t("setup.continue", "Continuar")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md rounded-xl bg-bg-secondary p-8 shadow-lg">
        <h1 className="mb-2 text-center text-3xl font-bold text-text-primary">
          OtoReport
        </h1>
        <p className="mb-8 text-center text-text-tertiary">
          {t("setup.selectFolder")}
        </p>
        <button
          onClick={handleSelectFolder}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 font-medium text-text-inverted transition-colors hover:bg-accent-hover"
        >
          <FolderOpen size={20} />
          {t("setup.start")}
        </button>
      </div>
    </div>
  );
}
