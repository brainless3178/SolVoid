use anchor_lang::prelude::*;
use ark_bn254::Fr;
use ark_ff::{PrimeField, BigInteger};

pub mod poseidon;
pub mod economics;
pub mod verifier;
pub mod nullifier_set;

declare_id!("3QcKRYWquzbBR3UpKeh4aKVCSpoHy89UT8gyovzRzzan");

pub const MAX_ROOT_HISTORY: usize = 50;

#[program]
pub mod solvoid_zk {
    use super::*;
    use crate::economics::*;
    use crate::verifier::*;

    pub fn initialize(ctx: Context<Initialize>, authority: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = authority;
        state.is_initialized = true;
        state.leaf_count = 0;
        
        // Initialize subtrees with zero hashes for a depth-8 tree
        let mut current_zero = [0u8; 32];
        for i in 0..8 {
            state.filled_subtrees[i] = current_zero;
            // Hash two of the same zeros to get the zero for the next level
            current_zero = poseidon::PoseidonHasherWrapper::hash_two_bytes(&current_zero, &current_zero)?;
        }
        state.merkle_root = current_zero; // The root of an empty tree
        
        msg!("SolVoid Protocol Initialized. Root: {:?}", state.merkle_root);
        Ok(())
    }

    pub fn initialize_verifier(
        ctx: Context<InitializeVerifier>,
        vk: verifier::VerificationKeyData,
    ) -> Result<()> {
        let verifier_state = &mut ctx.accounts.verifier_state;
        verifier_state.vk_alpha_g1 = vk.alpha_g1;
        verifier_state.vk_beta_g2 = vk.beta_g2;
        verifier_state.vk_gamma_g2 = vk.gamma_g2;
        verifier_state.vk_delta_g2 = vk.delta_g2;
        verifier_state.vk_ic = vk.ic_g1;
        verifier_state.is_initialized = true;
        msg!("Withdrawal Verifier Key Initialized");
        Ok(())
    }

    pub fn initialize_root_history(ctx: Context<InitializeRootHistory>) -> Result<()> {
        let root_history = &mut ctx.accounts.root_history;
        root_history.current_index = 0;
        root_history.roots = [[0u8; 32]; MAX_ROOT_HISTORY];
        Ok(())
    }

    pub fn initialize_economics(ctx: Context<InitializeEconomics>) -> Result<()> {
        let economic_state = &mut ctx.accounts.economic_state;
        economic_state.authority = ctx.accounts.authority.key();
        economic_state.is_emergency_active = false;
        economic_state.emergency_multiplier = 1;
        economic_state.circuit_breaker_active = false;
        economic_state.circuit_breaker_threshold = 500_000_000; // 0.5 SOL
        economic_state.hourly_limit = 5_000_000_000; // 5 SOL
        economic_state.minimum_reserve = 100_000_000; // 0.1 SOL
        msg!("Economic Safety Layer Initialized");
        Ok(())
    }

    pub fn deposit(
        ctx: Context<Deposit>,
        commitment: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        require!(amount >= 1_000_000, PrivacyError::DepositTooSmall); // 0.001 SOL
        require!(amount <= 1_000_000_000_000, PrivacyError::DepositTooLarge); // 1000 SOL

        let state = &mut ctx.accounts.state;
        let root_history = &mut ctx.accounts.root_history;

        // Verify the commitment is a valid field element
        check_field_element(&commitment)?;

        // Update the Merkle tree with the new commitment
        let mut current_level_hash = commitment;
        let index = state.leaf_count;
        
        // Zeros for a depth-8 tree
        let mut zeros = [[0u8; 32]; 8];
        let mut z = [0u8; 32];
        for i in 0..8 {
            zeros[i] = z;
            z = poseidon::PoseidonHasherWrapper::hash_two_bytes(&z, &z)?;
        }

        for i in 0..8 {
            if (index >> i) & 1 == 0 {
                state.filled_subtrees[i] = current_level_hash;
                current_level_hash = poseidon::PoseidonHasherWrapper::hash_two_bytes(&current_level_hash, &zeros[i])?;
            } else {
                current_level_hash = poseidon::PoseidonHasherWrapper::hash_two_bytes(&state.filled_subtrees[i], &current_level_hash)?;
            }
        }

        state.merkle_root = current_level_hash;
        state.leaf_count += 1;

        // Update root history
        let idx = (root_history.current_index % MAX_ROOT_HISTORY as u64) as usize;
        root_history.roots[idx] = state.merkle_root;
        root_history.current_index += 1;

        // Perform the deposit transfer
        let cpi_accounts = anchor_lang::system_program::Transfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
        anchor_lang::system_program::transfer(cpi_ctx, amount)?;

        msg!("Deposit successful. Leaf: {}, New Root: {:?}", state.leaf_count - 1, state.merkle_root);
        Ok(())
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        proof: verifier::ProofData,
        root: [u8; 32],
        nullifier_hash: [u8; 32],
        recipient: Pubkey,
        relayer: Pubkey,
        fee: u64,
        amount: u64,
    ) -> Result<()> {
        // 1. Sanity Checks
        check_field_element(&root)?;
        check_field_element(&nullifier_hash)?;
        require_keys_eq!(ctx.accounts.recipient.key(), recipient, PrivacyError::RecipientMismatch);
        require_keys_eq!(ctx.accounts.relayer.key(), relayer, PrivacyError::RelayerMismatch);

        // 2. Validate Root against History
        let root_history = &ctx.accounts.root_history;
        let mut root_valid = false;
        let limit = root_history.current_index.min(MAX_ROOT_HISTORY as u64) as usize;
        for i in 0..limit {
            if root_history.roots[i] == root {
                root_valid = true;
                break;
            }
        }
        require!(root_valid, PrivacyError::InvalidRoot);

        // 3. Verify ZK-SNARK Proof
        let mut public_inputs = [[0u8; 32]; 8];
        public_inputs[0] = root;
        public_inputs[1] = nullifier_hash;
        
        // Recipient (64 bytes split across two field elements)
        let r_bytes = recipient.to_bytes();
        public_inputs[2].copy_from_slice(&r_bytes[0..32]); // low bits simulation
        
        // Relayer
        let rel_bytes = relayer.to_bytes();
        public_inputs[4].copy_from_slice(&rel_bytes[0..32]);
        
        let mut f_bytes = [0u8; 32];
        f_bytes[..8].copy_from_slice(&fee.to_le_bytes());
        public_inputs[6] = f_bytes;
        
        let mut a_bytes = [0u8; 32];
        a_bytes[..8].copy_from_slice(&amount.to_le_bytes());
        public_inputs[7] = a_bytes;

        let is_valid = verifier::verify_withdraw_proof(
            &proof,
            &public_inputs,
            &ctx.accounts.verifier_state,
        )?;
        require!(is_valid, PrivacyError::InvalidProof);

        // 4. Double Spend Protection (handled by PDA uniqueness in ctx)
        ctx.accounts.nullifier_account.is_used = true;

        // 5. Economic Safety Layer & Fees
        let economic_state = &mut ctx.accounts.economic_state;
        let current_time = Clock::get()?.unix_timestamp;
        
        let protocol_fee = economics::calculate_protocol_fee_atomic(
            amount, 
            economic_state, 
            current_time
        )?;

        // 6. Execute Transfer
        let total_outflow = amount;
        require!(
            ctx.accounts.vault.lamports() >= total_outflow,
            PrivacyError::InsufficientVaultBalance
        );

        let recipient_amount = amount.checked_sub(protocol_fee)
            .and_then(|a| a.checked_sub(fee))
            .ok_or(PrivacyError::ArithmeticError)?;

        // Perform split transfers directly from the vault PDA
        **ctx.accounts.vault.try_borrow_mut_lamports()? -= total_outflow;
        **ctx.accounts.recipient.try_borrow_mut_lamports()? += recipient_amount;
        **ctx.accounts.relayer.try_borrow_mut_lamports()? += fee;
        **ctx.accounts.protocol_fee_accumulator.try_borrow_mut_lamports()? += protocol_fee;

        msg!("Withdrawal completed successfully. Nullifier: {:?}", nullifier_hash);
        Ok(())
    }

    pub fn trigger_emergency_mode(
        ctx: Context<AdminControlWithEconomics>,
        multiplier: u64,
        reason: String,
    ) -> Result<()> {
        economics::trigger_emergency_mode(ctx, multiplier, reason)
    }

    pub fn disable_emergency_mode(ctx: Context<AdminControlWithEconomics>) -> Result<()> {
        economics::disable_emergency_mode(ctx)
    }

    pub fn trigger_circuit_breaker(ctx: Context<AdminControlWithEconomics>) -> Result<()> {
        economics::trigger_circuit_breaker(ctx)
    }

    pub fn reset_circuit_breaker(ctx: Context<AdminControlWithEconomics>) -> Result<()> {
        economics::reset_circuit_breaker(ctx)
    }
}

pub fn check_field_element(bytes: &[u8; 32]) -> Result<()> {
    // Check if bytes represent a valid BN254 field element
    let fr = Fr::from_le_bytes_mod_order(bytes);
    let normalized = fr.into_bigint().to_bytes_le();
    let mut normalized_32 = [0u8; 32];
    normalized_32[..normalized.len()].copy_from_slice(&normalized);
    
    require!(
        &normalized_32 == bytes,
        PrivacyError::InvalidFieldElement
    );
    Ok(())
}

#[account]
pub struct ProgramState {
    pub authority: Pubkey,
    pub merkle_root: [u8; 32],
    pub leaf_count: u64,
    pub filled_subtrees: [[u8; 32]; 8],
    pub is_initialized: bool,
}

impl ProgramState {
    pub const INIT_SPACE: usize = 32 + 32 + 8 + (32 * 8) + 1;
}

#[account]
pub struct RootHistory {
    pub roots: [[u8; 32]; MAX_ROOT_HISTORY],
    pub current_index: u64,
}

impl RootHistory {
    pub const SIZE: usize = 8 + (32 * MAX_ROOT_HISTORY) + 8;
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, 
        payer = authority, 
        space = 8 + ProgramState::INIT_SPACE,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, ProgramState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeVerifier<'info> {
    #[account(
        init, 
        payer = authority, 
        space = 8 + 2048, // VK is slightly larger for depth-20 IC
        seeds = [b"verifier", state.key().as_ref()],
        bump
    )]
    pub verifier_state: Account<'info, verifier::VerifierState>,
    pub state: Account<'info, ProgramState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeRootHistory<'info> {
    #[account(
        init,
        payer = authority,
        space = RootHistory::SIZE,
        seeds = [b"root_history"],
        bump
    )]
    pub root_history: Account<'info, RootHistory>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeEconomics<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + economics::EconomicState::SPACE,
        seeds = [b"economic_state"],
        bump
    )]
    pub economic_state: Account<'info, economics::EconomicState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Box<Account<'info, ProgramState>>,
    #[account(mut, seeds = [b"root_history"], bump)]
    pub root_history: Box<Account<'info, RootHistory>>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    /// CHECK: Vault account holding funds
    #[account(mut, seeds = [b"vault"], bump)]
    pub vault: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(
    proof: verifier::ProofData,
    root: [u8; 32],
    nullifier_hash: [u8; 32],
)]
pub struct Withdraw<'info> {
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Box<Account<'info, ProgramState>>,
    /// CHECK: Vault account holding funds
    #[account(mut, seeds = [b"vault"], bump)]
    pub vault: AccountInfo<'info>,
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    #[account(mut)]
    pub relayer: Signer<'info>,
    /// CHECK: Protocol fee treasury
    #[account(mut, seeds = [b"treasury"], bump)]
    pub protocol_fee_accumulator: AccountInfo<'info>,
    #[account(seeds = [b"verifier", state.key().as_ref()], bump)]
    pub verifier_state: Box<Account<'info, verifier::VerifierState>>,
    #[account(seeds = [b"root_history"], bump)]
    pub root_history: Box<Account<'info, RootHistory>>,
    #[account(
        init,
        payer = relayer,
        space = nullifier_set::NullifierAccount::SIZE,
        seeds = [b"nullifier", nullifier_hash.as_ref()],
        bump
    )]
    pub nullifier_account: Account<'info, nullifier_set::NullifierAccount>,
    #[account(mut, seeds = [b"economic_state"], bump)]
    pub economic_state: Box<Account<'info, economics::EconomicState>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminControlWithEconomics<'info> {
    #[account(
        mut,
        has_one = authority @ PrivacyError::Unauthorized,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, ProgramState>,
    #[account(mut, seeds = [b"economic_state"], bump)]
    pub economic_state: Account<'info, economics::EconomicState>,
    pub authority: Signer<'info>,
}

#[error_code]
pub enum PrivacyError {
    #[msg("Recipient address does not match proof")]
    RecipientMismatch,
    #[msg("Relayer address does not match proof")]
    RelayerMismatch,
    #[msg("Invalid ZK proof")]
    InvalidProof,
    #[msg("Nullifier already used")]
    NullifierAlreadyUsed,
    #[msg("Arithmetic overflow or underflow")]
    ArithmeticError,
    #[msg("Deposit amount too small")]
    DepositTooSmall,
    #[msg("Deposit amount too large")]
    DepositTooLarge,
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Provided root is not in historical registry")]
    InvalidRoot,
    #[msg("Input is not a valid BN254 field element")]
    InvalidFieldElement,
    #[msg("Multiplier out of range")]
    InvalidMultiplier,
    #[msg("Rate limit exceeded")]
    RateLimitExceeded,
    #[msg("Poseidon hash computation failed")]
    PoseidonHashFailed,
}
