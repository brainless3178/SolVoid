import { buildPoseidon } from 'circomlibjs';
import { Buffer } from 'buffer';

/**
 * Poseidon hash wrapper with type safety and BN254 compatibility
 * Matches Rust implementation parameters for cryptographic consistency
 */
export class PoseidonHasher {
    private static poseidon: any = null;
    private static initialized = false;

    /**
     * Initialize Poseidon with BN254 field parameters
     * Width: 3 (2 inputs + 1 output for binary Merkle tree)
     * Security: 128-bit (standard for zk-SNARK applications)
     */
    private static async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Build Poseidon instance with parameters matching Rust implementation
            // circomlibjs buildPoseidon() returns a hash function directly
            this.poseidon = await buildPoseidon();

            // Validate that we got a valid Poseidon instance
            if (typeof this.poseidon !== 'function') {
                throw new Error('buildPoseidon did not return a valid hash function');
            }

            this.initialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize Poseidon: ${error}`);
        }
    }

    /**
     * Ensure Poseidon is initialized before use
     */
    private static async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    /**
     * Convert Buffer to BigInt for Poseidon input
     * Uses big-endian (standard hex) to match circom circuits
     */
    private static bufferToBigInt(buffer: Buffer): bigint {
        // Big-endian: direct hex conversion (matches circomlib)
        return BigInt('0x' + buffer.toString('hex'));
    }

    /**
     * Convert Poseidon output to Buffer (32 bytes, big-endian)
     * Uses poseidon.F.toString() to extract the field element value
     */
    private static poseidonOutputToBuffer(output: any): Buffer {
        // circomlibjs returns a Uint8Array - convert via F.toString()
        let value: bigint;

        if (output instanceof Uint8Array || Array.isArray(output)) {
            // Modern circomlibjs returns Uint8Array, use F.toString() to get string representation
            const strValue = this.poseidon.F.toString(output);
            value = BigInt(strValue);
        } else if (typeof output === 'bigint') {
            value = output;
        } else if (typeof output === 'string') {
            value = BigInt(output);
        } else {
            throw new Error(`Unexpected Poseidon output type: ${typeof output}`);
        }

        // Convert to hex string and pad to 64 characters (32 bytes)
        const hex = value.toString(16).padStart(64, '0');

        // Big-endian: direct hex to Buffer (matches circomlib)
        const buffer = Buffer.from(hex, 'hex');

        // Ensure exactly 32 bytes
        if (buffer.length !== 32) {
            throw new Error(`Poseidon output must be 32 bytes, got ${buffer.length}`);
        }

        return buffer;
    }

    /**
     * Hash with salt for commitment derivation
     * Matches Rust: hash_commitment_with_salt
     */
    static async hashWithSalt(left: Buffer, right: Buffer, saltValue: Buffer): Promise<Buffer> {
        await this.ensureInitialized();

        if (left.length !== 32 || right.length !== 32 || saltValue.length !== 32) {
            throw new Error('All inputs must be exactly 32 bytes');
        }

        const l = this.bufferToBigInt(left);
        const r = this.bufferToBigInt(right);
        const s = this.bufferToBigInt(saltValue);

        // Matches Rust: sponge.absorb(&l); sponge.absorb(&r); sponge.absorb(&s);
        const resultBigInt = this.poseidon([l, r, s]);
        return this.poseidonOutputToBuffer(resultBigInt);
    }

    /**
     * Hash two 32-byte inputs using Poseidon(2)
     * MATCHES MerkleTreeChecker circuit: Poseidon(2)
     */
    static async hashTwoInputs(left: Buffer, right: Buffer): Promise<Buffer> {
        await this.ensureInitialized();
        if (left.length !== 32 || right.length !== 32) {
            throw new Error('All inputs must be exactly 32 bytes');
        }

        const l = this.bufferToBigInt(left);
        const r = this.bufferToBigInt(right);

        // Strict Poseidon(2) for Merkle Tree consistency
        const resultBigInt = this.poseidon([l, r]);
        return this.poseidonOutputToBuffer(resultBigInt);
    }

    /**
     * Hash single input with zero for nullifier hash
     * MATCHES circuit: Poseidon(nullifier, 1)
     */
    static async hashWithZero(input: Buffer): Promise<Buffer> {
        await this.ensureInitialized();
        const n = this.bufferToBigInt(input);
        const resultBigInt = this.poseidon([n, BigInt(1)]);
        return this.poseidonOutputToBuffer(resultBigInt);
    }

    /**
     * Compute commitment from secret, nullifier, and amount
     * FIXED: Includes amount to prevent value inflation
     * Matches circuit: Poseidon(secret, nullifier, amount)
     */
    static async computeCommitment(secret: Buffer, nullifier: Buffer, amount: bigint): Promise<Buffer> {
        await this.ensureInitialized();
        const s = this.bufferToBigInt(secret);
        const n = this.bufferToBigInt(nullifier);
        const a = amount;

        const resultBigInt = this.poseidon([s, n, a]);
        return this.poseidonOutputToBuffer(resultBigInt);
    }

    /**
     * Compute nullifier hash from nullifier
     * FIXED: Uses constant domain salt matching the circuit
     * Matches circuit: Poseidon(nullifier, 1)
     */
    static async computeNullifierHash(nullifier: Buffer): Promise<Buffer> {
        await this.ensureInitialized();
        const n = this.bufferToBigInt(nullifier);
        const salt = BigInt(1);

        const resultBigInt = this.poseidon([n, salt]);
        return this.poseidonOutputToBuffer(resultBigInt);
    }

    /**
     * Compute Merkle root from leaf and proof path
     * @param leaf - 32-byte leaf value
     * @param proof - Array of 32-byte proof elements
     * @param indices - Array of indices (0 for left, 1 for right)
     * @returns 32-byte Merkle root
     */
    static async computeMerkleRoot(
        leaf: Buffer,
        proof: Buffer[],
        indices: number[]
    ): Promise<Buffer> {
        if (proof.length !== indices.length) {
            throw new Error('Proof and indices arrays must have same length');
        }

        let current = leaf;

        for (let i = 0; i < proof.length; i++) {
            const sibling = proof[i];
            const index = indices[i];

            if (index === 0) {
                // Current is left sibling
                current = await this.hashTwoInputs(current, sibling);
            } else {
                // Current is right sibling
                current = await this.hashTwoInputs(sibling, current);
            }
        }

        return current;
    }

    /**
     * Verify hash output is within BN254 field constraints
     * Ensures compatibility with zk-SNARK circuit requirements
     */
    static verifyFieldCompatibility(hash: Buffer): boolean {
        if (hash.length !== 32) return false;

        try {
            // Convert to BigInt and check it's within BN254 field
            const value = this.bufferToBigInt(hash);

            // BN254 prime field modulus (p)
            const BN254_PRIME = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

            return value < BN254_PRIME;
        } catch {
            return false;
        }
    }

    /**
     * Get Poseidon instance for advanced usage
     * @returns The underlying circomlibjs Poseidon instance
     */
    static async getPoseidonInstance(): Promise<any> {
        await this.ensureInitialized();
        return this.poseidon;
    }

    /**
     * Reset the Poseidon instance (useful for testing)
     */
    static reset(): void {
        this.poseidon = null;
        this.initialized = false;
    }
}

/**
 * Type definitions for Poseidon operations
 */
export type PoseidonHash = Buffer;
export type MerkleProof = {
    proof: Buffer[];
    indices: number[];
};

/**
 * FIXED: Secure salt generation for cryptographic domain separation
 * Matches Rust implementation in poseidon.rs
 */
export class SecureSalts {
    static generateSecureSalts(transactionContext: Buffer): {
        commitmentSalt: Buffer;
        nullifierSalt: Buffer;
        pathSalt: Buffer;
    } {
        const commitmentSalt = crypto.createHash('sha256')
            .update(transactionContext)
            .update(Buffer.from("commitment_domain"))
            .digest();

        const nullifierSalt = crypto.createHash('sha256')
            .update(transactionContext)
            .update(Buffer.from("nullifier_domain"))
            .digest();

        const pathSalt = crypto.createHash('sha256')
            .update(transactionContext)
            .update(Buffer.from("path_domain"))
            .digest();

        return {
            commitmentSalt,
            nullifierSalt,
            pathSalt
        };
    }

    static fromTransactionComponents(
        root: Buffer,
        nullifier: Buffer,
        recipient: Buffer,
        amount: bigint
    ) {
        const amountBuf = Buffer.alloc(8);
        amountBuf.writeBigUInt64LE(amount);

        const context = Buffer.concat([root, nullifier, recipient, amountBuf]);
        return this.generateSecureSalts(context);
    }
}

/**
 * Utility functions for working with Poseidon hashes
 */
export class PoseidonUtils {
    /**
     * Convert hex string to Buffer (32 bytes)
     */
    static hexToBuffer(hex: string): Buffer {
        if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
            throw new Error('Hex must be exactly 64 characters (32 bytes)');
        }
        return Buffer.from(hex, 'hex');
    }

    /**
     * Convert Buffer to hex string
     */
    static bufferToHex(buffer: Buffer): string {
        return buffer.toString('hex');
    }

    /**
     * Validate Buffer is 32 bytes
     */
    static validate32Bytes(buffer: Buffer): void {
        if (buffer.length !== 32) {
            throw new Error(`Buffer must be exactly 32 bytes, got ${buffer.length}`);
        }
    }

    /**
     * Create zero Buffer (32 bytes of zeros)
     */
    static zeroBuffer(): Buffer {
        return Buffer.alloc(32, 0);
    }
}

import * as crypto from 'crypto';
