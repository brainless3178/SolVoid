# Changelog

All notable changes to SolVoid will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-01-31

### 🚀 Added
- Full production-ready RescueEngine implementation
- Jito-MEV bundle integration for atomic asset recovery
- Economic Safety Layer with circuit breaker controls
- Emergency fee multiplier system (1x-10x)

### 🔧 Fixed
- RescueEngine build errors resolved
- TypeScript compilation issues in SDK
- Production migration path finalized

### 📚 Changed
- Upgraded to production-grade error handling
- Improved vault PDA derivation logic

---

## [1.2.0] - 2026-01-30

### 🚀 Added
- Administrative SDK methods (`triggerEmergencyMode`, `disableEmergencyMode`)
- Circuit breaker controls (`triggerCircuitBreaker`, `resetCircuitBreaker`)
- Enhanced CLI admin commands

### 🔧 Fixed
- SDK build errors for administrative infrastructure
- Method signature alignment across modules

---

## [1.1.7] - 2026-01-31

### 📚 Changed
- Achieved visual parity between GitHub and npm READMEs
- Unified documentation styling across platforms

---

## [1.1.6] - 2026-01-31

### 📚 Added
- Comprehensive ecosystem documentation
- ZK circuits reference guide
- Jito-MEV integration docs
- QA standards documentation

### 🔧 Changed
- Merged ecosystem docs into SDK README

---

## [1.1.5] - 2026-01-31

### 📚 Changed
- Synchronized SDK documentation
- Version bump for documentation updates

---

## [1.1.4] - 2026-01-31

### 📚 Changed
- Professionalized release documentation
- Enhanced README formatting

---

## [1.1.3] - 2026-01-30

### 🔧 Fixed
- Synchronized `prepareWithdrawal` with updated `generateZKProof` signature
- Path normalization across codebase

### 📚 Changed
- Professionalized documentation and source code comments
- Major codebase sanitization

---

## [1.1.2] - 2026-01-29

### 🔧 Fixed
- Minor bug fixes and stability improvements

---

## [1.1.1] - 2026-01-29

### 🔧 Fixed
- Post-release hotfixes
- Package configuration corrections

---

## [1.1.0] - 2026-01-29

### 🚀 Added
- Ghost Score privacy reputation system
- Shadow Relayer network with onion routing (1-5 hops)
- CLI tools (`shield`, `withdraw`, `ghost`, `rescue`, `admin`)
- TypeScript SDK with full type definitions

### 🔧 Changed
- Upgraded Merkle tree implementation
- Enhanced ZK proof generation pipeline

---

## [1.0.0] - 2026-01-26

### 🎉 Initial Release

#### Core Features
- **ZK-SNARK Privacy Engine**: Groth16 proofs on BN254 curve
- **Poseidon-3 Hashing**: Circuit-optimized hash function with cross-platform parity
- **On-Chain Program**: Anchor-based Solana program with depth-8 Merkle tree
- **Root History**: 50-root sliding window for proof freshness
- **Nullifier Protection**: PDA-based double-spend prevention

#### Infrastructure
- Non-custodial shielded pool architecture
- Deposit and withdrawal lifecycle management
- Field element validation for BN254 compliance

#### Developer Tools
- TypeScript SDK (`SolVoidClient`)
- Basic CLI interface
- Integration test suite

---

## Links

- **npm**: [npmjs.com/package/solvoid](https://www.npmjs.com/package/solvoid)
- **GitHub**: [github.com/brainless3178/SolVoid](https://github.com/brainless3178/SolVoid)
- **Documentation**: [README.md](./README.md)

