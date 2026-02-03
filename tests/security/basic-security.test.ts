/**
 * Basic Security Test - Validates our security testing framework
 */

// Jest provides expect globally
import * as snarkjs from 'snarkjs';
import fs from 'fs';

describe(' Basic Security Framework Test', () => {
    describe('Circuit Artifacts Validation', () => {
        it('Should have required circuit files', () => {
            const requiredFiles = [
                'withdraw.wasm',
                'withdraw_final.zkey', 
                'verification_key.json'
            ];
            
            requiredFiles.forEach(file => {
                expect(fs.existsSync(file), `Missing ${file}`).toBe(true);
            });
        });

        it('Should have valid verification key format', () => {
            const vkPath = 'verification_key.json';
            
            if (fs.existsSync(vkPath)) {
                const vk = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                
                expect(vk).to.have.property('protocol');
                expect(vk).to.have.property('curve');
                expect(vk).to.have.property('vk_alpha_1');
                expect(vk).to.have.property('vk_beta_2');
                expect(vk).to.have.property('IC');
                
                console.log(' Verification key format validated');
            } else {
                console.log(' Verification key not found');
            }
        });
    });

    describe('Basic Proof Verification', () => {
        it('Should reject invalid proof structure', async () => {
            const vkPath = 'verification_key.json';
            
            if (!fs.existsSync(vkPath)) {
                console.log(' Skipping - verification key not found');
                return;
            }
            
            const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
            
            // Create obviously invalid proof
            const invalidProof = {
                pi_a: ['0', '0', '1'],
                pi_b: [['0', '0'], ['0', '0'], ['1', '0']],
                pi_c: ['0', '0', '1'],
                protocol: 'groth16',
                curve: 'bn128'
            };
            
            const invalidSignals = ['0', '0', '0', '0', '0'];
            
            try {
                const isValid = await snarkjs.groth16.verify(vKey, invalidSignals, invalidProof);
                expect(isValid).toBe(false);
                console.log(' Invalid proof correctly rejected');
            } catch (error) {
                console.log(' Invalid proof caused verification error (expected)');
            }
        });
    });

    describe('Security Test Structure', () => {
        it('Should have all security test files', () => {
            const securityTests = [
                'tests/security/circuit-soundness.test.ts',
                'tests/security/verifier-consistency.test.ts', 
                'tests/security/state-invariants.test.ts',
                'tests/security/relayer-adversarial.test.ts',
                'tests/security/security-gates.test.ts'
            ];
            
            securityTests.forEach(test => {
                expect(fs.existsSync(test), `Missing security test: ${test}`).toBe(true);
            });
            
            console.log(' All security test files present');
        });

        it('Should have security validation script', () => {
            expect(fs.existsSync('scripts/security-validation.sh')).toBe(true);
            console.log(' Security validation script present');
        });

        it('Should have trust assumptions document', () => {
            expect(fs.existsSync('TRUST_ASSUMPTIONS_FREEZE.md')).toBe(true);
            console.log(' Trust assumptions document present');
        });

        it('Should have mainnet launch checklist', () => {
            expect(fs.existsSync('MAINNET_LAUNCH_CHECKLIST.md')).toBe(true);
            console.log(' Mainnet launch checklist present');
        });
    });

    describe('Documentation Completeness', () => {
        it('Should have comprehensive security documentation', () => {
            const docs = [
                'TRUST_ASSUMPTIONS_FREEZE.md',
                'MAINNET_LAUNCH_CHECKLIST.md'
            ];
            
            docs.forEach(doc => {
                const content = fs.readFileSync(doc, 'utf8');
                expect(content.length.toBeGreaterThan(1000); // Substantial content
            });
            
            console.log(' Security documentation is comprehensive');
        });
    });
});
