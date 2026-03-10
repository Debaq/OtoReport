import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatRut, cleanRut, validateRut, calculateAge } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { Patient } from "@/types";

/** DD-MM-YYYY → YYYY-MM-DD */
function displayToIso(display: string): string {
  const parts = display.split("-");
  if (parts.length !== 3 || parts[2].length !== 4) return "";
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

/** YYYY-MM-DD → DD-MM-YYYY */
function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3 || parts[0].length !== 4) return iso;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

/** Auto-formatea mientras se escribe: inserta guiones */
function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

function isValidDate(display: string): boolean {
  const iso = displayToIso(display);
  if (!iso) return false;
  const d = new Date(iso + "T00:00:00");
  return !isNaN(d.getTime()) && d.toISOString().startsWith(iso);
}

interface PatientFormProps {
  patient?: Patient;
  onSave: (patient: Patient) => Promise<void>;
  onCancel: () => void;
}

export function PatientForm({ patient, onSave, onCancel }: PatientFormProps) {
  const { t } = useTranslation();
  const { config } = useWorkspace();
  const idLabel = t(`patients.idLabel.${config?.id_type || "rut_id_dni"}`);

  const schema = z.object({
    name: z.string().min(2, t("patients.form.nameRequired")),
    rut: z.string().min(1, t("patients.form.rutInvalid")),
    birth_date: z.string().min(1, t("patients.form.birthDateRequired")),
    phone: z.string().optional(),
    email: z.string().email(t("patients.form.emailInvalid")).or(z.literal("")).optional(),
    notes: z.string().optional(),
  });

  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: patient?.name ?? "",
      rut: patient?.rut ?? "",
      birth_date: patient?.birth_date ?? "",
      phone: patient?.phone ?? "",
      email: patient?.email ?? "",
      notes: patient?.notes ?? "",
    },
  });

  const rutValue = watch("rut");
  const birthValue = watch("birth_date");
  const birthDisplay = isoToDisplay(birthValue);
  const age = isValidDate(birthDisplay) ? calculateAge(birthValue) : null;

  async function onSubmit(data: FormData) {
    const now = new Date().toISOString();
    const p: Patient = {
      id: patient?.id ?? uuidv4(),
      rut: validateRut(cleanRut(data.rut)) ? formatRut(data.rut) : data.rut.trim(),
      name: data.name,
      birth_date: data.birth_date,
      age: calculateAge(data.birth_date),
      phone: data.phone ?? "",
      email: data.email ?? "",
      notes: data.notes ?? "",
      created_at: patient?.created_at ?? now,
      updated_at: now,
    };
    await onSave(p);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label={t("patients.form.nameLabel")}
        id="name"
        {...register("name")}
        error={errors.name?.message}
      />
      <Input
        label={idLabel}
        id="rut"
        {...register("rut")}
        error={errors.rut?.message}
        value={validateRut(cleanRut(rutValue)) ? formatRut(rutValue) : rutValue}
        onChange={(e) => setValue("rut", e.target.value)}
      />
      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <label htmlFor="birth_date" className="block text-sm font-medium text-text-secondary">
            {t("patients.birthDate")}
          </label>
          {age !== null && age >= 0 && (
            <span className="text-xs text-text-tertiary">({age} {t("patients.ageYears")})</span>
          )}
        </div>
        <input
          id="birth_date"
          placeholder="DD-MM-YYYY"
          value={birthDisplay}
          onChange={(e) => {
            const formatted = formatDateInput(e.target.value);
            const iso = displayToIso(formatted);
            setValue("birth_date", iso || formatted, { shouldValidate: true });
          }}
          className={`w-full rounded-lg border px-3 py-2 text-sm text-text-primary bg-bg-secondary transition-colors placeholder:text-text-tertiary focus:outline-none focus:ring-1 ${
            errors.birth_date
              ? "border-danger focus:border-danger focus:ring-danger"
              : "border-border-primary focus:border-accent focus:ring-accent"
          }`}
        />
        {errors.birth_date && (
          <p className="text-xs text-danger-text">{errors.birth_date.message}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label={t("patients.phone")}
          id="phone"
          {...register("phone")}
        />
        <Input
          label={t("patients.email")}
          id="email"
          type="email"
          {...register("email")}
          error={errors.email?.message}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="notes" className="block text-sm font-medium text-text-secondary">
          {t("patients.notes")}
        </label>
        <textarea
          id="notes"
          {...register("notes")}
          rows={3}
          className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {patient ? t("patients.form.update") : t("patients.form.create")}
        </Button>
      </div>
    </form>
  );
}
