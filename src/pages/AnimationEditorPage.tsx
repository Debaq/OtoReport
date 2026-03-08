import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { useTranslation } from "react-i18next";
import { AnimationEditor } from "@/components/education/editor/AnimationEditor";
import { loadUserAnimation } from "@/lib/user-animations";
import type { AnimationDefinition } from "@/types/animation";

export function AnimationEditorPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const file = searchParams.get("file");
  const [initial, setInitial] = useState<AnimationDefinition | undefined>();
  const [loading, setLoading] = useState(!!file);

  useEffect(() => {
    if (!file) return;
    loadUserAnimation(file).then((anim) => {
      if (anim) setInitial(anim);
      setLoading(false);
    });
  }, [file]);

  if (loading) {
    return (
      <>
        <Header title={t("education.editor.title")} />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={t("education.editor.title")} />
      <div className="flex-1 overflow-hidden p-2">
        <AnimationEditor
          key={file ?? "new"}
          initial={initial}
          filename={file ?? undefined}
        />
      </div>
    </>
  );
}
