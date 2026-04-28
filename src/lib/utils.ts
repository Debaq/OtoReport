import i18n from "@/i18n/config";

export function cn(
  ...classes: (string | boolean | undefined | null)[]
): string {
  return classes.filter(Boolean).join(" ");
}

export function cleanRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase();
}

export function formatRut(rut: string): string {
  const clean = cleanRut(rut);
  if (clean.length < 2) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted}-${dv}`;
}

/**
 * Formatea un input de RUT mientras el usuario escribe.
 * Solo formatea si el contenido es plausible como RUT chileno
 * (solo dígitos, opcionalmente terminando en K). Si el usuario
 * está ingresando otro tipo de identificador (DNI con letras, etc.),
 * devuelve el valor tal cual.
 */
export function formatRutInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  // Si tiene caracteres distintos a dígitos, K, puntos, guion o espacio,
  // probablemente no es RUT chileno. Dejar tal cual.
  if (!/^[0-9kK.\-\s]+$/.test(trimmed)) return value;
  const clean = cleanRut(trimmed);
  if (clean.length < 2) return clean;
  // K solo puede ir en el dígito verificador (último carácter).
  if (/k/i.test(clean.slice(0, -1))) return value;
  return formatRut(clean);
}

export function validateRut(rut: string): boolean {
  const clean = cleanRut(rut);
  if (clean.length < 2) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  let expected: string;
  if (remainder === 11) expected = "0";
  else if (remainder === 10) expected = "K";
  else expected = remainder.toString();

  return dv === expected;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const locale = i18n.language.startsWith("es") ? "es-CL" : "en-US";
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}
