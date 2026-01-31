# Deployment Infrastructure: Component Orchestration

This document specifies the requirements and procedures for deploying protocol components across the on-chain, interface, and relay layers.

---

## On-Chain Logic (Solana Program)

### Prerequisites
- Solana Tool Suite initialized for the target cluster (Devnet/Mainnet).
- Authorized deployment wallet with sufficient SOL liquidity for rent and execution fees.

### Procedures
1. **Source Compilation:**
   ```bash
   anchor build
   ```
2. **Cluster Deployment:**
   ```bash
   anchor deploy --provider.cluster <NETWORK>
   ```
3. **State Initialization:**
   ```bash
   solvoid init --authority <PUBKEY>
   ```

---

## User Interface (Dashboard)

The Dashboard utilizes the Next.js framework and is optimized for deployment on Vercel or Netlify.

### Environment Configuration
The following environment variables must be configured on the hosting platform:
- `NEXT_PUBLIC_RPC_URL`: Primary Solana JSON-RPC endpoint.
- `NEXT_PUBLIC_PROGRAM_ID`: Canonical SolVoid Program ID.

### Build and Execution
```bash
# Production Build
npm run build

# Service Start
npm run start
```

---

## Shadow Relayer (Node.js/Containerized)

Relayer instances require a high-availability environment to ensure protocol responsiveness.

### Containerized Deployment (Recommended)
```bash
docker build -t solvoid-relayer ./relayer
docker run -p 3001:3001 --env-file .env solvoid-relayer
```

### Direct Service Orchestration
```bash
cd relayer
npm install
npm run build
pm2 start dist/index.js --name solvoid-relayer
```

---

## CI/CD Pipeline Integration

Automated CI/CD orchestration is facilitated via GitHub Actions.
- **Main Branch Integration:** Triggers automated deployment to the Staging/Devnet environment.
- **Release Tagging:** Triggers production deployment to the Mainnet environment.

For implementation details, refer to [CICD_REFERENCE.md](./CICD_REFERENCE.md).

---

## Protocol Rollback Procedures

### On-Chain Programs
Rollback capability is contingent on upgrade authority settings and buffer management.
```bash
solana program rollback <PROGRAM_ID>
```

### Interface Layer
Utilize the integrated version control features on Vercel/Netlify to revert to previous stable deployments.
