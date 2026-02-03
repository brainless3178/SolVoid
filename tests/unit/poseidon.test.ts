// Jest provides expect globally
import { PoseidonHasher, PoseidonUtils } from '../../sdk/crypto/poseidon';

describe('Poseidon Hash Implementation', () => {
    describe('Hash Consistency', () => {
        it('Should produce consistent hashes for same inputs', async () => {
            const input1 = PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000001');
            const input2 = PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000002');

            const hash1a = await PoseidonHasher.hashTwoInputs(input1, input2);
            const hash1b = await PoseidonHasher.hashTwoInputs(input1, input2);

            expect(PoseidonUtils.bufferToHex(hash1a)).toBe(PoseidonUtils.bufferToHex(hash1b));
        });

        it('Should produce different hashes for different inputs', async () => {
            const input1a = PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000001');
            const input1b = PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000002');
            const input2a = PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000003');
            const input2b = PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000004');

            const hash1 = await PoseidonHasher.hashTwoInputs(input1a, input1b);
            const hash2 = await PoseidonHasher.hashTwoInputs(input2a, input2b);

            expect(PoseidonUtils.bufferToHex(hash1)).not.toBe(PoseidonUtils.bufferToHex(hash2));
        });
    });

    describe('Hash Properties', () => {
        it('Should produce fixed-size output', async () => {
            const input1 = PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000001');
            const input2 = PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000002');

            const hash = await PoseidonHasher.hashTwoInputs(input1, input2);

            expect(hash).toHaveLength(32);
        });

        it('Should handle zero inputs', async () => {
            const zero = PoseidonUtils.zeroBuffer();

            const hash = await PoseidonHasher.hashTwoInputs(zero, zero);

            expect(hash).toHaveLength(32);
            expect(PoseidonUtils.bufferToHex(hash)).not.toBe('00'.repeat(32));
        });

        it('Should be deterministic', async () => {
            const input1 = PoseidonUtils.hexToBuffer('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
            const input2 = PoseidonUtils.hexToBuffer('fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321');

            const hash1 = await PoseidonHasher.hashTwoInputs(input1, input2);
            const hash2 = await PoseidonHasher.hashTwoInputs(input1, input2);

            expect(PoseidonUtils.bufferToHex(hash1)).toBe(PoseidonUtils.bufferToHex(hash2));
        });
    });

    describe('Commitment Generation', () => {
        it('Should generate valid commitments', async () => {
            const secret = PoseidonUtils.hexToBuffer('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
            const nullifier = PoseidonUtils.hexToBuffer('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

            const commitment = await PoseidonHasher.computeCommitment(secret, nullifier, 1000000n);

            expect(commitment).toHaveLength(32);
            expect(PoseidonHasher.verifyFieldCompatibility(commitment)).toBe(true);
        });

        it('Should generate different commitments for different inputs', async () => {
            const secret1 = PoseidonUtils.hexToBuffer('1111111111111111111111111111111111111111111111111111111111111111');
            const secret2 = PoseidonUtils.hexToBuffer('2222222222222222222222222222222222222222222222222222222222222222');
            const nullifier = PoseidonUtils.hexToBuffer('3333333333333333333333333333333333333333333333333333333333333333');

            const commitment1 = await PoseidonHasher.computeCommitment(secret1, nullifier, 1000000n);
            const commitment2 = await PoseidonHasher.computeCommitment(secret2, nullifier, 1000000n);

            expect(PoseidonUtils.bufferToHex(commitment1)).not.toBe(PoseidonUtils.bufferToHex(commitment2));
        });
    });

    describe('Nullifier Hash Generation', () => {
        it('Should generate valid nullifier hashes', async () => {
            const nullifier = PoseidonUtils.hexToBuffer('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');

            const nullifierHash = await PoseidonHasher.computeNullifierHash(nullifier);

            expect(nullifierHash).toHaveLength(32);
            expect(PoseidonHasher.verifyFieldCompatibility(nullifierHash)).toBe(true);
        });

        it('Should produce deterministic nullifier hashes', async () => {
            const nullifier = PoseidonUtils.hexToBuffer('9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba');

            const hash1 = await PoseidonHasher.computeNullifierHash(nullifier);
            const hash2 = await PoseidonHasher.computeNullifierHash(nullifier);

            expect(PoseidonUtils.bufferToHex(hash1)).toBe(PoseidonUtils.bufferToHex(hash2));
        });
    });

    describe('Merkle Tree Operations', () => {
        it('Should compute Merkle root correctly', async () => {
            const leaves = [
                PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000001'),
                PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000002'),
                PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000003'),
                PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000004')
            ];

            // Build simple 2-level Merkle tree
            const left = await PoseidonHasher.hashTwoInputs(leaves[0], leaves[1]);
            const right = await PoseidonHasher.hashTwoInputs(leaves[2], leaves[3]);
            const root = await PoseidonHasher.hashTwoInputs(left, right);

            expect(root).toHaveLength(32);
            expect(PoseidonHasher.verifyFieldCompatibility(root)).toBe(true);
        });

        it('Should handle Merkle proof verification', async () => {
            const leaf = PoseidonUtils.hexToBuffer('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
            const sibling = PoseidonUtils.hexToBuffer('fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321');
            const indices = [0]; // leaf is left sibling

            const root = await PoseidonHasher.computeMerkleRoot(leaf, [sibling], indices);

            expect(root).toHaveLength(32);
            expect(PoseidonHasher.verifyFieldCompatibility(root)).toBe(true);
        });
    });

    describe('Field Compatibility', () => {
        it('Should validate field compatibility correctly', () => {
            const validHash = PoseidonUtils.hexToBuffer('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
            const invalidHash = Buffer.alloc(33); // Wrong size

            expect(PoseidonHasher.verifyFieldCompatibility(validHash)).toBe(true);
            expect(PoseidonHasher.verifyFieldCompatibility(invalidHash)).toBe(false);
        });
    });

    describe('Utility Functions', () => {
        it('Should convert between hex and buffer correctly', () => {
            const hex = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
            const buffer = PoseidonUtils.hexToBuffer(hex);
            const backToHex = PoseidonUtils.bufferToHex(buffer);

            expect(backToHex).toBe(hex);
        });

        it('Should validate hex strings correctly', () => {
            const validHex = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
            const invalidHex = 'xyz123'; // Invalid characters

            expect(() => PoseidonUtils.hexToBuffer(validHex)).not.toThrow();
            expect(() => PoseidonUtils.hexToBuffer(invalidHex)).toThrow();
        });

        it('Should create zero buffers correctly', () => {
            const zero = PoseidonUtils.zeroBuffer();

            expect(zero).toHaveLength(32);
            expect(PoseidonUtils.bufferToHex(zero)).toBe('00'.repeat(32));
        });
    });
});
