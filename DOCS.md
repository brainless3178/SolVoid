# SolVoid Documentation

Privacy-first transaction layer for Solana.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [CLI Reference](CLI_REFERENCE.md) | Command-line interface |
| [SDK Reference](SDK_REFERENCE.md) | TypeScript SDK |
| [API Reference](API_REFERENCE.md) | Relayer endpoints |
| [ZK Reference](ZK_REFERENCE.md) | Zero-knowledge proof system |
| [Ghost Reference](GHOST_REFERENCE.md) | Privacy scoring |
| [CI/CD Reference](CICD_REFERENCE.md) | Build and deployment |
| [System Status](SYSTEM_STATUS.md) | Architecture overview |
| [Test Matrix](TEST_MATRIX.md) | Test coverage |

---

## Quick Start

```bash
# Install dependencies
npm install

# Start relayer
cd relayer && npm run start:dev

# Shield funds
solvoid shield 0.5

# Withdraw with ZK proof
solvoid withdraw <secret> <nullifier> <recipient> 0.5
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `solvoid shield <amount>` | Create private deposit |
| `solvoid withdraw <s> <n> <r> <a>` | ZK withdrawal |
| `solvoid protect <address>` | Privacy passport |
| `solvoid ghost <address>` | Ghost score |
| `solvoid rescue <wallet>` | Emergency rescue |
| `solvoid admin <cmd>` | Admin controls |

See [CLI Reference](CLI_REFERENCE.md) for full documentation.

---

## SDK Classes

| Class | Purpose |
|-------|---------|
| `SolVoidClient` | Main client |
| `PrivacyShield` | ZK proof generation |
| `PoseidonHasher` | Circuit-compatible hashing |
| `GhostScoreCalculator` | Privacy scoring |

See [SDK Reference](SDK_REFERENCE.md) for full documentation.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Service health |
| `/commitments` | GET | Fetch commitments |
| `/relay` | POST | Relay transaction |

See [API Reference](API_REFERENCE.md) for full documentation.

---

## Project Structure

```
solvoid/
├── cli/                    # Command-line interface
├── sdk/                    # TypeScript SDK
├── relayer/                # Relay service
├── circuits/               # ZK circuits
├── programs/               # Solana programs
├── scripts/                # Deployment scripts
└── tests/                  # Test suites
```

---

## Environment

```bash
RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=3QcKRYWquzbBR3UpKeh4aKVCSpoHy89UT8gyovzRzzan
MERKLE_TREE_LEVELS=20
```

---

## Deployment

```bash
# Devnet
./scripts/deploy-program.sh

# Initialize
npx ts-node scripts/initialize-program.ts
```

---

## Version

```
SolVoid v1.0.0
```
