# Contribution Implementation: Collaboration Standards

The SolVoid project prioritizes professional, engineering-first collaboration to advance the state of privacy on the Solana network.

## Code of Conduct
All participants are required to adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md) during all protocol-related interactions.

---

## Technical Contribution Pathways

### Defect Reporting (Bug Discovery)
- **State Analysis:** Verify if a matching issue exists within our current tracker before initializing a new report.
- **Specification Requirements:** Reports must include environment specifications (OS, local runtime versions), dependency versions (Anchor/Solana CLI), and a deterministic reproduction case.
- **Log Attachment:** Attach relevant terminal output or serialized transaction logs to facilitate rapid remediation.

### Feature Proposals
Enhancement requests should be submitted via the issue tracker using the "Feature Request" classification. Proposals should address:
- **Scope:** Technical specification of the proposed capability.
- **Justification:** Architectural or privacy-focused rationale for the addition.
- **Implementation:** High-level description of the proposed operational logic.

### Pull Request (PR) Requirements
1. **Fork Synchronization:** Fork the primary repository and initialize a feature branch from the `main` HEAD.
2. **Environment Initialization:** Refer to [GETTING_STARTED.md](./GETTING_STARTED.md) for standard setup procedures.
3. **Verification Coverage:** All changes must be accompanied by comprehensive unit or integration tests.
4. **Formatting Compliance:** Adhere to established styling standards via Prettier (TypeScript) and `cargo fmt` (Rust).
5. **Documentation Parity:** Update all relevant `.md` reference files to reflect changes in API signatures or protocol behavior.

---

## Local Development Execution

```bash
# Node environment initialization
npm install

# Suite verification
anchor test

# Cryptographic primitive generation
./scripts/build-zk.sh
```

---

## Commit Orchestration Standards
We adhere to the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification:
- `feat:` for primitive or feature implementation.
- `fix:` for protocol or service defect remediation.
- `docs:` for documentation-only modifications.
- `refactor:` for internal logic optimization without interface changes.

---

## Contributor Recognition
Contributors are acknowledged within the primary README. Future governance or DAO transitions will utilize contribution history as a baseline for community participation metrics.

---
*For technical inquiries or priority disclosures, contact our engineering team via [Twitter/X](https://x.com/solvoid).*
