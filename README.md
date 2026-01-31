# SolVoid: Institutional-Grade Privacy Infrastructure for Solana

[![Protocol Status](https://img.shields.io/badge/Protocol-Beta-cyan.svg)](https://solvoid.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-gray.svg)](https://opensource.org/licenses/MIT)
[![Security: ZK-Optimized](https://img.shields.io/badge/Security-ZK--Optimized-blue.svg)](./ZK_REFERENCE.md)

SolVoid is a high-performance, non-custodial privacy protocol designed for the Solana ecosystem. By leveraging **Groth16 Zero-Knowledge Proofs** and circuit-optimized **Poseidon-3 hashing**, SolVoid enables cryptographically unlinkable asset transfers and identity obfuscation with minimal latency.

---

## 🏛 Protocol Architecture

SolVoid orchestrates a multi-layered privacy lifecycle (PLM) that decouples on-chain identities from their transaction history while maintaining full protocol verifiability.

![SolVoid Architecture](./solvoid_architecture_premium_1769868901255.png)

### Core Components
- **ZK-Prover Engine:** Orchestrates client-side Groth16 witness generation on the BN254 curve.
- **Merkle Tree State:** Optimized 20-level sparse tree implementation supporting over 1,000,000 unique commitments.
- **Shadow Relayer Network:** A decentralized RSA-OAEP onion-routing network for gasless, unlinkable transaction broadcast.
- **On-chain Verifier:** An Anchor-based validation layer implementing efficient G1/G2 point verification for proof acceptance.

---

## 🚀 Key Features

| Feature | Technical Specification |
|:---|:---|
| **Zero-Knowledge** | Groth16 proofs with verified R1CS constraints |
| **Privacy Scoring** | HEURISTIC-based "Ghost Score" (0-100) for anonymity auditing |
| **Atomic Rescue** | Automated rotation of leaked assets for compromised wallets |
| **Onion Routing** | Recursive encryption layer for transaction obfuscation |
| **Data Integrity** | Strict schema enforcement across CLI, SDK, and API boundaries |

---

## 📦 Technical Deployment

### 1. Environment Initialization
```bash
git clone https://github.com/brainless3178/SolVoid.git
cd SolVoid
npm install
```

### 2. ZK Circuit Compilation
Ensure `circom` and `snarkjs` are available in the local binary path.
```bash
./scripts/build-zk.sh
```

### 3. Service Orchestration
Initialize the Shadow Relayer and local dashboard.
```bash
# Start Relayer
cd relayer && npm start

# Start Dashboard
cd dashboard && npm run dev
```

---

## 🛠 Command Orchestration (CLI)

### Execute Private Deposit (Shielding)
```bash
solvoid shield 1.5
```
*Requirement: Persist the returned Secret and Nullifier keys. Loss of these primitives results in permanent asset sequestration.*

### Execute Unlinkable Withdrawal
```bash
# format: solvoid withdraw <amount> <recipient> --secret <key> --nullifier <key>
solvoid withdraw 1.5 <RECIPIENT_ADDRESS> --secret 0x... --nullifier 0x...
```

---

## 📖 Project Reference Documentation

Our technical documentation is partitioned by infrastructure layer:

- **Protocol Core:** [DOCS.md](DOCS.md) | [ZK_REFERENCE.md](ZK_REFERENCE.md) | [GHOST_REFERENCE.md](GHOST_REFERENCE.md)
- **Integration Layer:** [SDK_REFERENCE.md](SDK_REFERENCE.md) | [CLI_REFERENCE.md](CLI_REFERENCE.md) | [API_REFERENCE.md](API_REFERENCE.md)
- **Operations:** [CICD_REFERENCE.md](CICD_REFERENCE.md) | [SYSTEM_STATUS.md](SYSTEM_STATUS.md) | [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🔒 Security Compliance

Protocol integrity is the core focus of the SolVoid Engineering team.

- **Current Status:** Experimental Beta
- **Audit Path:** Undergoing internal peer review; third-party audit scheduled for Q2.
- **Vulnerability Policy:** Refer to [SECURITY.md](SECURITY.md) for disclosure protocols.

---

## 📄 Licensing

Distributed under the MIT License. See `LICENSE` for additional parameters.

---

*Engineering-First. Privacy-Preserving. Solana-Native.*
