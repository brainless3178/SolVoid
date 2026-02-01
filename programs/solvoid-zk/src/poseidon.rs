use anchor_lang::prelude::*;
use light_poseidon::{Poseidon, PoseidonBytesHasher, PoseidonError};
use ark_bn254::Fr;

/// Production-grade on-chain Poseidon implementation using light-poseidon.
/// 
/// This implementation uses the BN254 curve scalar field (Fr) which matches
/// the circomlib Poseidon implementation used in our ZK circuits.
/// 
/// The light-poseidon crate is optimized for Solana BPF:
/// - Uses heap allocation to avoid stack overflow
/// - Minimal compute unit usage (~10k CU per hash)
/// - Compatible with BN254 field elements
pub struct PoseidonHasherWrapper;

/// Convert a PoseidonError to an Anchor error
fn poseidon_error_to_anchor(_e: PoseidonError) -> Error {
    Error::from(crate::PrivacyError::PoseidonHashFailed)
}

impl PoseidonHasherWrapper {
    /// Executes a dual-input hash operation (Arity 2).
    /// Used for Merkle tree node computation.
    /// 
    /// This matches the circomlib Poseidon(2) used in merkleTree.circom:
    /// `hashers[i] = Poseidon(2);`
    pub fn hash_two_bytes(a: &[u8; 32], b: &[u8; 32]) -> Result<[u8; 32]> {
        // Create Poseidon hasher with width 3 (2 inputs + 1 capacity)
        // This matches circomlib's Poseidon(2)
        let mut poseidon = Poseidon::<Fr>::new_circom(2)
            .map_err(poseidon_error_to_anchor)?;
        
        // Hash the two inputs
        // light-poseidon uses big-endian bytes which matches circomlib
        let result = poseidon.hash_bytes_be(&[a, b])
            .map_err(poseidon_error_to_anchor)?;
        
        Ok(result)
    }
    
    /// Executes a triple-input hash operation (Arity 3).
    /// Used for commitment computation: H(secret, nullifier, amount).
    /// 
    /// This matches the circomlib Poseidon(3) used in withdraw.circom:
    /// `component commitmentHasher = Poseidon(3);`
    pub fn hash_three_bytes(a: &[u8; 32], b: &[u8; 32], c: &[u8; 32]) -> Result<[u8; 32]> {
        // Create Poseidon hasher with width 4 (3 inputs + 1 capacity)
        let mut poseidon = Poseidon::<Fr>::new_circom(3)
            .map_err(poseidon_error_to_anchor)?;
        
        let result = poseidon.hash_bytes_be(&[a, b, c])
            .map_err(poseidon_error_to_anchor)?;
        
        Ok(result)
    }
    
    /// Computes the nullifier hash: H(nullifier, salt).
    /// 
    /// This matches the circuit:
    /// `nullifierHasher.inputs[0] <== nullifier;`
    /// `nullifierHasher.inputs[1] <== 1;` // salt
    pub fn compute_nullifier_hash(nullifier: &[u8; 32]) -> Result<[u8; 32]> {
        // Salt value of 1 as specified in the circuit
        let mut salt = [0u8; 32];
        salt[31] = 1; // Big-endian representation of 1
        
        Self::hash_two_bytes(nullifier, &salt)
    }
    
    /// Computes the commitment: H(secret, nullifier, amount).
    /// 
    /// This matches the circuit:
    /// `commitmentHasher.inputs[0] <== secret;`
    /// `commitmentHasher.inputs[1] <== nullifier;`
    /// `commitmentHasher.inputs[2] <== amount;`
    pub fn compute_commitment(
        secret: &[u8; 32],
        nullifier: &[u8; 32],
        amount: u64,
    ) -> Result<[u8; 32]> {
        // Convert amount to 32-byte big-endian representation
        let mut amount_bytes = [0u8; 32];
        amount_bytes[24..32].copy_from_slice(&amount.to_be_bytes());
        
        Self::hash_three_bytes(secret, nullifier, &amount_bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_poseidon_hash_two() {
        let a = [0u8; 32];
        let b = [0u8; 32];
        
        let result = PoseidonHasherWrapper::hash_two_bytes(&a, &b);
        assert!(result.is_ok());
        
        // Hash of two zeros should be deterministic
        let hash = result.unwrap();
        assert_ne!(hash, [0u8; 32]); // Should not be zero
    }
    
    #[test]
    fn test_poseidon_hash_three() {
        let a = [1u8; 32];
        let b = [2u8; 32];
        let c = [3u8; 32];
        
        let result = PoseidonHasherWrapper::hash_three_bytes(&a, &b, &c);
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_poseidon_deterministic() {
        let a = [1u8; 32];
        let b = [2u8; 32];
        
        let result1 = PoseidonHasherWrapper::hash_two_bytes(&a, &b).unwrap();
        let result2 = PoseidonHasherWrapper::hash_two_bytes(&a, &b).unwrap();
        
        assert_eq!(result1, result2);
    }
    
    #[test]
    fn test_nullifier_hash() {
        let nullifier = [42u8; 32];
        let result = PoseidonHasherWrapper::compute_nullifier_hash(&nullifier);
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_commitment() {
        let secret = [1u8; 32];
        let nullifier = [2u8; 32];
        let amount = 1_000_000_000u64; // 1 SOL in lamports
        
        let result = PoseidonHasherWrapper::compute_commitment(&secret, &nullifier, amount);
        assert!(result.is_ok());
    }
}
