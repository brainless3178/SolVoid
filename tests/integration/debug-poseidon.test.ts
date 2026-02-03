// Jest provides expect globally
import { buildPoseidon } from 'circomlibjs';

describe('Debug Poseidon', () => {
    it('should debug poseidon output format', async () => {
        const poseidon = await buildPoseidon();
        
        const inputs = [123, 456];
        const inputsBigInt = inputs.map(x => BigInt(x));
        const result = poseidon(inputsBigInt);
        
        console.log('Result type:', typeof result);
        console.log('Result value:', result);
        
        // Try different conversion methods
        if (typeof result === 'bigint') {
            console.log('BigInt conversion:', '0x' + result.toString(16).padStart(64, '0'));
        } else if (typeof result === 'string') {
            console.log('String conversion:', result);
        } else {
            console.log('Unknown type, using default conversion');
            const resultStr = String(result);
            console.log('Default conversion:', resultStr);
        }
        
        expect(true).toBe(true);
    });
});
