import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { ANAMNESIS_GROUPS, normalizeAnamnesis, hasAnamnesisContent } from "@/types/anamnesis";
import type { Anamnesis } from "@/types/anamnesis";

interface AnamnesisSectionProps {
  anamnesis?: Anamnesis | null;
  onChange: (updater: (prev: Anamnesis) => Anamnesis) => void;
  readOnly?: boolean;
}

export function AnamnesisSection({ anamnesis, onChange, readOnly }: AnamnesisSectionProps) {
  const { t } = useTranslation();
  const data = normalizeAnamnesis(anamnesis);
  const [open, setOpen] = useState(hasAnamnesisContent(anamnesis));

  function toggleOption(groupId: keyof Anamnesis, key: string, checked: boolean) {
    onChange((prev) => {
      const base = normalizeAnamnesis(prev);
      const group = { ...(base[groupId] as Record<string, boolean>), [key]: checked };
      return { ...base, [groupId]: group };
    });
  }

  function setOther(field: keyof Anamnesis, value: string) {
    onChange((prev) => ({ ...normalizeAnamnesis(prev), [field]: value }));
  }

  return (
    <div className="rounded-xl border border-border-secondary bg-bg-secondary">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <ClipboardList size={16} className="text-text-tertiary" />
        <span className="text-sm font-medium text-text-secondary">
          {t("report.anamnesis.title")}
        </span>
        <span className="ml-auto text-text-tertiary">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-5 border-t border-border-secondary p-4 md:grid-cols-2">
          {ANAMNESIS_GROUPS.map((group) => {
            const record = (data[group.id] as Record<string, boolean>) ?? {};
            return (
              <div key={group.id}>
                <h4 className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
                  {t(`report.anamnesis.${group.id}.title`)}
                </h4>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {group.options.map((key) => (
                    <Checkbox
                      key={key}
                      id={`anamnesis-${group.id}-${key}`}
                      label={t(`report.anamnesis.${group.id}.${key}`)}
                      checked={record[key] ?? false}
                      disabled={readOnly}
                      onChange={(e) => toggleOption(group.id, key, e.target.checked)}
                    />
                  ))}
                </div>
                <input
                  value={(data[group.other] as string) ?? ""}
                  onChange={(e) => setOther(group.other, e.target.value)}
                  disabled={readOnly}
                  placeholder={t("report.anamnesis.otherPlaceholder")}
                  className="mt-2 w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-bg-tertiary disabled:text-text-tertiary"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
