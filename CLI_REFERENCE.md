# SolVoid CLI Reference

Technical documentation for the SolVoid command-line interface. Our CLI provides a direct interface for executing private protocol operations, managing shield commitments, and performing zero-knowledge withdrawals.

---

## Installation and Setup

We provide a direct npm installation path for the CLI toolkit.

```bash
# Install project dependencies
npm install

# Link CLI globally for system-wide access
npm link
```

---

## Core Protocol Operations

### `shield` - Commitment Generation

We use this command to initiate the shielding process. It generates a cryptographic commitment based on the supplied SOL amount.

```bash
solvoid shield <amount>
```

**Parameters:**
| Argument | Type | Description |
|----------|------|-------------|
| `amount` | number | SOL quantity to be shielded |

**Standard Output:**
```
--- SECRET DATA - DO NOT SHARE ---
Secret: <32-byte-hex>
Nullifier: <32-byte-hex>
Commitment: <Poseidon-hash>
```

⚠️ **Security Requirement**: We must store the `Secret` and `Nullifier` securely. These are the only keys capable of unlocking the shielded assets.

---

### `withdraw` - ZK Proof Execution

We execute unlinked withdrawals by generating and relaying a Groth16 proof to our on-chain verifier.

```bash
solvoid withdraw <secret> <nullifier> <recipient> <amount> [options]
```

**Required Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `secret` | string | Hex-encoded secret generated during shield |
| `nullifier` | string | Hex-encoded nullifier key |
| `recipient` | string | Target Solana address for funds |
| `amount` | number | Withdrawal quantity in SOL |

**Available Options:**
| Flag | Description | Default |
|------|-------------|---------|
| `--relayer <url>` | Target relayer endpoint | http://localhost:8080 |

---

### `ghost` - Privacy Analysis

We utilize the Ghost Score system to analyze wallet privacy levels.

```bash
solvoid ghost <address> [options]
```

**Functional Options:**
| Flag | Description |
|------|-------------|
| `--badge` | Generate a ZK-verified privacy badge |
| `--json` | Return raw data for programmatic integration |
| `--share` | Display social sharing metadata |
| `--verify <proof>` | Validate a third-party privacy proof |

---

### `rescue` - Atomic Security Recovery

Our emergency engine for recovering compromised wallets with MEV protection.

```bash
solvoid rescue <wallet_input> [options]
```

**Configuration Flags:**
| Flag | Description |
|------|-------------|
| `--to <address>` | Specified recovery destination |
| `--emergency` | Priority fee escalation for sub-2s execution |
| `--reason <type>` | Threat classification (e.g., `key-leak`, `mev-attack`) |
| `--dry-run` | Execution simulation without on-chain broadcast |

---

## Global Configuration

We support the following global overrides across all command sets:

| Flag | Description | Reference |
|------|-------------|-----------|
| `--rpc <url>` | Override default Solana RPC | `process.env.RPC_URL` |
| `--program <id>` | Specify target SolVoid program | `process.env.PROGRAM_ID` |
| `--relayer <url>` | Specify relay node | `process.env.RELAYER_URL` |

---

## Technical Specifications

- **Proof System**: Groth16 (BN254)
- **Hashing**: Poseidon (Big-Endian optimized)
- **Merkle Tree**: 20-Level Sparse implementation
- **Relay Mechanism**: Multi-hop Onion Routing
