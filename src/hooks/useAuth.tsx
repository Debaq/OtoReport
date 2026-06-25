import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  legacyDataExists,
  migrateFromFs,
  vaultExists,
  vaultIsUnlocked,
  vaultLock,
  vaultSetup,
  vaultUnlock,
} from "@/lib/auth";

type AuthStatus =
  | "loading"
  | "needs-setup"
  | "locked"
  | "migrating"
  | "unlocked";

interface AuthContextValue {
  status: AuthStatus;
  error: string | null;
  setup: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Inactividad antes de bloquear automáticamente (10 min). */
const IDLE_MS = 10 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const { workspacePath } = useWorkspace();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  // Tras desbloquear: migrar datos planos viejos al vault (una vez), luego abrir.
  const postUnlock = useCallback(async (isCancelled: () => boolean = () => false) => {
    try {
      if (await legacyDataExists()) {
        if (!isCancelled()) setStatus("migrating");
        await migrateFromFs();
      }
    } catch (e) {
      // Si la migración falla, el FS viejo queda intacto; la app abre igual.
      console.error("Migración fallida:", e);
    }
    if (!isCancelled()) setStatus("unlocked");
  }, []);

  // Decide setup/locked/unlocked cuando el workspace ya está disponible.
  useEffect(() => {
    let cancelled = false;
    if (!workspacePath) {
      setStatus("loading");
      return;
    }
    (async () => {
      try {
        // El backend pudo quedar desbloqueado (recarga de dev / HMR).
        if (await vaultIsUnlocked()) {
          await postUnlock(() => cancelled);
          return;
        }
        const exists = await vaultExists();
        if (!cancelled) setStatus(exists ? "locked" : "needs-setup");
      } catch {
        if (!cancelled) setStatus("needs-setup");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspacePath, postUnlock]);

  const setup = useCallback(
    async (password: string) => {
      setError(null);
      try {
        await vaultSetup(password);
        await postUnlock();
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [postUnlock]
  );

  const unlock = useCallback(
    async (password: string) => {
      setError(null);
      try {
        await vaultUnlock(password);
        await postUnlock();
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [postUnlock]
  );

  const lock = useCallback(async () => {
    await vaultLock();
    setStatus("locked");
  }, []);

  // Auto-bloqueo solo por inactividad (todas las plataformas).
  // NOTA: NO se bloquea al ir a background. En Android, abrir el selector de
  // galería/cámara/visor de PDF manda la app a background; bloquear ahí cerraba
  // el vault en mitad del flujo (la imagen no se guardaba, fallaba el PDF).
  useEffect(() => {
    if (status !== "unlocked") return;
    let timer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void lock(), IDLE_MS);
    };
    const activity = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    activity.forEach((e) =>
      window.addEventListener(e, resetIdle, { passive: true })
    );
    resetIdle();

    return () => {
      clearTimeout(timer);
      activity.forEach((e) => window.removeEventListener(e, resetIdle));
    };
  }, [status, lock]);

  return (
    <AuthContext.Provider value={{ status, error, setup, unlock, lock }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
