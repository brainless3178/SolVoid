# SolVoid SDK Reference

Developer toolkit for integrating privacy primitives into Solana-based applications. Our SDK provides the core logic for ZK proof generation, Poseidon hashing, and Merkle tree state management.

---

## Integration Setup

We distribute our SDK via npm for streamlined project integration.

```bash
npm install @solvoid/sdk
```

---

## Architecture Overview

### `SolVoidClient`

We utilize the `SolVoidClient` as the primary entry point for protocol interaction. It orchestrates the flow between our privacy modules and the Solana network.

```typescript
import { SolVoidClient } from '@solvoid/sdk';

const client = new SolVoidClient({
  rpcUrl: 'https://api.devnet.solana.com',
  programId: '3QcKRYWquzbBR3UpKeh4aKVCSpoHy89UT8gyovzRzzan'
}, wallet);
```

**Core Implementation Methods:**

| Method | Purpose | Implementation Detail |
|--------|---------|-----------------------|
| `shield(amount)` | Commitment Creation | Triggers Poseidon hash generation |
| `withdraw(...)` | ZK Proof Submission | Orchestrates snarkjs prover |
| `protect(address)` | Privacy Audit | Executes transaction graph analysis |

---

### `PrivacyShield` (ZK Module)

Our `PrivacyShield` class manages the heavy cryptographic lifting. We use this for low-level proof manipulation and leaf state calculations.

| Implementation | Purpose |
|----------------|---------|
| `generateZKProof` | Executes Groth16 prover with supplied witness |
| `verifyProof` | Performs local validation of BN254 pairings |
| `computeMerklePath` | Generates 20-level membership witness |

---

### `PoseidonHasher`

We maintain a strict big-endian implementation of the Poseidon hash function to ensure absolute compatibility between our TypeScript SDK and our Circom-based ZK circuits.

```typescript
const hasher = new PoseidonHasher();
await hasher.initialize();

const commitment = await hasher.computeCommitment(secret, nullifier, amount);
```

---

## Data Integrity and Security

We enforce a strict data integrity layer using Zod schemas. Our system classifies data based on its source (Origin) and verification status (Trust).

| Data Origin | Default Trust | Verification Requirement |
|-------------|---------------|-------------------------|
| `ZK_PROOF` | `VERIFIED` | Cryptographic pairing check |
| `ONCHAIN_ACCOUNT` | `TRUSTED` | RPC sanity check |
| `USER_INPUT` | `UNTRUSTED` | Schema enforcement required |

---

## Error Handling Standards

Our SDK throws standardized `SolVoidError` exceptions. We recommend implementing comprehensive switch cases for error handling:

```typescript
try {
  await client.withdraw(...);
} catch (error) {
  if (error.code === ErrorCodes.INVALID_PROOF) {
    // Handling for failed verification
  }
}
```

---

## Implementation Requirements

- **Environment**: ESM or CommonJS (Browser/Node.js compatible)
- **Circuit Artifacts**: Must provide `.wasm` and `.zkey` paths in configuration
- **Network**: Supports Solana Devnet and Mainnet-Beta
