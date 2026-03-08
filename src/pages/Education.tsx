import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { EarAnatomySvg } from "@/components/education/EarAnatomySvg";
import { TympanumInteractive } from "@/components/education/TympanumInteractive";
import { EustachianTubeDemo } from "@/components/education/EustachianTubeDemo";
import { AnimationPlayer } from "@/components/education/animation/AnimationPlayer";
import { Ear, Circle, ArrowDownUp, Film, Pencil, Trash2, FlaskConical } from "lucide-react";
import { listUserAnimations, loadUserAnimation, deleteUserAnimation } from "@/lib/user-animations";
import type { AnimationDefinition } from "@/types/animation";

type ModuleId = "anatomy" | "tympanum" | "eustachian" | "animations";

const MODULES: { id: ModuleId; labelKey: string; icon: typeof Ear }[] = [
  { id: "anatomy", labelKey: "education.modules.anatomy", icon: Ear },
  { id: "tympanum", labelKey: "education.modules.tympanum", icon: Circle },
  { id: "eustachian", labelKey: "education.modules.eustachian", icon: ArrowDownUp },
  { id: "animations", labelKey: "education.modules.animations", icon: Film },
];

interface LoadedAnimation {
  filename: string;
  animation: AnimationDefinition;
}

export function Education() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<ModuleId>("anatomy");
  const [animations, setAnimations] = useState<LoadedAnimation[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshAnimations = async () => {
    setLoading(true);
    try {
      const files = await listUserAnimations();
      const loaded: LoadedAnimation[] = [];
      for (const filename of files) {
        const anim = await loadUserAnimation(filename);
        if (anim) loaded.push({ filename, animation: anim });
      }
      setAnimations(loaded);
    } catch {
      setAnimations([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (activeModule === "animations") {
      refreshAnimations();
    }
  }, [activeModule]);

  const handleDelete = async (filename: string) => {
    await deleteUserAnimation(filename);
    setAnimations((prev) => prev.filter((a) => a.filename !== filename));
  };

  const handleEdit = (filename: string) => {
    navigate(`/animation-editor?file=${encodeURIComponent(filename)}`);
  };

  return (
    <>
      <Header title={t("education.title")} />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-5xl">
          {/* Beta badge */}
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
              <FlaskConical size={12} />
              Beta
            </span>
            <span className="text-sm text-text-tertiary">{t("education.subtitle")}</span>
          </div>

          {/* Module tabs */}
          <div className="mb-6 flex gap-1 rounded-xl border border-border-secondary bg-bg-secondary p-1">
            {MODULES.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveModule(m.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    activeModule === m.id
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  }`}
                >
                  <Icon size={16} />
                  {t(m.labelKey)}
                </button>
              );
            })}
          </div>

          {/* Module content */}
          <div className="rounded-xl border border-border-secondary bg-bg-secondary p-6">
            <h3 className="mb-1 text-lg font-semibold text-text-primary">
              {t(`education.modules.${activeModule}`)}
            </h3>
            <p className="mb-6 text-sm text-text-tertiary">
              {t(`education.modules.${activeModule}Desc`)}
            </p>

            {activeModule === "anatomy" && <EarAnatomySvg />}
            {activeModule === "tympanum" && <TympanumInteractive />}
            {activeModule === "eustachian" && <EustachianTubeDemo />}
            {activeModule === "animations" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text-secondary">
                    {t("education.modules.animationsDesc")}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/animation-editor")}
                    className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-sm text-accent transition-colors hover:bg-accent/20"
                  >
                    <Pencil size={14} />
                    {t("education.editor.openEditor")}
                  </button>
                </div>

                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  </div>
                ) : animations.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-secondary py-12">
                    <Film size={32} className="text-text-tertiary" />
                    <p className="text-sm text-text-tertiary">
                      {t("education.modules.noAnimations")}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/animation-editor")}
                      className="rounded-lg bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent/80"
                    >
                      {t("education.editor.createFirst")}
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {animations.map(({ filename, animation }) => (
                      <div key={filename} className="group relative">
                        <AnimationPlayer animation={animation} />
                        <div className="mt-1 flex items-center justify-between px-1">
                          <span className="text-xs text-text-tertiary">{filename}</span>
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => handleEdit(filename)}
                              className="rounded p-1 text-text-tertiary hover:bg-bg-tertiary hover:text-accent"
                              title={t("education.editor.openEditor")}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(filename)}
                              className="rounded p-1 text-text-tertiary hover:bg-red-500/10 hover:text-red-400"
                              title={t("common.delete")}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
