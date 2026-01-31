# Implementation Patterns: Integration Examples

This document outlines standard usage patterns and technical integration examples for the SolVoid protocol.

## Primary Protocol Flow (CLI)

### Core Shielding and Withdrawal Transaction
1. **Initial Asset Shielding:**
   ```bash
   solvoid shield 1.0
   # Persist returned cryptographic primitives: SECRET, NULLIFIER
   ```
2. **Unlinkable Withdrawal to Remediation Address:**
   ```bash
   solvoid withdraw 1.0 <NEW_ADDRESS> --secret <SECRET_KEY> --nullifier <NULLIFIER_KEY>
   ```

---

## SDK Integration Patterns (TypeScript)

Implementation of the SolVoid SDK within external decentralized applications and automated services.

### Client Initialization
```typescript
import { SolVoidClient } from '@solvoid/sdk';
import { useWallet } from '@solana/wallet-adapter-react';

const wallet = useWallet();
const client = new SolVoidClient({
    rpcUrl: 'https://api.devnet.solana.com',
    programId: 'Fg6PaFpoGXkYsidMpSsu3SWJYEHp7rQU9YSTFNDQ4F5i'
}, wallet);
```

### Programmatic Asset Shielding
```typescript
const amount = 1_000_000_000; // Standardizing on atomic units (Lamports)
const { commitmentData, status } = await client.shield(amount);

/** Requirements: Persistence of secret and nullifier for subsequent withdrawal. */
console.log('Cryptographic Primitives:', 
    commitmentData.secret, 
    commitmentData.nullifier
);
```

---

## Relayer Architecture Integration

The Relayer implementation facilitates gasless withdrawals, decoupling the destination identity from the initial funding source by utilizing a third-party fee payer.

### Configuration Specification
Define parameters within the protocol configuration or environment variables:
```json
{
  "relayerUrl": "https://relayer.solvoid.network",
  "fee": 5000000 
}
```

### Gasless Withdrawal Execution
```bash
solvoid withdraw 1.0 <RECIPIENT> --relayer --fee 0.005
```

---

## Advanced Remediations (The "Atomic Rescue" Pattern)

The "Atomic Rescue" pattern is utilized for remediating critical privacy compromises, such as identity linkage or transaction-graph exposure.

1. **Leak Vector Identification:**
   ```bash
   solvoid rescue <COMPROMISED_WALLET>
   ```
   *Result Summary: Multiple anonymity leaks identified in specified asset types.*

2. **Automated Batch Shielding:**
   The SDK identifies all liquid assets and orchestrates a prioritized batch of shielding transactions.

3. **Temporal Obfuscation:**
   Execution of withdrawals over randomized intervals to multiple destination addresses to mitigate timing analysis.

---

## Anchor Testing Framework Integration
Standardized pattern for executing privacy verification within Anchor-based testing suites.

```typescript
it("executes a verified privacy cycle", async () => {
    // 1. Initialize logic
    await client.init();

    // 2. Execute Shielding
    const shieldResult = await client.shield(1e9);
    
    // 3. Synchronize Merkle Tree state
    const allCommitments = [shieldResult.commitmentData.commitmentHex];
    
    // 4. Generate ZK Witness
    const withdrawResult = await client.prepareWithdrawal(
        shieldResult.commitmentData.secret,
        shieldResult.commitmentData.nullifier,
        BigInt(1e9),
        recipient.publicKey,
        allCommitments,
        "./circuits/withdraw.wasm",
        "./circuits/withdraw.zkey"
    );

    // 5. Submit Transaction
    const tx = await client.submitWithdrawal(withdrawResult);
    expect(tx).to.be.ok;
});
```
