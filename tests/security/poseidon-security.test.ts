// Jest provides expect globally
import { PoseidonHasher, PoseidonUtils } from '../../sdk/crypto/poseidon';

describe('Poseidon Security Tests', () => {
    describe('Cryptographic Properties', () => {
        it('Should demonstrate avalanche effect', async () => {
            const input1 = PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000001');
            const input2 = PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000002');
            
            const hash1 = await PoseidonHasher.hashTwoInputs(input1, input2);
            
            // Flip one bit in input1
            const modifiedInput1 = Buffer.from(input1);
            modifiedInput1[31] ^= 0x01; // Flip last bit
            
            const hash2 = await PoseidonHasher.hashTwoInputs(modifiedInput1, input2);
            
            const hash1Hex = PoseidonUtils.bufferToHex(hash1);
            const hash2Hex = PoseidonUtils.bufferToHex(hash2);
            
            // Hashes should be significantly different
            let differingBits = 0;
            for (let i = 0; i < hash1Hex.length; i++) {
                if (hash1Hex[i] !== hash2Hex[i]) {
                    differingBits++;
                }
            }
            
            // Should have substantial difference (at least 25% of bits)
            expect(differingBits.toBeGreaterThan(hash1Hex.length * 0.25);
        });
        
        it('Should resist collision attempts with similar inputs', async () => {
            const baseInput = PoseidonUtils.hexToBuffer('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
            const similarInputs = [];
            
            // Generate inputs with small variations
            for (let i = 0; i < 100; i++) {
                const modified = Buffer.from(baseInput);
                modified[0] = (modified[0] + i) % 256;
                similarInputs.push(modified);
            }
            
            const hashes = new Set();
            
            for (const input of similarInputs) {
                const hash = await PoseidonHasher.hashTwoInputs(input, baseInput);
                const hashHex = PoseidonUtils.bufferToHex(hash);
                hashes.add(hashHex);
            }
            
            // All hashes should be unique
            expect(hashes.size).toBe(similarInputs.length);
        });
    });
    
    describe('Input Validation Security', () => {
        it('Should reject malformed inputs gracefully', async () => {
            try {
                // Test with undefined input
                await PoseidonHasher.hashTwoInputs(undefined as any, undefined as any);
                throw new Error('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.an('error');
            }
        });
        
        it('Should handle edge case inputs safely', async () => {
            const zeroBuffer = PoseidonUtils.zeroBuffer();
            const maxBuffer = PoseidonUtils.hexToBuffer('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
            
            // These should not crash
            const hash1 = await PoseidonHasher.hashTwoInputs(zeroBuffer, zeroBuffer);
            const hash2 = await PoseidonHasher.hashTwoInputs(maxBuffer, maxBuffer);
            const hash3 = await PoseidonHasher.hashTwoInputs(zeroBuffer, maxBuffer);
            
            expect(hash1).toHaveLength(32);
            expect(hash2).toHaveLength(32);
            expect(hash3).toHaveLength(32);
            
            // All should be different
            expect(PoseidonUtils.bufferToHex(hash1)).not.toBe(PoseidonUtils.bufferToHex(hash2));
            expect(PoseidonUtils.bufferToHex(hash1)).not.toBe(PoseidonUtils.bufferToHex(hash3));
            expect(PoseidonUtils.bufferToHex(hash2)).not.toBe(PoseidonUtils.bufferToHex(hash3));
        });
    });
    
    describe('Side-Channel Resistance', () => {
        it('Should have consistent timing regardless of input values', async () => {
            const iterations = 100;
            const input1 = PoseidonUtils.hexToBuffer('0000000000000000000000000000000000000000000000000000000000000001');
            const input2 = PoseidonUtils.hexToBuffer('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
            
            const times = [];
            
            for (let i = 0; i < iterations; i++) {
                const start = process.hrtime.bigint();
                await PoseidonHasher.hashTwoInputs(input1, input2);
                const end = process.hrtime.bigint();
                times.push(Number(end - start));
            }
            
            // Calculate standard deviation
            const mean = times.reduce((a, b) => a + b, 0) / times.length;
            const variance = times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length;
            const stdDev = Math.sqrt(variance);
            
            // Standard deviation should be relatively small (consistent timing)
            // Allow for some variance due to system noise
            expect(stdDev).to.be.lessThan(mean * 0.5);
        });
    });
    
    describe('Deterministic Behavior', () => {
        it('Should produce identical results across multiple instances', async () => {
            const input1 = PoseidonUtils.hexToBuffer('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
            const input2 = PoseidonUtils.hexToBuffer('fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321');
            
            // Reset Poseidon instance to test fresh initialization
            PoseidonHasher.reset();
            const hash1 = await PoseidonHasher.hashTwoInputs(input1, input2);
            
            PoseidonHasher.reset();
            const hash2 = await PoseidonHasher.hashTwoInputs(input1, input2);
            
            expect(PoseidonUtils.bufferToHex(hash1)).toBe(PoseidonUtils.bufferToHex(hash2));
        });
        
        it('Should maintain determinism after many operations', async () => {
            const input1 = PoseidonUtils.hexToBuffer('1111111111111111111111111111111111111111111111111111111111111111');
            const input2 = PoseidonUtils.hexToBuffer('2222222222222222222222222222222222222222222222222222222222222222');
            
            const originalHash = await PoseidonHasher.hashTwoInputs(input1, input2);
            
            // Perform many other operations
            for (let i = 0; i < 1000; i++) {
                const temp1 = PoseidonUtils.hexToBuffer(i.toString(16).padStart(64, '0'));
                const temp2 = PoseidonUtils.hexToBuffer((i + 1).toString(16).padStart(64, '0'));
                await PoseidonHasher.hashTwoInputs(temp1, temp2);
            }
            
            // Original hash should still be the same
            const finalHash = await PoseidonHasher.hashTwoInputs(input1, input2);
            expect(PoseidonUtils.bufferToHex(originalHash)).toBe(PoseidonUtils.bufferToHex(finalHash));
        });
    });
    
    describe('Field Security', () => {
        it('Should properly validate field boundaries', () => {
            const validHash = PoseidonUtils.hexToBuffer('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
            const invalidSize = Buffer.alloc(33);
            const emptyBuffer = Buffer.alloc(0);
            
            expect(PoseidonHasher.verifyFieldCompatibility(validHash)).toBe(true);
            expect(PoseidonHasher.verifyFieldCompatibility(invalidSize)).toBe(false);
            expect(PoseidonHasher.verifyFieldCompatibility(emptyBuffer)).toBe(false);
        });
        
        it('Should handle field arithmetic correctly', async () => {
            const input1 = PoseidonUtils.hexToBuffer('8000000000000000000000000000000000000000000000000000000000000000');
            const input2 = PoseidonUtils.hexToBuffer('7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
            
            const hash = await PoseidonHasher.hashTwoInputs(input1, input2);
            
            // Result should be a valid field element
            expect(hash).toHaveLength(32);
            expect(PoseidonHasher.verifyFieldCompatibility(hash)).toBe(true);
            
            // Should not be all zeros (invalid result)
            expect(PoseidonUtils.bufferToHex(hash)).not.toBe('00'.repeat(32));
        });
    });
});
