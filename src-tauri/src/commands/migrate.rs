// Migración única: datos planos en FS (anteriores al cifrado) → vault cifrado.
//
// Idempotente: `put` sobrescribe por clave, así un reintento tras fallo es seguro.
// El FS viejo solo se mueve a backup DESPUÉS de una migración exitosa completa.

use crate::commands::audit;
use crate::commands::patients::Patient;
use crate::commands::workspace;
use crate::storage::file_manager;
use crate::storage::vault::{Store, VaultError, VaultState};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::State;

#[derive(Debug, Serialize)]
pub struct MigrationReport {
    pub patients: usize,
    pub reports: usize,
    pub images: usize,
    pub backup_path: String,
}

fn normalize_rut(rut: &str) -> String {
    rut.chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_uppercase()
}

/// ¿Hay datos planos viejos sin migrar en el workspace?
#[tauri::command]
pub fn legacy_data_exists(app: tauri::AppHandle) -> Result<bool, String> {
    let ws = workspace::get_workspace_path(&app)?;
    let pdir = ws.join("patients");
    if !pdir.exists() {
        return Ok(false);
    }
    for id in file_manager::list_dirs(&pdir)? {
        if pdir.join(&id).join("patient.json").exists() {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Elige un nombre de backup libre: `patients.pre-encrypt.bak`, `...-2`, etc.
fn pick_backup_path(ws: &Path) -> PathBuf {
    let base = ws.join("patients.pre-encrypt.bak");
    if !base.exists() {
        return base;
    }
    let mut n = 2;
    loop {
        let p = ws.join(format!("patients.pre-encrypt.bak-{}", n));
        if !p.exists() {
            return p;
        }
        n += 1;
    }
}

#[tauri::command]
pub fn migrate_from_fs(
    app: tauri::AppHandle,
    state: State<VaultState>,
) -> Result<MigrationReport, String> {
    let ws = workspace::get_workspace_path(&app)?;
    let pdir = ws.join("patients");
    if !pdir.exists() {
        return Ok(MigrationReport { patients: 0, reports: 0, images: 0, backup_path: String::new() });
    }

    // Cifrar todo dentro del vault desbloqueado.
    let (patients, reports, images) = state.with(|v| migrate_tree(v, &pdir))?;

    // Solo tras éxito: mover el FS viejo a backup (no se re-migra ni se pierde).
    let backup = pick_backup_path(&ws);
    std::fs::rename(&pdir, &backup)
        .map_err(|e| format!("migración ok pero falló mover backup: {}", e))?;

    audit::record(
        &app,
        &state,
        "vault.migrate",
        &format!("patients={} reports={} images={}", patients, reports, images),
    );

    Ok(MigrationReport {
        patients,
        reports,
        images,
        backup_path: backup.to_string_lossy().to_string(),
    })
}

fn read_file(path: &Path) -> Result<Vec<u8>, VaultError> {
    std::fs::read(path).map_err(|e| VaultError::Corrupt(format!("{}: {}", path.display(), e)))
}

fn migrate_tree(
    v: &crate::storage::vault::Vault,
    pdir: &Path,
) -> Result<(usize, usize, usize), VaultError> {
    let mut n_patients = 0;
    let mut n_reports = 0;
    let mut n_images = 0;

    for pid in file_manager::list_dirs(pdir).map_err(VaultError::Corrupt)? {
        let patient_dir = pdir.join(&pid);

        // patient.json
        let pjson = patient_dir.join("patient.json");
        if pjson.exists() {
            let bytes = read_file(&pjson)?;
            v.put(Store::Patients, &pid, &bytes)?;
            // Índice ciego de RUT.
            if let Ok(p) = serde_json::from_slice::<Patient>(&bytes) {
                if !p.rut.trim().is_empty() {
                    let token = v.blind_index(&normalize_rut(&p.rut));
                    v.set_rut_index(&token, &pid)?;
                }
            }
            n_patients += 1;
        }

        // sessions/
        let sdir = patient_dir.join("sessions");
        if !sdir.exists() {
            continue;
        }
        for sid in file_manager::list_dirs(&sdir).map_err(VaultError::Corrupt)? {
            let session_dir = sdir.join(&sid);

            // report.json
            let rjson = session_dir.join("report.json");
            if rjson.exists() {
                let rb = read_file(&rjson)?;
                v.put(Store::Reports, &format!("{}/{}", pid, sid), &rb)?;
                n_reports += 1;
            }

            // Subcarpetas de lado (right/left/pre_*/post_*) con imágenes.
            let entries =
                std::fs::read_dir(&session_dir).map_err(|e| VaultError::Corrupt(e.to_string()))?;
            for entry in entries {
                let entry = entry.map_err(|e| VaultError::Corrupt(e.to_string()))?;
                let side_path = entry.path();
                if !side_path.is_dir() {
                    continue;
                }
                let side = entry.file_name().to_string_lossy().to_string();
                let files =
                    std::fs::read_dir(&side_path).map_err(|e| VaultError::Corrupt(e.to_string()))?;
                for f in files {
                    let f = f.map_err(|e| VaultError::Corrupt(e.to_string()))?;
                    let fpath = f.path();
                    if !fpath.is_file() {
                        continue;
                    }
                    let fname = f.file_name().to_string_lossy().to_string();
                    let data = read_file(&fpath)?;
                    v.put(Store::Images, &format!("{}/{}/{}/{}", pid, sid, side, fname), &data)?;
                    n_images += 1;
                }
            }
        }
    }

    Ok((n_patients, n_reports, n_images))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::vault::Vault;
    use std::sync::atomic::{AtomicU64, Ordering};

    static C: AtomicU64 = AtomicU64::new(0);

    fn tmp(name: &str) -> PathBuf {
        let n = C.fetch_add(1, Ordering::SeqCst);
        std::env::temp_dir().join(format!("oto_mig_{}_{}_{}", std::process::id(), n, name))
    }

    #[test]
    fn migrates_patients_reports_images() {
        // Árbol FS plano falso: 1 paciente, 1 sesión, report.json + 2 imágenes.
        let pdir = tmp("patients");
        let pid = "pat-1";
        let sid = "ses-1";
        let pat_json = br#"{"id":"pat-1","rut":"16316711-5","name":"Ana","birth_date":"1990-01-01","age":35,"phone":"","email":"","notes":"","created_at":"x","updated_at":"x"}"#;
        std::fs::create_dir_all(pdir.join(pid).join("sessions").join(sid).join("right")).unwrap();
        std::fs::write(pdir.join(pid).join("patient.json"), pat_json).unwrap();
        std::fs::write(
            pdir.join(pid).join("sessions").join(sid).join("report.json"),
            br#"{"report":1}"#,
        )
        .unwrap();
        std::fs::write(
            pdir.join(pid).join("sessions").join(sid).join("right").join("a.jpeg"),
            b"IMGDATA",
        )
        .unwrap();
        std::fs::write(
            pdir.join(pid).join("sessions").join(sid).join("right").join("a_thumb.jpg"),
            b"THUMB",
        )
        .unwrap();

        let vpath = tmp("vault");
        let v = Vault::setup(&vpath, b"pw").unwrap();
        let (np, nr, ni) = migrate_tree(&v, &pdir).unwrap();
        assert_eq!((np, nr, ni), (1, 1, 2));

        // Los datos se leen descifrados desde el vault.
        assert_eq!(v.get(Store::Patients, "pat-1").unwrap().unwrap(), pat_json);
        assert_eq!(v.get(Store::Reports, "pat-1/ses-1").unwrap().unwrap(), br#"{"report":1}"#);
        assert_eq!(
            v.get(Store::Images, "pat-1/ses-1/right/a.jpeg").unwrap().unwrap(),
            b"IMGDATA"
        );
        // El RUT quedó indexado.
        let token = v.blind_index(&normalize_rut("16.316.711-5"));
        assert_eq!(v.get_rut_index(&token).unwrap().as_deref(), Some("pat-1"));

        let _ = std::fs::remove_dir_all(&pdir);
        let _ = std::fs::remove_file(&vpath);
    }
}
