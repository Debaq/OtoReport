use crate::commands::audit;
use crate::storage::vault::{Store, VaultState};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Patient {
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

/// Normaliza el RUT igual que el frontend: solo alfanuméricos, mayúsculas.
fn normalize_rut(rut: &str) -> String {
    rut.chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_uppercase()
}

#[tauri::command]
pub fn list_patients(state: State<VaultState>) -> Result<Vec<Patient>, String> {
    state.with(|v| {
        let mut patients = Vec::new();
        for (_, bytes) in v.list(Store::Patients)? {
            if let Ok(p) = serde_json::from_slice::<Patient>(&bytes) {
                patients.push(p);
            }
        }
        Ok(patients)
    })
    .map(|mut patients| {
        patients.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        patients
    })
}

#[tauri::command]
pub fn save_patient(
    app: tauri::AppHandle,
    state: State<VaultState>,
    patient: Patient,
) -> Result<(), String> {
    let id = patient.id.clone();
    state.with(|v| {
        let bytes = serde_json::to_vec(&patient)
            .map_err(|e| crate::storage::vault::VaultError::Crypto(e.to_string()))?;
        v.put(Store::Patients, &patient.id, &bytes)?;
        // Índice ciego de RUT → permite buscar por RUT sin descifrar todo.
        if !patient.rut.trim().is_empty() {
            let token = v.blind_index(&normalize_rut(&patient.rut));
            v.set_rut_index(&token, &patient.id)?;
        }
        Ok(())
    })?;
    audit::record(&app, &state, "patient.save", &id);
    Ok(())
}

#[tauri::command]
pub fn get_patient(state: State<VaultState>, id: String) -> Result<Patient, String> {
    state.with(|v| {
        let bytes = v
            .get(Store::Patients, &id)?
            .ok_or_else(|| crate::storage::vault::VaultError::Corrupt("paciente no encontrado".into()))?;
        serde_json::from_slice::<Patient>(&bytes)
            .map_err(|e| crate::storage::vault::VaultError::Corrupt(e.to_string()))
    })
}

#[tauri::command]
pub fn find_patient_by_rut(
    state: State<VaultState>,
    rut: String,
) -> Result<Option<Patient>, String> {
    state.with(|v| {
        let norm = normalize_rut(&rut);
        let token = v.blind_index(&norm);
        // Vía rápida: índice ciego.
        if let Some(pid) = v.get_rut_index(&token)? {
            if let Some(bytes) = v.get(Store::Patients, &pid)? {
                if let Ok(p) = serde_json::from_slice::<Patient>(&bytes) {
                    return Ok(Some(p));
                }
            }
        }
        // Respaldo: escanear (datos viejos sin indexar) y reindexar al vuelo.
        for (_, bytes) in v.list(Store::Patients)? {
            if let Ok(p) = serde_json::from_slice::<Patient>(&bytes) {
                if normalize_rut(&p.rut) == norm {
                    v.set_rut_index(&token, &p.id)?;
                    return Ok(Some(p));
                }
            }
        }
        Ok(None)
    })
}

#[tauri::command]
pub fn delete_patient(
    app: tauri::AppHandle,
    state: State<VaultState>,
    id: String,
) -> Result<(), String> {
    let result = state.with(|v| {
        // Recuperar el RUT para borrar también su índice.
        if let Some(bytes) = v.get(Store::Patients, &id)? {
            if let Ok(p) = serde_json::from_slice::<Patient>(&bytes) {
                if !p.rut.trim().is_empty() {
                    let token = v.blind_index(&normalize_rut(&p.rut));
                    let _ = v.delete_rut_index(&token);
                }
            }
        }
        // Cascada: paciente + todos sus reportes e imágenes.
        let existed = v.delete(Store::Patients, &id)?;
        let prefix = format!("{}/", id);
        v.delete_prefix(Store::Reports, &prefix)?;
        v.delete_prefix(Store::Images, &prefix)?;
        if existed {
            Ok(())
        } else {
            Err(crate::storage::vault::VaultError::Corrupt("paciente no encontrado".into()))
        }
    });
    if result.is_ok() {
        audit::record(&app, &state, "patient.delete", &id);
    }
    result
}
