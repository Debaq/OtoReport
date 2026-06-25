use crate::storage::vault::{Store, VaultError, VaultState};
use image::imageops::FilterType;
use image::{DynamicImage, ImageFormat, ImageReader};
use std::io::Cursor;
use tauri::State;
use uuid::Uuid;

/// Clave de imagen en el vault: `patient_id/session_id/side/filename`.
fn img_key(patient_id: &str, session_id: &str, side: &str, filename: &str) -> String {
    format!("{}/{}/{}/{}", patient_id, session_id, side, filename)
}

fn decode(data: &[u8]) -> Result<DynamicImage, String> {
    ImageReader::new(Cursor::new(data))
        .with_guessed_format()
        .map_err(|e| e.to_string())?
        .decode()
        .map_err(|e| e.to_string())
}

fn encode(img: &DynamicImage, fmt: ImageFormat) -> Result<Vec<u8>, String> {
    let mut buf = Cursor::new(Vec::new());
    img.write_to(&mut buf, fmt).map_err(|e| e.to_string())?;
    Ok(buf.into_inner())
}

fn thumb_bytes(img: &DynamicImage) -> Result<Vec<u8>, String> {
    encode(&img.resize(200, 200, FilterType::Triangle), ImageFormat::Jpeg)
}

#[tauri::command]
pub fn save_image(
    state: State<VaultState>,
    patient_id: String,
    session_id: String,
    side: String,
    image_data: Vec<u8>,
    extension: String,
) -> Result<(String, String), String> {
    let id = Uuid::new_v4().to_string();
    let filename = format!("{}.{}", id, extension);
    let thumb_filename = format!("{}_thumb.jpg", id);

    // Decodificar/generar thumbnail fuera del lock (CPU).
    let img = decode(&image_data)?;
    let thumb = thumb_bytes(&img)?;

    state.with(|v| {
        v.put(
            Store::Images,
            &img_key(&patient_id, &session_id, &side, &filename),
            &image_data,
        )?;
        v.put(
            Store::Images,
            &img_key(&patient_id, &session_id, &side, &thumb_filename),
            &thumb,
        )?;
        Ok(())
    })?;

    Ok((filename, thumb_filename))
}

#[tauri::command]
pub fn load_image(
    state: State<VaultState>,
    patient_id: String,
    session_id: String,
    side: String,
    filename: String,
) -> Result<Vec<u8>, String> {
    state.with(|v| {
        v.get(Store::Images, &img_key(&patient_id, &session_id, &side, &filename))?
            .ok_or_else(|| VaultError::Corrupt("imagen no encontrada".into()))
    })
}

#[tauri::command]
pub fn delete_image(
    state: State<VaultState>,
    patient_id: String,
    session_id: String,
    side: String,
    filename: String,
    thumbnail: String,
) -> Result<(), String> {
    state.with(|v| {
        let _ = v.delete(Store::Images, &img_key(&patient_id, &session_id, &side, &filename))?;
        let _ = v.delete(Store::Images, &img_key(&patient_id, &session_id, &side, &thumbnail))?;
        Ok(())
    })
}

#[tauri::command]
pub fn rotate_image(
    state: State<VaultState>,
    patient_id: String,
    session_id: String,
    side: String,
    filename: String,
    degrees: i32,
) -> Result<(), String> {
    let key = img_key(&patient_id, &session_id, &side, &filename);
    let data = state.with(|v| {
        v.get(Store::Images, &key)?
            .ok_or_else(|| VaultError::Corrupt("imagen no encontrada".into()))
    })?;

    let img = decode(&data)?;
    let rotated = match degrees % 360 {
        90 | -270 => img.rotate90(),
        180 | -180 => img.rotate180(),
        270 | -90 => img.rotate270(),
        _ => img,
    };

    // Re-codificar en el formato original (según la extensión del archivo).
    let ext = filename.rsplit_once('.').map(|(_, e)| e).unwrap_or("png");
    let fmt = ImageFormat::from_extension(ext).unwrap_or(ImageFormat::Png);
    let rotated_bytes = encode(&rotated, fmt)?;
    let thumb = thumb_bytes(&rotated)?;

    let stem = filename.rsplit_once('.').map(|(s, _)| s).unwrap_or(&filename);
    let thumb_key = img_key(&patient_id, &session_id, &side, &format!("{}_thumb.jpg", stem));

    state.with(|v| {
        v.put(Store::Images, &key, &rotated_bytes)?;
        v.put(Store::Images, &thumb_key, &thumb)?;
        Ok(())
    })
}

#[tauri::command]
pub fn move_image(
    state: State<VaultState>,
    patient_id: String,
    session_id: String,
    from_side: String,
    to_side: String,
    filename: String,
    thumbnail: String,
) -> Result<(), String> {
    state.with(|v| {
        for name in [&filename, &thumbnail] {
            let from = img_key(&patient_id, &session_id, &from_side, name);
            let to = img_key(&patient_id, &session_id, &to_side, name);
            if let Some(bytes) = v.get(Store::Images, &from)? {
                v.put(Store::Images, &to, &bytes)?;
                v.delete(Store::Images, &from)?;
            }
        }
        Ok(())
    })
}

#[tauri::command]
pub fn save_annotated(
    state: State<VaultState>,
    patient_id: String,
    session_id: String,
    side: String,
    filename: String,
    image_data: Vec<u8>,
) -> Result<(), String> {
    let stem = filename.rsplit_once('.').map(|(s, _)| s).unwrap_or(&filename);
    let annotated = format!("{}_annotated.png", stem);
    state.with(|v| {
        v.put(
            Store::Images,
            &img_key(&patient_id, &session_id, &side, &annotated),
            &image_data,
        )
    })
}
