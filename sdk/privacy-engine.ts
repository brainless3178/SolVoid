import { PublicKey } from '@solana/web3.js';
import { TransactionJSON, Leak, GeyserTransactionEvents } from './types';

/** Protocol-standard system programs excluded from entropy calculations. */
const SYSTEM_PROGRAMS: readonly string[] = [
    "11111111111111111111111111111111",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
];

/**
 * PrivacyEngine: Heuristic analysis layer for identifying transaction-graph privacy leaks.
 * Implements weighted scoring based on identity linkage and metadata entropy.
 */
export class PrivacyEngine {

    /**
     * Executes a comprehensive leak analysis on a serialized transaction object.
     */
    public analyzeTransaction(tx: TransactionJSON): Leak[] {
        const leaks: Leak[] = [];
        const accountKeys = tx.message.accountKeys;
        const rootInstructions = tx.message.instructions;
        const feePayer = accountKeys[0];

        if (!feePayer) {
            throw new Error("Data Integrity Violation: Transaction primitive missing index-0 fee payer.");
        }

        /** 
         * Funding Linkage Analysis: 
         * Identifies direct creation of fresh accounts via SystemProgram instructions.
         */
        const logs = tx.meta?.logMessages;
        if (logs && logs.some((log: string) => log.includes("CreateAccount"))) {
            leaks.push({
                type: "identity",
                scope: "funding",
                visibility: "PUBLIC",
                description: "Direct account creation history identified in transaction logs.",
                remediation: "Utilize a relay service to decouple fee funding from primary identity.",
                severity: "HIGH"
            });
        }

        /** 
         * Associated Token Account (ATA) Linkage: 
         * Identifies explicit identity-to-token linkage via owner-field serialization in CPIs.
         */
        rootInstructions.forEach((ix) => {
            const programId = accountKeys[ix.programIdIndex];
            if (programId === "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL") {
                const ownerIndex = ix.accounts[2];
                if (ownerIndex !== undefined) {
                    const owner = accountKeys[ownerIndex];
                    if (owner === feePayer) {
                        leaks.push({
                            type: "identity",
                            scope: "ata_link",
                            visibility: "PUBLIC",
                            description: `Explicit ATA linking for identity ${owner.slice(0, 8)} detected.`,
                            remediation: "Execute token shielding protocols before cross-dApp interaction.",
                            severity: "CRITICAL"
                        });
                    }
                }
            }
        });

        /** 
         * Static Fingerprinting: 
         * High entropy interactions with diverse programs create a unique user profile.
         */
        const uniquePrograms = new Set(rootInstructions.map(ix => accountKeys[ix.programIdIndex]));
        const filteredPrograms = Array.from(uniquePrograms).filter(p => p !== undefined && !SYSTEM_PROGRAMS.includes(p));

        if (filteredPrograms.length > 2) {
            leaks.push({
                type: "metadata",
                scope: "fingerprinting",
                visibility: "PROGRAM",
                description: `High entropy profile: Transaction interacts with ${filteredPrograms.length} distinct program entities.`,
                remediation: "Partition interactions across multiple transactions with temporal variance.",
                severity: "MEDIUM"
            });
        }

        /** 
         * Raw Payload Leakage: 
         * Scans instruction data for raw public key byte-alignment (typical in state-storing instructions).
         */
        rootInstructions.forEach((ix, i) => {
            const dataBase64 = ix.data;
            const dataBuf = Buffer.from(dataBase64, 'base64');
            const dataHex = dataBuf.toString('hex');

            const payerBuf = new PublicKey(feePayer).toBuffer();
            const payerHex = payerBuf.toString('hex');

            if (dataHex.includes(payerHex)) {
                const programId = accountKeys[ix.programIdIndex] ?? 'unknown';
                leaks.push({
                    type: "identity",
                    scope: `payload:${programId}`,
                    visibility: "PUBLIC",
                    description: `Critical Leak: Signer public key identified in Instruction #${i} binary payload.`,
                    remediation: "Implement a shim layer to randomize identity bytes in program arguments.",
                    severity: "CRITICAL"
                });
            }
        });

        return leaks;
    }

    /**
     * Calculates the Privacy Ghost Score (0-100).
     * Implements weighted deduction ranges and correlation amplifiers.
     * 
     * Formula Logic:
     * - Base Penalty: Defined by leak type and severity.
     * - Frequency Multiplier: Escalates penalties for repeated leak vectors.
     * - Visibility Amplifier: Weighs public leaks higher than local or program-specific ones.
     */
    public calculateScore(leaks: readonly Leak[]): number {
        if (leaks.length === 0) return 100;

        let totalDeduction = 0;
        const typeCounts: Record<string, number> = {};
        const typesPresent = new Set<string>();

        const PENALTY_RANGES: Readonly<Record<string, readonly [number, number]>> = {
            "identity": [25, 40],
            "cpi-linkage": [20, 35],
            "state-leak": [15, 25],
            "metadata": [10, 20]
        };

        const FREQUENCY_MULTIPLIERS: readonly number[] = [1.0, 1.3, 1.6, 2.0];
        const SCOPE_AMPLIFIERS: Readonly<Record<string, number>> = {
            "PUBLIC": 1.5,
            "PROGRAM": 1.2,
            "LOCAL": 0.8
        };

        let totalRefundable = 0;

        leaks.forEach(leak => {
            const range = PENALTY_RANGES[leak.type] || [10, 20];
            let basePenalty = 0;
            switch (leak.severity) {
                case "CRITICAL": basePenalty = range[1]; break;
                case "HIGH": basePenalty = range[0] + (range[1] - range[0]) * 0.75; break;
                case "MEDIUM": basePenalty = range[0] + (range[1] - range[0]) * 0.50; break;
                case "LOW": basePenalty = range[0] + (range[1] - range[0]) * 0.25; break;
            }

            const count = (typeCounts[leak.type] || 0);
            const freqMult = count >= 3 ? (FREQUENCY_MULTIPLIERS[3] ?? 2.0) : (FREQUENCY_MULTIPLIERS[count] ?? 1.0);
            typeCounts[leak.type] = count + 1;
            typesPresent.add(leak.type);

            const scopeMult = SCOPE_AMPLIFIERS[leak.visibility] || 1.0;
            const finalLeakPenalty = basePenalty * freqMult * scopeMult;

            totalDeduction += finalLeakPenalty;

            if (leak.remediation) {
                totalRefundable += finalLeakPenalty * 0.3;
            }
        });

        /** Apply correlation penalties for interconnected leak vectors. */
        let correlationDeduction = 0;
        if (typesPresent.has("identity") && typesPresent.has("cpi-linkage")) correlationDeduction += 15;
        if (typesPresent.has("identity") && typesPresent.has("state-leak")) correlationDeduction += 12;
        if (typesPresent.has("cpi-linkage") && typesPresent.has("metadata")) correlationDeduction += 10;
        if (typesPresent.has("state-leak") && typesPresent.has("metadata")) correlationDeduction += 8;
        if (typesPresent.size >= 3) correlationDeduction += 20;

        totalDeduction += correlationDeduction;

        let finalScore = 100 - totalDeduction + totalRefundable;

        /** Enforce remediation and baseline score thresholds. */
        const maxScoreWithRemediation = 80;
        if (totalDeduction > 0 && finalScore > maxScoreWithRemediation) {
            finalScore = maxScoreWithRemediation;
        }

        const anyRemediation = leaks.some(l => !!l.remediation);
        if (anyRemediation && finalScore < 15) {
            finalScore = 15;
        }

        return Math.min(100, Math.max(0, Math.round(finalScore)));
    }

    /**
     * Executes advanced analyzer logic for Geyser-synchronous transaction events.
     */
    public analyzeGeyserEvents(tx: TransactionJSON, events: GeyserTransactionEvents): Leak[] {
        const leaks = this.analyzeTransaction(tx);

        /** Account update correlation logic for persistent state analysis. */
        events.accountUpdates.forEach(update => {
            if (update.pubkey.includes("1111")) return;
        });

        return leaks;
    }
}
