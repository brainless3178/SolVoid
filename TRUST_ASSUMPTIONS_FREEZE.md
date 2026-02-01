# SolVoid Trust Assumptions Document

**Version:** 1.0.0  
**Last Updated:** 2026-02-01  
**Status:** FROZEN FOR AUDIT

---

## Executive Summary

This document specifies the security assumptions underlying the SolVoid privacy protocol. All parties interacting with the protocol must understand and accept these assumptions before use.

---

## 1. Cryptographic Assumptions

### 1.1 ZK-SNARK Security (Groth16)

**Assumption:** The Groth16 proving system is computationally secure under the following conditions:

- **Knowledge of Exponent (KEA):** Adversaries cannot produce valid proofs without knowing the witness
- **Discrete Logarithm Problem (DLP):** Computing discrete logs in the BN254 curve group is computationally infeasible
- **Trusted Setup Integrity:** The Powers of Tau ceremony was conducted honestly with at least one honest participant destroying their toxic waste

**Risk Level:** LOW  
**Mitigation:** We use the Hermez Powers of Tau ceremony (2^14) with 100+ participants

### 1.2 Poseidon Hash Function

**Assumption:** The Poseidon hash function provides:

- **Collision Resistance:** Finding two distinct inputs with the same hash is computationally infeasible
- **Preimage Resistance:** Recovering inputs from hash output is computationally infeasible
- **Second Preimage Resistance:** Given input x, finding x' ≠ x with H(x) = H(x') is infeasible

**Risk Level:** LOW  
**Mitigation:** Poseidon is specifically designed for ZK circuits and has undergone extensive cryptanalysis

### 1.3 BN254 Curve Security

**Assumption:** The BN254 (alt_bn128) elliptic curve provides ~100 bits of security

**Risk Level:** MEDIUM  
**Note:** BN254 security has been reduced from initial 128-bit estimates. We accept this for efficiency on Solana.

---

## 2. Protocol Assumptions

### 2.1 Merkle Tree Integrity

**Assumption:** The on-chain Merkle tree accurately represents all deposits

- Root history (50 roots) prevents race conditions during proof generation
- Tree depth of 8 supports up to 256 deposits per pool
- Filled subtrees are correctly maintained across deposits

**Risk Level:** LOW  
**Mitigation:** Deterministic tree construction with on-chain verification

### 2.2 Nullifier Uniqueness

**Assumption:** Each commitment can only be withdrawn once

- Nullifier accounts are unique PDAs derived from nullifier hash
- Account initialization fails if nullifier already exists
- No nullifier can be reused across withdrawals

**Risk Level:** LOW  
**Mitigation:** PDA uniqueness enforced by Solana runtime

### 2.3 Binding Signal Integrity

**Assumption:** ZK proofs bind the following to prevent theft:

- `recipient`: Funds can only go to the address in the proof
- `relayer`: Only the specified relayer can submit the transaction
- `fee`: Relayer fee is fixed at proof generation time
- `amount`: Withdrawal amount matches the deposit amount

**Risk Level:** LOW  
**Mitigation:** All signals are public inputs verified on-chain

---

## 3. Infrastructure Assumptions

### 3.1 Solana Network

**Assumption:** The Solana blockchain operates correctly

- Transactions are finalized within reasonable time (~400ms)
- State transitions are atomic and consistent
- PDA derivation is deterministic and collision-free

**Risk Level:** LOW  
**Mitigation:** Standard Solana security guarantees apply

### 3.2 RPC Provider Trust

**Assumption:** RPC providers return accurate blockchain state

- Merkle roots fetched from RPC are accurate
- Transaction simulation results are reliable
- No RPC-level censorship or manipulation

**Risk Level:** MEDIUM  
**Mitigation:** Users should verify state across multiple RPC endpoints

### 3.3 Relayer Availability

**Assumption:** Relayers are available but not trusted with funds

- Relayers cannot steal funds (binding signals prevent this)
- Relayers may censor transactions (liveness issue, not safety)
- Users can always self-relay if needed

**Risk Level:** LOW  
**Mitigation:** Multiple relayer endpoints, direct withdrawal option

---

## 4. Operational Assumptions

### 4.1 Key Management

**Assumption:** Users securely store their secrets

- `secret` and `nullifier` must be stored securely
- Loss of these values means permanent loss of funds
- Compromise allows immediate theft

**Risk Level:** HIGH (user responsibility)  
**Mitigation:** Clear user guidance, optional encrypted backup

### 4.2 Authority Key Security

**Assumption:** Protocol authority key is secured

- Authority can trigger emergency mode
- Authority can activate circuit breaker
- Authority cannot steal user funds

**Risk Level:** MEDIUM  
**Mitigation:** Multi-sig authority recommended for mainnet

### 4.3 Circuit Breaker Effectiveness

**Assumption:** Emergency controls function as designed

- Circuit breaker halts withdrawals within one block
- Emergency mode increases fees to deter attacks
- Rate limiting prevents rapid fund drainage

**Risk Level:** LOW  
**Mitigation:** Comprehensive testing of emergency procedures

---

## 5. Economic Assumptions

### 5.1 Fee Structure

**Assumption:** Protocol fees are economically sustainable

- Base fee: 0.1% of withdrawal amount
- Emergency multiplier: up to 10x
- Relayer bounty: market-driven

**Risk Level:** LOW  
**Mitigation:** Adjustable parameters via authority

### 5.2 Vault Solvency

**Assumption:** Vault always has sufficient funds

- Total deposits ≥ total withdrawable
- Minimum reserve maintained (0.1 SOL)
- Circuit breaker triggers on reserve breach

**Risk Level:** LOW  
**Mitigation:** On-chain balance checks before withdrawal

---

## 6. Known Limitations

### 6.1 Anonymity Set Size

- Privacy is proportional to the number of deposits
- Small pools provide limited privacy
- Users should wait for sufficient deposits before withdrawing

### 6.2 Timing Analysis

- Deposit/withdrawal timing patterns may be analyzed
- Users should introduce random delays
- Identical amounts improve privacy

### 6.3 Amount Correlation

- Fixed amounts (0.1, 1, 10 SOL pools) recommended
- Variable amounts reduce anonymity set
- Cross-amount analysis is possible

---

## 7. Audit Status

| Component | Auditor | Status | Date |
|-----------|---------|--------|------|
| Circom Circuits | Pending | Not Audited | - |
| Solana Program | Pending | Not Audited | - |
| SDK | Pending | Not Audited | - |
| Cryptographic Primitives | Pending | Not Audited | - |

**⚠️ WARNING:** This protocol has not been audited. Use at your own risk.

---

## 8. Acceptance

By using the SolVoid protocol, users acknowledge:

1. They have read and understood this document
2. They accept all stated assumptions and risks
3. They understand the protocol has not been audited
4. They are responsible for securing their own keys

---

*Document frozen for audit review. Any changes require version increment and re-review.*
