use crate::commands::workspace;
use crate::storage::{file_manager, json_store};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EduCacheMeta {
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub last_sync: String,
    /// filename -> version string for change detection
    #[serde(default)]
    pub images: HashMap<String, String>,
    #[serde(default)]
    pub animations: HashMap<String, String>,
}

fn get_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let ws = workspace::get_workspace_path(app)?;
    Ok(ws.join("edu_cache"))
}

fn get_img_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(get_cache_dir(app)?.join("images"))
}

fn get_anim_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(get_cache_dir(app)?.join("animations"))
}

#[tauri::command]
pub fn get_edu_cache_meta(app: tauri::AppHandle) -> Result<EduCacheMeta, String> {
    let meta_path = get_cache_dir(&app)?.join("meta.json");
    if meta_path.exists() {
        json_store::read_json(&meta_path)
    } else {
        Ok(EduCacheMeta::default())
    }
}

#[tauri::command]
pub fn save_edu_cache_meta(app: tauri::AppHandle, meta: EduCacheMeta) -> Result<(), String> {
    let cache_dir = get_cache_dir(&app)?;
    file_manager::ensure_dir(&cache_dir)?;
    let meta_path = cache_dir.join("meta.json");
    json_store::write_json(&meta_path, &meta)
}

// --- Images ---

#[tauri::command]
pub fn save_edu_image(app: tauri::AppHandle, filename: String, image_data: Vec<u8>) -> Result<(), String> {
    let img_dir = get_img_dir(&app)?;
    file_manager::ensure_dir(&img_dir)?;
    let file_path = img_dir.join(&filename);
    std::fs::write(&file_path, &image_data)
        .map_err(|e| format!("Error guardando imagen educativa: {}", e))
}

#[tauri::command]
pub fn load_edu_image(app: tauri::AppHandle, filename: String) -> Result<Vec<u8>, String> {
    let img_dir = get_img_dir(&app)?;
    let file_path = img_dir.join(&filename);
    if file_path.exists() {
        std::fs::read(&file_path)
            .map_err(|e| format!("Error leyendo imagen educativa: {}", e))
    } else {
        Err(format!("Imagen educativa no encontrada: {}", filename))
    }
}

#[tauri::command]
pub fn list_edu_images(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let img_dir = get_img_dir(&app)?;
    list_files_with_extensions(&img_dir, &["png", "jpg", "jpeg", "webp", "svg", "bmp"])
}

// --- Animations ---

#[tauri::command]
pub fn save_edu_animation(app: tauri::AppHandle, filename: String, data: Vec<u8>) -> Result<(), String> {
    let anim_dir = get_anim_dir(&app)?;
    file_manager::ensure_dir(&anim_dir)?;
    let file_path = anim_dir.join(&filename);
    std::fs::write(&file_path, &data)
        .map_err(|e| format!("Error guardando animación educativa: {}", e))
}

#[tauri::command]
pub fn load_edu_animation(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let anim_dir = get_anim_dir(&app)?;
    let file_path = anim_dir.join(&filename);
    if file_path.exists() {
        std::fs::read_to_string(&file_path)
            .map_err(|e| format!("Error leyendo animación educativa: {}", e))
    } else {
        Err(format!("Animación no encontrada: {}", filename))
    }
}

#[tauri::command]
pub fn list_edu_animations(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let anim_dir = get_anim_dir(&app)?;
    list_files_with_extensions(&anim_dir, &["json"])
}

// --- Utils ---

fn list_files_with_extensions(dir: &PathBuf, extensions: &[&str]) -> Result<Vec<String>, String> {
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut files = Vec::new();
    let entries = std::fs::read_dir(dir)
        .map_err(|e| format!("Error listando directorio: {}", e))?;
    for entry in entries.flatten() {
        if let Some(name) = entry.file_name().to_str() {
            let lower = name.to_lowercase();
            if extensions.iter().any(|ext| lower.ends_with(&format!(".{}", ext))) {
                files.push(name.to_string());
            }
        }
    }
    files.sort();
    Ok(files)
}
