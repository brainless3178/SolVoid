# SolVoid TypeScript SDK: Institutional Privacy Integration

The official integration layer for the SolVoid Privacy Protocol. This SDK provides a comprehensive software interface for decentralized applications requiring Zero-Knowledge (ZK) transaction anonymity and privacy auditing on Solana.

[![NPM Version](https://img.shields.io/npm/v/solvoid.svg)](https://www.npmjs.com/package/solvoid)
[![Documentation: SDK](https://img.shields.io/badge/Docs-SDK%20Reference-blue.svg)](../SDK_REFERENCE.md)

---

## 🛠 Architectural Features

The SDK implements a highly-secure boundary between untrusted user inputs and protocol-critical ZK operations.

- **Proof Orchestration:** Native integration with `snarkjs` for browser-compatible Groth16 witness generation.
- **Sparse Merkle Tree Pathing:** Efficient client-side calculation of Merkle witnesses for 20-level trees.
- **Onion Decryption Engine:** Handles multi-hop route construction and RSA-OAEP encryption for Shadow Relayer interactions.
- **Data Integrity Layer:** Zod-based schema enforcement at every operational boundary (CLI, API, and Persistence).

---

## 📦 Installation

```bash
npm install solvoid
```

---

## 🚀 Integration Patterns

### 1. Client Initialization
```typescript
import { SolVoidClient } from 'solvoid';
import { Connection } from '@solana/web3.js';

const config = {
    rpcUrl: process.env.SOLANA_RPC_URL,
    programId: 'Fg6PaFpoGXkYsidMpSsu3SWJYEHp7rQU9YSTFNDQ4F5i',
    relayerUrl: 'https://relayer.solvoid.network'
};

const client = new SolVoidClient(config, walletAdapter);
```

### 2. Executing a Private Deposit (Surgical Shielding)
```typescript
const amountLamports = 1_000_000_000; // 1.0 SOL
const { commitmentData, status } = await client.shield(amountLamports);

/** Persist primitives for subsequent unshielding. */
console.log('Commitment Hash:', commitmentData.commitmentHex);
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

---

## 🧬 Diagnostic Capability: Ghost Score

The SDK provides internal access to the SolVoid Privacy Engine for real-time anonymity auditing.

```typescript
const address = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const passport = await client.getPassport(address);

console.log(`Current Ghost Score: ${passport.overallScore}/100`);
passport.recommendations.forEach(rec => console.log(`Audit Note: ${rec}`));
```

---

## 🔒 Integrity Standard

The SolVoid SDK enforces **Strict Contextual Validation**. Every public key, transaction primitive, and API payload is validated against protocol-standard schemas before processing, mitigating common injection and state-corruption attack vectors.

---

## 📄 Licensing & Governance

Distributed under the MIT License. SolVoid is a community-driven initiative focused on the advancement of digital sovereignty.

---
*Questions? Refer to the [Technical Reference Documentation](../SDK_REFERENCE.md).*
