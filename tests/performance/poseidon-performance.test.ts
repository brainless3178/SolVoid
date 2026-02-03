// Jest provides expect globally, no chai needed
import { PoseidonHasher, PoseidonUtils } from '../../sdk/crypto/poseidon';

describe('Poseidon Performance Tests', () => {
    describe('Hash Performance Benchmarks', () => {
        it('Should meet performance targets for single hash operations', async () => {
            const iterations = 1000;
            const input1 = PoseidonUtils.hexToBuffer('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
            const input2 = PoseidonUtils.hexToBuffer('fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321');
            
            const startTime = process.hrtime.bigint();
            
            for (let i = 0; i < iterations; i++) {
                await PoseidonHasher.hashTwoInputs(input1, input2);
            }
            
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
            
            const avgTimePerHash = duration / iterations;
            
            // Should average less than 1ms per hash
            expect(avgTimePerHash).toBeLessThan(1);
            console.log(`Average time per hash: ${avgTimePerHash.toFixed(3)}ms`);
            console.log(`Total time for ${iterations} hashes: ${duration.toFixed(2)}ms`);
        });
        
        it('Should handle batch operations efficiently', async () => {
            const batchSize = 100;
            const batches = 10;
            
            const inputs = [];
            for (let i = 0; i < batchSize * batches; i++) {
                inputs.push([
                    PoseidonUtils.hexToBuffer(i.toString(16).padStart(64, '0')),
                    PoseidonUtils.hexToBuffer((i + 1).toString(16).padStart(64, '0'))
                ]);
            }
            
            const startTime = process.hrtime.bigint();
            
            for (let batch = 0; batch < batches; batch++) {
                const promises = [];
                for (let i = 0; i < batchSize; i++) {
                    const index = batch * batchSize + i;
                    promises.push(PoseidonHasher.hashTwoInputs(inputs[index][0], inputs[index][1]));
                }
                await Promise.all(promises);
            }
            
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1000000;
            
            const avgTimePerHash = duration / (batchSize * batches);
            
            // Batch operations should be efficient
            expect(avgTimePerHash).toBeLessThan(2);
            console.log(`Batch processing: ${avgTimePerHash.toFixed(3)}ms per hash`);
        });
    });
    
    describe('Merkle Tree Performance', () => {
        it('Should build large Merkle trees efficiently', async () => {
            const treeSizes = [16, 32, 64, 128, 256, 512, 1024];
            
            for (const size of treeSizes) {
                const leaves = [];
                for (let i = 0; i < size; i++) {
                    leaves.push(PoseidonUtils.hexToBuffer(i.toString(16).padStart(64, '0')));
                }
                
                const startTime = process.hrtime.bigint();
                
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
                
                const endTime = process.hrtime.bigint();
                const duration = Number(endTime - startTime) / 1000000;
                
                expect(currentLevel).toHaveLength(1);
                expect(currentLevel[0]).toHaveLength(32);
                
                const timePerLeaf = duration / size;
                console.log(`Tree size ${size}: ${duration.toFixed(2)}ms total, ${timePerLeaf.toFixed(3)}ms per leaf`);
                
                // Performance should scale reasonably
                expect(timePerLeaf).toBeLessThan(0.1); // Less than 0.1ms per leaf
            }
        });
        
        it('Should verify Merkle proofs quickly', async () => {
            const treeSize = 1024;
            const proofTests = 100;
            
            // Build tree
            const leaves = [];
            for (let i = 0; i < treeSize; i++) {
                leaves.push(PoseidonUtils.hexToBuffer(i.toString(16).padStart(64, '0')));
            }
            
            let currentLevel = leaves;
            const treeLevels = [];
            treeLevels.push(currentLevel);
            
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
                treeLevels.push(currentLevel);
            }
            
            const root = currentLevel[0];
            
            // Test proof verification performance
            const startTime = process.hrtime.bigint();
            
            for (let test = 0; test < proofTests; test++) {
                const leafIndex = Math.floor(Math.random() * treeSize);
                const leaf = leaves[leafIndex];
                
                // Generate proof
                const proof = [];
                const indices = [];
                let currentIndex = leafIndex;
                
                for (let level = 0; level < treeLevels.length - 1; level++) {
                    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
                    const sibling = siblingIndex < treeLevels[level].length 
                        ? treeLevels[level][siblingIndex] 
                        : PoseidonUtils.zeroBuffer();
                    
                    proof.push(sibling);
                    indices.push(currentIndex % 2);
                    currentIndex = Math.floor(currentIndex / 2);
                }
                
                // Verify proof
                const computedRoot = await PoseidonHasher.computeMerkleRoot(leaf, proof, indices);
                expect(PoseidonUtils.bufferToHex(computedRoot)).toBe(PoseidonUtils.bufferToHex(root));
            }
            
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1000000;
            const avgTimePerProof = duration / proofTests;
            
            expect(avgTimePerProof).toBeLessThan(5); // Less than 5ms per proof
            console.log(`Proof verification: ${avgTimePerProof.toFixed(3)}ms per proof`);
        });
    });
    
    describe('Memory Performance', () => {
        it('Should maintain stable memory usage during operations', async () => {
            const iterations = 1000;
            const input1 = PoseidonUtils.hexToBuffer('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
            const input2 = PoseidonUtils.hexToBuffer('fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321');
            
            const initialMemory = process.memoryUsage().heapUsed;
            
            for (let i = 0; i < iterations; i++) {
                await PoseidonHasher.hashTwoInputs(input1, input2);
                
                // Force garbage collection periodically
                if (i % 100 === 0 && global.gc) {
                    global.gc();
                }
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // Memory increase should be minimal (< 1MB)
            expect(memoryIncrease).toBeLessThan(1024 * 1024);
            console.log(`Memory increase: ${(memoryIncrease / 1024).toFixed(2)}KB`);
        });
        
        it('Should handle large buffer operations efficiently', async () => {
            const largeBufferSize = 10000;
            const largeBuffers = [];
            
            // Create large buffers
            for (let i = 0; i < largeBufferSize; i++) {
                largeBuffers.push(PoseidonUtils.hexToBuffer(i.toString(16).padStart(64, '0')));
            }
            
            const startTime = process.hrtime.bigint();
            
            // Perform hash operations on large dataset
            const promises = [];
            for (let i = 0; i < largeBufferSize - 1; i++) {
                promises.push(PoseidonHasher.hashTwoInputs(largeBuffers[i], largeBuffers[i + 1]));
            }
            
            const results = await Promise.all(promises);
            
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1000000;
            
            expect(results).toHaveLength(largeBufferSize - 1);
            expect(duration).toBeLessThan(10000); // Should complete in < 10 seconds
            
            const avgTimePerOp = duration / (largeBufferSize - 1);
            console.log(`Large buffer operations: ${avgTimePerOp.toFixed(3)}ms per operation`);
        });
    });
    
    describe('Concurrent Performance', () => {
        it('Should handle concurrent hash operations efficiently', async () => {
            const concurrentOps = 50;
            const opsPerThread = 100;
            
            const promises = [];
            const startTime = process.hrtime.bigint();
            
            for (let thread = 0; thread < concurrentOps; thread++) {
                const threadPromise = async () => {
                    const results = [];
                    for (let i = 0; i < opsPerThread; i++) {
                        const input1 = PoseidonUtils.hexToBuffer((thread * opsPerThread + i).toString(16).padStart(64, '0'));
                        const input2 = PoseidonUtils.hexToBuffer(((thread * opsPerThread + i) + 1).toString(16).padStart(64, '0'));
                        const hash = await PoseidonHasher.hashTwoInputs(input1, input2);
                        results.push(hash);
                    }
                    return results;
                };
                promises.push(threadPromise());
            }
            
            const allResults = await Promise.all(promises);
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1000000;
            
            const totalOps = concurrentOps * opsPerThread;
            const avgTimePerOp = duration / totalOps;
            
            expect(allResults).toHaveLength(concurrentOps);
            expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds
            
            console.log(`Concurrent operations: ${avgTimePerOp.toFixed(3)}ms per operation`);
            console.log(`Total time for ${totalOps} operations: ${duration.toFixed(2)}ms`);
        });
    });
});
