import { z } from 'zod';
import { Buffer } from 'buffer';

// Secure Buffer polyfill with type safety
if (typeof window !== 'undefined') {
    // Only set Buffer if it doesn't exist
    if (!(window as any).Buffer) {
        (window as any).Buffer = Buffer;
    }

    // Enhanced isBuffer with strict type checking
    const originalIsBuffer = (window as any).Buffer?.isBuffer;
    (window as any).Buffer.isBuffer = (obj: any): boolean => {
        // Use original if available
        if (originalIsBuffer && typeof originalIsBuffer === 'function') {
            return originalIsBuffer(obj);
        }

        // Strict type checking - no type confusion
        return obj instanceof Buffer ||
            (obj && obj.constructor && obj.constructor.name === 'Buffer');
    };
}

/**
 * Data Integrity Enforcement Layer
 * Complies with strict data-integrity enforcement mode.
 */

export enum DataOrigin {
    UI_INPUT = 'UI_INPUT',
    API_PAYLOAD = 'API_PAYLOAD',
    ENV_VAR = 'ENV_VAR',
    CLI_ARG = 'CLI_ARG',
    DB = 'DB',
    CACHE = 'CACHE',
    CHAIN = 'CHAIN',
    INTERNAL_LOGIC = 'INTERNAL_LOGIC',
}

export enum DataTrust {
    UNTRUSTED = 'UNTRUSTED',
    SEMI_TRUSTED = 'SEMI_TRUSTED',
    TRUSTED = 'TRUSTED',
}

export enum Unit {
    SOL = 'SOL',
    LAMPORT = 'LAMPORT',
    MS = 'MS',
    S = 'S',
    BYTES = 'BYTES',
    KB = 'KB',
    PERCENT = 'PERCENT',
}

export interface DataMetadata {
    readonly origin: DataOrigin;
    readonly trust: DataTrust;
    readonly createdAt: number; // Unix timestamp in MS
    readonly lifetimeMs?: number; // Validity duration
    readonly units?: Unit;
    readonly owner: string; // Source of Truth identifier
}

export interface EnforcedData<T> {
    readonly value: T;
    readonly metadata: DataMetadata;
}

/**
 * SCHEMA DEFINITIONS
 */

// 1. Types & 2. Shape
export const PublicKeySchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Base58 Public Key");
export const SignatureSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/, "Invalid Base58 Signature");

export const LeakTypeSchema = z.enum(["identity", "metadata", "state-leak", "cpi-linkage"]);
export const VisibilityScopeSchema = z.enum(["PUBLIC", "PROGRAM", "LOCAL"]);
export const SeveritySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

export const LeakSchema = z.object({
    type: LeakTypeSchema,
    scope: z.string().min(1),
    visibility: VisibilityScopeSchema,
    description: z.string().min(1),
    remediation: z.string().optional(),
    severity: SeveritySchema,
    programName: z.string().optional(),
}).strict(); // No extra keys allowed (Rule 2)

export const TransactionInstructionSchema = z.object({
    programIdIndex: z.number().int().nonnegative(),
    accounts: z.array(z.number().int().nonnegative()),
    data: z.string(), // Base64 encoded
}).strict();

export const TransactionJSONSchema = z.object({
    message: z.object({
        accountKeys: z.array(PublicKeySchema),
        header: z.object({
            numRequiredSignatures: z.number().int().nonnegative(),
        }).strict(),
        instructions: z.array(TransactionInstructionSchema),
    }).strict(),
    meta: z.object({
        innerInstructions: z.array(z.object({
            index: z.number().int().nonnegative(),
            instructions: z.array(TransactionInstructionSchema),
        }).strict()).optional().nullable(),
        logMessages: z.array(z.string()).optional().nullable(),
    }).strict().optional().nullable(),
    signatures: z.array(SignatureSchema),
}).strict();

export const IdlFieldSchema = z.object({
    name: z.string(),
    type: z.any(), // Complex IDL types (e.g. { defined: '...' }, { vec: '...' })
    docs: z.array(z.string()).optional(),
}).strict();

export const IdlInstructionSchema = z.object({
    name: z.string(),
    accounts: z.array(z.object({
        name: z.string(),
        writable: z.boolean().optional(),
        signer: z.boolean().optional(),
        isMut: z.boolean().optional(),
        isSigner: z.boolean().optional(),
        docs: z.array(z.string()).optional(),
        optional: z.boolean().optional(),
    }).passthrough()),
    args: z.array(IdlFieldSchema),
    discriminator: z.array(z.number()).optional(),
    docs: z.array(z.string()).optional(),
});

export const IdlAccountSchema = z.object({
    name: z.string(),
    type: z.object({
        kind: z.literal('struct'),
        fields: z.array(IdlFieldSchema),
    }).strict(),
    docs: z.array(z.string()).optional(),
}).strict();

export const IdlTypeSchema = z.object({
    name: z.string(),
    type: z.any(),
}).strict();

export const IdlEventSchema = z.object({
    name: z.string(),
    fields: z.array(z.object({
        name: z.string(),
        type: z.any(),
        index: z.boolean(),
    }).strict()),
}).strict();

export const IdlErrorSchema = z.object({
    code: z.number(),
    name: z.string(),
    msg: z.string().optional(),
}).strict();

export const IdlSchema = z.object({
    version: z.string(),
    name: z.string(),
    instructions: z.array(IdlInstructionSchema),
    accounts: z.array(IdlAccountSchema).optional(),
    types: z.array(IdlTypeSchema).optional(),
    events: z.array(IdlEventSchema).optional(),
    errors: z.array(IdlErrorSchema).optional(),
    metadata: z.any().optional(),
    address: PublicKeySchema.optional(),
}); // Removed strict to allow Anchor internal mutations

export const ScoreSnapshotSchema = z.object({
    timestamp: z.number().int().nonnegative(),
    score: z.number().int().min(0).max(100),
}).strict();

export const PrivacyBadgeSchema = z.object({
    name: z.string(),
    icon: z.string(),
    description: z.string(),
    dateEarned: z.number().int().nonnegative(),
}).strict();

export const PrivacyPassportSchema = z.object({
    walletAddress: PublicKeySchema,
    overallScore: z.number().int().min(0).max(100),
    scoreHistory: z.array(ScoreSnapshotSchema),
    badges: z.array(PrivacyBadgeSchema),
    recommendations: z.array(z.string()),
}).strict();

export const MerkleProofSchema = z.object({
    proof: z.array(z.string().regex(/^[0-9a-fA-F]{64}$/)), // Hex strings for transport
    indices: z.array(z.number().int().min(0).max(1)),
}).strict();

export const CommitmentDataSchema = z.object({
    secret: z.string().regex(/^[0-9a-fA-F]{64}$/),
    nullifier: z.string().regex(/^[0-9a-fA-F]{64}$/),
    commitment: z.string().regex(/^[0-9a-fA-F]{64}$/),
    nullifierHash: z.string().regex(/^[0-9a-fA-F]{64}$/),
    commitmentHex: z.string().regex(/^[0-9a-fA-F]{64}$/),
}).strict();

export const RelayRequestSchema = z.object({
    transaction: z.string().optional(), // Base64
    hops: z.number().int().min(1).max(5),
    targetNode: z.string().optional(),
    encryptedPayload: z.string().optional(),
}).strict().refine(data => data.transaction || data.encryptedPayload, {
    message: "Either transaction or encryptedPayload must be provided"
});

export const ShadowNodeSchema = z.object({
    id: z.string().min(1),
    endpoint: z.string().url(),
    region: z.string().min(1),
    latency: z.number().nonnegative().optional(),
    isHealthy: z.boolean(),
}).strict();

export const RelayOptionsSchema = z.object({
    hops: z.number().int().min(1).max(10),
    stealthMode: z.boolean(),
    preferredRegions: z.array(z.string()).optional(),
    timeout: z.number().int().positive().optional(),
}).strict();

export const RelayResponseSchema = z.object({
    success: z.boolean(),
    txid: z.string().optional(),
    hopCount: z.number().int().nonnegative().optional(),
    error: z.string().optional(),
    relayPath: z.array(z.string()).optional(),
}).strict();

export const OnionLayerSchema = z.object({
    nextHop: z.string(),
    payload: z.string(),
    nonce: z.string(),
}).strict();

export const LeakedAssetSchema = z.object({
    mint: z.string().min(1),
    mintName: z.string().optional(),
    amount: z.number().nonnegative(),
    decimals: z.number().int().min(0).max(9),
    reason: z.string().min(1),
    severity: SeveritySchema,
    isNative: z.boolean(),
    ataAddress: PublicKeySchema.optional(),
}).strict();

export const RescueAnalysisSchema = z.object({
    leakedAssets: z.array(LeakedAssetSchema),
    totalValueLamports: z.number().nonnegative(),
    splTokenCount: z.number().nonnegative(),
    nativeSOL: z.number().nonnegative(),
    riskScore: z.number().int().min(0).max(100),
    estimatedFee: z.number().nonnegative(),
}).strict();

export const ProtocolStatsSchema = z.object({
    solPriceUSD: z.number().nonnegative(),
    relayNodeCount: z.number().int().nonnegative(),
    mixingTimeAvgMinutes: z.number().nonnegative(),
    anonSetSize: z.number().int().nonnegative(),
    totalShieldedValueSOL: z.number().nonnegative(),
    systemStatus: z.enum(["OPERATIONAL", "DEGRADED", "MAINTENANCE"]),
    lastUpdated: z.number().int().nonnegative(),
}).strict();

// 3. Types
export type LeakType = z.infer<typeof LeakTypeSchema>;
export type VisibilityScope = z.infer<typeof VisibilityScopeSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type Leak = z.infer<typeof LeakSchema>;
export type TransactionInstruction = z.infer<typeof TransactionInstructionSchema>;
export type TransactionJSON = z.infer<typeof TransactionJSONSchema>;
export type IdlField = z.infer<typeof IdlFieldSchema>;
export type IdlInstruction = z.infer<typeof IdlInstructionSchema>;
export type IdlAccount = z.infer<typeof IdlAccountSchema>;
export type IdlType = z.infer<typeof IdlTypeSchema>;
export type IdlEvent = z.infer<typeof IdlEventSchema>;
export type IdlError = z.infer<typeof IdlErrorSchema>;
export type Idl = z.infer<typeof IdlSchema>;
export type ScoreSnapshot = z.infer<typeof ScoreSnapshotSchema>;
export type PrivacyBadge = z.infer<typeof PrivacyBadgeSchema>;
export type PrivacyPassport = z.infer<typeof PrivacyPassportSchema>;
export type MerkleProof = z.infer<typeof MerkleProofSchema>;
export type CommitmentData = z.infer<typeof CommitmentDataSchema>;
export type RelayRequest = z.infer<typeof RelayRequestSchema>;
export type ShadowNode = z.infer<typeof ShadowNodeSchema>;
export type RelayOptions = z.infer<typeof RelayOptionsSchema>;
export type RelayResponse = z.infer<typeof RelayResponseSchema>;
export type OnionLayer = z.infer<typeof OnionLayerSchema>;
export type LeakedAsset = z.infer<typeof LeakedAssetSchema>;
export type RescueAnalysis = z.infer<typeof RescueAnalysisSchema>;
export type ProtocolStats = z.infer<typeof ProtocolStatsSchema>;

/**
 * Utility for boundary enforcement
 */
export function enforce<T>(schema: z.ZodSchema<T>, data: unknown, metadata: DataMetadata): EnforcedData<T> {
    const result = schema.safeParse(data);
    if (!result.success) {
        throw new Error(`Data Integrity Violation: ${result.error.message} - Metadata: ${JSON.stringify(metadata)}`);
    }

    // Check lifetime (Rule 5)
    if (metadata.lifetimeMs) {
        const now = Date.now();
        if (now - metadata.createdAt > metadata.lifetimeMs) {
            throw new Error(`Data Integrity Violation: Data is stale. Created: ${metadata.createdAt}, Lifetime: ${metadata.lifetimeMs}ms`);
        }
    }

    return {
        value: result.data,
        metadata
    };
}
