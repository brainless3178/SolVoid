# SolVoid Complete Command & Flag Reference

> **Every command, flag, and script in the entire codebase**

---

## Table of Contents

1. [CLI Commands](#cli-commands)
2. [NPM Scripts](#npm-scripts)
3. [Shell Scripts](#shell-scripts)
4. [Anchor/Cargo Commands](#anchorcargo-commands)
5. [ZK Circuit Commands](#zk-circuit-commands)
6. [CI/CD Workflows](#cicd-workflows)
7. [API Endpoints](#api-endpoints)

---

## CLI Commands

### Main Entry Point

```bash
solvoid-scan <command> [options]
```

### Global Options

| Flag | Description | Default |
|------|-------------|---------|
| `--rpc <url>` | Override Solana RPC URL | `https://api.mainnet-beta.solana.com` |
| `--program <id>` | Override SolVoid Program ID | `Fg6PaFpoGXkYsidMpSsu3SWJYEHp7rQU9YSTFNDQ4F5i` |
| `--relayer <url>` | Override Shadow Relayer URL | `http://localhost:3000` |
| `--help` | Display help information | - |

---

### `protect` - Privacy Leak Audit

Execute comprehensive privacy leak audit on a wallet.

```bash
solvoid protect <address> [options]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `<address>` | Yes | Target wallet public key |

**Example:**
```bash
solvoid protect 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
```

---

### `ghost` - Privacy Ghost Score

Generate Privacy Ghost Score and ZK-verified reputation artifacts.

```bash
solvoid ghost <address> [options]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `<address>` | Yes | Wallet address for privacy analysis |

| Flag | Description |
|------|-------------|
| `--badge` | Generate cryptographically verifiable privacy badge |
| `--json` | Return raw score data in JSON format |
| `--share` | Generate social metadata and sharing strings |
| `--verify <proof>` | Validate an external ZK privacy proof |
| `--rpc <url>` | Specify Solana RPC endpoint |
| `--program <id>` | Specify SolVoid program ID |
| `--relayer <url>` | Specify Shadow Relayer API URL |

**Examples:**
```bash
# Basic analysis
solvoid ghost 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM

# Generate badge with sharing metadata
solvoid ghost 9WzDXw... --badge --share

# JSON output for automation
solvoid ghost 9WzDXw... --json

# Verify external proof
solvoid ghost --verify "proof_data_here..."
```

---

### `rescue` - Atomic Asset Recovery

Execute atomic rescue protocols for compromised wallets.

```bash
solvoid rescue <wallet> [options]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `<wallet>` | Yes | Target wallet address or private key |

| Flag | Description |
|------|-------------|
| `--to <address>` | Destination for remediated assets |
| `--emergency` | Emergency Priority: Escalate fees for <2s execution |
| `--reason <type>` | Threat classification (see below) |
| `--dry-run` | Simulate without network broadcast |
| `--jito-bundle` | Use Jito MEV bundles for atomicity |
| `--auto-generate` | Initialize fresh destination address |
| `--monitor` | Activate post-remediation threat monitoring |
| `--mev-protection` | Enable advanced MEV shielding |
| `--rpc <url>` | Specify Solana RPC endpoint |
| `--program <id>` | Specify SolVoid program ID |
| `--relayer <url>` | Specify Shadow Relayer API URL |

**Reason Types:**
- `key-leak` - Private key compromise detected
- `mev-attack` - Active MEV attack detected
- `drainer` - Wallet drainer detected
- `privacy` - Privacy rotation (default)

**Examples:**
```bash
# Dry run rescue to specific address
solvoid rescue 9WzDXw... --to SAFE_ADDRESS --dry-run

# Emergency rescue with Jito MEV protection
solvoid rescue PRIVATE_KEY --emergency --jito-bundle --reason key-leak

# Auto-generate safe destination
solvoid rescue PRIVATE_KEY --auto-generate --monitor
```

---

### `shield` - Private Deposit

Execute a private deposit (Surgical Shielding).

```bash
solvoid shield <amount>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `<amount>` | Yes | Amount in SOL to shield |

**Example:**
```bash
solvoid shield 1.5
```

**Output:**
- Secret Key (SENSITIVE)
- Nullifier Key (SENSITIVE)
- Commitment Hash

---

### `withdraw` - ZK Withdrawal

Execute an unlinkable ZK withdrawal.

```bash
solvoid withdraw <secret> <nullifier> <recipient> <amount>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `<secret>` | Yes | Secret key from shield operation |
| `<nullifier>` | Yes | Nullifier key from shield operation |
| `<recipient>` | Yes | Destination wallet address |
| `<amount>` | Yes | Amount in SOL to withdraw |

**Example:**
```bash
solvoid withdraw SECRET_KEY NULLIFIER_KEY 9WzDXw... 1.5
```

---

### `admin` - Protocol Administration

Protocol administration and emergency controls.

#### `admin trigger-emergency`

Trigger protocol-wide emergency fee multiplier.

```bash
solvoid admin trigger-emergency <multiplier> <reason>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `<multiplier>` | Yes | Fee multiplier (1-10) |
| `<reason>` | Yes | Reason for emergency |

#### `admin disable-emergency`

Deactivate emergency mode and reset fees.

```bash
solvoid admin disable-emergency
```

#### `admin pause`

Pause all withdrawals via Circuit Breaker.

```bash
solvoid admin pause
```

#### `admin resume`

Resume withdrawals and reset circuit breaker.

```bash
solvoid admin resume
```

---

## NPM Scripts

### Root Package (`package.json`)

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsc` | Compile TypeScript |
| `test` | `jest --coverage` | Run all tests with coverage |
| `test:unit` | `jest --testPathPattern=tests/unit` | Run unit tests only |
| `test:integration` | `jest --testPathPattern=tests/integration` | Run integration tests |
| `lint` | `eslint sdk cli --ext .ts` | Lint SDK and CLI |
| `docs` | `typedoc --out docs sdk/` | Generate documentation |
| `dashboard:dev` | `npm run dev --prefix dashboard` | Start dashboard dev server |
| `dashboard:build` | `npm run build --prefix dashboard` | Build dashboard |
| `dashboard:start` | `npm run start --prefix dashboard` | Start dashboard production |

### SDK Package (`sdk/package.json`)

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsc` | Compile TypeScript |
| `dev` | `tsc --watch` | Watch mode compilation |
| `clean` | `rm -rf dist` | Clean build artifacts |

### CLI Package (`cli/package.json`)

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsc` | Compile TypeScript |
| `dev` | `tsc --watch` | Watch mode compilation |
| `start` | `node solvoid-scan.js` | Run CLI |
| `clean` | `rm -rf dist` | Clean build artifacts |

### Dashboard Package (`dashboard/package.json`)

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev` | Start Next.js dev server |
| `build` | `next build` | Build for production |
| `start` | `next start` | Start production server |
| `lint` | `eslint` | Lint dashboard code |

### Relayer Package (`relayer/package.json`)

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx watch service.ts` | Development with hot reload |
| `build` | `tsc` | Compile TypeScript |
| `start` | `node dist/service.js` | Start production relayer |
| `start:dev` | `tsx service.ts` | Start dev relayer |

### Tools Package (`tools/package.json`)

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsc` | Compile TypeScript |
| `dev` | `tsc --watch` | Watch mode compilation |
| `start` | `node dist/indexer.js` | Start indexer |
| `clean` | `rm -rf dist` | Clean build artifacts |

---

## Shell Scripts

### Build Scripts

#### `scripts/build-circuits.sh`

Compile ZK circuits and generate proving/verification keys.

```bash
./scripts/build-circuits.sh
```

**Operations:**
1. Check circom installation
2. Download Powers of Tau (pot14)
3. Compile withdraw circuit
4. Generate Groth16 setup
5. Export verification keys
6. Generate Solidity verifiers

#### `scripts/compile-circuits.sh`

Full circuit compilation with key generation.

```bash
./scripts/compile-circuits.sh
```

**Commands used internally:**
```bash
circom circuits/rescue.circom --r1cs --wasm --c --sym -l node_modules/circomlib/circuits -o circuits/build/ --O2
circom circuits/withdraw.circom --r1cs --wasm --c --sym -l node_modules/circomlib/circuits -o circuits/build/ --O2
npx snarkjs powersoftau new bn128 14 pot14_0000.ptau -v
npx snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="First contribution" -v
npx snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau -v
npx snarkjs groth16 setup circuits/build/rescue.r1cs pot14_final.ptau circuits/keys/rescue_0000.zkey
npx snarkjs zkey contribute circuits/keys/rescue_0000.zkey circuits/keys/rescue_0001.zkey --name="1st Contributor Name" -v
npx snarkjs zkey export verificationkey circuits/keys/rescue_0001.zkey circuits/keys/rescue_verification_key.json
```

#### `scripts/build-zk.sh`

Real ZK build system for production.

```bash
./scripts/build-zk.sh
```

**Phases:**
1. Circom compilation
2. Powers of Tau generation
3. Groth16 setup
4. Verification key export

---

### Deployment Scripts

#### `scripts/deploy-program.sh`

Deploy Solana program to network.

```bash
./scripts/deploy-program.sh
```

**Commands used:**
```bash
solana balance
solana program show --buffers
solana program close "$ADDR"
solana program deploy target/deploy/solvoid_zk.so --with-compute-unit-price 5000
solana program show "$PROGRAM_ID"
```

#### `scripts/deploy-zk-program.sh`

Full ZK program deployment with Anchor.

```bash
./scripts/deploy-zk-program.sh [network]
```

| Argument | Options | Description |
|----------|---------|-------------|
| `network` | `devnet`, `testnet`, `mainnet`, `localnet` | Target network |

**Commands used:**
```bash
anchor build
anchor keys list
solana-keygen pubkey $PROGRAM_KEYPAIR
anchor deploy --provider.cluster devnet
anchor deploy --provider.cluster mainnet
anchor run initialize --provider.cluster devnet
```

#### `scripts/deploy-secure-system.sh`

Complete secure deployment pipeline.

```bash
./scripts/deploy-secure-system.sh [network]
```

| Argument | Options | Default |
|----------|---------|---------|
| `network` | `devnet`, `testnet`, `mainnet` | `devnet` |

**Phases:**
1. Build ZK Circuits
2. Run MPC Ceremony
3. Build Solana Program
4. Security Testing
5. Deploy to Network
6. Initialize Program
7. Verify Deployment
8. Start Relayer Service
9. Final Health Check

---

### MPC Ceremony Scripts

#### `scripts/mpc-ceremony.sh`

MPC ceremony contribution and finalization.

```bash
./scripts/mpc-ceremony.sh [command] [name]
```

| Command | Description |
|---------|-------------|
| `contribute` | Add a contribution to the ceremony |
| `finalize` | Finalize the ceremony and export keys |

**Commands used:**
```bash
npx snarkjs groth16 setup circuits/withdraw.r1cs $PTAU_FILE withdraw_0000.zkey
npx snarkjs zkey contribute $prev_zkey $next_zkey --name="$name" -v -e="$(openssl rand -base64 32)"
npx snarkjs zkey export verificationkey $last_zkey verification_key.json
```

#### `scripts/run-ceremony.sh`

Orchestrate complete MPC ceremony.

```bash
./scripts/run-ceremony.sh
```

**Operations:**
1. Build ceremony coordinator
2. Initialize ceremony
3. Add contributions
4. Verify contributions
5. Finalize ceremony

---

### Testing Scripts

#### `scripts/run-tests.sh`

Comprehensive test runner.

```bash
./scripts/run-tests.sh
```

**Commands used:**
```bash
npx jest tests/unit --testTimeout=300000 --coverage --verbose
npx jest tests/integration --testTimeout=300000 --verbose
npx jest tests/performance --testTimeout=300000 --verbose
```

**Environment Variables:**
- `SOLANA_PRIVATE_KEY` - Enable integration tests
- `USE_DEVNET` - Enable devnet tests

#### `scripts/run-security-tests.sh`

Security test suite runner.

```bash
./scripts/run-security-tests.sh
```

**Test Categories:**
- Proof forgery tests
- Nullifier reuse tests
- Economic attack tests
- Authentication bypass tests
- Edge case security tests
- Rust security tests
- Circuit security tests
- Fuzzing tests
- Performance security tests

#### `scripts/security-test-suite.sh`

Validate security test components.

```bash
./scripts/security-test-suite.sh
```

#### `scripts/security-validation.sh`

Complete security validation suite.

```bash
./scripts/security-validation.sh
```

**Test Suites:**
```bash
npm test -- --testPathPattern="circuit-soundness" --verbose
npm test -- --testPathPattern="verifier-consistency" --verbose
npm test -- --testPathPattern="state-invariants" --verbose
npm test -- --testPathPattern="relayer-adversarial" --verbose
```

---

### Validation Scripts

#### `scripts/verify-deployment.sh`

Pre-deployment verification checks.

```bash
./scripts/verify-deployment.sh
```

**Sections:**
1. Cryptographic Verification
2. Security Verification
3. Integration Testing
4. Infrastructure
5. Emergency Procedures
6. Code Quality
7. Dependencies
8. Documentation

#### `scripts/verify-hash-consistency.sh`

Cross-platform hash verification.

```bash
./scripts/verify-hash-consistency.sh
```

#### `scripts/arithmetic-safety-test.sh`

Test arithmetic overflow/underflow protection.

```bash
./scripts/arithmetic-safety-test.sh
```

#### `scripts/nullifier-validation-test.sh`

Validate nullifier double-spend prevention.

```bash
./scripts/nullifier-validation-test.sh
```

#### `scripts/vault-balance-protection-test.sh`

Test vault balance protection mechanisms.

```bash
./scripts/vault-balance-protection-test.sh
```

#### `scripts/fee-manipulation-protection-test.sh`

Test fee manipulation protection.

```bash
./scripts/fee-manipulation-protection-test.sh
```

#### `scripts/end-to-end-lifecycle-test.sh`

End-to-end privacy lifecycle validation.

```bash
./scripts/end-to-end-lifecycle-test.sh
```

#### `scripts/cross-platform-hash-verification.sh`

Cross-platform hash consistency verification.

```bash
./scripts/cross-platform-hash-verification.sh
```

---

### Infrastructure Scripts

#### `scripts/test-infrastructure.sh`

Test all infrastructure components.

```bash
./scripts/test-infrastructure.sh
```

**Tests:**
- Relayer service
- Key persistence
- Rate limiting
- Monitoring
- Alert system
- Database connectivity
- Load balancing
- Health checks
- Security configuration
- Logging configuration

#### `scripts/test-admin-controls.sh`

Test admin control functionality.

```bash
./scripts/test-admin-controls.sh
```

**Tests:**
- Emergency mode controls
- Fee multiplier adjustment
- Pause/resume operations
- Admin authentication
- Admin permissions

#### `scripts/test-emergency-procedures.sh`

Test emergency procedures.

```bash
./scripts/test-emergency-procedures.sh
```

**Tests:**
- Circuit breaker functionality
- Emergency mode activation/deactivation
- Pause/resume operations
- Emergency event emission
- Emergency rollback procedures
- Emergency communication procedures

---

### Utility Scripts

#### `scripts/launch.sh`

Launch the tactical command center.

```bash
./scripts/launch.sh
```

**Operations:**
1. Check Node.js installation
2. Build SDK if needed
3. Launch dashboard

#### `scripts/start-dashboard.sh`

Start the dashboard server.

```bash
./scripts/start-dashboard.sh
```

**Environment Variables:**
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (default: production)

---

### Rust/Clippy Scripts

#### `scripts/rust-clippy-test.sh`

Run Rust clippy validation.

```bash
./scripts/rust-clippy-test.sh
```

#### `scripts/rust-dependency-audit.sh`

Audit Rust dependencies for vulnerabilities.

```bash
./scripts/rust-dependency-audit.sh
```

#### `scripts/rust-poseidon-test.sh`

Test Rust Poseidon implementation.

```bash
TEST_INPUTS="123,456" ./scripts/rust-poseidon-test.sh
```

---

## Anchor/Cargo Commands

### Anchor Commands

| Command | Description |
|---------|-------------|
| `anchor build` | Build the Solana program |
| `anchor deploy` | Deploy to configured cluster |
| `anchor deploy --provider.cluster devnet` | Deploy to devnet |
| `anchor deploy --provider.cluster mainnet` | Deploy to mainnet |
| `anchor deploy --provider.cluster localnet` | Deploy to local validator |
| `anchor keys list` | List program keypairs |
| `anchor run initialize` | Run initialize script |
| `anchor run health` | Run health check script |
| `anchor test` | Run Anchor tests |

### Cargo Commands

| Command | Description |
|---------|-------------|
| `cargo build --lib` | Build the library |
| `cargo build --release` | Build optimized release |
| `cargo test` | Run all tests |
| `cargo test poseidon` | Run Poseidon tests |
| `cargo test --release` | Run tests in release mode |
| `cargo clippy` | Run linter |
| `cargo audit` | Audit dependencies |
| `cargo fetch` | Fetch dependencies |

### Solana CLI Commands

| Command | Description |
|---------|-------------|
| `solana balance` | Check wallet balance |
| `solana config set --url <url>` | Set RPC URL |
| `solana program deploy <file>` | Deploy program |
| `solana program show <id>` | Show program info |
| `solana program show --buffers` | List program buffers |
| `solana program close <addr>` | Close program buffer |
| `solana account <addr>` | Show account info |
| `solana-keygen pubkey <file>` | Get public key from file |

---

## ZK Circuit Commands

### Circom Commands

| Command | Description |
|---------|-------------|
| `circom <file> --r1cs` | Generate R1CS constraint system |
| `circom <file> --wasm` | Generate WASM witness calculator |
| `circom <file> --c` | Generate C witness calculator |
| `circom <file> --sym` | Generate symbol file |
| `circom <file> -l <path>` | Include library path |
| `circom <file> -o <dir>` | Output directory |
| `circom <file> --O2` | Optimization level 2 |

### SnarkJS Commands

| Command | Description |
|---------|-------------|
| `npx snarkjs powersoftau new bn128 14 <output>` | Create new Powers of Tau |
| `npx snarkjs powersoftau contribute <in> <out>` | Contribute to ceremony |
| `npx snarkjs powersoftau prepare phase2 <in> <out>` | Prepare for phase 2 |
| `npx snarkjs groth16 setup <r1cs> <ptau> <zkey>` | Groth16 trusted setup |
| `npx snarkjs zkey contribute <in> <out>` | Contribute to zkey |
| `npx snarkjs zkey export verificationkey <zkey> <vk>` | Export verification key |
| `npx snarkjs zkey export solidityverifier <zkey> <sol>` | Export Solidity verifier |
| `npx snarkjs groth16 prove <zkey> <witness> <proof> <public>` | Generate proof |
| `npx snarkjs groth16 verify <vk> <public> <proof>` | Verify proof |

---

## CI/CD Workflows

### `privacy.yml` - Privacy Zero Scan

**Triggers:**
- Push to `main`
- Pull requests

**Jobs:**
```yaml
- uses: actions/checkout@v3
- uses: actions/setup-node@v3 (node: 18.x)
- run: npm install
- run: npm test
- run: npm run build
```

### `hash-verification.yml` - Cross-Component Hash Verification

**Triggers:**
- Push to `main`, `develop`
- Pull requests to `main`

**Matrix:**
- Node.js: 18.x, 20.x
- Rust: stable, 1.70.0

**Jobs:**
```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
- uses: actions-rs/toolchain@v1
- Install Circom
- npm ci
- cargo fetch
- ./scripts/verify-hash-consistency.sh
- npm test -- tests/integration/cross-component-hash-verification.test.ts
- cargo test test_poseidon_hash --release
- cargo test test_merkle_root --release
- cargo test test_hash_consistency_edge_cases --release
- cargo test test_regression_vectors --release
```

---

## API Endpoints

### Dashboard API (`/api/solvoid`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/solvoid` | Main SolVoid API endpoint |
| GET | `/api/test` | Test endpoint |

### Relayer API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/commitments` | Get commitment tree |
| POST | `/relay` | Relay transaction |
| POST | `/broadcast` | Broadcast signed transaction |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `PROGRAM_ID` | SolVoid program ID | `Fg6PaFpoGXkYsidMpSsu3SWJYEHp7rQU9YSTFNDQ4F5i` |
| `SHADOW_RELAYER_URL` | Shadow relayer URL | `http://localhost:3000` |
| `ZK_WASM_PATH` | Path to ZK WASM file | `./circuits/withdraw_js/withdraw.wasm` |
| `ZK_ZKEY_PATH` | Path to ZK key file | `./circuits/build/withdraw_final.zkey` |
| `ANCHOR_PROVIDER_URL` | Anchor RPC URL | `https://api.devnet.solana.com` |
| `ANCHOR_WALLET` | Anchor wallet path | `~/.config/solana/id.json` |
| `PORT` | Dashboard port | `3001` |
| `NODE_ENV` | Node environment | `development` |
| `SOLANA_PRIVATE_KEY` | Private key for tests | - |
| `USE_DEVNET` | Enable devnet tests | - |
| `TEST_INPUTS` | Test inputs for Poseidon | - |

---

## Quick Reference

### Most Common Commands

```bash
# Development
npm run build                    # Build all TypeScript
npm run test                     # Run all tests
npm run dashboard:dev            # Start dashboard dev server

# CLI
solvoid ghost <address>          # Check privacy score
solvoid rescue <wallet> --dry-run # Simulate rescue
solvoid shield <amount>          # Private deposit
solvoid admin pause              # Emergency pause

# ZK Circuits
./scripts/build-circuits.sh      # Build ZK circuits
./scripts/mpc-ceremony.sh contribute "Name"  # Add ceremony contribution
./scripts/mpc-ceremony.sh finalize           # Finalize ceremony

# Deployment
./scripts/deploy-zk-program.sh devnet   # Deploy to devnet
./scripts/deploy-zk-program.sh mainnet  # Deploy to mainnet

# Security
./scripts/run-security-tests.sh  # Run security tests
./scripts/security-validation.sh # Full security validation
./scripts/verify-deployment.sh   # Pre-deployment checks

# Rust
cargo build --lib                # Build Rust program
cargo test                       # Run Rust tests
```

---

*Generated for SolVoid v1.3.0*
