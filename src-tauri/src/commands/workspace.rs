use crate::storage::{file_manager, json_store};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

// --- Findings config (sin cambios) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FindingCheckConfig {
    pub key: String,
    pub label: String,
    pub enabled: bool,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FindingsCategoryConfig {
    pub id: String,
    pub name: String,
    pub checks: Vec<FindingCheckConfig>,
}

// --- AppConfig: solo workspace_path + active_profile_id ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    pub workspace_path: String,
    pub active_profile_id: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            workspace_path: String::new(),
            active_profile_id: String::new(),
        }
    }
}

// --- UserProfile: datos del usuario/centro/informe ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct UserProfile {
    pub id: String,
    pub name: String,
    pub color: String,
    pub avatar: Option<u32>,
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
    pub ear_wash_report_title: String,
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
    pub findings_categories: Vec<FindingsCategoryConfig>,
    pub app_theme: String,
}

impl Default for UserProfile {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            color: "#3B82F6".to_string(),
            avatar: None,
            center_name: String::new(),
            center_address: String::new(),
            center_phone: String::new(),
            center_email: String::new(),
            logo_path: String::new(),
            examiner: String::new(),
            equipment: String::new(),
            report_title: "Informe de Otoscopía".to_string(),
            ear_wash_report_title: "Informe de Lavado de Oído".to_string(),
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
                "header".to_string(),
                "patient_info".to_string(),
                "exam_info".to_string(),
                "diagram".to_string(),
                "findings".to_string(),
                "observations".to_string(),
                "images".to_string(),
                "annotations".to_string(),
                "conclusion".to_string(),
                "footer".to_string(),
            ],
            findings_categories: Vec::new(),
            app_theme: "dracula".to_string(),
        }
    }
}

// --- ProfilesData: almacenado en {workspace}/profiles.json ---

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProfilesData {
    pub profiles: Vec<UserProfile>,
}

// --- WorkspaceConfig legacy: para deserializar config.json viejo ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacyWorkspaceConfig {
    #[serde(default)]
    pub workspace_path: String,
    #[serde(default)]
    pub center_name: String,
    #[serde(default)]
    pub center_address: String,
    #[serde(default)]
    pub center_phone: String,
    #[serde(default)]
    pub center_email: String,
    #[serde(default)]
    pub logo_path: String,
    #[serde(default)]
    pub examiner: String,
    #[serde(default)]
    pub equipment: String,
    #[serde(default = "default_report_title")]
    pub report_title: String,
    #[serde(default = "default_true")]
    pub show_header: bool,
    #[serde(default = "default_true")]
    pub show_logo: bool,
    #[serde(default = "default_true")]
    pub show_patient_info: bool,
    #[serde(default = "default_true")]
    pub show_exam_info: bool,
    #[serde(default = "default_true")]
    pub show_diagram: bool,
    #[serde(default = "default_true")]
    pub show_annotations: bool,
    #[serde(default = "default_true")]
    pub show_findings: bool,
    #[serde(default = "default_true")]
    pub show_observations: bool,
    #[serde(default = "default_true")]
    pub show_images: bool,
    #[serde(default = "default_true")]
    pub show_conclusion: bool,
    #[serde(default = "default_true")]
    pub show_footer: bool,
    #[serde(default = "default_image_size")]
    pub image_size: String,
    #[serde(default = "default_images_per_row")]
    pub images_per_row: u32,
    #[serde(default = "default_theme_color")]
    pub theme_color: String,
    #[serde(default)]
    pub section_order: Vec<String>,
    #[serde(default)]
    pub findings_categories: Vec<FindingsCategoryConfig>,
}

fn default_true() -> bool { true }
fn default_report_title() -> String { "Informe de Otoscopía".to_string() }
fn default_image_size() -> String { "medium".to_string() }
fn default_images_per_row() -> u32 { 3 }
fn default_theme_color() -> String { "blue".to_string() }

// --- WorkspaceConfig para compatibilidad con frontend ---
// El frontend sigue enviando/recibiendo este shape

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct WorkspaceConfig {
    pub workspace_path: String,
    pub center_name: String,
    pub center_address: String,
    pub center_phone: String,
    pub center_email: String,
    pub logo_path: String,
    pub examiner: String,
    pub equipment: String,
    pub report_title: String,
    pub ear_wash_report_title: String,
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
    pub findings_categories: Vec<FindingsCategoryConfig>,
    pub app_theme: String,
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
            ear_wash_report_title: "Informe de Lavado de Oído".to_string(),
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
                "header".to_string(),
                "patient_info".to_string(),
                "exam_info".to_string(),
                "diagram".to_string(),
                "findings".to_string(),
                "observations".to_string(),
                "images".to_string(),
                "annotations".to_string(),
                "conclusion".to_string(),
                "footer".to_string(),
            ],
            findings_categories: Vec::new(),
            app_theme: "dracula".to_string(),
        }
    }
}

// --- Helpers ---

fn get_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    file_manager::ensure_dir(&data_dir)?;
    Ok(data_dir.join("config.json"))
}

fn get_app_config(app: &tauri::AppHandle) -> Result<AppConfig, String> {
    let config_path = get_config_path(app)?;
    if config_path.exists() {
        // Intentar leer como AppConfig nuevo
        let content = std::fs::read_to_string(&config_path)
            .map_err(|e| e.to_string())?;
        // Si tiene campo "examiner" es formato viejo, migrar
        if content.contains("\"examiner\"") {
            return migrate_legacy_config(app, &config_path, &content);
        }
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Ok(AppConfig::default())
    }
}

fn save_app_config(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let config_path = get_config_path(app)?;
    json_store::write_json(&config_path, config)
}

fn get_profiles_path(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("profiles.json")
}

fn get_profiles_data(workspace_path: &str) -> Result<ProfilesData, String> {
    let path = get_profiles_path(workspace_path);
    if path.exists() {
        json_store::read_json(&path)
    } else {
        Ok(ProfilesData::default())
    }
}

fn save_profiles_data(workspace_path: &str, data: &ProfilesData) -> Result<(), String> {
    let path = get_profiles_path(workspace_path);
    json_store::write_json(&path, data)
}

fn migrate_legacy_config(_app: &tauri::AppHandle, config_path: &PathBuf, content: &str) -> Result<AppConfig, String> {
    let legacy: LegacyWorkspaceConfig = serde_json::from_str(content)
        .map_err(|e| e.to_string())?;

    let profile_id = uuid::Uuid::new_v4().to_string();
    let profile_name = if legacy.examiner.is_empty() {
        "Usuario".to_string()
    } else {
        legacy.examiner.clone()
    };

    let profile = UserProfile {
        id: profile_id.clone(),
        name: profile_name.clone(),
        color: "#3B82F6".to_string(),
        avatar: None,
        center_name: legacy.center_name,
        center_address: legacy.center_address,
        center_phone: legacy.center_phone,
        center_email: legacy.center_email,
        logo_path: legacy.logo_path,
        examiner: legacy.examiner.clone(),
        equipment: legacy.equipment,
        report_title: legacy.report_title,
        ear_wash_report_title: "Informe de Lavado de Oído".to_string(),
        show_header: legacy.show_header,
        show_logo: legacy.show_logo,
        show_patient_info: legacy.show_patient_info,
        show_exam_info: legacy.show_exam_info,
        show_diagram: legacy.show_diagram,
        show_annotations: legacy.show_annotations,
        show_findings: legacy.show_findings,
        show_observations: legacy.show_observations,
        show_images: legacy.show_images,
        show_conclusion: legacy.show_conclusion,
        show_footer: legacy.show_footer,
        image_size: legacy.image_size,
        images_per_row: legacy.images_per_row,
        theme_color: legacy.theme_color,
        section_order: if legacy.section_order.is_empty() {
            UserProfile::default().section_order
        } else {
            legacy.section_order
        },
        findings_categories: legacy.findings_categories,
        app_theme: "dracula".to_string(),
    };

    // Guardar perfil en workspace/profiles.json
    if !legacy.workspace_path.is_empty() {
        let profiles = ProfilesData { profiles: vec![profile] };
        save_profiles_data(&legacy.workspace_path, &profiles)?;
    }

    // Reescribir config.json como AppConfig
    let app_config = AppConfig {
        workspace_path: legacy.workspace_path,
        active_profile_id: profile_id,
    };
    json_store::write_json(config_path, &app_config)?;

    Ok(app_config)
}

fn get_active_profile(app: &tauri::AppHandle) -> Result<UserProfile, String> {
    let app_config = get_app_config(app)?;
    if app_config.workspace_path.is_empty() {
        return Ok(UserProfile::default());
    }
    let profiles_data = get_profiles_data(&app_config.workspace_path)?;
    if let Some(profile) = profiles_data.profiles.iter().find(|p| p.id == app_config.active_profile_id) {
        Ok(profile.clone())
    } else if let Some(first) = profiles_data.profiles.first() {
        Ok(first.clone())
    } else {
        Ok(UserProfile::default())
    }
}

pub fn get_workspace_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config = get_app_config(app)?;
    if config.workspace_path.is_empty() {
        return Err("Workspace no configurado".to_string());
    }
    let path = PathBuf::from(&config.workspace_path);
    file_manager::ensure_dir(&path)?;
    Ok(path)
}

// --- Comandos Tauri ---

#[tauri::command]
pub fn get_workspace(app: tauri::AppHandle) -> Result<String, String> {
    let config = get_app_config(&app)?;
    Ok(config.workspace_path)
}

#[tauri::command]
pub fn set_workspace(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let workspace = PathBuf::from(&path);
    file_manager::ensure_dir(&workspace)?;
    file_manager::ensure_dir(&workspace.join("patients"))?;

    let mut config = get_app_config(&app)?;
    config.workspace_path = path;
    save_app_config(&app, &config)
}

#[tauri::command]
pub fn get_workspace_config(app: tauri::AppHandle) -> Result<WorkspaceConfig, String> {
    let app_config = get_app_config(&app)?;
    let profile = get_active_profile(&app)?;

    Ok(WorkspaceConfig {
        workspace_path: app_config.workspace_path,
        center_name: profile.center_name,
        center_address: profile.center_address,
        center_phone: profile.center_phone,
        center_email: profile.center_email,
        logo_path: profile.logo_path,
        examiner: profile.examiner,
        equipment: profile.equipment,
        report_title: profile.report_title,
        ear_wash_report_title: profile.ear_wash_report_title,
        show_header: profile.show_header,
        show_logo: profile.show_logo,
        show_patient_info: profile.show_patient_info,
        show_exam_info: profile.show_exam_info,
        show_diagram: profile.show_diagram,
        show_annotations: profile.show_annotations,
        show_findings: profile.show_findings,
        show_observations: profile.show_observations,
        show_images: profile.show_images,
        show_conclusion: profile.show_conclusion,
        show_footer: profile.show_footer,
        image_size: profile.image_size,
        images_per_row: profile.images_per_row,
        theme_color: profile.theme_color,
        section_order: profile.section_order,
        findings_categories: profile.findings_categories,
        app_theme: profile.app_theme,
    })
}

#[tauri::command]
pub fn save_workspace_config(app: tauri::AppHandle, config: WorkspaceConfig) -> Result<(), String> {
    let app_config = get_app_config(&app)?;

    // Guardar workspace_path en app config si cambió
    if app_config.workspace_path != config.workspace_path {
        let mut new_app_config = app_config.clone();
        new_app_config.workspace_path = config.workspace_path.clone();
        save_app_config(&app, &new_app_config)?;
    }

    // Actualizar el perfil activo con los datos del config
    if !app_config.workspace_path.is_empty() {
        let mut profiles_data = get_profiles_data(&app_config.workspace_path)?;
        if let Some(profile) = profiles_data.profiles.iter_mut().find(|p| p.id == app_config.active_profile_id) {
            profile.center_name = config.center_name;
            profile.center_address = config.center_address;
            profile.center_phone = config.center_phone;
            profile.center_email = config.center_email;
            profile.logo_path = config.logo_path;
            profile.examiner = config.examiner;
            profile.equipment = config.equipment;
            profile.report_title = config.report_title;
            profile.ear_wash_report_title = config.ear_wash_report_title;
            profile.show_header = config.show_header;
            profile.show_logo = config.show_logo;
            profile.show_patient_info = config.show_patient_info;
            profile.show_exam_info = config.show_exam_info;
            profile.show_diagram = config.show_diagram;
            profile.show_annotations = config.show_annotations;
            profile.show_findings = config.show_findings;
            profile.show_observations = config.show_observations;
            profile.show_images = config.show_images;
            profile.show_conclusion = config.show_conclusion;
            profile.show_footer = config.show_footer;
            profile.image_size = config.image_size;
            profile.images_per_row = config.images_per_row;
            profile.theme_color = config.theme_color;
            profile.section_order = config.section_order;
            profile.findings_categories = config.findings_categories;
            profile.app_theme = config.app_theme;
            save_profiles_data(&app_config.workspace_path, &profiles_data)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_profiles(app: tauri::AppHandle) -> Result<Vec<UserProfile>, String> {
    let app_config = get_app_config(&app)?;
    if app_config.workspace_path.is_empty() {
        return Ok(Vec::new());
    }
    let data = get_profiles_data(&app_config.workspace_path)?;
    Ok(data.profiles)
}

#[tauri::command]
pub fn save_profiles(app: tauri::AppHandle, profiles: Vec<UserProfile>) -> Result<(), String> {
    let app_config = get_app_config(&app)?;
    if app_config.workspace_path.is_empty() {
        return Err("Workspace no configurado".to_string());
    }
    let data = ProfilesData { profiles };
    save_profiles_data(&app_config.workspace_path, &data)
}

#[tauri::command]
pub fn set_active_profile(app: tauri::AppHandle, profile_id: String) -> Result<(), String> {
    let mut config = get_app_config(&app)?;
    config.active_profile_id = profile_id;
    save_app_config(&app, &config)
}

#[tauri::command]
pub fn get_active_profile_id(app: tauri::AppHandle) -> Result<String, String> {
    let config = get_app_config(&app)?;
    Ok(config.active_profile_id)
}

#[tauri::command]
pub fn load_logo(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Error al leer logo: {}", e))
}

#[tauri::command]
pub fn get_platform() -> String {
    if cfg!(target_os = "android") {
        "android".into()
    } else if cfg!(target_os = "ios") {
        "ios".into()
    } else {
        "desktop".into()
    }
}

#[tauri::command]
pub fn auto_setup_workspace(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let workspace = data_dir.join("workspace");
    file_manager::ensure_dir(&workspace)?;
    file_manager::ensure_dir(&workspace.join("patients"))?;

    let ws_str = workspace.to_string_lossy().to_string();
    let mut config = get_app_config(&app)?;
    config.workspace_path = ws_str.clone();
    save_app_config(&app, &config)?;
    Ok(ws_str)
}

#[tauri::command]
pub fn save_logo(app: tauri::AppHandle, data: Vec<u8>, extension: String) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    file_manager::ensure_dir(&data_dir)?;
    let logo_path = data_dir.join(format!("logo.{}", extension));
    std::fs::write(&logo_path, &data)
        .map_err(|e| format!("Error al guardar logo: {}", e))?;
    Ok(logo_path.to_string_lossy().to_string())
}
