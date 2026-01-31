# SolVoid Ghost System Reference

Technical specification for our privacy audit and reputation engine. We utilize the Ghost System to quantify transaction privacy and generate cryptographically verifiable reputation artifacts.

---

## Privacy Scoring Methodology

Our engine calculates a "Ghost Score" (0-100) based on five weighted dimensions of wallet activity. We prioritize data-driven analysis to provide an accurate representation of a wallet's anonymity set.

### Weighted Dimensions

| Dimension | Weight | Our Analysis Criteria |
|-----------|--------|----------------------|
| **Anonymity** | 25% | Ratio of shielded vs. public transactions |
| **Linkage** | 25% | Graph analysis of links to known CEX/DEX entities |
| **Pattern** | 20% | Identification of repeating transaction amounts or loops |
| **Volume** | 15% | Analysis of amount obfuscation and splitting |
| **Timing** | 15% | Resistance to temporal correlation attacks |

---

## Verifiable Privacy Badges

We enable users to generate shareable badges that prove their privacy score without revealing their wallet address.

**System Mechanics:**
1. **Local Calculation**: We compute the score locally within the SDK.
2. **ZK Attestation**: We generate a ZK proof that attests to the score range (e.g., "Score > 80") without leaking the underlying transaction history.
3. **Badge Metadata**: We package this proof into a JSON-LD format suitable for social sharing and platform integration.

---

## Implementation Patterns

Our system provides the suivant integration points:

- **CLI Interface**: `solvoid ghost <address> --badge`
- **SDK Integration**: `BadgeGenerator.generate(address, ghostScore)`
- **Verification**: `BadgeGenerator.verifyBadge(proofData)`

## Classification Standards

We categorize privacy levels into five distinct tiers based on our scoring engine:

- **Invisible (90-100)**: Maximum anonymity set.
- **Translucent (70-89)**: Strong privacy practices.
- **Visible (50-69)**: Basic privacy protections active.
- **Exposed (30-49)**: Significant privacy leaks detected.
- **Glass House (0-29)**: Complete lack of privacy protocols.
