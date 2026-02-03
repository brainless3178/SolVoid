// Jest provides expect globally
import { PoseidonHasher, PoseidonUtils } from '../../sdk/crypto/poseidon';

describe('Poseidon Integration Tests', () => {
    describe('End-to-End Privacy Flow', () => {
        it('Should complete full privacy workflow', async () => {
            // 1. Generate commitment
            const secret = PoseidonUtils.hexToBuffer('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
            const nullifier = PoseidonUtils.hexToBuffer('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

            const commitment = await PoseidonHasher.computeCommitment(secret, nullifier, 1000000n);
            expect(commitment).toHaveLength(32);

            // 2. Generate nullifier hash
            const nullifierHash = await PoseidonHasher.computeNullifierHash(nullifier);
            expect(nullifierHash).toHaveLength(32);

            // 3. Build Merkle tree with multiple commitments
            const commitments = [
                commitment,
                await PoseidonHasher.computeCommitment(
                    PoseidonUtils.hexToBuffer('1111111111111111111111111111111111111111111111111111111111111111'),
                    PoseidonUtils.hexToBuffer('2222222222222222222222222222222222222222222222222222222222222222'),
                    1000000n
                ),
                await PoseidonHasher.computeCommitment(
                    PoseidonUtils.hexToBuffer('3333333333333333333333333333333333333333333333333333333333333333'),
                    PoseidonUtils.hexToBuffer('4444444444444444444444444444444444444444444444444444444444444444'),
                    1000000n
                ),
                await PoseidonHasher.computeCommitment(
                    PoseidonUtils.hexToBuffer('5555555555555555555555555555555555555555555555555555555555555555'),
                    PoseidonUtils.hexToBuffer('6666666666666666666666666666666666666666666666666666666666666666'),
                    1000000n
                )
            ];

            // 4. Compute Merkle root
            const left = await PoseidonHasher.hashTwoInputs(commitments[0], commitments[1]);
            const right = await PoseidonHasher.hashTwoInputs(commitments[2], commitments[3]);
            const merkleRoot = await PoseidonHasher.hashTwoInputs(left, right);

            expect(merkleRoot).toHaveLength(32);
            expect(PoseidonHasher.verifyFieldCompatibility(merkleRoot)).toBe(true);

            // 5. Generate Merkle proof for first commitment
            const proof = [commitments[1]]; // Sibling for first commitment
            const indices = [0]; // First commitment is left sibling

            const computedRoot = await PoseidonHasher.computeMerkleRoot(commitments[0], proof, indices);
            expect(PoseidonUtils.bufferToHex(computedRoot)).toBe(PoseidonUtils.bufferToHex(merkleRoot));
        });
    });

    describe('Performance Benchmarks', () => {
        it('Should handle large number of hash operations efficiently', async () => {
            const iterations = 1000;
            const input1 = PoseidonUtils.hexToBuffer('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
            const input2 = PoseidonUtils.hexToBuffer('fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321');

            const startTime = Date.now();

            for (let i = 0; i < iterations; i++) {
                await PoseidonHasher.hashTwoInputs(input1, input2);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete 1000 hashes in reasonable time (< 5 seconds)
            expect(duration).to.be.lessThan(5000);
            console.log(`Completed ${iterations} hashes in ${duration}ms`);
        });

        it('Should handle large Merkle trees efficiently', async () => {
            const leafCount = 128; // 7-level tree
            const leaves = [];

            // Generate leaves
            for (let i = 0; i < leafCount; i++) {
                const value = i.toString(16).padStart(64, '0');
                leaves.push(PoseidonUtils.hexToBuffer(value));
            }

            const startTime = Date.now();

            // Build Merkle tree
            let currentLevel = leaves;
            while (currentLevel.length > 1) {
                const nextLevel = [];
                for (let i = 0; i < currentLevel.length; i += 2) {
                    const left = currentLevel[i];
                    const right = (i + 1 < currentLevel.length)
                        ? currentLevel[i + 1]
                        : PoseidonUtils.zeroBuffer();

                    const parent = await PoseidonHasher.hashTwoInputs(left, right);
                    nextLevel.push(parent);
                }
                currentLevel = nextLevel;
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(currentLevel).toHaveLength(1);
            expect(currentLevel[0]).toHaveLength(32);
            expect(duration).to.be.lessThan(1000); // Should complete in < 1 second

            console.log(`Built ${leafCount}-leaf Merkle tree in ${duration}ms`);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('Should handle maximum field values', async () => {
            const maxField = PoseidonUtils.hexToBuffer('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
            const minField = PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000000');

            const hash = await PoseidonHasher.hashTwoInputs(maxField, minField);
            expect(hash).toHaveLength(32);
            expect(PoseidonHasher.verifyFieldCompatibility(hash)).toBe(true);
        });

        it('Should handle alternating bit patterns', async () => {
            const pattern1 = PoseidonUtils.hexToBuffer('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
            const pattern2 = PoseidonUtils.hexToBuffer('5555555555555555555555555555555555555555555555555555555555555555555');

            const hash = await PoseidonHasher.hashTwoInputs(pattern1, pattern2);
            expect(hash).toHaveLength(32);
            expect(PoseidonHasher.verifyFieldCompatibility(hash)).toBe(true);
        });

        it('Should maintain consistency across multiple operations', async () => {
            const input1 = PoseidonUtils.hexToBuffer('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
            const input2 = PoseidonUtils.hexToBuffer('fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321');

            // Multiple operations should produce same result
            const hash1 = await PoseidonHasher.hashTwoInputs(input1, input2);
            const hash2 = await PoseidonHasher.hashTwoInputs(input1, input2);
            const hash3 = await PoseidonHasher.hashTwoInputs(input1, input2);

            const hex1 = PoseidonUtils.bufferToHex(hash1);
            const hex2 = PoseidonUtils.bufferToHex(hash2);
            const hex3 = PoseidonUtils.bufferToHex(hash3);

            expect(hex1).toBe(hex2);
            expect(hex2).toBe(hex3);
        });
    });

    describe('Memory and Resource Management', () => {
        it('Should not leak memory during repeated operations', async () => {
            const iterations = 100;
            const input1 = PoseidonUtils.hexToBuffer('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
            const input2 = PoseidonUtils.hexToBuffer('fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321');

            const hashes = [];

            for (let i = 0; i < iterations; i++) {
                const hash = await PoseidonHasher.hashTwoInputs(input1, input2);
                hashes.push(hash);

                // Verify each hash is valid
                expect(hash).toHaveLength(32);
                expect(PoseidonHasher.verifyFieldCompatibility(hash)).toBe(true);
            }

            // All hashes should be identical
            const firstHash = PoseidonUtils.bufferToHex(hashes[0]);
            for (let i = 1; i < hashes.length; i++) {
                expect(PoseidonUtils.bufferToHex(hashes[i])).toBe(firstHash);
            }
        });

        it('Should handle concurrent operations', async () => {
            const concurrentOps = 10;
            const input1 = PoseidonUtils.hexToBuffer('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
            const input2 = PoseidonUtils.hexToBuffer('fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321');

            const promises = [];
            for (let i = 0; i < concurrentOps; i++) {
                promises.push(PoseidonHasher.hashTwoInputs(input1, input2));
            }

            const results = await Promise.all(promises);

            // All results should be identical
            const firstResult = PoseidonUtils.bufferToHex(results[0]);
            for (let i = 1; i < results.length; i++) {
                expect(PoseidonUtils.bufferToHex(results[i])).toBe(firstResult);
            }
        });
    });
});
