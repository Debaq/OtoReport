import { invoke } from "@tauri-apps/api/core";

/** ¿Existe ya un vault cifrado en el workspace? */
export async function vaultExists(): Promise<boolean> {
  return invoke<boolean>("vault_exists");
}

/** ¿Hay un vault desbloqueado en esta sesión del backend? */
export async function vaultIsUnlocked(): Promise<boolean> {
  return invoke<boolean>("vault_is_unlocked");
}

/** Crea el vault por primera vez y lo deja desbloqueado. */
export async function vaultSetup(password: string): Promise<void> {
  return invoke("vault_setup", { password });
}

/** Desbloquea el vault. Lanza si la contraseña es incorrecta. */
export async function vaultUnlock(password: string): Promise<void> {
  return invoke("vault_unlock", { password });
}

/** Bloquea el vault (borra las claves de memoria del backend). */
export async function vaultLock(): Promise<void> {
  return invoke("vault_lock");
}

/** Cambia la contraseña (re-envuelve la DEK; no re-cifra los datos). */
export async function vaultChangePassword(newPassword: string): Promise<void> {
  return invoke("vault_change_password", { newPassword });
}

export interface MigrationReport {
  patients: number;
  reports: number;
  images: number;
  backup_path: string;
}

/** ¿Hay datos planos viejos (pre-cifrado) sin migrar en el workspace? */
export async function legacyDataExists(): Promise<boolean> {
  return invoke<boolean>("legacy_data_exists");
}

/** Migra el FS plano viejo al vault cifrado. Mueve el FS a backup tras éxito. */
export async function migrateFromFs(): Promise<MigrationReport> {
  return invoke<MigrationReport>("migrate_from_fs");
}
