# SolVoid Mainnet Launch Checklist

**Version:** 1.0.0  
**Last Updated:** 2026-02-01  
**Status:** PRE-LAUNCH

---

## Overview

This checklist must be completed before deploying SolVoid to Solana Mainnet-Beta. Each item requires sign-off from the responsible party.

---

## 1. Security Audits

### 1.1 Smart Contract Audit
- [ ] **Solana Program Audit** - External security firm review of `programs/solvoid-zk`
- [ ] **All critical/high findings resolved**
- [ ] **Medium findings addressed or accepted with documentation**
- [ ] **Audit report published**

### 1.2 Cryptographic Audit
- [ ] **ZK Circuit Review** - Formal verification of `circuits/withdraw.circom`
- [ ] **Poseidon Implementation Audit** - Cross-platform hash consistency verified
- [ ] **Groth16 Verifier Audit** - On-chain verifier matches snarkjs output

### 1.3 Infrastructure Audit
- [ ] **Relayer Security Review** - Replay protection, rate limiting verified
- [ ] **SDK Security Review** - No secret leakage, proper randomness

---

## 2. Testing Requirements

### 2.1 Unit Tests
- [ ] **SDK unit tests passing** - `npm run test:unit`
- [ ] **Rust unit tests passing** - `cargo test`
- [ ] **Code coverage ≥ 80%**

### 2.2 Integration Tests
- [ ] **End-to-end deposit/withdraw flow** - `npm run test:integration`
- [ ] **Cross-platform hash consistency** - TypeScript ↔ Rust ↔ Circom
- [ ] **Merkle tree state synchronization**

### 2.3 Security Tests
- [ ] **Circuit soundness tests passing** - Invalid proofs rejected
- [ ] **Verifier consistency tests passing** - On-chain = off-chain
- [ ] **State invariant tests passing** - No double-spend possible
- [ ] **Adversarial tests passing** - Attack simulations fail

### 2.4 Performance Tests
- [ ] **Proof generation < 10 seconds** on consumer hardware
- [ ] **Transaction simulation successful** on mainnet RPC
- [ ] **Load testing completed** - 100+ concurrent operations

---

## 3. Cryptographic Setup

### 3.1 Trusted Setup Ceremony
- [ ] **Powers of Tau downloaded** - Hermez pot14_0000.ptau
- [ ] **Circuit-specific ceremony completed** - withdraw_final.zkey generated
- [ ] **Verification key exported** - verification_key.json validated
- [ ] **Ceremony transcript published** - Reproducible build verified

### 3.2 Key Verification
- [ ] **Verification key hash published** - SHA256 commitment
- [ ] **On-chain VK matches ceremony output**
- [ ] **Independent verification by third party**

---

## 4. Deployment Preparation

### 4.1 Program Deployment
- [ ] **Program ID reserved** - Keypair generated and secured
- [ ] **Upgrade authority configured** - Multi-sig or frozen
- [ ] **Program deployed to devnet** - Full test cycle completed
- [ ] **Program deployed to mainnet** - `anchor deploy --provider.cluster mainnet`

### 4.2 Account Initialization
- [ ] **State PDA initialized** - `solvoid init`
- [ ] **Verifier state initialized** - Verification key loaded
- [ ] **Root history initialized** - Empty tree root stored
- [ ] **Economic state initialized** - Default parameters set
- [ ] **Vault PDA funded** - Minimum reserve deposited
- [ ] **Treasury PDA created** - Fee accumulator ready

### 4.3 Authority Configuration
- [ ] **Multi-sig authority deployed** - Recommended: 3-of-5
- [ ] **Authority transferred to multi-sig**
- [ ] **Emergency procedures tested** - Circuit breaker, emergency mode

---

## 5. Infrastructure

### 5.1 Relayer Network
- [ ] **Primary relayer deployed** - Geographic redundancy
- [ ] **Backup relayer deployed** - Failover tested
- [ ] **Rate limiting configured** - 100 req/min/IP
- [ ] **Monitoring enabled** - Alerts for anomalies

### 5.2 RPC Configuration
- [ ] **Primary RPC endpoint** - Low latency, high availability
- [ ] **Fallback RPC endpoints** - 3+ alternatives configured
- [ ] **WebSocket connections** - Real-time state updates

### 5.3 Monitoring & Alerting
- [ ] **Transaction monitoring** - Success/failure rates
- [ ] **Vault balance monitoring** - Reserve threshold alerts
- [ ] **Circuit breaker monitoring** - Automatic notifications
- [ ] **Uptime monitoring** - Relayer availability

---

## 6. Documentation

### 6.1 User Documentation
- [ ] **Getting started guide** - First deposit walkthrough
- [ ] **CLI reference** - All commands documented
- [ ] **SDK reference** - API documentation complete
- [ ] **FAQ** - Common questions answered

### 6.2 Security Documentation
- [ ] **Trust assumptions document** - TRUST_ASSUMPTIONS_FREEZE.md
- [ ] **Security policy** - Responsible disclosure process
- [ ] **Incident response plan** - Emergency procedures documented

### 6.3 Technical Documentation
- [ ] **Architecture overview** - System design documented
- [ ] **API reference** - Relayer endpoints documented
- [ ] **Deployment guide** - Reproducible deployment steps

---

## 7. Legal & Compliance

### 7.1 Legal Review
- [ ] **Terms of service** - User agreements
- [ ] **Privacy policy** - Data handling practices
- [ ] **Regulatory assessment** - Jurisdiction-specific review

### 7.2 Compliance
- [ ] **OFAC screening integration** - Optional compliance mode
- [ ] **Audit trail capability** - For institutional users

---

## 8. Launch Procedures

### 8.1 Pre-Launch (T-7 days)
- [ ] **Final security review completed**
- [ ] **Mainnet deployment verified**
- [ ] **Monitoring systems active**
- [ ] **Support channels ready**

### 8.2 Launch Day (T-0)
- [ ] **Circuit breaker in standby mode**
- [ ] **Team on-call for 24 hours**
- [ ] **Initial deposits monitored closely**
- [ ] **Public announcement published**

### 8.3 Post-Launch (T+7 days)
- [ ] **No critical issues reported**
- [ ] **Transaction volume within expectations**
- [ ] **User feedback collected**
- [ ] **Bug bounty program announced**

---

## 9. Emergency Procedures

### 9.1 Circuit Breaker Activation
```bash
# Halt all withdrawals immediately
solvoid admin trigger-circuit-breaker
```

### 9.2 Emergency Mode
```bash
# Increase fees to deter attacks
solvoid admin trigger-emergency --multiplier 10 --reason "Suspicious activity"
```

### 9.3 Recovery Procedures
- [ ] **Root cause analysis template ready**
- [ ] **Communication templates ready**
- [ ] **Rollback procedures documented**

---

## 10. Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Lead Developer | | | |
| Security Lead | | | |
| Operations Lead | | | |
| Project Manager | | | |

---

## Approval

By signing above, we certify that all checklist items have been completed and the protocol is ready for mainnet deployment.

**Final Approval Date:** _______________

---

*This checklist must be version-controlled and updated for each deployment.*
