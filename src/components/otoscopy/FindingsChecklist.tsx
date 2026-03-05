import { Checkbox } from "@/components/ui/Checkbox";
import type { EarFindings, FindingsCategoryConfig } from "@/types";
import { getDefaultFindingsCategories, translateFindingsCategories } from "@/types";

interface FindingsChecklistProps {
  findings: EarFindings;
  onChange: (findings: EarFindings) => void;
  categoriesConfig?: FindingsCategoryConfig[];
}

export function FindingsChecklist({ findings, onChange, categoriesConfig }: FindingsChecklistProps) {
  const categories = translateFindingsCategories(
    categoriesConfig && categoriesConfig.length > 0
      ? categoriesConfig
      : getDefaultFindingsCategories()
  );

  const membraneCategory = categories.find((c) => c.id === "membrane");
  const caeCategory = categories.find((c) => c.id === "cae");

  const membraneKeys = new Set(
    membraneCategory?.checks.map((c) => c.key) ?? []
  );
  const caeKeys = new Set(
    caeCategory?.checks.map((c) => c.key) ?? []
  );

  function handleChange(key: string, checked: boolean) {
    const updated = { ...findings, [key]: checked };

    // Si marcan "normal" de membrana, desmarcan los demás de membrana
    if (key === "normal" && checked && membraneCategory) {
      for (const f of membraneCategory.checks) {
        if (f.key !== "normal") updated[f.key] = false;
      }
    }
    // Si marcan otro hallazgo de membrana, desmarcan "normal"
    if (key !== "normal" && membraneKeys.has(key) && checked) {
      updated.normal = false;
    }

    // Lo mismo para CAE
    if (key === "cae_normal" && checked && caeCategory) {
      for (const f of caeCategory.checks) {
        if (f.key !== "cae_normal") updated[f.key] = false;
      }
    }
    if (caeKeys.has(key) && key !== "cae_normal" && checked) {
      updated.cae_normal = false;
    }

    onChange(updated);
  }

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const checks = category.checks;
        if (checks.length === 0) return null;
        return (
          <div key={category.id}>
            <h4 className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
              {category.name}
            </h4>
            <div className="grid grid-cols-2 gap-1">
              {checks.map(({ key, label, description }) => (
                <div key={key} title={description || undefined}>
                  <Checkbox
                    id={key}
                    label={label}
                    checked={findings[key] ?? false}
                    onChange={(e) => handleChange(key, e.target.checked)}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
