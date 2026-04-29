mod commands;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![
            commands::workspace::get_workspace,
            commands::workspace::set_workspace,
            commands::workspace::get_workspace_config,
            commands::workspace::save_workspace_config,
            commands::workspace::load_logo,
            commands::workspace::get_platform,
            commands::workspace::auto_setup_workspace,
            commands::workspace::save_logo,
            commands::workspace::get_profiles,
            commands::workspace::save_profiles,
            commands::workspace::set_active_profile,
            commands::workspace::get_active_profile_id,
            commands::patients::list_patients,
            commands::patients::save_patient,
            commands::patients::get_patient,
            commands::patients::delete_patient,
            commands::patients::find_patient_by_rut,
            commands::reports::create_session,
            commands::reports::save_report,
            commands::reports::load_report,
            commands::reports::list_sessions,
            commands::reports::list_patient_sessions,
            commands::reports::delete_session,
            commands::reports::duplicate_session,
            commands::reports::import_session_ears,
            commands::images::save_image,
            commands::images::load_image,
            commands::images::delete_image,
            commands::images::rotate_image,
            commands::images::move_image,
            commands::images::save_annotated,
            commands::export::save_pdf,
            commands::export::save_pdf_to_cache,
            commands::contribute::create_contribution_zip,
            commands::findings_cache::get_findings_cache_meta,
            commands::findings_cache::save_findings_cache_meta,
            commands::findings_cache::save_finding_image,
            commands::findings_cache::load_finding_image,
            commands::findings_cache::clear_findings_cache,
            commands::edu_cache::get_edu_cache_meta,
            commands::edu_cache::save_edu_cache_meta,
            commands::edu_cache::save_edu_image,
            commands::edu_cache::load_edu_image,
            commands::edu_cache::list_edu_images,
            commands::edu_cache::save_edu_animation,
            commands::edu_cache::load_edu_animation,
            commands::edu_cache::list_edu_animations,
            commands::edu_anim::save_user_animation,
            commands::edu_anim::load_user_animation,
            commands::edu_anim::list_user_animations,
            commands::edu_anim::delete_user_animation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
