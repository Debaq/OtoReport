use crate::commands::workspace;
use crate::storage::file_manager;
use std::path::PathBuf;

fn get_anim_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let ws = workspace::get_workspace_path(app)?;
    let dir = ws.join("edu").join("anim");
    file_manager::ensure_dir(&dir)?;
    Ok(dir)
}

#[tauri::command]
pub fn save_user_animation(app: tauri::AppHandle, filename: String, data: String) -> Result<(), String> {
    let dir = get_anim_dir(&app)?;
    let file_path = dir.join(&filename);
    std::fs::write(&file_path, data.as_bytes())
        .map_err(|e| format!("Error guardando animación: {}", e))
}

#[tauri::command]
pub fn load_user_animation(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let dir = get_anim_dir(&app)?;
    let file_path = dir.join(&filename);
    if file_path.exists() {
        std::fs::read_to_string(&file_path)
            .map_err(|e| format!("Error leyendo animación: {}", e))
    } else {
        Err(format!("Animación no encontrada: {}", filename))
    }
}

#[tauri::command]
pub fn list_user_animations(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dir = get_anim_dir(&app)?;
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut files = Vec::new();
    let entries = std::fs::read_dir(&dir)
        .map_err(|e| format!("Error listando animaciones: {}", e))?;
    for entry in entries.flatten() {
        if let Some(name) = entry.file_name().to_str() {
            if name.to_lowercase().ends_with(".json") {
                files.push(name.to_string());
            }
        }
    }
    files.sort();
    Ok(files)
}

#[tauri::command]
pub fn delete_user_animation(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    let dir = get_anim_dir(&app)?;
    let file_path = dir.join(&filename);
    if file_path.exists() {
        std::fs::remove_file(&file_path)
            .map_err(|e| format!("Error eliminando animación: {}", e))
    } else {
        Ok(())
    }
}
