# SolVoid TypeScript SDK: Institutional Privacy Integration

The official integration layer for the **SolVoid Privacy Protocol**. This SDK provides a comprehensive software interface for decentralized applications requiring Zero-Knowledge (ZK) transaction anonymity, identity obfuscation, and privacy auditing on Solana.

[![NPM Version](https://img.shields.io/npm/v/solvoid.svg)](https://www.npmjs.com/package/solvoid)
[![Protocol Status](https://img.shields.io/badge/Protocol-Beta-cyan.svg)](https://github.com/brainless3178/SolVoid)
[![License: MIT](https://img.shields.io/badge/License-MIT-gray.svg)](https://opensource.org/licenses/MIT)

---

## 🏛 Full Ecosystem Context

While this package provides the SDK, SolVoid is a multi-layered privacy infrastructure. To access the full ecosystem—including the **ZK circuits**, **Shadow Relayer**, **Atomic Rescue CLI**, and **Web Dashboard**—refer to the primary repository:

🔗 **[github.com/brainless3178/SolVoid](https://github.com/brainless3178/SolVoid)**

---

## 🚀 Key Ecosystem Features

### 1. Advanced Zero-Knowledge Stack
- **Groth16 Proving Pipeline**: High-performance proving implementation on the **BN254 curve**.
- **Poseidon-3 Hashing**: Standardized sponge construction ensuring 100% hash parity across **Circom (circuits)**, **Rust (Anchor program)**, and **TypeScript (SDK)**.

### 2. Privacy Ghost Score (Anonymity Auditing)
An integrated heuristic diagnostic engine that quantifies on-chain privacy risk (0-100).
- **Leak Detection**: Identifies identity linkage via common fee-funding sources, ATA creation history, and transaction-graph entropy.
- **ZK-Verified Badges**: Generate cryptographically verifiable reputation artifacts without revealing underlying data.

### 3. Shadow Relayer Network (Onion Routing)
A decentralized network for gasless, unlinkable withdrawals.
- **RSA-OAEP Encryption**: Protects withdrawal payloads using recursive encryption layers.
- **Onion Routing**: Decouples the destination address from the withdrawal request.

### 4. Data Integrity Enforcement (DIE)
Institutional-grade security layer implemented across the entire stack using Zod-powered schema validation at every operational boundary.

---

## 📦 Installation

```bash
npm install solvoid
```

---

## 🛠 SDK Integration Patterns

### 1. Client Initialization
```typescript
import { SolVoidClient } from 'solvoid';

const config = {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    programId: 'Fg6PaFpoGXkYsidMpSsu3SWJYEHp7rQU9YSTFNDQ4F5i',
    relayerUrl: 'https://relayer.solvoid.network'
};

const client = new SolVoidClient(config, walletAdapter);
```

### 2. Executing a Private Deposit (Shielding)
```typescript
const amountLamports = 1_000_000_000; // 1.0 SOL
const { commitmentData, status } = await client.shield(amountLamports);

console.log('Secret/Nullifier Primitives:', commitmentData.secret, commitmentData.nullifier);
```

### 3. Executing an Unlinkable Withdrawal
```typescript
const result = await client.prepareWithdrawal(
    secret,
    nullifier,
    amountLamports,
    recipientPubkey,
    commitmentsBuffer, // Hex-encoded commitment set
    wasmPath,
    zkeyPath
);

// Submit via Shadow Relayer for gasless execution
const txid = await client.submitWithdrawal(result);
```

### 4. Privacy Auditing (Ghost Score)
```typescript
const passport = await client.getPassport(address);
console.log(`Current Ghost Score: ${passport.overallScore}/100`);
```

---

## 🔒 Security & Performance
- **Sub-second Latency**: Optimized for Solana's 400ms block times.
- **Browser-Side Proving**: Execute Groth16 witness generation directly in the client environment via `snarkjs`.
- **Strict Validation**: All cryptographic primitives are validated at the SDK boundary.

---

## 📄 Licensing

Distributed under the MIT License. SolVoid is an engineering-first initiative focused on digital sovereignty.

---
*For the complete protocol documentation, circuits, and CLI, visit the [Main Repository](https://github.com/brainless3178/SolVoid).*
