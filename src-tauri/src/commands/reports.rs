use crate::commands::audit;
use crate::commands::workspace::FindingsCategoryConfig;
use crate::storage::vault::{Store, VaultError, VaultState};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

fn report_key(patient_id: &str, session_id: &str) -> String {
    format!("{}/{}", patient_id, session_id)
}

/// Reemplaza el segmento de sesión en una key de imagen `pid/sid/side/file`.
fn replace_session_in_image_key(key: &str, new_session_id: &str) -> Option<String> {
    let mut parts: Vec<&str> = key.split('/').collect();
    if parts.len() < 4 {
        return None;
    }
    parts[1] = new_session_id;
    Some(parts.join("/"))
}

fn to_json(value: &impl Serialize) -> Result<Vec<u8>, VaultError> {
    serde_json::to_vec(value).map_err(|e| VaultError::Crypto(e.to_string()))
}

fn from_json<T: serde::de::DeserializeOwned>(bytes: &[u8]) -> Result<T, VaultError> {
    serde_json::from_slice(bytes).map_err(|e| VaultError::Corrupt(e.to_string()))
}

pub type EarFindings = HashMap<String, bool>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuadrantMark {
    pub quadrant: String,
    pub finding: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarMarks {
    pub marks: Vec<QuadrantMark>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct EarImageData {
    pub id: String,
    pub filename: String,
    pub thumbnail: String,
    pub source: String,
    pub selected: bool,
    pub primary: bool,
    pub sort_order: i32,
    pub rotation: i32,
    pub notes: String,
    pub annotations: serde_json::Value,
    pub crop: Option<serde_json::Value>,
    #[serde(rename = "frameShape")]
    pub frame_shape: Option<String>,
    pub background: Option<String>,
    #[serde(rename = "tympanicRef")]
    pub tympanic_ref: Option<serde_json::Value>,
    pub viewport: Option<serde_json::Value>,
    pub adjustments: Option<serde_json::Value>,
}

impl Default for EarImageData {
    fn default() -> Self {
        Self {
            id: String::new(),
            filename: String::new(),
            thumbnail: String::new(),
            source: String::new(),
            selected: true,
            primary: false,
            sort_order: 0,
            rotation: 0,
            notes: String::new(),
            annotations: serde_json::Value::Array(vec![]),
            crop: None,
            frame_shape: None,
            background: None,
            tympanic_ref: None,
            viewport: None,
            adjustments: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarData {
    pub findings: EarFindings,
    pub marks: EarMarks,
    pub images: Vec<EarImageData>,
    pub observations: String,
    #[serde(default)]
    pub pneumatic: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientRef {
    pub id: String,
    pub rut: String,
    pub name: String,
    pub birth_date: String,
    pub age: i32,
    pub phone: String,
    pub email: String,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

fn default_status() -> String {
    "in_progress".to_string()
}

fn default_report_type() -> String {
    "otoscopy".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Report {
    pub id: String,
    pub patient_id: String,
    pub patient: PatientRef,
    pub session_id: String,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default = "default_report_type")]
    pub report_type: String,
    pub examiner: String,
    pub equipment: String,
    pub right_ear: EarData,
    pub left_ear: EarData,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub post_right_ear: Option<EarData>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub post_left_ear: Option<EarData>,
    pub conclusion: String,
    #[serde(default)]
    pub anamnesis: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub findings_categories: Vec<FindingsCategoryConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub patient_id: String,
    pub patient_name: String,
    pub created_at: String,
    pub status: String,
    #[serde(default = "default_report_type")]
    pub report_type: String,
}

/// Crear sesión ya no necesita crear carpetas (el vault no usa FS por sesión).
/// Se mantiene por compatibilidad con el frontend: el reporte se crea al guardar.
#[tauri::command]
pub fn create_session(
    _patient_id: String,
    _session_id: String,
    _report_type: Option<String>,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn save_report(state: State<VaultState>, report: Report) -> Result<(), String> {
    state.with(|v| {
        let bytes = to_json(&report)?;
        v.put(Store::Reports, &report_key(&report.patient_id, &report.session_id), &bytes)
    })
}

#[tauri::command]
pub fn load_report(
    state: State<VaultState>,
    patient_id: String,
    session_id: String,
) -> Result<Report, String> {
    state.with(|v| {
        let bytes = v
            .get(Store::Reports, &report_key(&patient_id, &session_id))?
            .ok_or_else(|| VaultError::Corrupt("reporte no encontrado".into()))?;
        from_json::<Report>(&bytes)
    })
}

fn session_info_from_report(r: &Report) -> SessionInfo {
    SessionInfo {
        id: r.session_id.clone(),
        patient_id: r.patient_id.clone(),
        patient_name: r.patient.name.clone(),
        created_at: r.created_at.clone(),
        status: r.status.clone(),
        report_type: r.report_type.clone(),
    }
}

#[tauri::command]
pub fn list_sessions(state: State<VaultState>) -> Result<Vec<SessionInfo>, String> {
    state.with(|v| {
        let mut sessions = Vec::new();
        for (_, bytes) in v.list(Store::Reports)? {
            if let Ok(r) = from_json::<Report>(&bytes) {
                sessions.push(session_info_from_report(&r));
            }
        }
        sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(sessions)
    })
}

#[tauri::command]
pub fn list_patient_sessions(
    state: State<VaultState>,
    patient_id: String,
) -> Result<Vec<SessionInfo>, String> {
    state.with(|v| {
        let prefix = format!("{}/", patient_id);
        let mut sessions = Vec::new();
        for (_, bytes) in v.list_prefix(Store::Reports, &prefix)? {
            if let Ok(r) = from_json::<Report>(&bytes) {
                sessions.push(session_info_from_report(&r));
            }
        }
        sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(sessions)
    })
}

#[tauri::command]
pub fn delete_session(
    app: tauri::AppHandle,
    state: State<VaultState>,
    patient_id: String,
    session_id: String,
) -> Result<(), String> {
    let result = state.with(|v| {
        let existed = v.delete(Store::Reports, &report_key(&patient_id, &session_id))?;
        // Borrar todas las imágenes de la sesión.
        let prefix = format!("{}/{}/", patient_id, session_id);
        v.delete_prefix(Store::Images, &prefix)?;
        if existed {
            Ok(())
        } else {
            Err(VaultError::Corrupt("sesión no encontrada".into()))
        }
    });
    if result.is_ok() {
        audit::record(&app, &state, "session.delete", &report_key(&patient_id, &session_id));
    }
    result
}

#[tauri::command]
pub fn duplicate_session(
    app: tauri::AppHandle,
    state: State<VaultState>,
    patient_id: String,
    session_id: String,
) -> Result<String, String> {
    let new_id = uuid::Uuid::new_v4().to_string();
    state.with(|v| {
        let bytes = v
            .get(Store::Reports, &report_key(&patient_id, &session_id))?
            .ok_or_else(|| VaultError::Corrupt("sesión no encontrada".into()))?;
        let mut report = from_json::<Report>(&bytes)?;

        report.id = uuid::Uuid::new_v4().to_string();
        report.session_id = new_id.clone();
        report.status = default_status();
        report.created_at = chrono_now();
        report.updated_at = chrono_now();

        // Recalcular edad desde la fecha de nacimiento del paciente actual.
        if let Some(pb) = v.get(Store::Patients, &patient_id)? {
            if let Ok(patient) = from_json::<crate::commands::patients::Patient>(&pb) {
                report.patient.age = calculate_age(&patient.birth_date);
                report.patient.birth_date = patient.birth_date;
            }
        }

        let nb = to_json(&report)?;
        v.put(Store::Reports, &report_key(&patient_id, &new_id), &nb)?;

        // Copiar imágenes de la sesión origen, reasignando el id de sesión.
        let src_prefix = format!("{}/{}/", patient_id, session_id);
        for (key, img_bytes) in v.list_prefix(Store::Images, &src_prefix)? {
            if let Some(nk) = replace_session_in_image_key(&key, &new_id) {
                v.put(Store::Images, &nk, &img_bytes)?;
            }
        }
        Ok(())
    })?;
    audit::record(&app, &state, "session.duplicate", &report_key(&patient_id, &new_id));
    Ok(new_id)
}

#[tauri::command]
pub fn import_session_ears(
    state: State<VaultState>,
    source_patient_id: String,
    source_session_id: String,
    target_patient_id: String,
    target_session_id: String,
    target_right_dir: String,
    target_left_dir: String,
) -> Result<(), String> {
    state.with(|v| {
        let src_prefix = format!("{}/{}/", source_patient_id, source_session_id);
        let imgs = v.list_prefix(Store::Images, &src_prefix)?;
        if imgs.is_empty() {
            return Err(VaultError::Corrupt("sesión origen sin imágenes".into()));
        }

        // Limpiar destinos antes de copiar.
        let dest_right_prefix =
            format!("{}/{}/{}/", target_patient_id, target_session_id, target_right_dir);
        let dest_left_prefix =
            format!("{}/{}/{}/", target_patient_id, target_session_id, target_left_dir);
        v.delete_prefix(Store::Images, &dest_right_prefix)?;
        v.delete_prefix(Store::Images, &dest_left_prefix)?;

        for (key, img_bytes) in imgs {
            // key = spid/ssid/side/filename
            let parts: Vec<&str> = key.split('/').collect();
            if parts.len() < 4 {
                continue;
            }
            let side = parts[2];
            let filename = parts[3..].join("/");
            let is_right = side == "right" || side == "pre_right" || side == "post_right";
            let is_left = side == "left" || side == "pre_left" || side == "post_left";
            let target_dir = if is_right {
                &target_right_dir
            } else if is_left {
                &target_left_dir
            } else {
                continue;
            };
            let nk = format!(
                "{}/{}/{}/{}",
                target_patient_id, target_session_id, target_dir, filename
            );
            v.put(Store::Images, &nk, &img_bytes)?;
        }
        Ok(())
    })
}

fn calculate_age(birth_date: &str) -> i32 {
    // Parse YYYY-MM-DD
    let parts: Vec<&str> = birth_date.split('-').collect();
    if parts.len() != 3 {
        return 0;
    }
    let (by, bm, bd) = match (
        parts[0].parse::<i32>(),
        parts[1].parse::<u32>(),
        parts[2].parse::<u32>(),
    ) {
        (Ok(y), Ok(m), Ok(d)) => (y, m, d),
        _ => return 0,
    };

    // Obtener fecha actual usando el timestamp del sistema
    // Usamos una fórmula civil para convertir días desde epoch a fecha
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let days = (secs / 86400) as i32;
    // Algoritmo de conversión de días julianos a fecha civil
    // Basado en: http://howardhinnant.github.io/date_algorithms.html
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i32 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };

    let mut age = year - by;
    if m < bm || (m == bm && d < bd) {
        age -= 1;
    }
    age
}

fn chrono_now() -> String {
    // ISO 8601 UTC timestamp (formato compatible con `new Date()` en JS).
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    unix_secs_to_iso(secs)
}

fn unix_secs_to_iso(secs: i64) -> String {
    let days = secs.div_euclid(86_400);
    let tod = secs.rem_euclid(86_400);
    let hour = tod / 3600;
    let minute = (tod % 3600) / 60;
    let second = tod % 60;
    let (year, month, day) = civil_from_days(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, minute, second
    )
}

// Howard Hinnant's date algorithm: días desde 1970-01-01 → (año, mes, día) calendario civil.
fn civil_from_days(days_since_epoch: i64) -> (i32, u32, u32) {
    let z = days_since_epoch + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as i64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let year = if m <= 2 { y + 1 } else { y };
    (year as i32, m, d)
}
