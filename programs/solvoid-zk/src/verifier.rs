use anchor_lang::prelude::*;
use groth16_solana::groth16::Groth16Verifier;
use groth16_solana::groth16::Groth16Verifyingkey;

pub fn verify_withdraw_proof(
    proof_data: &ProofData,
    public_inputs: &[[u8; 32]; 8],
    vk_data: &VerifierState,
) -> Result<bool> {
    
    let vk = Groth16Verifyingkey {
        nr_pubinputs: 8,
        vk_alpha_g1: vk_data.vk_alpha_g1,
        vk_beta_g2: vk_data.vk_beta_g2,
        vk_gamme_g2: vk_data.vk_gamma_g2,
        vk_delta_g2: vk_data.vk_delta_g2,
        vk_ic: &vk_data.vk_ic,
    };

    let mut verifier = Groth16Verifier::new(
        &proof_data.proof_a_g1,
        &proof_data.proof_b_g2,
        &proof_data.proof_c_g1,
        public_inputs,
        &vk,
    ).map_err(|_| ProgramError::InvalidInstructionData)?;

    verifier.verify().map_err(|_| ProgramError::InvalidInstructionData)?;
    Ok(true)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct ProofData {
    pub proof_a_g1: [u8; 64],
    pub proof_b_g2: [u8; 128],
    pub proof_c_g1: [u8; 64],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct VerificationKeyData {
    pub alpha_g1: [u8; 64],
    pub beta_g2: [u8; 128],
    pub gamma_g2: [u8; 128],
    pub delta_g2: [u8; 128],
    pub ic_g1: Vec<[u8; 64]>,
}

#[account]
pub struct VerifierState {
    pub is_initialized: bool,
    pub vk_alpha_g1: [u8; 64],
    pub vk_beta_g2: [u8; 128],
    pub vk_gamma_g2: [u8; 128],
    pub vk_delta_g2: [u8; 128],
    pub vk_ic: Vec<[u8; 64]>,
}
