# Getting Started: Protocol Onboarding

This document outlines the standard procedures for environment initialization and the execution of a primary privacy cycle.

## Dependency Prerequisites

Operating environments must satisfy the following hardware and software requirements:

- **Node.js:** v18.0.0 or higher ([Download](https://nodejs.org/))
- **Solana Tool Suite:** v1.18.0 or higher ([Install](https://docs.solana.com/cli/install-solana-cli-tools))
- **Anchor Framework:** v0.30.0 ([Install](https://www.anchor-lang.com/docs/installation))
- **Rust:** v1.75.0 or higher ([Install](https://www.rust-lang.org/tools/install))
- **Git:** Required for repository orchestration.

---

## Installation

### 1. Repository Acquisition
```bash
git clone https://github.com/brainless3178/SolVoid.git
cd SolVoid
```

### 2. Dependency Resolution
```bash
# Initialize root environment
npm install

# Initialize SDK components
cd sdk && npm install && cd ..

# Initialize Dashboard interface
cd dashboard && npm install && cd ..
```

### 3. ZK Circuit Compilation
SolVoid requires compiled ZK circuits and Groth16 proving keys. Compilation latency varies based on local compute capacity.
```bash
./scripts/build-zk.sh
```
*Note: This process requires global installations of `circom` and `snarkjs` or local availability via the project path.*

---

## Environment Configuration

Initialize the `.env` configuration file from the provided template:
```bash
cp .env.example .env
```

Define the target RPC provider and wallet parameters:
```env
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WALLET_PATH=~/.config/solana/id.json
RELAYER_URL=http://localhost:3001
```

---

## Network Target Selection

### Local Development Environment
To initialize a local validator instance with the SolVoid program:
```bash
anchor localnet
```

### Devnet Testing Environment
Configure the Solana CLI for the Devnet cluster and ensure sufficient SOL liquidity:
```bash
solana config set --url devnet
solana airdrop 2
```

---

## Technical Walkthrough: Primary Privacy Cycle

Executing the standard shield-and-withdraw workflow.

### Step 0: Privacy Baseline Analysis
Initialize an audit of the target wallet to establish a baseline Privacy Ghost Score.
```bash
./bin/solvoid ghost <WALLET_PUBKEY>
```
The CLI will return the current Ghost Score and identify critical identity linkage vectors.

### Step 1: Asset Shielding (Deposit)
Generates a unique cryptographic commitment and locks SOL in the protocol vault.
```bash
./bin/solvoid shield 0.5
```
**Output Summary:**
- **Commitment:** 0x... (Publicly registered)
- **Nullifier Key:** 0x... (Persistence Required)
- **Secret Key:** 0x... (Persistence Required)

### Step 2: Confirmation Verification
Monitor the transaction for finality. Verification status is available via the SolVoid Dashboard.

### Step 3: Unlinkable Withdrawal
Execute a ZK-verified withdrawal to a fresh, unlinked destination address.
```bash
./bin/solvoid withdraw 0.5 <RECIPIENT_PUBKEY> --nullifier <NULLIFIER_KEY> --secret <SECRET_KEY>
```

---

## Implementation Troubleshooting

- **"Account Not Found":** Verification failed due to missing program state initialization. Ensure `anchor run init` has been successfully executed.
- **"Invalid Proof":** Metadata mismatch identified. Confirm that the secret and nullifier keys match the initial commitment exactly.
- **"Insufficient Funds":** Execution blocked by balance constraints. Verify vault liquidity and priority gas availability.

For advanced remediation, refer to [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
