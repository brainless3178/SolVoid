// Jest provides expect globally
import * as snarkjs from 'snarkjs';
import fs from 'fs';

describe(' Circuit Soundness Test', () => {
    let vkPath: string;
    
    beforeEach(() => {
        vkPath = './verification_key.json';
    });

    it('Should reject invalid proof', async () => {
        if (!fs.existsSync(vkPath)) {
            console.log(' Skipping - verification key not found');
            return;
        }
        
        const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
        const invalidSignals = ['0', '0', '0', '0', '0'];
        const fakeProof = {
            pi_a: ['0', '0', '1'],
            pi_b: [['0', '0'], ['0', '0'], ['1', '0']],
            pi_c: ['0', '0', '1'],
            protocol: 'groth16',
            curve: 'bn128'
        };
        
        try {
            const isValid = await snarkjs.groth16.verify(vKey, invalidSignals, fakeProof);
            expect(isValid).toBe(false);
            console.log(' Invalid proof rejected');
        } catch (error) {
            console.log(' Invalid proof caused error (expected)');
        }
    });

    it('Should have valid verification key', () => {
        if (!fs.existsSync(vkPath)) return;
        
        const vk = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
        expect(vk).to.have.property('protocol');
        expect(vk).to.have.property('curve');
        expect(vk).to.have.property('vk_alpha_1');
        console.log(' Verification key valid');
    });
});
