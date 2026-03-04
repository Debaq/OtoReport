mod commands;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| {
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;
                let main_window = _app.get_webview_window("main").unwrap();
                main_window
                    .with_webview(|webview| {
                        use webkit2gtk::{PermissionRequestExt, WebViewExt};
                        let wv = webview.inner();
                        wv.connect_permission_request(|_wv, request| {
                            request.allow();
                            true
                        });
                    })
                    .unwrap();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::workspace::get_workspace,
            commands::workspace::set_workspace,
            commands::workspace::get_workspace_config,
            commands::workspace::save_workspace_config,
            commands::workspace::load_logo,
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
            commands::images::save_image,
            commands::images::load_image,
            commands::images::delete_image,
            commands::images::rotate_image,
            commands::images::move_image,
            commands::images::save_annotated,
            commands::export::save_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
