// Cripto core OtoReport
//
// - KDF: Argon2id, parámetros OWASP 2025 (m=64 MiB, t=3, p=4, salt 16B, key 32B).
// - AEAD: AES-256-GCM, nonce 96-bit aleatorio, tag 128-bit.
// - Salt y nonce siempre por OS CSPRNG (`OsRng`).
// - Las claves se zeroize al drop.
//
// Pure-Rust (aes-gcm, argon2): cruza a Android/iOS sin toolchain C/OpenSSL.
// Uso interno del backend; el frontend nunca ve material criptográfico.

use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Key, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

pub const SALT_LEN: usize = 16;
pub const KEY_LEN: usize = 32;
pub const NONCE_LEN: usize = 12;
#[allow(dead_code)]
pub const TAG_LEN: usize = 16;

// OWASP 2025 Argon2id recommendation.
pub const ARGON2_M_KIB: u32 = 65_536; // 64 MiB
pub const ARGON2_T: u32 = 3;
pub const ARGON2_P: u32 = 4;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("argon2 derivation failed: {0}")]
    Kdf(String),
    #[error("aead operation failed")]
    Aead,
    #[error("invalid input length: expected {expected}, got {got}")]
    InvalidLength { expected: usize, got: usize },
}

impl serde::Serialize for CryptoError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

/// Clave de 32 bytes que se borra de memoria al salir de scope.
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct DerivedKey(pub [u8; KEY_LEN]);

/// KDF Argon2id con parámetros OWASP 2025.
pub fn derive_key(password: &[u8], salt: &[u8]) -> Result<DerivedKey, CryptoError> {
    if salt.len() < 8 {
        return Err(CryptoError::InvalidLength { expected: SALT_LEN, got: salt.len() });
    }
    let params = Params::new(ARGON2_M_KIB, ARGON2_T, ARGON2_P, Some(KEY_LEN))
        .map_err(|e| CryptoError::Kdf(e.to_string()))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut out = [0u8; KEY_LEN];
    argon2
        .hash_password_into(password, salt, &mut out)
        .map_err(|e| CryptoError::Kdf(e.to_string()))?;
    Ok(DerivedKey(out))
}

/// n bytes aleatorios desde el CSPRNG del SO.
pub fn random_bytes(n: usize) -> Vec<u8> {
    let mut buf = vec![0u8; n];
    OsRng.fill_bytes(&mut buf);
    buf
}

/// Resultado de un sellado AEAD: nonce + ciphertext (tag GCM incluido al final).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sealed {
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>, // incluye tag GCM al final
}

impl Sealed {
    /// Serializa a un blob plano: [nonce(12)] || [ciphertext+tag].
    /// Formato de almacenamiento en el vault.
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(self.nonce.len() + self.ciphertext.len());
        out.extend_from_slice(&self.nonce);
        out.extend_from_slice(&self.ciphertext);
        out
    }

    /// Parsea un blob plano [nonce(12)] || [ciphertext+tag].
    pub fn from_bytes(blob: &[u8]) -> Result<Self, CryptoError> {
        if blob.len() < NONCE_LEN {
            return Err(CryptoError::InvalidLength { expected: NONCE_LEN, got: blob.len() });
        }
        let (nonce, ciphertext) = blob.split_at(NONCE_LEN);
        Ok(Sealed { nonce: nonce.to_vec(), ciphertext: ciphertext.to_vec() })
    }
}

/// AES-256-GCM seal. `aad` se autentica pero no se cifra.
pub fn aead_seal(key: &[u8], plaintext: &[u8], aad: &[u8]) -> Result<Sealed, CryptoError> {
    if key.len() != KEY_LEN {
        return Err(CryptoError::InvalidLength { expected: KEY_LEN, got: key.len() });
    }
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, Payload { msg: plaintext, aad })
        .map_err(|_| CryptoError::Aead)?;
    Ok(Sealed { nonce: nonce_bytes.to_vec(), ciphertext })
}

/// AES-256-GCM open. Falla si la clave, el nonce, el `aad` o el ciphertext
/// no coinciden (tag GCM inválido).
pub fn aead_open(
    key: &[u8],
    nonce: &[u8],
    ciphertext: &[u8],
    aad: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    if key.len() != KEY_LEN {
        return Err(CryptoError::InvalidLength { expected: KEY_LEN, got: key.len() });
    }
    if nonce.len() != NONCE_LEN {
        return Err(CryptoError::InvalidLength { expected: NONCE_LEN, got: nonce.len() });
    }
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    cipher
        .decrypt(Nonce::from_slice(nonce), Payload { msg: ciphertext, aad })
        .map_err(|_| CryptoError::Aead)
}

// ---------------- Tests ----------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn argon2id_deterministic_same_salt() {
        let salt = b"0123456789abcdef";
        let k1 = derive_key(b"correct horse battery", salt).unwrap();
        let k2 = derive_key(b"correct horse battery", salt).unwrap();
        assert_eq!(k1.0, k2.0);
        let k3 = derive_key(b"correct horse battery!", salt).unwrap();
        assert_ne!(k1.0, k3.0);
    }

    #[test]
    fn aead_roundtrip() {
        let salt = random_bytes(SALT_LEN);
        let key = derive_key(b"pw", &salt).unwrap();
        let pt = b"clinical data record".to_vec();
        let aad = b"patient:42".to_vec();
        let sealed = aead_seal(&key.0, &pt, &aad).unwrap();
        let opened = aead_open(&key.0, &sealed.nonce, &sealed.ciphertext, &aad).unwrap();
        assert_eq!(opened, pt);
    }

    #[test]
    fn sealed_blob_roundtrip() {
        let key = [9u8; KEY_LEN];
        let sealed = aead_seal(&key, b"report json bytes", b"reports/p/s").unwrap();
        let blob = sealed.to_bytes();
        let parsed = Sealed::from_bytes(&blob).unwrap();
        let opened = aead_open(&key, &parsed.nonce, &parsed.ciphertext, b"reports/p/s").unwrap();
        assert_eq!(opened, b"report json bytes");
    }

    #[test]
    fn aead_aad_tamper_rejected() {
        let key = [7u8; KEY_LEN];
        let sealed = aead_seal(&key, b"x", b"aad1").unwrap();
        let err = aead_open(&key, &sealed.nonce, &sealed.ciphertext, b"aad2");
        assert!(err.is_err());
    }

    #[test]
    fn aead_ciphertext_tamper_rejected() {
        let key = [7u8; KEY_LEN];
        let mut sealed = aead_seal(&key, b"x", b"").unwrap();
        sealed.ciphertext[0] ^= 0x01;
        let err = aead_open(&key, &sealed.nonce, &sealed.ciphertext, b"");
        assert!(err.is_err());
    }

    #[test]
    fn wrong_key_rejected() {
        let key = [7u8; KEY_LEN];
        let other = [8u8; KEY_LEN];
        let sealed = aead_seal(&key, b"x", b"").unwrap();
        let err = aead_open(&other, &sealed.nonce, &sealed.ciphertext, b"");
        assert!(err.is_err());
    }

    #[test]
    fn short_blob_rejected() {
        let err = Sealed::from_bytes(&[0u8; 4]);
        assert!(err.is_err());
    }
}
