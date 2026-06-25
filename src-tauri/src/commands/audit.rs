// Registro de auditoría (trazabilidad ley 21.719): quién, qué, cuándo.
// Entradas cifradas dentro del vault. Best-effort: nunca bloquean la operación.

use crate::commands::workspace;
use crate::storage::vault::VaultState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    /// Timestamp ISO 8601 UTC.
    pub ts: String,
    /// Perfil activo (examinador) que realizó la acción.
    pub actor: String,
    /// Acción, p. ej. "patient.create", "session.delete", "vault.unlock".
    pub action: String,
    /// Objetivo (id de paciente/sesión) o vacío.
    pub target: String,
}

/// Registra una acción. Best-effort: si falla, no interrumpe la operación.
/// IMPORTANTE: llamar FUERA de un `state.with(...)` — el Mutex no es reentrante.
pub fn record(app: &tauri::AppHandle, state: &VaultState, action: &str, target: &str) {
    let actor = workspace::get_active_profile_id(app.clone()).unwrap_or_default();
    let entry = AuditEntry {
        ts: now_iso(),
        actor,
        action: action.to_string(),
        target: target.to_string(),
    };
    if let Ok(bytes) = serde_json::to_vec(&entry) {
        let _ = state.with(|v| v.append_audit(&bytes));
    }
}

#[tauri::command]
pub fn get_audit_log(state: State<VaultState>) -> Result<Vec<AuditEntry>, String> {
    state.with(|v| {
        let mut entries = Vec::new();
        for bytes in v.list_audit()? {
            if let Ok(e) = serde_json::from_slice::<AuditEntry>(&bytes) {
                entries.push(e);
            }
        }
        Ok(entries)
    })
}

// --- Fecha ISO 8601 UTC (sin dependencias externas) ---

fn now_iso() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let days = secs.div_euclid(86_400);
    let tod = secs.rem_euclid(86_400);
    let (y, m, d) = civil_from_days(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y,
        m,
        d,
        tod / 3600,
        (tod % 3600) / 60,
        tod % 60
    )
}

// Howard Hinnant: días desde epoch → (año, mes, día) civil.
fn civil_from_days(days_since_epoch: i64) -> (i32, u32, u32) {
    let z = days_since_epoch + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let year = if m <= 2 { y + 1 } else { y };
    (year as i32, m, d)
}
