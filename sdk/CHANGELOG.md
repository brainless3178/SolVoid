# Changelog

All notable changes to the SolVoid SDK will be documented in this file.

## [1.1.7] - 2026-01-31

### Synchronized
- **Visual Parity**: Updated NPM documentation with high-fidelity architecture diagrams (raw URLs) and Mermaid data-flow schemas.
- **Enhanced Specs**: Synchronized all technical ecosystem features (Jito-MEV, circuitry, and admin controls) for institutional-grade presentation.

## [1.1.6] - 2026-01-31

## [1.1.5] - 2026-01-31

## [1.1.4] - 2026-01-31

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
