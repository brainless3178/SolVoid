/**
 * Cryptographic Consistency Tests
 * Verifies Poseidon hashing, commitment generation, and Merkle tree operations
 */

import { PoseidonHasher, PoseidonUtils } from '../../sdk/crypto/poseidon';
import { Connection, PublicKey } from '@solana/web3.js';
import * as crypto from 'crypto';

const RPC_ENDPOINT = process.env.RPC_URL || 'https://api.devnet.solana.com';

describe('Cryptographic Consistency Tests', () => {
    let connection: Connection;

    beforeAll(() => {
        connection = new Connection(RPC_ENDPOINT, 'confirmed');
    });

    describe('Poseidon Hash', () => {
        it('produces consistent hashes for identical inputs', async () => {
            const input1 = Buffer.from('0'.repeat(64), 'hex');
            const input2 = Buffer.from('0'.repeat(64), 'hex');

            const hash1 = await PoseidonHasher.hashTwoInputs(input1, input2);
            const hash2 = await PoseidonHasher.hashTwoInputs(input1, input2);

            expect(hash1.toString('hex')).toBe(hash2.toString('hex'));
            expect(hash1.length).toBe(32);
        });

        it('produces different hashes for different inputs', async () => {
            const input1 = crypto.randomBytes(32);
            const input2 = crypto.randomBytes(32);
            const input3 = crypto.randomBytes(32);

            const hash1 = await PoseidonHasher.hashTwoInputs(input1, input2);
            const hash2 = await PoseidonHasher.hashTwoInputs(input1, input3);

            expect(hash1.toString('hex')).not.toBe(hash2.toString('hex'));
        });

        it('produces 32-byte output', async () => {
            for (let i = 0; i < 10; i++) {
                const left = crypto.randomBytes(32);
                const right = crypto.randomBytes(32);
                const hash = await PoseidonHasher.hashTwoInputs(left, right);

                expect(hash.length).toBe(32);
                expect(hash.toString('hex')).toMatch(/^[0-9a-f]{64}$/);
            }
        });
    });

    describe('Commitment Generation', () => {
        it('generates valid commitment from secret, nullifier, and amount', async () => {
            const secret = crypto.randomBytes(32);
            const nullifier = crypto.randomBytes(32);
            const amount = BigInt(1000000);

            const commitment = await PoseidonHasher.computeCommitment(secret, nullifier, amount);

            expect(commitment.length).toBe(32);
            expect(commitment.toString('hex')).toMatch(/^[0-9a-f]{64}$/);
        });

        it('produces different commitments for different secrets', async () => {
            const secret1 = crypto.randomBytes(32);
            const secret2 = crypto.randomBytes(32);
            const nullifier = crypto.randomBytes(32);
            const amount = BigInt(1000000);

            const commitment1 = await PoseidonHasher.computeCommitment(secret1, nullifier, amount);
            const commitment2 = await PoseidonHasher.computeCommitment(secret2, nullifier, amount);

            expect(commitment1.toString('hex')).not.toBe(commitment2.toString('hex'));
        });

        it('produces different commitments for different amounts', async () => {
            const secret = crypto.randomBytes(32);
            const nullifier = crypto.randomBytes(32);

            const commitment1 = await PoseidonHasher.computeCommitment(secret, nullifier, BigInt(1000000));
            const commitment2 = await PoseidonHasher.computeCommitment(secret, nullifier, BigInt(2000000));

            expect(commitment1.toString('hex')).not.toBe(commitment2.toString('hex'));
        });

        it('is deterministic', async () => {
            const secret = Buffer.from('a'.repeat(64), 'hex');
            const nullifier = Buffer.from('b'.repeat(64), 'hex');
            const amount = BigInt(500000);

            const commitment1 = await PoseidonHasher.computeCommitment(secret, nullifier, amount);
            const commitment2 = await PoseidonHasher.computeCommitment(secret, nullifier, amount);

            expect(commitment1.toString('hex')).toBe(commitment2.toString('hex'));
        });
    });

    describe('Nullifier Hash', () => {
        it('computes valid nullifier hash', async () => {
            const nullifier = crypto.randomBytes(32);
            const nullifierHash = await PoseidonHasher.computeNullifierHash(nullifier);

            expect(nullifierHash.length).toBe(32);
            expect(nullifierHash.toString('hex')).toMatch(/^[0-9a-f]{64}$/);
        });

        it('is deterministic', async () => {
            const nullifier = Buffer.from('c'.repeat(64), 'hex');

            const hash1 = await PoseidonHasher.computeNullifierHash(nullifier);
            const hash2 = await PoseidonHasher.computeNullifierHash(nullifier);

            expect(hash1.toString('hex')).toBe(hash2.toString('hex'));
        });

        it('produces unique hashes for different nullifiers', async () => {
            const nullifier1 = crypto.randomBytes(32);
            const nullifier2 = crypto.randomBytes(32);

            const hash1 = await PoseidonHasher.computeNullifierHash(nullifier1);
            const hash2 = await PoseidonHasher.computeNullifierHash(nullifier2);

            expect(hash1.toString('hex')).not.toBe(hash2.toString('hex'));
        });
    });

    describe('Merkle Tree Operations', () => {
        it('computes Merkle root from commitments', async () => {
            const commitments: Buffer[] = [];
            for (let i = 0; i < 4; i++) {
                const secret = crypto.randomBytes(32);
                const nullifier = crypto.randomBytes(32);
                const commitment = await PoseidonHasher.computeCommitment(secret, nullifier, BigInt(100000));
                commitments.push(commitment);
            }

            const level1Left = await PoseidonHasher.hashTwoInputs(commitments[0], commitments[1]);
            const level1Right = await PoseidonHasher.hashTwoInputs(commitments[2], commitments[3]);
            const root = await PoseidonHasher.hashTwoInputs(level1Left, level1Right);

            expect(root.length).toBe(32);
            expect(root.toString('hex')).toMatch(/^[0-9a-f]{64}$/);
        });

        it('produces consistent roots for same commitments', async () => {
            const commitment1 = Buffer.from('1'.repeat(64), 'hex');
            const commitment2 = Buffer.from('2'.repeat(64), 'hex');

            const parent1 = await PoseidonHasher.hashTwoInputs(commitment1, commitment2);
            const parent2 = await PoseidonHasher.hashTwoInputs(commitment1, commitment2);

            expect(parent1.toString('hex')).toBe(parent2.toString('hex'));
        });

        it('produces different roots when commitments change', async () => {
            const commitment1 = Buffer.from('1'.repeat(64), 'hex');
            const commitment2a = Buffer.from('2'.repeat(64), 'hex');
            const commitment2b = Buffer.from('3'.repeat(64), 'hex');

            const root1 = await PoseidonHasher.hashTwoInputs(commitment1, commitment2a);
            const root2 = await PoseidonHasher.hashTwoInputs(commitment1, commitment2b);

            expect(root1.toString('hex')).not.toBe(root2.toString('hex'));
        });
    });

    describe('PoseidonUtils', () => {
        it('converts hex to buffer and back', () => {
            const original = 'abcdef0123456789'.repeat(4);
            const buffer = PoseidonUtils.hexToBuffer(original);
            const result = PoseidonUtils.bufferToHex(buffer);

            expect(result).toBe(original);
            expect(buffer.length).toBe(32);
        });

        it('creates zero buffers', () => {
            const zero = PoseidonUtils.zeroBuffer();

            expect(zero.length).toBe(32);
            expect(zero.toString('hex')).toBe('0'.repeat(64));
        });

        it('validates 32-byte buffers', () => {
            const valid = Buffer.alloc(32);
            expect(() => PoseidonUtils.validate32Bytes(valid)).not.toThrow();

            const invalid = Buffer.alloc(16);
            expect(() => PoseidonUtils.validate32Bytes(invalid)).toThrow();
        });
    });

    describe('Solana Connection', () => {
        it('connects to network', async () => {
            const version = await connection.getVersion();
            expect(version['solana-core']).toBeDefined();
        });

        it('fetches slot height', async () => {
            const slot = await connection.getSlot();
            expect(slot).toBeGreaterThan(0);
        });

        it('retrieves address balance', async () => {
            const testAddress = new PublicKey('9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g');
            const balance = await connection.getBalance(testAddress);
            expect(balance).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Deposit Flow', () => {
        it('executes complete deposit preparation', async () => {
            const secret = crypto.randomBytes(32);
            const nullifier = crypto.randomBytes(32);
            const amount = BigInt(100000000);

            const commitment = await PoseidonHasher.computeCommitment(secret, nullifier, amount);
            const nullifierHash = await PoseidonHasher.computeNullifierHash(nullifier);

            expect(commitment.length).toBe(32);
            expect(nullifierHash.length).toBe(32);
            expect(commitment.toString('hex')).not.toBe(nullifierHash.toString('hex'));
        });

        it('guarantees commitment uniqueness', async () => {
            const commitments = new Set<string>();

            for (let i = 0; i < 10; i++) {
                const secret = crypto.randomBytes(32);
                const nullifier = crypto.randomBytes(32);
                const commitment = await PoseidonHasher.computeCommitment(
                    secret, nullifier, BigInt(1000000 * (i + 1))
                );
                commitments.add(commitment.toString('hex'));
            }

            expect(commitments.size).toBe(10);
        });
    });
});
