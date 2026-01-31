# SolVoid System Status

Current technical state and operational status for the SolVoid protocol. We keep this document updated to reflect our current deployment progress and feature readiness.

---

## Operational Roadmap

### Current Milestones

| Component | Status | Implementation Notes |
|-----------|--------|----------------------|
| **ZK Prover** | ✅ OPERATIONAL | Groth16 with WASM/ZKEY integration active. |
| **Relay Network** | ✅ OPERATIONAL | Multi-hop onion routing and commitment API active. |
| **Privacy SDK** | ✅ OPERATIONAL | Full support for shield and withdraw patterns. |
| **On-Chain Verifier** | ⏳ PENDING | Program built (v1.0.0); awaiting network availability. |

---

## Technical Baseline

Our current implementation is based on the following protocol parameters:

- **Anchor IDL Version**: 0.29.0
- **Merkle Depth**: 20 Levels (Standardized)
- **Hash Function**: Poseidon (Big-Endian optimized)
- **Target Network**: Solana Devnet / Mainnet-Beta

---

## Deployment Status

We are currently in a state of **Readiness for Deployment**. Our program binaries (`solvoid_zk.so`) are compiled and ready for on-chain broadcast.

### Blockers and Resolutions
1. **Network Congestion**: Current RPC bottlenecks on devnet/mainnet are delaying program uploads.
2. **Resolution**: We have implemented a deployment script with recovery logic and SOL balance verification to manage deployment across congested windows.

---

## System Architecture

Our architecture is designed for modularity across four distinct layers:

1. **Client Interface**: CLI and SDK for user interaction.
2. **Proving Layer**: Off-chain snarkjs implementation for proof generation.
3. **Relay Layer**: Middle-tier service for transaction obfuscation.
4. **Execution Layer**: On-chain Anchor program for state management and verification.
