import { PublicKey } from '@solana/web3.js';
import { Idl, IdlInstruction } from './types';
import { InstructionDecoder } from './decoder';
import { TransactionGraph, TransactionNode, TransactionEdge } from './graph';
import { KNOWN_PROGRAMS, identifyProgram, isSwapProgram } from '../registry/programs';
import { EventBus } from '../events/bus';

/**
 * Semantic analysis result for a single instruction
 */
export interface InstructionSemantics {
    readonly programId: string;
    readonly programName: string;
    readonly instructionName: string | null;
    readonly category: InstructionCategory;
    readonly privacyImpact: PrivacyImpact;
    readonly accounts: readonly AccountRole[];
    readonly dataFields: readonly DataField[];
}

/**
 * Categories of instruction types
 */
export type InstructionCategory =
    | 'TRANSFER'
    | 'SWAP'
    | 'STAKE'
    | 'GOVERNANCE'
    | 'NFT'
    | 'DEFI'
    | 'SYSTEM'
    | 'TOKEN'
    | 'UNKNOWN';

/**
 * Privacy impact levels
 */
export interface PrivacyImpact {
    readonly level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    readonly reason: string;
    readonly mitigations: readonly string[];
}

/**
 * Role of an account in an instruction
 */
export interface AccountRole {
    readonly pubkey: string;
    readonly role: 'SIGNER' | 'WRITABLE' | 'READONLY' | 'FEE_PAYER' | 'AUTHORITY';
    readonly semanticType: string | null;
}

/**
 * Parsed data field from instruction
 */
export interface DataField {
    readonly name: string;
    readonly type: string;
    readonly value: unknown;
    readonly privacySensitive: boolean;
}

/**
 * Full transaction semantic analysis result
 */
export interface TransactionSemantics {
    readonly signature: string;
    readonly timestamp: number;
    readonly feePayer: string;
    readonly instructions: readonly InstructionSemantics[];
    readonly overallPrivacyScore: number;
    readonly graphNodes: readonly TransactionNode[];
    readonly graphEdges: readonly TransactionEdge[];
}

/**
 * SemanticAnalyzer - Deep analysis of transaction semantics
 * 
 * Analyzes transactions to understand:
 * - What programs are being called
 * - What operations are being performed
 * - Privacy implications of each operation
 * - Account relationships and data flows
 */
export class SemanticAnalyzer {
    private readonly decoder: InstructionDecoder;
    private readonly graph: TransactionGraph;

    constructor() {
        this.decoder = new InstructionDecoder();
        this.graph = new TransactionGraph();
    }

    /**
     * Register an IDL for instruction decoding
     */
    public registerIdl(programId: string, idl: Idl): void {
        this.decoder.registerIdl(programId, idl);
    }

    /**
     * Analyze a transaction and return semantic information
     */
    public analyzeTransaction(
        signature: string,
        accountKeys: readonly string[],
        instructions: readonly {
            programIdIndex: number;
            accounts: readonly number[];
            data: string;
        }[],
        timestamp?: number
    ): TransactionSemantics {
        const feePayer = accountKeys[0] ?? 'unknown';
        const analyzedInstructions: InstructionSemantics[] = [];

        for (const ix of instructions) {
            const programId = accountKeys[ix.programIdIndex] ?? 'unknown';
            const semantics = this.analyzeInstruction(
                programId,
                ix.accounts.map(i => accountKeys[i] ?? 'unknown'),
                ix.data,
                feePayer
            );
            analyzedInstructions.push(semantics);

            // Add to graph
            this.addInstructionToGraph(signature, semantics, feePayer);
        }

        const overallPrivacyScore = this.calculateOverallPrivacyScore(analyzedInstructions);

        return {
            signature,
            timestamp: timestamp ?? Date.now(),
            feePayer,
            instructions: analyzedInstructions,
            overallPrivacyScore,
            graphNodes: this.graph.getNodes(),
            graphEdges: this.graph.getEdges()
        };
    }

    /**
     * Analyze a single instruction
     */
    private analyzeInstruction(
        programId: string,
        accounts: readonly string[],
        dataBase64: string,
        feePayer: string
    ): InstructionSemantics {
        const programName = identifyProgram(programId);
        const isSwap = isSwapProgram(programId);
        const category = this.categorizeProgram(programId, programName);

        // Try to decode instruction
        const dataBuf = Buffer.from(dataBase64, 'base64');
        const decoded = this.decoder.decode(programId, dataBuf);

        const accountRoles = this.analyzeAccountRoles(accounts, feePayer, category);
        const privacyImpact = this.assessPrivacyImpact(category, isSwap, accounts, feePayer);
        const dataFields = this.extractDataFields(decoded, dataBuf);

        return {
            programId,
            programName,
            instructionName: decoded?.name ?? null,
            category,
            privacyImpact,
            accounts: accountRoles,
            dataFields
        };
    }

    /**
     * Categorize a program based on its ID and name
     */
    private categorizeProgram(programId: string, programName: string): InstructionCategory {
        const nameLower = programName.toLowerCase();

        if (programId === '11111111111111111111111111111111') return 'SYSTEM';
        if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') return 'TOKEN';
        if (programId === 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL') return 'TOKEN';

        if (nameLower.includes('swap') || nameLower.includes('amm') || isSwapProgram(programId)) {
            return 'SWAP';
        }
        if (nameLower.includes('stake')) return 'STAKE';
        if (nameLower.includes('governance') || nameLower.includes('vote')) return 'GOVERNANCE';
        if (nameLower.includes('nft') || nameLower.includes('metaplex')) return 'NFT';
        if (nameLower.includes('lend') || nameLower.includes('borrow') || nameLower.includes('margin')) {
            return 'DEFI';
        }

        return 'UNKNOWN';
    }

    /**
     * Analyze account roles in an instruction
     */
    private analyzeAccountRoles(
        accounts: readonly string[],
        feePayer: string,
        category: InstructionCategory
    ): AccountRole[] {
        return accounts.map((pubkey, index) => {
            let role: AccountRole['role'] = 'READONLY';
            let semanticType: string | null = null;

            if (pubkey === feePayer) {
                role = 'FEE_PAYER';
                semanticType = 'fee_payer';
            } else if (index === 0) {
                // First account is often the authority/signer
                role = 'SIGNER';
                semanticType = 'authority';
            } else if (category === 'TRANSFER' && index <= 1) {
                role = 'WRITABLE';
                semanticType = index === 0 ? 'source' : 'destination';
            } else if (category === 'SWAP' && index <= 4) {
                role = 'WRITABLE';
                semanticType = ['user_source', 'user_dest', 'pool_source', 'pool_dest'][index - 1] ?? null;
            }

            return { pubkey, role, semanticType };
        });
    }

    /**
     * Assess privacy impact of an instruction
     */
    private assessPrivacyImpact(
        category: InstructionCategory,
        isSwap: boolean,
        accounts: readonly string[],
        feePayer: string
    ): PrivacyImpact {
        // High-privacy-impact operations
        if (isSwap) {
            return {
                level: 'HIGH',
                reason: 'DEX swaps create permanent on-chain records linking input/output tokens',
                mitigations: [
                    'Use privacy shielding before swapping',
                    'Consider splitting swaps across multiple transactions',
                    'Use a fresh wallet for each swap'
                ]
            };
        }

        if (category === 'TRANSFER') {
            const isDirectLink = accounts.some(a => a === feePayer && accounts.length <= 3);
            if (isDirectLink) {
                return {
                    level: 'CRITICAL',
                    reason: 'Direct transfer creates explicit link between sender and recipient',
                    mitigations: [
                        'Use privacy shielding to break the link',
                        'Route through a relay service',
                        'Use time delays between deposits and withdrawals'
                    ]
                };
            }
            return {
                level: 'MEDIUM',
                reason: 'Transfer operation visible on-chain',
                mitigations: ['Shield funds before transferring']
            };
        }

        if (category === 'TOKEN') {
            return {
                level: 'MEDIUM',
                reason: 'Token operations create linkage between wallet and token accounts',
                mitigations: ['Use shielded token transfers when possible']
            };
        }

        if (category === 'SYSTEM') {
            return {
                level: 'LOW',
                reason: 'System program operations are standard',
                mitigations: []
            };
        }

        return {
            level: 'LOW',
            reason: 'Unknown privacy implications',
            mitigations: ['Review transaction manually']
        };
    }

    /**
     * Extract data fields from decoded instruction
     */
    private extractDataFields(decoded: any, rawData: Buffer): DataField[] {
        const fields: DataField[] = [];

        if (!decoded || !decoded.data) {
            // If we can't decode, just return the raw discriminator
            if (rawData.length >= 8) {
                fields.push({
                    name: 'discriminator',
                    type: 'bytes',
                    value: rawData.subarray(0, 8).toString('hex'),
                    privacySensitive: false
                });
            }
            return fields;
        }

        // Extract known fields
        for (const [key, value] of Object.entries(decoded.data)) {
            const isSensitive = this.isPrivacySensitiveField(key);
            fields.push({
                name: key,
                type: typeof value,
                value,
                privacySensitive: isSensitive
            });
        }

        return fields;
    }

    /**
     * Check if a field name indicates privacy-sensitive data
     */
    private isPrivacySensitiveField(fieldName: string): boolean {
        const sensitivePatterns = [
            'amount',
            'recipient',
            'destination',
            'owner',
            'authority',
            'signer',
            'secret',
            'nullifier',
            'commitment'
        ];
        const lower = fieldName.toLowerCase();
        return sensitivePatterns.some(pattern => lower.includes(pattern));
    }

    /**
     * Add instruction to the transaction graph
     */
    private addInstructionToGraph(
        signature: string,
        semantics: InstructionSemantics,
        feePayer: string
    ): void {
        // Add transaction node
        this.graph.addNode({
            id: signature,
            type: 'transaction',
            label: semantics.instructionName ?? semantics.category,
            metadata: {
                programId: semantics.programId,
                category: semantics.category,
                privacyLevel: semantics.privacyImpact.level
            }
        });

        // Add account nodes and edges
        for (const account of semantics.accounts) {
            this.graph.addNode({
                id: account.pubkey,
                type: 'account',
                label: account.semanticType ?? 'account',
                metadata: { role: account.role }
            });

            this.graph.addEdge({
                source: account.pubkey,
                target: signature,
                type: account.role === 'SIGNER' ? 'signed' : 'participated',
                weight: account.role === 'FEE_PAYER' ? 2 : 1
            });
        }
    }

    /**
     * Calculate overall privacy score from instruction analysis
     */
    private calculateOverallPrivacyScore(instructions: readonly InstructionSemantics[]): number {
        if (instructions.length === 0) return 100;

        const impactScores: Record<PrivacyImpact['level'], number> = {
            'NONE': 0,
            'LOW': 10,
            'MEDIUM': 25,
            'HIGH': 40,
            'CRITICAL': 60
        };

        let totalDeduction = 0;
        for (const ix of instructions) {
            totalDeduction += impactScores[ix.privacyImpact.level];
        }

        // Cap deduction at 90 (minimum score of 10)
        totalDeduction = Math.min(90, totalDeduction);

        return 100 - totalDeduction;
    }

    /**
     * Get the transaction graph
     */
    public getGraph(): TransactionGraph {
        return this.graph;
    }

    /**
     * Clear the transaction graph
     */
    public clearGraph(): void {
        this.graph.clear();
    }
}
