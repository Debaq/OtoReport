use crate::storage::{file_manager, json_store};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct WorkspaceConfig {
    pub workspace_path: String,
    // Centro de salud
    pub center_name: String,
    pub center_address: String,
    pub center_phone: String,
    pub center_email: String,
    pub logo_path: String,
    // Examinador
    pub examiner: String,
    pub equipment: String,
    // Preferencias del informe
    pub report_title: String,
    pub show_header: bool,
    pub show_logo: bool,
    pub show_patient_info: bool,
    pub show_exam_info: bool,
    pub show_diagram: bool,
    pub show_annotations: bool,
    pub show_findings: bool,
    pub show_observations: bool,
    pub show_images: bool,
    pub show_conclusion: bool,
    pub show_footer: bool,
    pub image_size: String,
    pub images_per_row: u32,
    pub theme_color: String,
    pub section_order: Vec<String>,
}

impl Default for WorkspaceConfig {
    fn default() -> Self {
        Self {
            workspace_path: String::new(),
            center_name: String::new(),
            center_address: String::new(),
            center_phone: String::new(),
            center_email: String::new(),
            logo_path: String::new(),
            examiner: String::new(),
            equipment: String::new(),
            report_title: "Informe de Otoscopía".to_string(),
            show_header: true,
            show_logo: true,
            show_patient_info: true,
            show_exam_info: true,
            show_diagram: true,
            show_annotations: true,
            show_findings: true,
            show_observations: true,
            show_images: true,
            show_conclusion: true,
            show_footer: true,
            image_size: "medium".to_string(),
            images_per_row: 3,
            theme_color: "blue".to_string(),
            section_order: vec![
                "patient_info".to_string(),
                "exam_info".to_string(),
                "findings".to_string(),
                "conclusion".to_string(),
            ],
        }
    }
}

fn get_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    file_manager::ensure_dir(&data_dir)?;
    Ok(data_dir.join("config.json"))
}

pub fn get_workspace_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config = get_workspace_config_inner(app)?;
    if config.workspace_path.is_empty() {
        return Err("Workspace no configurado".to_string());
    }
    let path = PathBuf::from(&config.workspace_path);
    file_manager::ensure_dir(&path)?;
    Ok(path)
}

fn get_workspace_config_inner(app: &tauri::AppHandle) -> Result<WorkspaceConfig, String> {
    let config_path = get_config_path(app)?;
    if config_path.exists() {
        json_store::read_json(&config_path)
    } else {
        Ok(WorkspaceConfig::default())
    }
}

#[tauri::command]
pub fn get_workspace(app: tauri::AppHandle) -> Result<String, String> {
    let config = get_workspace_config_inner(&app)?;
    Ok(config.workspace_path)
}

#[tauri::command]
pub fn set_workspace(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let workspace = PathBuf::from(&path);
    file_manager::ensure_dir(&workspace)?;
    file_manager::ensure_dir(&workspace.join("patients"))?;

    let config_path = get_config_path(&app)?;
    let mut config = get_workspace_config_inner(&app)?;
    config.workspace_path = path;
    json_store::write_json(&config_path, &config)
}

#[tauri::command]
pub fn get_workspace_config(app: tauri::AppHandle) -> Result<WorkspaceConfig, String> {
    get_workspace_config_inner(&app)
}

#[tauri::command]
pub fn save_workspace_config(app: tauri::AppHandle, config: WorkspaceConfig) -> Result<(), String> {
    let config_path = get_config_path(&app)?;
    json_store::write_json(&config_path, &config)
}

#[tauri::command]
pub fn load_logo(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Error al leer logo: {}", e))
}
