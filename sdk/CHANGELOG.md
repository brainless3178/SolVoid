# Changelog

All notable changes to the SolVoid SDK will be documented in this file.

## [1.1.4] - 2026-01-31

### Synchronized
- **Circuit-to-SDK Parity**: Finalized the synchronization of G1/G2 point verification signatures across the ZK proving pipeline.
- **Professionalized Documentation**: Completed the transition to institutional-grade technical communication across all READMEs and internal comments.

## [1.1.3] - 2026-01-31

### Fixed
- **Path Normalization**: Corrected directory structural inconsistencies that caused import failures in external CLI and Dashboard environments.
- **Merkle Proof Accuracy**: Resolved a subtle bug in the Merkle path calculation for Groth16 proof generation.
- **Buffer Polyfill**: Standardized browser-safe Buffer handling for cross-platform (Web/Node) compatibility.

### Security
- Implemented `enforce()` gates for all sensitive Public Key and Signature operations.
- Added cryptographic consistency checks to verify hash parity between TypeScript, Rust, and Circom contexts.

---

## [1.1.2] - 2026-01-28
- Initial stable release of the unified SDK.
- Support for Groth16 proof generation.
- Integrated Shadow Relayer client.
