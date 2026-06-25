// Comandos de autenticación / desbloqueo del vault cifrado.
//
// El frontend nunca ve la clave: solo manda la contraseña, el backend deriva,
// desenvuelve la DEK y la mantiene viva en `VaultState` durante la sesión.

use crate::commands::audit;
use crate::commands::workspace;
use crate::storage::vault::{Vault, VaultState};
use std::path::PathBuf;
use tauri::State;

const VAULT_FILENAME: &str = "oto.vault";

fn vault_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(workspace::get_workspace_path(app)?.join(VAULT_FILENAME))
}

/// ¿Ya existe un vault en el workspace? (decide setup vs unlock en el frontend).
#[tauri::command]
pub fn vault_exists(app: tauri::AppHandle) -> Result<bool, String> {
    Ok(vault_path(&app)?.exists())
}

/// ¿Hay un vault desbloqueado en esta sesión?
#[tauri::command]
pub fn vault_is_unlocked(state: State<VaultState>) -> bool {
    state.is_unlocked()
}

/// Crea el vault por primera vez con la contraseña dada y lo deja desbloqueado.
#[tauri::command]
pub fn vault_setup(
    app: tauri::AppHandle,
    password: String,
    state: State<VaultState>,
) -> Result<(), String> {
    let path = vault_path(&app)?;
    if path.exists() {
        return Err("El vault ya existe".to_string());
    }
    let vault = Vault::setup(&path, password.as_bytes()).map_err(|e| e.to_string())?;
    *state.0.lock().map_err(|_| "estado envenenado".to_string())? = Some(vault);
    audit::record(&app, &state, "vault.setup", "");
    Ok(())
}

/// Desbloquea el vault verificando la contraseña.
#[tauri::command]
pub fn vault_unlock(
    app: tauri::AppHandle,
    password: String,
    state: State<VaultState>,
) -> Result<(), String> {
    let path = vault_path(&app)?;
    let vault = Vault::unlock(&path, password.as_bytes()).map_err(|e| e.to_string())?;
    *state.0.lock().map_err(|_| "estado envenenado".to_string())? = Some(vault);
    audit::record(&app, &state, "vault.unlock", "");
    Ok(())
}

/// Bloquea el vault: descarta las claves de memoria (zeroize).
#[tauri::command]
pub fn vault_lock(app: tauri::AppHandle, state: State<VaultState>) -> Result<(), String> {
    audit::record(&app, &state, "vault.lock", "");
    state.lock_vault();
    Ok(())
}

/// Cambia la contraseña (re-envuelve la DEK; no re-cifra los datos).
#[tauri::command]
pub fn vault_change_password(
    app: tauri::AppHandle,
    new_password: String,
    state: State<VaultState>,
) -> Result<(), String> {
    {
        let guard = state.0.lock().map_err(|_| "estado envenenado".to_string())?;
        let vault = guard.as_ref().ok_or("vault bloqueado")?;
        vault
            .change_password(new_password.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    audit::record(&app, &state, "vault.change_password", "");
    Ok(())
}
