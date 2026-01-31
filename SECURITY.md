# Security Standards: Protocol Integrity & Disclosure

## Vulnerability Disclosure Policy

The SolVoid project recognizes that protocol security is an ongoing engineering process. In the event of vulnerability identification, we prioritize responsible, coordinated disclosure to ensure the continuous protection of the collective anonymity set.

### Reporting Methodology
- **Communication Channel:** [security@solvoid.io] (Contact registry placeholder).
- **Cryptographic Protection:** Encrypt all sensitive disclosures using the project's PGP identifier (Link placeholder).
- **Response Protocol:** The engineering team will acknowledge reports within 48 hours and establish a remediation timeline. We request that reporters maintain confidentiality until a verified patch has been deployed across the network.

---

## Technical Security Best Practices

1. **Primitive Sequestration:** The secret and nullifier keys constitute the sole access vectors for shielded liquidity. Execution of the protocol implies user responsibility for the secure, off-chain storage of these cryptographical primitives.
2. **Identity Decoupling:** To maintain maximum anonymity, withdrawal destination addresses should have zero historical on-chain linkage to the depositor's primary identity.
3. **Environment Verification:** Verify the integrity of the local build or ensure the use of the canonical `solvoid.io` interface to mitigate man-in-the-middle or phishing attacks.
4. **Gas Funding Risks:** When not utilizing the Shadow Relayer network, funding a fresh destination wallet with SOL gas may introduce timing-based or graph-based linkage vulnerabilities.

---

## Critical Security Considerations & Risk Factors

1. **Audit Status:** The current protocol implementation has **not** undergone a third-party security audit. Usage is restricted to experimental or testing environments.
2. **Proving Ceremony Requirements:** Proving keys currently in use are intended for development cycles. A production-grade Multi-Party Computation (MPC) ceremony is mandatory before Mainnet architectural finalization.
3. **Circuit Constraints:** Circom circuit constraints are undergoing continuous peer review and refinement to ensure comprehensive boundary coverage.
4. **Relayer Trust Model:** Relayer entities are restricted by ZK-bindings from asset theft, but retain the capacity for IP logging or localized Denial of Service (DoS).

---

## Version Support Matrix

| Specification | Support Status | Maintenance Type |
|---------------|----------------|------------------|
| 0.2.x         | Active         | Feature/Security |
| 0.1.x         | Deprecated     | Critical Fixes   |

---

## Bug Bounty Initiative
We operate a "Coordinated Vulnerability Research" program. Reports of critical vulnerabilities that adhere to disclosure requirements are prioritized for retroactive rewards as the protocol ecosystem matures.
