use crate::commands::workspace;
use crate::storage::{file_manager, json_store};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudiogramPoint {
    pub frequency: i32,
    pub threshold: f64,
    pub masked: bool,
    #[serde(rename = "noResponse")]
    pub no_response: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AudiogramEar {
    pub air: Vec<AudiogramPoint>,
    pub bone: Vec<AudiogramPoint>,
    #[serde(default)]
    pub ldl: Vec<AudiogramPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogoPoint {
    pub intensity: f64,
    pub percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LogoaudiometryEar {
    pub srt: Option<f64>,
    pub discrimination: Option<f64>,
    pub discrimination_intensity: Option<f64>,
    pub curve: Vec<LogoPoint>,
    pub observations: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Acumetry {
    pub weber: String,
    pub rinne_right: String,
    pub rinne_left: String,
    pub schwabach: String,
    pub observations: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FowlerData {
    pub frequency: i32,
    pub reference_ear: String,
    #[serde(default)]
    pub threshold_db: f64,
    #[serde(default = "default_fowler_step")]
    pub step_db: f64,
    #[serde(default)]
    pub matches: Vec<Option<f64>>,
    #[serde(default)]
    pub diplacusia: bool,
}

fn default_fowler_step() -> f64 {
    20.0
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SisiData {
    pub ear: String,
    pub frequency: i32,
    #[serde(default)]
    pub threshold_db: f64,
    #[serde(default = "default_sisi_sl")]
    pub sl_db: f64,
    #[serde(default)]
    pub presentation_db: f64,
    #[serde(default = "default_sisi_fam_step")]
    pub familiarization_step_db: f64,
    #[serde(default = "default_sisi_test_inc")]
    pub test_increment_db: f64,
    #[serde(default)]
    pub trials: Vec<bool>,
}

fn default_sisi_sl() -> f64 { 20.0 }
fn default_sisi_fam_step() -> f64 { 5.0 }
fn default_sisi_test_inc() -> f64 { 1.0 }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RegerData {
    pub ear: String,
    pub reference_frequency: i32,
    pub comparison_frequency: i32,
    #[serde(default)]
    pub threshold_db: f64,
    #[serde(default = "default_fowler_step")]
    pub step_db: f64,
    #[serde(default)]
    pub matches: Vec<Option<f64>>,
    #[serde(default)]
    pub diplacusia: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CarhartStep {
    #[serde(default)]
    pub level_db: f64,
    #[serde(default)]
    pub seconds_heard: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CarhartData {
    pub ear: String,
    pub frequency: i32,
    #[serde(default)]
    pub threshold_db: f64,
    #[serde(default = "default_carhart_start_sl")]
    pub start_sl_db: f64,
    #[serde(default = "default_carhart_step")]
    pub step_db: f64,
    #[serde(default = "default_carhart_max")]
    pub max_decay_db: f64,
    #[serde(default)]
    pub steps: Vec<CarhartStep>,
}

fn default_carhart_start_sl() -> f64 { 5.0 }
fn default_carhart_step() -> f64 { 5.0 }
fn default_carhart_max() -> f64 { 30.0 }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SupraliminarTest {
    pub id: String,
    #[serde(rename = "type")]
    pub test_type: String,
    #[serde(default)]
    pub custom_name: Option<String>,
    pub ear: String,
    pub result: String,
    pub observations: String,
    #[serde(default)]
    pub fowler: Option<FowlerData>,
    #[serde(default)]
    pub reger: Option<RegerData>,
    #[serde(default)]
    pub sisi: Option<SisiData>,
    #[serde(default)]
    pub carhart: Option<CarhartData>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Supraliminar {
    #[serde(default)]
    pub tests: Vec<SupraliminarTest>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PTA {
    pub right_air: Option<f64>,
    pub left_air: Option<f64>,
    pub right_bone: Option<f64>,
    pub left_bone: Option<f64>,
    #[serde(default)]
    pub right_air_4: Option<f64>,
    #[serde(default)]
    pub left_air_4: Option<f64>,
    #[serde(default)]
    pub right_bone_4: Option<f64>,
    #[serde(default)]
    pub left_bone_4: Option<f64>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudiometryReport {
    pub id: String,
    pub patient_id: String,
    pub patient: PatientRef,
    pub session_id: String,
    pub status: String,
    pub report_type: String,
    pub examiner: String,
    pub equipment: String,
    pub right_audiogram: AudiogramEar,
    pub left_audiogram: AudiogramEar,
    pub logo_right: LogoaudiometryEar,
    pub logo_left: LogoaudiometryEar,
    pub supraliminar: Supraliminar,
    pub acumetry: Acumetry,
    pub pta: PTA,
    pub conclusion: String,
    pub created_at: String,
    pub updated_at: String,
}

fn session_path(
    app: &tauri::AppHandle,
    patient_id: &str,
    session_id: &str,
) -> Result<std::path::PathBuf, String> {
    let ws = workspace::get_workspace_path(app)?;
    Ok(ws
        .join("patients")
        .join(patient_id)
        .join("sessions")
        .join(session_id))
}

#[tauri::command]
pub fn create_audiometry_session(
    app: tauri::AppHandle,
    patient_id: String,
    session_id: String,
) -> Result<(), String> {
    let path = session_path(&app, &patient_id, &session_id)?;
    file_manager::ensure_dir(&path)
}

#[tauri::command]
pub fn save_audiometry(app: tauri::AppHandle, report: AudiometryReport) -> Result<(), String> {
    let path = session_path(&app, &report.patient_id, &report.session_id)?;
    file_manager::ensure_dir(&path)?;
    json_store::write_json(&path.join("audiometry.json"), &report)
}

#[tauri::command]
pub fn load_audiometry(
    app: tauri::AppHandle,
    patient_id: String,
    session_id: String,
) -> Result<AudiometryReport, String> {
    let path = session_path(&app, &patient_id, &session_id)?;
    json_store::read_json(&path.join("audiometry.json"))
}
