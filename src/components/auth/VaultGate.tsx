import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, ShieldCheck, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const MIN_LEN = 8;

/** Crear contraseña por primera vez (no hay vault todavía). */
function VaultSetupScreen() {
  const { t } = useTranslation();
  const { setup } = useAuth();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tooShort = pw.length > 0 && pw.length < MIN_LEN;
  const mismatch = confirm.length > 0 && pw !== confirm;
  const valid = pw.length >= MIN_LEN && pw === confirm;

  async function handleSubmit() {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await setup(pw);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md rounded-xl bg-bg-secondary p-8 shadow-lg">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
            <ShieldCheck className="text-accent" size={28} />
          </div>
        </div>
        <h1 className="mb-2 text-center text-2xl font-bold text-text-primary">
          {t("vault.setupTitle", "Proteger datos clínicos")}
        </h1>
        <p className="mb-6 text-center text-sm text-text-tertiary">
          {t(
            "vault.setupSubtitle",
            "Crea una contraseña para cifrar los datos de pacientes en este equipo."
          )}
        </p>

        <div className="space-y-3">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={t("vault.passwordPlaceholder", "Contraseña")}
              autoFocus
              className="w-full rounded-lg border border-border-secondary bg-bg-primary px-4 py-3 pr-11 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={t("vault.confirmPlaceholder", "Repetir contraseña")}
            className="w-full rounded-lg border border-border-secondary bg-bg-primary px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
          />

          {tooShort && (
            <p className="text-xs text-amber-500">
              {t("vault.tooShort", `Mínimo ${MIN_LEN} caracteres.`)}
            </p>
          )}
          {mismatch && (
            <p className="text-xs text-red-500">
              {t("vault.mismatch", "Las contraseñas no coinciden.")}
            </p>
          )}
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-500" size={16} />
          <p className="text-xs text-text-tertiary">
            {t(
              "vault.noRecovery",
              "Si olvidas esta contraseña no hay forma de recuperar los datos. Guárdala en un lugar seguro."
            )}
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!valid || busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 font-medium text-text-inverted transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          <ShieldCheck size={20} />
          {t("vault.createAction", "Crear contraseña")}
        </button>
      </div>
    </div>
  );
}

/** Desbloquear un vault existente. */
function VaultUnlockScreen() {
  const { t } = useTranslation();
  const { unlock, error } = useAuth();
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!pw || busy) return;
    setBusy(true);
    try {
      await unlock(pw);
    } catch {
      // error lo expone el contexto
      setPw("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md rounded-xl bg-bg-secondary p-8 shadow-lg">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
            <Lock className="text-accent" size={28} />
          </div>
        </div>
        <h1 className="mb-2 text-center text-2xl font-bold text-text-primary">
          {t("vault.unlockTitle", "Desbloquear OtoReport")}
        </h1>
        <p className="mb-6 text-center text-sm text-text-tertiary">
          {t("vault.unlockSubtitle", "Ingresa tu contraseña para acceder a los datos.")}
        </p>

        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={t("vault.passwordPlaceholder", "Contraseña")}
            autoFocus
            className="w-full rounded-lg border border-border-secondary bg-bg-primary px-4 py-3 pr-11 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!pw || busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 font-medium text-text-inverted transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          <Lock size={20} />
          {t("vault.unlockAction", "Desbloquear")}
        </button>
      </div>
    </div>
  );
}

/** Migrando datos viejos al vault cifrado (una sola vez). */
function MigratingScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg-primary">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      <p className="text-text-primary">
        {t("vault.migrating", "Cifrando tus datos…")}
      </p>
      <p className="max-w-xs text-center text-xs text-text-tertiary">
        {t(
          "vault.migratingHint",
          "Esto ocurre solo una vez. No cierres la aplicación."
        )}
      </p>
    </div>
  );
}

/**
 * Gate de cifrado. Muestra setup/unlock según el estado; renderiza `children`
 * solo cuando el vault está desbloqueado.
 */
export function VaultGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }
  if (status === "needs-setup") return <VaultSetupScreen />;
  if (status === "locked") return <VaultUnlockScreen />;
  if (status === "migrating") return <MigratingScreen />;
  return <>{children}</>;
}
