use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
pub fn save_pdf(path: String, data: Vec<u8>) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&file_path, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_pdf_to_cache(app: tauri::AppHandle, filename: String, data: Vec<u8>) -> Result<String, String> {
    // Cache dir: en Android lo expone el FileProvider (file_paths.xml `cache-path`),
    // así `openPath`/compartir puede abrir el PDF. app_data_dir (files/) NO está
    // expuesto → openPath fallaba en Android.
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let exports_dir = cache_dir.join("exports");
    std::fs::create_dir_all(&exports_dir).map_err(|e| e.to_string())?;
    let file_path = exports_dir.join(&filename);
    std::fs::write(&file_path, &data).map_err(|e| e.to_string())?;
    Ok(file_path.to_string_lossy().to_string())
}
