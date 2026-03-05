use std::io::Write;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

#[tauri::command]
pub fn create_contribution_zip(
    image_data: Vec<u8>,
    image_filename: String,
    annotations_json: String,
    metadata_json: String,
    save_path: String,
) -> Result<(), String> {
    let file = std::fs::File::create(&save_path).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    zip.start_file(&image_filename, options)
        .map_err(|e| e.to_string())?;
    zip.write_all(&image_data).map_err(|e| e.to_string())?;

    zip.start_file("annotations.json", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(annotations_json.as_bytes())
        .map_err(|e| e.to_string())?;

    zip.start_file("metadata.json", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(metadata_json.as_bytes())
        .map_err(|e| e.to_string())?;

    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}
