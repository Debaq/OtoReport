use crate::commands::workspace::{self, FindingsCategoryConfig};
use crate::storage::{file_manager, json_store};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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

fn session_path(
    app: &tauri::AppHandle,
    patient_id: &str,
    session_id: &str,
) -> Result<std::path::PathBuf, String> {
    let ws = workspace::get_workspace_path(app)?;
    let path = ws
        .join("patients")
        .join(patient_id)
        .join("sessions")
        .join(session_id);
    Ok(path)
}

#[tauri::command]
pub fn create_session(
    app: tauri::AppHandle,
    patient_id: String,
    session_id: String,
    report_type: Option<String>,
) -> Result<(), String> {
    let path = session_path(&app, &patient_id, &session_id)?;
    file_manager::ensure_dir(&path)?;

    let rt = report_type.unwrap_or_else(|| "otoscopy".to_string());
    if rt == "ear_wash" {
        file_manager::ensure_dir(&path.join("pre_right"))?;
        file_manager::ensure_dir(&path.join("pre_left"))?;
        file_manager::ensure_dir(&path.join("post_right"))?;
        file_manager::ensure_dir(&path.join("post_left"))?;
    } else {
        file_manager::ensure_dir(&path.join("right"))?;
        file_manager::ensure_dir(&path.join("left"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn save_report(app: tauri::AppHandle, report: Report) -> Result<(), String> {
    let path = session_path(&app, &report.patient_id, &report.session_id)?;
    file_manager::ensure_dir(&path)?;
    json_store::write_json(&path.join("report.json"), &report)
}

#[tauri::command]
pub fn load_report(
    app: tauri::AppHandle,
    patient_id: String,
    session_id: String,
) -> Result<Report, String> {
    let path = session_path(&app, &patient_id, &session_id)?;
    json_store::read_json(&path.join("report.json"))
}

#[tauri::command]
pub fn list_sessions(app: tauri::AppHandle) -> Result<Vec<SessionInfo>, String> {
    let ws = workspace::get_workspace_path(&app)?;
    let patients_dir = ws.join("patients");
    if !patients_dir.exists() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();
    let patient_ids = file_manager::list_dirs(&patients_dir)?;

    for pid in patient_ids {
        let patient_path = patients_dir.join(&pid).join("patient.json");
        let patient_name = if patient_path.exists() {
            json_store::read_json::<crate::commands::patients::Patient>(&patient_path)
                .map(|p| p.name)
                .unwrap_or_else(|_| "Desconocido".to_string())
        } else {
            continue;
        };

        let sessions_dir = patients_dir.join(&pid).join("sessions");
        if !sessions_dir.exists() {
            continue;
        }

        let session_ids = file_manager::list_dirs(&sessions_dir)?;
        for sid in session_ids {
            let report_path = sessions_dir.join(&sid).join("report.json");
            let (created_at, status, report_type) = if report_path.exists() {
                json_store::read_json::<Report>(&report_path)
                    .map(|r| (r.created_at, r.status, r.report_type))
                    .unwrap_or_else(|_| (sid.clone(), default_status(), default_report_type()))
            } else {
                (sid.clone(), default_status(), default_report_type())
            };

            sessions.push(SessionInfo {
                id: sid,
                patient_id: pid.clone(),
                patient_name: patient_name.clone(),
                created_at,
                status,
                report_type,
            });
        }
    }

    sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(sessions)
}

#[tauri::command]
pub fn list_patient_sessions(
    app: tauri::AppHandle,
    patient_id: String,
) -> Result<Vec<SessionInfo>, String> {
    let ws = workspace::get_workspace_path(&app)?;
    let patient_path = ws.join("patients").join(&patient_id);

    let patient_name = {
        let p_path = patient_path.join("patient.json");
        if p_path.exists() {
            json_store::read_json::<crate::commands::patients::Patient>(&p_path)
                .map(|p| p.name)
                .unwrap_or_else(|_| "Desconocido".to_string())
        } else {
            "Desconocido".to_string()
        }
    };

    let sessions_dir = patient_path.join("sessions");
    if !sessions_dir.exists() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();
    let session_ids = file_manager::list_dirs(&sessions_dir)?;

    for sid in session_ids {
        let report_path = sessions_dir.join(&sid).join("report.json");
        let (created_at, status, report_type) = if report_path.exists() {
            json_store::read_json::<Report>(&report_path)
                .map(|r| (r.created_at, r.status, r.report_type))
                .unwrap_or_else(|_| (sid.clone(), default_status(), default_report_type()))
        } else {
            (sid.clone(), default_status(), default_report_type())
        };

        sessions.push(SessionInfo {
            id: sid,
            patient_id: patient_id.clone(),
            patient_name: patient_name.clone(),
            created_at,
            status,
            report_type,
        });
    }

    sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(sessions)
}

#[tauri::command]
pub fn delete_session(
    app: tauri::AppHandle,
    patient_id: String,
    session_id: String,
) -> Result<(), String> {
    let path = session_path(&app, &patient_id, &session_id)?;
    if path.exists() {
        file_manager::remove_dir_all(&path)
    } else {
        Err("Sesión no encontrada".to_string())
    }
}

#[tauri::command]
pub fn duplicate_session(
    app: tauri::AppHandle,
    patient_id: String,
    session_id: String,
) -> Result<String, String> {
    let src = session_path(&app, &patient_id, &session_id)?;
    if !src.exists() {
        return Err("Sesión no encontrada".to_string());
    }

    let new_id = uuid::Uuid::new_v4().to_string();
    let dest = session_path(&app, &patient_id, &new_id)?;
    copy_dir_recursive(&src, &dest)?;

    // Update IDs inside the duplicated report.json
    let report_path = dest.join("report.json");
    if report_path.exists() {
        if let Ok(mut report) = json_store::read_json::<Report>(&report_path) {
            report.id = uuid::Uuid::new_v4().to_string();
            report.session_id = new_id.clone();
            report.status = default_status();
            report.created_at = chrono_now();
            report.updated_at = chrono_now();
            // Recalcular edad desde fecha de nacimiento del paciente actual
            if let Ok(patient) = json_store::read_json::<crate::commands::patients::Patient>(
                &src.parent().unwrap().parent().unwrap().join("patient.json"),
            ) {
                report.patient.age = calculate_age(&patient.birth_date);
                report.patient.birth_date = patient.birth_date;
            }
            let _ = json_store::write_json(&report_path, &report);
        }
    }

    Ok(new_id)
}

#[tauri::command]
pub fn import_session_ears(
    app: tauri::AppHandle,
    source_patient_id: String,
    source_session_id: String,
    target_patient_id: String,
    target_session_id: String,
    target_right_dir: String,
    target_left_dir: String,
) -> Result<(), String> {
    let src = session_path(&app, &source_patient_id, &source_session_id)?;
    let dest = session_path(&app, &target_patient_id, &target_session_id)?;

    // Determine source directories - otoscopy uses right/left, ear_wash uses pre_right/pre_left
    let src_right = if src.join("right").exists() {
        src.join("right")
    } else if src.join("pre_right").exists() {
        src.join("pre_right")
    } else {
        return Err("Directorio de oído derecho no encontrado en sesión origen".to_string());
    };
    let src_left = if src.join("left").exists() {
        src.join("left")
    } else if src.join("pre_left").exists() {
        src.join("pre_left")
    } else {
        return Err("Directorio de oído izquierdo no encontrado en sesión origen".to_string());
    };

    let dest_right = dest.join(&target_right_dir);
    let dest_left = dest.join(&target_left_dir);

    // Clean target directories and copy
    if dest_right.exists() {
        file_manager::remove_dir_all(&dest_right)?;
    }
    copy_dir_recursive(&src_right, &dest_right)?;

    if dest_left.exists() {
        file_manager::remove_dir_all(&dest_left)?;
    }
    copy_dir_recursive(&src_left, &dest_left)?;

    Ok(())
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
    // Simple ISO timestamp without chrono dependency
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Format as ISO-ish string (good enough for sorting)
    format!("{}", now)
}

fn copy_dir_recursive(src: &std::path::Path, dest: &std::path::Path) -> Result<(), String> {
    file_manager::ensure_dir(dest)?;
    let entries = std::fs::read_dir(src).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            std::fs::copy(&src_path, &dest_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
