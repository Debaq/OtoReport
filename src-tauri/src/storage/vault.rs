// Vault cifrado de OtoReport
//
// Contenedor único `oto.vault` (redb, pure-Rust → corre igual en desktop y Android/iOS).
// redb NO cifra: guardamos solo blobs AES-256-GCM. Las claves de redb son UUIDs o
// HMAC(rut) — sin PII. Los valores (JSON clínico, imágenes) van cifrados.
//
// Esquema de claves (patrón DEK+KEK):
//   password --Argon2id(salt)--> KEK --desenvuelve--> DEK (random, 32B)
//   DEK cifra cada registro. Cambiar password solo re-envuelve la DEK.
//   El DEK envuelto ES el verificador: si el password es malo, el tag GCM falla.

use crate::crypto::{self, KEY_LEN, SALT_LEN};
use hmac::{Hmac, Mac};
use redb::{Database, ReadableTable, TableDefinition};
use sha2::Sha256;
use std::path::Path;
use std::sync::Mutex;
use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

type HmacSha256 = Hmac<Sha256>;

// Tablas redb. Valores = blob [nonce(12) || ciphertext+tag].
const META: TableDefinition<&str, &[u8]> = TableDefinition::new("meta");
const PATIENTS: TableDefinition<&str, &[u8]> = TableDefinition::new("patients");
const REPORTS: TableDefinition<&str, &[u8]> = TableDefinition::new("reports");
const IMAGES: TableDefinition<&str, &[u8]> = TableDefinition::new("images");
const RUT_INDEX: TableDefinition<&str, &str> = TableDefinition::new("rut_index");
const AUDIT: TableDefinition<u64, &[u8]> = TableDefinition::new("audit_log");

// Meta keys.
const META_SALT: &str = "salt";
const META_WRAPPED_DEK: &str = "wrapped_dek";
const META_VERSION: &str = "version";

const AAD_DEK: &[u8] = b"oto-dek-v1";
const SCHEMA_VERSION: u32 = 1;

/// Espacios de almacenamiento expuestos al resto del backend (oculta redb).
#[derive(Clone, Copy)]
pub enum Store {
    Patients,
    Reports,
    Images,
}

impl Store {
    fn table(self) -> TableDefinition<'static, &'static str, &'static [u8]> {
        match self {
            Store::Patients => PATIENTS,
            Store::Reports => REPORTS,
            Store::Images => IMAGES,
        }
    }
    fn ns(self) -> &'static str {
        match self {
            Store::Patients => "patients",
            Store::Reports => "reports",
            Store::Images => "images",
        }
    }
}

#[derive(Debug, Error)]
pub enum VaultError {
    #[error("vault bloqueado")]
    Locked,
    #[error("contraseña incorrecta")]
    WrongPassword,
    #[error("error de base de datos: {0}")]
    Db(String),
    #[error("error criptográfico: {0}")]
    Crypto(String),
    #[error("vault corrupto: {0}")]
    Corrupt(String),
}

impl From<crypto::CryptoError> for VaultError {
    fn from(e: crypto::CryptoError) -> Self {
        VaultError::Crypto(e.to_string())
    }
}

// Convierte cualquier error de redb a Db(String) (redb tiene ~6 tipos de error).
macro_rules! db {
    ($e:expr) => {
        ($e).map_err(|err| VaultError::Db(err.to_string()))?
    };
}

/// Claves secretas vivas en memoria; se borran al drop.
#[derive(Zeroize, ZeroizeOnDrop)]
struct SecretKeys {
    dek: [u8; KEY_LEN],
    mac_key: [u8; KEY_LEN], // para el índice ciego HMAC(rut)
}

fn derive_secret_keys(dek: &[u8]) -> SecretKeys {
    let mut d = [0u8; KEY_LEN];
    d.copy_from_slice(dek);
    // mac_key = HMAC(dek, "oto-blind-index-v1") — subclave dedicada, no reusa la DEK.
    let mut mac = HmacSha256::new_from_slice(dek).expect("hmac acepta cualquier largo de clave");
    mac.update(b"oto-blind-index-v1");
    let out = mac.finalize().into_bytes();
    let mut m = [0u8; KEY_LEN];
    m.copy_from_slice(&out);
    SecretKeys { dek: d, mac_key: m }
}

fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

/// Vault abierto (desbloqueado): handle de redb + claves en RAM.
pub struct Vault {
    db: Database,
    keys: SecretKeys,
}

impl Vault {
    /// Crea un vault nuevo con la contraseña dada. Falla si el archivo ya existe.
    pub fn setup(path: &Path, password: &[u8]) -> Result<Self, VaultError> {
        let db = db!(Database::create(path));
        let salt = crypto::random_bytes(SALT_LEN);
        let kek = crypto::derive_key(password, &salt)?;
        let dek = crypto::random_bytes(KEY_LEN);
        let wrapped = crypto::aead_seal(&kek.0, &dek, AAD_DEK)?.to_bytes();

        let txn = db!(db.begin_write());
        {
            let mut t = db!(txn.open_table(META));
            db!(t.insert(META_SALT, salt.as_slice()));
            db!(t.insert(META_WRAPPED_DEK, wrapped.as_slice()));
            db!(t.insert(META_VERSION, SCHEMA_VERSION.to_le_bytes().as_slice()));
        }
        db!(txn.commit());

        Ok(Vault { db, keys: derive_secret_keys(&dek) })
    }

    /// Abre un vault existente verificando la contraseña.
    pub fn unlock(path: &Path, password: &[u8]) -> Result<Self, VaultError> {
        let db = db!(Database::open(path));
        let (salt, wrapped) = {
            let txn = db!(db.begin_read());
            let t = db!(txn.open_table(META));
            let salt = db!(t.get(META_SALT))
                .ok_or_else(|| VaultError::Corrupt("falta salt".into()))?
                .value()
                .to_vec();
            let wrapped = db!(t.get(META_WRAPPED_DEK))
                .ok_or_else(|| VaultError::Corrupt("falta wrapped_dek".into()))?
                .value()
                .to_vec();
            (salt, wrapped)
        };

        let kek = crypto::derive_key(password, &salt)?;
        let sealed = crypto::Sealed::from_bytes(&wrapped)
            .map_err(|e| VaultError::Corrupt(e.to_string()))?;
        // Si la KEK es incorrecta (password malo), el tag GCM falla aquí.
        let dek = crypto::aead_open(&kek.0, &sealed.nonce, &sealed.ciphertext, AAD_DEK)
            .map_err(|_| VaultError::WrongPassword)?;

        Ok(Vault { db, keys: derive_secret_keys(&dek) })
    }

    /// Re-envuelve la DEK con una contraseña nueva (no re-cifra los datos).
    pub fn change_password(&self, new_password: &[u8]) -> Result<(), VaultError> {
        let new_salt = crypto::random_bytes(SALT_LEN);
        let new_kek = crypto::derive_key(new_password, &new_salt)?;
        let wrapped = crypto::aead_seal(&new_kek.0, &self.keys.dek, AAD_DEK)?.to_bytes();

        let txn = db!(self.db.begin_write());
        {
            let mut t = db!(txn.open_table(META));
            db!(t.insert(META_SALT, new_salt.as_slice()));
            db!(t.insert(META_WRAPPED_DEK, wrapped.as_slice()));
        }
        db!(txn.commit());
        Ok(())
    }

    // --- AEAD helpers (AAD liga el ciphertext a su ubicación) ---

    fn aad(ns: &str, key: &str) -> Vec<u8> {
        let mut v = Vec::with_capacity(ns.len() + 1 + key.len());
        v.extend_from_slice(ns.as_bytes());
        v.push(b':');
        v.extend_from_slice(key.as_bytes());
        v
    }

    fn seal(&self, aad: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, VaultError> {
        Ok(crypto::aead_seal(&self.keys.dek, plaintext, aad)?.to_bytes())
    }

    fn open(&self, aad: &[u8], blob: &[u8]) -> Result<Vec<u8>, VaultError> {
        let s = crypto::Sealed::from_bytes(blob).map_err(|e| VaultError::Corrupt(e.to_string()))?;
        Ok(crypto::aead_open(&self.keys.dek, &s.nonce, &s.ciphertext, aad)?)
    }

    // --- API genérica cifrada (la usa el paso 4: patients/reports/images) ---

    pub fn put(&self, store: Store, key: &str, plaintext: &[u8]) -> Result<(), VaultError> {
        let blob = self.seal(&Self::aad(store.ns(), key), plaintext)?;
        let txn = db!(self.db.begin_write());
        {
            let mut t = db!(txn.open_table(store.table()));
            db!(t.insert(key, blob.as_slice()));
        }
        db!(txn.commit());
        Ok(())
    }

    pub fn get(&self, store: Store, key: &str) -> Result<Option<Vec<u8>>, VaultError> {
        let txn = db!(self.db.begin_read());
        let t = match txn.open_table(store.table()) {
            Ok(t) => t,
            Err(redb::TableError::TableDoesNotExist(_)) => return Ok(None),
            Err(e) => return Err(VaultError::Db(e.to_string())),
        };
        match db!(t.get(key)) {
            Some(g) => Ok(Some(self.open(&Self::aad(store.ns(), key), g.value())?)),
            None => Ok(None),
        }
    }

    pub fn delete(&self, store: Store, key: &str) -> Result<bool, VaultError> {
        let txn = db!(self.db.begin_write());
        let existed = {
            let mut t = db!(txn.open_table(store.table()));
            let removed = db!(t.remove(key)).is_some();
            removed
        };
        db!(txn.commit());
        Ok(existed)
    }

    /// Todos los registros de un store, descifrados: (key, plaintext).
    pub fn list(&self, store: Store) -> Result<Vec<(String, Vec<u8>)>, VaultError> {
        self.list_prefix(store, "")
    }

    /// Registros cuya key empieza con `prefix`, descifrados.
    pub fn list_prefix(
        &self,
        store: Store,
        prefix: &str,
    ) -> Result<Vec<(String, Vec<u8>)>, VaultError> {
        let txn = db!(self.db.begin_read());
        let t = match txn.open_table(store.table()) {
            Ok(t) => t,
            Err(redb::TableError::TableDoesNotExist(_)) => return Ok(Vec::new()),
            Err(e) => return Err(VaultError::Db(e.to_string())),
        };
        let mut out = Vec::new();
        for item in db!(t.iter()) {
            let (k, v) = db!(item);
            let key = k.value().to_string();
            if !prefix.is_empty() && !key.starts_with(prefix) {
                continue;
            }
            let pt = self.open(&Self::aad(store.ns(), &key), v.value())?;
            out.push((key, pt));
        }
        Ok(out)
    }

    /// Borra todos los registros de un store cuya key empieza con `prefix`.
    /// Devuelve cuántos borró. Usado para cascada (borrar paciente) y limpieza.
    pub fn delete_prefix(&self, store: Store, prefix: &str) -> Result<usize, VaultError> {
        let keys: Vec<String> = {
            let txn = db!(self.db.begin_read());
            let t = match txn.open_table(store.table()) {
                Ok(t) => t,
                Err(redb::TableError::TableDoesNotExist(_)) => return Ok(0),
                Err(e) => return Err(VaultError::Db(e.to_string())),
            };
            let mut ks = Vec::new();
            for item in db!(t.iter()) {
                let (k, _) = db!(item);
                let key = k.value().to_string();
                if prefix.is_empty() || key.starts_with(prefix) {
                    ks.push(key);
                }
            }
            ks
        };
        let mut n = 0;
        let txn = db!(self.db.begin_write());
        {
            let mut t = db!(txn.open_table(store.table()));
            for k in &keys {
                if db!(t.remove(k.as_str())).is_some() {
                    n += 1;
                }
            }
        }
        db!(txn.commit());
        Ok(n)
    }

    // --- Índice ciego de RUT (busca por RUT sin descifrar todos los pacientes) ---

    /// Token determinístico HMAC(mac_key, rut). No reversible sin la clave.
    pub fn blind_index(&self, value: &str) -> String {
        let mut mac =
            HmacSha256::new_from_slice(&self.keys.mac_key).expect("hmac acepta cualquier clave");
        mac.update(value.as_bytes());
        hex(&mac.finalize().into_bytes())
    }

    pub fn set_rut_index(&self, rut_token: &str, patient_id: &str) -> Result<(), VaultError> {
        let txn = db!(self.db.begin_write());
        {
            let mut t = db!(txn.open_table(RUT_INDEX));
            db!(t.insert(rut_token, patient_id));
        }
        db!(txn.commit());
        Ok(())
    }

    pub fn get_rut_index(&self, rut_token: &str) -> Result<Option<String>, VaultError> {
        let txn = db!(self.db.begin_read());
        let t = match txn.open_table(RUT_INDEX) {
            Ok(t) => t,
            Err(redb::TableError::TableDoesNotExist(_)) => return Ok(None),
            Err(e) => return Err(VaultError::Db(e.to_string())),
        };
        Ok(db!(t.get(rut_token)).map(|g| g.value().to_string()))
    }

    pub fn delete_rut_index(&self, rut_token: &str) -> Result<bool, VaultError> {
        let txn = db!(self.db.begin_write());
        let existed = {
            let mut t = db!(txn.open_table(RUT_INDEX));
            let removed = db!(t.remove(rut_token)).is_some();
            removed
        };
        db!(txn.commit());
        Ok(existed)
    }

    // --- Audit log (trazabilidad ley 21.719). Entrada = JSON ya serializado. ---

    pub fn append_audit(&self, entry: &[u8]) -> Result<(), VaultError> {
        let txn = db!(self.db.begin_write());
        {
            let mut t = db!(txn.open_table(AUDIT));
            let next = match db!(t.last()) {
                Some((k, _)) => k.value() + 1,
                None => 0,
            };
            // La entrada va cifrada (revela qué pacientes se accedieron).
            let aad = Self::aad("audit", &next.to_string());
            let blob = self.seal(&aad, entry)?;
            db!(t.insert(next, blob.as_slice()));
        }
        db!(txn.commit());
        Ok(())
    }

    /// Todas las entradas de auditoría descifradas, en orden cronológico.
    pub fn list_audit(&self) -> Result<Vec<Vec<u8>>, VaultError> {
        let txn = db!(self.db.begin_read());
        let t = match txn.open_table(AUDIT) {
            Ok(t) => t,
            Err(redb::TableError::TableDoesNotExist(_)) => return Ok(Vec::new()),
            Err(e) => return Err(VaultError::Db(e.to_string())),
        };
        let mut out = Vec::new();
        for item in db!(t.iter()) {
            let (k, val) = db!(item);
            let aad = Self::aad("audit", &k.value().to_string());
            out.push(self.open(&aad, val.value())?);
        }
        Ok(out)
    }
}

/// Estado Tauri: el vault desbloqueado vive aquí durante la sesión.
#[derive(Default)]
pub struct VaultState(pub Mutex<Option<Vault>>);

impl VaultState {
    /// Ejecuta `f` con el vault desbloqueado. Error "bloqueado" si no hay sesión.
    /// Mapea cualquier `VaultError` a `String` para los comandos Tauri.
    pub fn with<T>(
        &self,
        f: impl FnOnce(&Vault) -> Result<T, VaultError>,
    ) -> Result<T, String> {
        let guard = self.0.lock().map_err(|_| "estado del vault envenenado".to_string())?;
        let vault = guard.as_ref().ok_or(VaultError::Locked).map_err(|e| e.to_string())?;
        f(vault).map_err(|e| e.to_string())
    }

    pub fn lock_vault(&self) {
        // Reemplazar por None hace drop del Vault → zeroize de las claves.
        if let Ok(mut g) = self.0.lock() {
            *g = None;
        }
    }
    pub fn is_unlocked(&self) -> bool {
        self.0.lock().map(|g| g.is_some()).unwrap_or(false)
    }
}

// ---------------- Tests ----------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    struct TempVault(std::path::PathBuf);
    impl TempVault {
        fn new() -> Self {
            let n = COUNTER.fetch_add(1, Ordering::SeqCst);
            let p = std::env::temp_dir().join(format!("oto_test_{}_{}.vault", std::process::id(), n));
            let _ = std::fs::remove_file(&p);
            TempVault(p)
        }
    }
    impl Drop for TempVault {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }

    #[test]
    fn setup_then_unlock_ok() {
        let tv = TempVault::new();
        {
            let v = Vault::setup(&tv.0, b"clave-correcta").unwrap();
            v.put(Store::Patients, "p1", b"datos paciente").unwrap();
        }
        let v = Vault::unlock(&tv.0, b"clave-correcta").unwrap();
        let got = v.get(Store::Patients, "p1").unwrap().unwrap();
        assert_eq!(got, b"datos paciente");
    }

    #[test]
    fn wrong_password_rejected() {
        let tv = TempVault::new();
        Vault::setup(&tv.0, b"correcta").unwrap();
        let err = Vault::unlock(&tv.0, b"incorrecta");
        assert!(matches!(err, Err(VaultError::WrongPassword)));
    }

    #[test]
    fn change_password_keeps_data() {
        let tv = TempVault::new();
        {
            let v = Vault::setup(&tv.0, b"vieja").unwrap();
            v.put(Store::Reports, "p1/s1", b"reporte").unwrap();
            v.change_password(b"nueva").unwrap();
        }
        assert!(matches!(Vault::unlock(&tv.0, b"vieja"), Err(VaultError::WrongPassword)));
        let v = Vault::unlock(&tv.0, b"nueva").unwrap();
        assert_eq!(v.get(Store::Reports, "p1/s1").unwrap().unwrap(), b"reporte");
    }

    #[test]
    fn aad_binding_detects_moved_blob() {
        // Un blob cifrado para una key no debe descifrar bajo otra (AAD distinto).
        let tv = TempVault::new();
        let v = Vault::setup(&tv.0, b"pw").unwrap();
        let aad1 = Vault::aad("patients", "p1");
        let blob = v.seal(&aad1, b"x").unwrap();
        let aad2 = Vault::aad("patients", "p2");
        assert!(v.open(&aad2, &blob).is_err());
        assert_eq!(v.open(&aad1, &blob).unwrap(), b"x");
    }

    #[test]
    fn list_and_prefix() {
        let tv = TempVault::new();
        let v = Vault::setup(&tv.0, b"pw").unwrap();
        v.put(Store::Reports, "pa/s1", b"a1").unwrap();
        v.put(Store::Reports, "pa/s2", b"a2").unwrap();
        v.put(Store::Reports, "pb/s1", b"b1").unwrap();
        assert_eq!(v.list(Store::Reports).unwrap().len(), 3);
        let pa = v.list_prefix(Store::Reports, "pa/").unwrap();
        assert_eq!(pa.len(), 2);
    }

    #[test]
    fn delete_works() {
        let tv = TempVault::new();
        let v = Vault::setup(&tv.0, b"pw").unwrap();
        v.put(Store::Patients, "p1", b"x").unwrap();
        assert!(v.delete(Store::Patients, "p1").unwrap());
        assert!(v.get(Store::Patients, "p1").unwrap().is_none());
        assert!(!v.delete(Store::Patients, "p1").unwrap());
    }

    #[test]
    fn blind_index_lookup() {
        let tv = TempVault::new();
        let v = Vault::setup(&tv.0, b"pw").unwrap();
        let token = v.blind_index("16316711-5");
        v.set_rut_index(&token, "patient-uuid").unwrap();
        assert_eq!(v.get_rut_index(&token).unwrap().as_deref(), Some("patient-uuid"));
        // El token no contiene el RUT en claro.
        assert!(!token.contains("16316711"));
        // Determinístico.
        assert_eq!(token, v.blind_index("16316711-5"));
    }

    #[test]
    fn audit_appends_in_order() {
        let tv = TempVault::new();
        let v = Vault::setup(&tv.0, b"pw").unwrap();
        v.append_audit(b"e0").unwrap();
        v.append_audit(b"e1").unwrap();
        let entries = v.list_audit().unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0], b"e0");
        assert_eq!(entries[1], b"e1");
        // En disco la entrada está cifrada (no aparece el texto plano).
        let txn = v.db.begin_read().unwrap();
        let t = txn.open_table(AUDIT).unwrap();
        let raw = t.get(0u64).unwrap().unwrap();
        assert_ne!(raw.value(), b"e0");
    }
}
