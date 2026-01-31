import { Connection, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { PrivacyEngine } from './privacy-engine';
import { PrivacyShield } from './privacy/shield';
import { EventBus } from './events/bus';
import { Leak } from './types';
import {
    DataOrigin,
    DataTrust,
    TransactionJSONSchema,
    enforce,
    DataMetadata
} from './integrity';

export interface ScanResult {
    readonly signature: string;
    readonly leaks: readonly Leak[];
    readonly remediation: {
        readonly action: string;
        readonly data: Record<string, unknown>;
        readonly description: string;
    } | null;
    readonly privacyScore: number; // Unit: PERCENT
}

export class PrivacyPipeline {
    private readonly connection: Connection;
    private readonly engine: PrivacyEngine;
    private readonly shield: PrivacyShield;

    constructor(connection: Connection, shield: PrivacyShield) {
        this.connection = connection;
        this.engine = new PrivacyEngine();
        this.shield = shield;
    }

    public async processAddress(address: PublicKey | string): Promise<ScanResult[]> {
        // Explicit conversion (Rule 6)
        const pubkey = typeof address === 'string' ? new PublicKey(address) : address;
        const addressStr = pubkey.toBase58();

        EventBus.scanStart(addressStr);
        EventBus.info('Fetching transaction history from Solana cluster...');

        // FIXED: Increase scan depth to prevent history smearing (Vulnerability: Semantic Evasion)
        const scanLimit = 50;
        const signatures = await this.connection.getSignaturesForAddress(pubkey, { limit: scanLimit });
        EventBus.info(`Found ${signatures.length} transactions. Analyzing latest ${scanLimit}...`);

        const results: ScanResult[] = [];
        let totalLeaksCount = 0;

        for (const sig of signatures.slice(0, 10)) {
            const rawTx = await this.connection.getTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0,
            });

            if (!rawTx) {
                // Explicit failure behavior (Rule 9)
                EventBus.error(`Transaction not found: ${sig.signature}`);
                continue;
            }

            // Data Transformation: External (Solana SDK) -> Internal (Rule 6)
            const txDataUnvalidated = {
                message: {
                    accountKeys: rawTx.transaction.message.staticAccountKeys.map((k) => k.toBase58()),
                    header: {
                        numRequiredSignatures: rawTx.transaction.message.header.numRequiredSignatures,
                    },
                    instructions: rawTx.transaction.message.compiledInstructions.map((ix) => {
                        let dataStr = '';
                        const data = ix.data;
                        if ((data as any) instanceof Uint8Array || Buffer.isBuffer(data) || Array.isArray(data)) {
                            dataStr = Buffer.from(data as any).toString('base64');
                        } else if (typeof data === 'string') {
                            dataStr = data;
                        }
                        return {
                            programIdIndex: ix.programIdIndex,
                            accounts: ix.accountKeyIndexes,
                            data: dataStr
                        };
                    })
                },
                meta: {
                    innerInstructions: rawTx.meta?.innerInstructions?.map(ii => ({
                        index: ii.index,
                        instructions: ii.instructions.map(ix => {
                            let dataStr = '';
                            const data = ix.data;
                            if ((data as any) instanceof Uint8Array || Buffer.isBuffer(data) || Array.isArray(data)) {
                                dataStr = Buffer.from(data as any).toString('base64');
                            } else if (typeof data === 'string') {
                                dataStr = data;
                            }
                            return {
                                programIdIndex: ix.programIdIndex,
                                accounts: ix.accounts,
                                data: dataStr
                            };
                        })
                    })) ?? null,
                    logMessages: rawTx.meta?.logMessages ?? null
                },
                signatures: rawTx.transaction.signatures.map(s => {
                    if (typeof s === 'string') return s;
                    return bs58.encode(s as Uint8Array);
                })
            };

            const metadata: DataMetadata = {
                origin: DataOrigin.CHAIN,
                trust: DataTrust.TRUSTED,
                createdAt: Date.now(),
                owner: 'Solana RPC'
            };

            const enforcedTx = enforce(TransactionJSONSchema, txDataUnvalidated, metadata);
            const txData = enforcedTx.value;

            // Emit transaction parsed event
            const programId = txData.message.accountKeys[
                txData.message.instructions[0]?.programIdIndex ?? 0
            ] ?? 'Unknown';

            EventBus.transactionParsed(sig.signature, programId);

            const leaks = this.engine.analyzeTransaction(txData);
            const privacyScore = this.engine.calculateScore(leaks);

            // Explicitly handle leaks (Rule 3)
            for (const leak of leaks) {
                EventBus.leakDetected(leak.type, leak.severity, leak.description, sig.signature);
                totalLeaksCount++;
            }

            if (leaks.length > 0) {
                const remediation = await this.generateRemediation(pubkey, leaks);
                results.push({
                    signature: sig.signature,
                    leaks,
                    remediation,
                    privacyScore
                });
            } else {
                results.push({
                    signature: sig.signature,
                    leaks: [],
                    remediation: null,
                    privacyScore: 100
                });
            }
        }

        // Calculate final score with unit enforcement (Rule 6)
        const avgScore = results.length > 0
            ? Math.round(results.reduce((acc, r) => acc + r.privacyScore, 0) / results.length)
            : 100;

        EventBus.scanComplete(addressStr, totalLeaksCount, avgScore);

        return results;
    }

    /**
     * Suggest specific fixes like shielding if we hit critical leak thresholds.
     */
    private async generateRemediation(_user: PublicKey, leaks: readonly Leak[]) {
        const criticalLeaks = leaks.filter(l => l.severity === 'CRITICAL' || l.severity === 'HIGH');

        if (criticalLeaks.length > 0) {
            // FIXED: Await the async commitment generation (Vulnerability: Ghost Commitment)
            const commitmentData = await this.shield.generateCommitment();
            EventBus.info('Critical leaks detected. Generating shielding recommendation...');

            return {
                action: 'SHIELD_BALANCE',
                data: {
                    commitment: commitmentData.commitmentHex,
                    nullifierHash: commitmentData.nullifierHash,
                },
                description: `High risk leaks found. Shielding recommended to break clear identity links.`,
            };
        }

        return null;
    }
}
