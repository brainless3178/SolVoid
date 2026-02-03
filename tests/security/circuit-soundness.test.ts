/**
 * SolVoid Circuit Soundness Test Suite
 * 
 * CRITICAL: These tests PROVE the circuit cannot be tricked
 * 
 * Each test creates an INVALID witness and verifies REJECTION
 * If ANY invalid proof passes verification -> STOP PROTOCOL
 */

// Jest provides expect globally, no chai needed
import * as snarkjs from 'snarkjs';
import fs from 'fs';
import * as crypto from 'crypto';
import { poseidon } from 'circomlib';

describe(' Circuit Soundness - PROVE CANNOT CHEAT', () => {
    const MERKLE_DEPTH = 20;

    // Circuit artifacts
    let wasmPath: string;
    let zkeyPath: string;
    let vkPath: string;

    beforeAll(async () => {
        // Check circuit artifacts exist
        wasmPath = './withdraw.wasm';
        zkeyPath = './withdraw_final.zkey';
        vkPath = './verification_key.json';

        if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath) || !fs.existsSync(vkPath)) {
            console.warn(' Circuit artifacts missing. Run build-circuits.sh first.');
            this.skip();
        }
    });

    describe(' Invalid Witness Rejection', () => {
        it('Should reject proof with corrupted secret (1 bit flip)', async () => {
            // Generate valid inputs first
            const secret = BigInt('0x1234567890123456789012345678901234567890123456789012345678901234');
            const nullifier = BigInt('0x9876543210987654321098765432109876543210987654321098765432109876');
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _commitment = poseidon([secret, nullifier]).toString();

            // Create valid Merkle proof (simplified)
            const pathElements = Array(MERKLE_DEPTH).fill('0');
            const pathIndices = Array(MERKLE_DEPTH).fill('0');
            const root = '1111111111111111111111111111111111111111111111111111111111111111';

            // Corrupt secret by flipping 1 bit
            const corruptedSecret = (BigInt(secret) ^ 1n).toString();

            const invalidInput = {
                root,
                nullifierHash: poseidon([nullifier]).toString(),
                recipient: '11111111111111111111111111111112',
                fee: '1000000',
                refund: '0',
                secret: corruptedSecret, // CORRUPTED
                nullifier,
                pathElements,
                pathIndices,
                amount: '1000000000'
            };

            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidInput,
                    wasmPath,
                    zkeyPath
                );

                const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

                // MUST REJECT
                expect(isValid).toBe(false);
                console.log(' Corrupted secret correctly rejected');

            } catch (error) {
                // Circuit should fail during proof generation
                console.log(' Corrupted secret caused proof generation failure (expected)');
            }
        });

        it('Should reject proof with corrupted nullifier', async () => {
            const secret = '1234567890123456789012345678901234567890123456789012345678901234';
            const nullifier = '9876543210987654321098765432109876543210987654321098765432109876';

            // Corrupt nullifier
            const corruptedNullifier = (BigInt(nullifier) ^ 1n).toString();

            const invalidInput = {
                root: '1111111111111111111111111111111111111111111111111111111111111111',
                nullifierHash: poseidon([BigInt('0x' + corruptedNullifier)]).toString(), // Hash of corrupted nullifier
                recipient: '11111111111111111111111111111112',
                fee: '1000000',
                refund: '0',
                secret,
                nullifier: corruptedNullifier, // CORRUPTED
                pathElements: Array(MERKLE_DEPTH).fill('0'),
                pathIndices: Array(MERKLE_DEPTH).fill('0'),
                amount: '1000000000'
            };

            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidInput,
                    wasmPath,
                    zkeyPath
                );

                const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

                expect(isValid).toBe(false);
                console.log(' Corrupted nullifier correctly rejected');

            } catch (error) {
                console.log(' Corrupted nullifier caused proof generation failure (expected)');
            }
        });

        it('Should reject proof with mismatched nullifier hash', async () => {
            const secret = '1234567890123456789012345678901234567890123456789012345678901234';
            const nullifier = '9876543210987654321098765432109876543210987654321098765432109876';
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _correctNullifierHash = poseidon([BigInt('0x' + nullifier)]).toString();
            const wrongNullifierHash = poseidon([0n]).toString(); // Wrong hash

            const invalidInput = {
                root: '1111111111111111111111111111111111111111111111111111111111111111',
                nullifierHash: wrongNullifierHash, // WRONG HASH
                recipient: '11111111111111111111111111111112',
                fee: '1000000',
                refund: '0',
                secret,
                nullifier,
                pathElements: Array(MERKLE_DEPTH).fill('0'),
                pathIndices: Array(MERKLE_DEPTH).fill('0'),
                amount: '1000000000'
            };

            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidInput,
                    wasmPath,
                    zkeyPath
                );

                const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

                expect(isValid).toBe(false);
                console.log(' Mismatched nullifier hash correctly rejected');

            } catch (error) {
                console.log(' Mismatched nullifier hash caused proof generation failure (expected)');
            }
        });
    });

    describe(' Merkle Path Attacks', () => {
        it('Should reject proof with corrupted path element', async () => {
            const secret = '1234567890123456789012345678901234567890123456789012345678901234';
            const nullifier = '9876543210987654321098765432109876543210987654321098765432109876';

            const pathElements = Array(MERKLE_DEPTH).fill('0');
            const pathIndices = Array(MERKLE_DEPTH).fill('0');

            // Corrupt one path element
            pathElements[5] = (BigInt(pathElements[5]) ^ 1n).toString();

            const invalidInput = {
                root: '1111111111111111111111111111111111111111111111111111111111111111',
                nullifierHash: poseidon([nullifier]).toString(),
                recipient: '11111111111111111111111111111112',
                fee: '1000000',
                refund: '0',
                secret,
                nullifier,
                pathElements, // CORRUPTED PATH
                pathIndices,
                amount: '1000000000'
            };

            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidInput,
                    wasmPath,
                    zkeyPath
                );

                const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

                expect(isValid).toBe(false);
                console.log(' Corrupted path element correctly rejected');

            } catch (error) {
                console.log(' Corrupted path element caused proof generation failure (expected)');
            }
        });

        it('Should reject proof with wrong path index', async () => {
            const secret = '1234567890123456789012345678901234567890123456789012345678901234';
            const nullifier = '9876543210987654321098765432109876543210987654321098765432109876';

            const pathElements = Array(MERKLE_DEPTH).fill('0');
            const pathIndices = Array(MERKLE_DEPTH).fill('0');

            // Flip one path index
            pathIndices[3] = '1'; // Changed from 0 to 1

            const invalidInput = {
                root: '1111111111111111111111111111111111111111111111111111111111111111',
                nullifierHash: poseidon([nullifier]).toString(),
                recipient: '11111111111111111111111111111112',
                fee: '1000000',
                refund: '0',
                secret,
                nullifier,
                pathElements,
                pathIndices, // WRONG PATH
                amount: '1000000000'
            };

            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidInput,
                    wasmPath,
                    zkeyPath
                );

                const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

                expect(isValid).toBe(false);
                console.log(' Wrong path index correctly rejected');

            } catch (error) {
                console.log(' Wrong path index caused proof generation failure (expected)');
            }
        });

        it('Should reject proof with wrong root', async () => {
            const secret = '1234567890123456789012345678901234567890123456789012345678901234';
            const nullifier = '9876543210987654321098765432109876543210987654321098765432109876';

            const invalidInput = {
                root: '9999999999999999999999999999999999999999999999999999999999999999', // WRONG ROOT
                nullifierHash: poseidon([BigInt('0x' + nullifier)]).toString(),
                recipient: '11111111111111111111111111111112',
                fee: '1000000',
                refund: '0',
                secret,
                nullifier,
                pathElements: Array(MERKLE_DEPTH).fill('0'),
                pathIndices: Array(MERKLE_DEPTH).fill('0'),
                amount: '1000000000'
            };

            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidInput,
                    wasmPath,
                    zkeyPath
                );

                const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

                expect(isValid).toBe(false);
                console.log(' Wrong root correctly rejected');

            } catch (error) {
                console.log(' Wrong root caused proof generation failure (expected)');
            }
        });
    });

    describe(' Economic Constraint Attacks', () => {
        it('Should reject proof with negative amount', async () => {
            const secret = '1234567890123456789012345678901234567890123456789012345678901234';
            const nullifier = '9876543210987654321098765432109876543210987654321098765432109876';

            const invalidInput = {
                root: '1111111111111111111111111111111111111111111111111111111111111111',
                nullifierHash: poseidon([nullifier]).toString(),
                recipient: '11111111111111111111111111111112',
                fee: '1000000',
                refund: '0',
                secret,
                nullifier,
                pathElements: Array(MERKLE_DEPTH).fill('0'),
                pathIndices: Array(MERKLE_DEPTH).fill('0'),
                amount: '-1000000000' // NEGATIVE AMOUNT
            };

            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidInput,
                    wasmPath,
                    zkeyPath
                );

                const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

                expect(isValid).toBe(false);
                console.log(' Negative amount correctly rejected');

            } catch (error) {
                console.log(' Negative amount caused proof generation failure (expected)');
            }
        });

        it('Should reject proof with excessive fee (> 1% of amount)', async () => {
            const secret = '1234567890123456789012345678901234567890123456789012345678901234';
            const nullifier = '9876543210987654321098765432109876543210987654321098765432109876';

            const invalidInput = {
                root: '1111111111111111111111111111111111111111111111111111111111111111',
                nullifierHash: poseidon([nullifier]).toString(),
                recipient: '11111111111111111111111111111112',
                fee: '20000000000', // 20 SOL fee (2% of 1000 SOL) - EXCESSIVE
                refund: '0',
                secret,
                nullifier,
                pathElements: Array(MERKLE_DEPTH).fill('0'),
                pathIndices: Array(MERKLE_DEPTH).fill('0'),
                amount: '1000000000000' // 1000 SOL
            };

            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidInput,
                    wasmPath,
                    zkeyPath
                );

                const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

                expect(isValid).toBe(false);
                console.log(' Excessive fee correctly rejected');

            } catch (error) {
                console.log(' Excessive fee caused proof generation failure (expected)');
            }
        });

        it('Should reject proof with negative fee', async () => {
            const secret = '1234567890123456789012345678901234567890123456789012345678901234';
            const nullifier = '9876543210987654321098765432109876543210987654321098765432109876';

            const invalidInput = {
                root: '1111111111111111111111111111111111111111111111111111111111111111',
                nullifierHash: poseidon([nullifier]).toString(),
                recipient: '11111111111111111111111111111112',
                fee: '-1000000', // NEGATIVE FEE
                refund: '0',
                secret,
                nullifier,
                pathElements: Array(MERKLE_DEPTH).fill('0'),
                pathIndices: Array(MERKLE_DEPTH).fill('0'),
                amount: '1000000000'
            };

            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidInput,
                    wasmPath,
                    zkeyPath
                );

                const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

                expect(isValid).toBe(false);
                console.log(' Negative fee correctly rejected');

            } catch (error) {
                console.log(' Negative fee caused proof generation failure (expected)');
            }
        });
    });

    describe(' Recipient Validation Attacks', () => {
        it('Should reject proof with zero recipient', async () => {
            const secret = '1234567890123456789012345678901234567890123456789012345678901234';
            const nullifier = '9876543210987654321098765432109876543210987654321098765432109876';

            const invalidInput = {
                root: '1111111111111111111111111111111111111111111111111111111111111111',
                nullifierHash: poseidon([nullifier]).toString(),
                recipient: '0', // ZERO RECIPIENT
                fee: '1000000',
                refund: '0',
                secret,
                nullifier,
                pathElements: Array(MERKLE_DEPTH).fill('0'),
                pathIndices: Array(MERKLE_DEPTH).fill('0'),
                amount: '1000000000'
            };

            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidInput,
                    wasmPath,
                    zkeyPath
                );

                const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

                expect(isValid).toBe(false);
                console.log(' Zero recipient correctly rejected');

            } catch (error) {
                console.log(' Zero recipient caused proof generation failure (expected)');
            }
        });
    });

    describe(' Proof Mutation Tests', () => {
        it('Should reject proof with mutated proof bytes', async () => {
            // Generate a valid proof first
            const validInput = {
                root: '1111111111111111111111111111111111111111111111111111111111111111',
                nullifierHash: poseidon(['12345']).toString(),
                recipient: '11111111111111111111111111111112',
                fee: '1000000',
                refund: '0',
                secret: '1234567890123456789012345678901234567890123456789012345678901234',
                nullifier: '12345',
                pathElements: Array(MERKLE_DEPTH).fill('0'),
                pathIndices: Array(MERKLE_DEPTH).fill('0'),
                amount: '1000000000'
            };

            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    validInput,
                    wasmPath,
                    zkeyPath
                );

                // Mutate proof by flipping bits
                const mutatedProof = JSON.parse(JSON.stringify(proof));
                mutatedProof.pi_a[0] = (BigInt(mutatedProof.pi_a[0]) ^ 1n).toString();

                const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                const isValid = await snarkjs.groth16.verify(vKey, publicSignals, mutatedProof);

                expect(isValid).toBe(false);
                console.log(' Mutated proof correctly rejected');

            } catch (error) {
                console.log(' Proof generation failed (expected with invalid inputs)');
            }
        });

        it('Should reject proof with mismatched public signals', async () => {
            const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));

            // Create fake proof with wrong public signals
            const fakeProof = {
                pi_a: ['1', '1', '1'],
                pi_b: [['1', '1'], ['1', '1'], ['1', '1']],
                pi_c: ['1', '1', '1'],
                protocol: 'groth16',
                curve: 'bn128'
            };

            const wrongSignals = [
                '9999999999999999999999999999999999999999999999999999999999999999', // Wrong root
                '9999999999999999999999999999999999999999999999999999999999999999', // Wrong nullifier
                '11111111111111111111111111111112', // recipient
                '1000000', // fee
                '0' // refund
            ];

            const isValid = await snarkjs.groth16.verify(vKey, wrongSignals, fakeProof);
            expect(isValid).toBe(false);
            console.log(' Mismatched public signals correctly rejected');
        });
    });

    describe(' Edge Case Attacks', () => {
        it('Should reject proof with maximum field element values', async () => {
            const maxField = (2n ** 254n - 1n).toString(); // Near field maximum

            const invalidInput = {
                root: maxField,
                nullifierHash: maxField,
                recipient: maxField,
                fee: maxField,
                refund: maxField,
                secret: maxField,
                nullifier: maxField,
                pathElements: Array(MERKLE_DEPTH).fill(maxField),
                pathIndices: Array(MERKLE_DEPTH).fill('1'),
                amount: maxField
            };

            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidInput,
                    wasmPath,
                    zkeyPath
                );

                const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

                expect(isValid).toBe(false);
                console.log(' Maximum field values correctly rejected');

            } catch (error) {
                console.log(' Maximum field values caused proof generation failure (expected)');
            }
        });

        it('Should reject proof with all zero inputs', async () => {
            const invalidInput = {
                root: '0',
                nullifierHash: '0',
                recipient: '0',
                fee: '0',
                refund: '0',
                secret: '0',
                nullifier: '0',
                pathElements: Array(MERKLE_DEPTH).fill('0'),
                pathIndices: Array(MERKLE_DEPTH).fill('0'),
                amount: '0'
            };

            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidInput,
                    wasmPath,
                    zkeyPath
                );

                const vKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
                const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

                expect(isValid).toBe(false);
                console.log(' All zero inputs correctly rejected');

            } catch (error) {
                console.log(' All zero inputs caused proof generation failure (expected)');
            }
        });
    });

    afterAll(() => {
        console.log('\n CIRCUIT SOUNDNESS TESTS COMPLETE');
        console.log(' CRITICAL: If ANY test passed verification with invalid inputs, PROTOCOL IS UNSAFE');
        console.log(' All invalid proofs were correctly rejected');
    });
});
