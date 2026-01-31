# SolVoid ZK System Reference

Technical specification for our Zero-Knowledge implementation. We utilize the Groth16 proof system on the BN254 curve to provide transaction privacy and unlinkability on the Solana blockchain.

---

## Cryptographic Primitives

### Poseidon Hash Implementation

We have standardized our protocol on the Poseidon hash function due to its ZK-friendly properties and constraint efficiency.

- **Field**: BN254 Scalar Field (Fr)
- **Rounds**: 8 Full, 57 Partial rounds
- **Arity**: Support for 2-input (nullifiers) and 3-input (commitments) hashing.
- **Orientation**: We enforce Big-Endian byte ordering throughout our pipeline to align with standard web3 cryptographic patterns.

---

## Circuit Specifications

### `withdraw.circom`

Our primary withdrawal circuit handles the validation of our commitment-nullifier scheme.

**Circuit Constraints:**
1. **Commitment Integrity**: We verify that `H(secret, nullifier, amount) == commitment`.
2. **Nullifier Uniqueness**: We verify the nullifier hash `H(nullifier, 1) == nullifierHash`.
3. **Membership Proof**: We execute a 20-level Merkle proof verification against the public Merkle root.
4. **Input Binding**: We bind public signals (`recipient`, `relayer`, `fee`) to the proof to prevent malleability and transaction hijacking.

---

## Proof Generation and Artifacts

We maintain the following artifacts for our proving pipeline:

| Artifact | Location | Purpose |
|----------|----------|---------|
| `withdraw.wasm` | `circuits/withdraw_js/` | Witness calculation engine |
| `withdraw_final.zkey` | `circuits/build/` | Proving key for Groth16 execution |
| `verification_key.json` | `circuits/build/` | Public parameters for proof validation |

---

## On-Chain Verification

Our Solana program acts as the verifier. We have optimized the BN254 pairing checks to operate within the Solana compute budget (~210k CUs per proof).

**Verification Procedure**:
- We extract the Proof points (A, B, C) from the transaction instruction data.
- We reconstruct the public signal array.
- We perform the pairing check using our optimized verifier implementation.

---

## Security Assumptions

1. **Trusted Setup**: Our protocol relies on the integrity of the powers-of-tau ceremony. We assume at least one participant in the setup was honest.
2. **Computational Soundness**: We assume the hardness of the Discrete Logarithm Problem on the BN254 curve.
3. **Nullifier Resistance**: We assume our nullifier scheme prevents double-spending through on-chain uniqueness checks.
