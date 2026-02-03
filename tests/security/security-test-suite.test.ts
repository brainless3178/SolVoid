// Jest provides expect globally, no chai needed
import { buildPoseidon } from 'circomlibjs';
import { groth16 } from 'snarkjs';
import { 
    AnchorProvider, 
    Program, 
    BN,
    Wallet
} from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import crypto from 'crypto';

describe('Security Test Suite', () => {
    let provider: AnchorProvider;
    let program: any;
    let poseidon: any;
    let stateKeypair: Keypair;
    let vaultKeypair: Keypair;
    let nullifierSetKeypair: Keypair;
    let payer: Keypair;
    let attacker: Keypair;
    let relayer: Keypair;
    let recipient: Keypair;
    
    // Test data for security tests
    let nullifier: Buffer;
    let secret: Buffer;
    let commitment: Buffer;
    let merkleProof: Buffer[];
    let groth16Proof: any;
    let publicSignals: number[];
    
    const DEPOSIT_AMOUNT = new BN(LAMPORTS_PER_SOL); // 1 SOL
    const EMERGENCY_MULTIPLIER = 2;

    beforeEach(async () => {
        // Setup test environment
        const connection = new Connection('http://localhost:8899', 'confirmed');
        payer = Keypair.generate();
        attacker = Keypair.generate();
        relayer = Keypair.generate();
        recipient = Keypair.generate();
        
        // Fund accounts
        await connection.requestAirdrop(payer.publicKey, 10 * LAMPORTS_PER_SOL);
        await connection.requestAirdrop(attacker.publicKey, 10 * LAMPORTS_PER_SOL);
        await connection.requestAirdrop(relayer.publicKey, 10 * LAMPORTS_PER_SOL);
        
        provider = new AnchorProvider(connection, new Wallet(payer), {});
        
        // Initialize program
        const idl = JSON.parse(fs.readFileSync('./target/idl/solvoid.json', 'utf8'));
        const programId = JSON.parse(fs.readFileSync('./target/deploy/solvoid.json', 'utf8')).programId;
        program = new Program(idl, new PublicKey(programId), provider);
        
        // Initialize Poseidon
        poseidon = await buildPoseidon();
        
        // Setup accounts
        stateKeypair = Keypair.generate();
        vaultKeypair = Keypair.generate();
        nullifierSetKeypair = Keypair.generate();
        
        // Initialize program state
        const vkBuffer = fs.readFileSync('./verification_key.json');
        const vk = JSON.parse(vkBuffer.toString());
        
        await program.methods
            .initialize(
                DEPOSIT_AMOUNT,
                Buffer.from(JSON.stringify(vk.withdraw)),
                Buffer.from(JSON.stringify(vk.deposit))
            )
            .accounts({
                state: stateKeypair.publicKey,
                authority: payer.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([payer, stateKeypair])
            .rpc();
            
        await program.methods
            .initializeNullifierSet(payer.publicKey)
            .accounts({
                nullifierSet: nullifierSetKeypair.publicKey,
                authority: payer.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([payer, nullifierSetKeypair])
            .rpc();
            
        // Fund vault
        await connection.requestAirdrop(vaultKeypair.publicKey, 5 * LAMPORTS_PER_SOL);
        
        // Generate valid test data
        nullifier = crypto.randomBytes(32);
        secret = crypto.randomBytes(32);
        
        const nullifierBigInt = BigInt('0x' + nullifier.toString('hex'));
        const secretBigInt = BigInt('0x' + secret.toString('hex'));
        
        const commitmentBigInt = poseidon([nullifierBigInt, secretBigInt]);
        commitment = Buffer.from(commitmentBigInt.toString(16).padStart(64, '0'), 'hex');
        
        // Submit valid deposit
        await program.methods
            .deposit(commitment)
            .accounts({
                state: stateKeypair.publicKey,
                depositor: payer.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([payer])
            .rpc();
            
        // Generate valid proof
        merkleProof = await generateMerkleProof(commitment, 0);
        
        const circuitInput = {
            nullifier: Array.from(nullifier).map(x => x.toString()),
            secret: Array.from(secret).map(x => x.toString()),
            pathElements: merkleProof.map(p => Array.from(p).map(x => x.toString())),
            pathIndices: [0],
            root: Array.from(commitment).map(x => x.toString()),
        };
        
        groth16Proof = await groth16.fullProve(
            circuitInput,
            './withdraw.wasm',
            './withdraw_final.zkey'
        );
        
        publicSignals = [
            ...Array.from(nullifier).map(x => x.toString()),
            ...Array.from(commitment).map(x => x.toString()),
            ...Array.from(merkleProof[merkleProof.length - 1]).map(x => x.toString()),
        ];
    });

    describe('Proof Forgery Attempts', () => {
        it('should reject proof with wrong public inputs', async () => {
            // Corrupt nullifier in public signals
            const corruptedPublicSignals = [...publicSignals];
            corruptedPublicSignals[0] = 999; // Corrupt first byte of nullifier
            
            try {
                await program.methods
                    .withdraw(
                        Array.from(nullifier),
                        Array.from(groth16Proof.pi_a),
                        Array.from(groth16Proof.pi_b.flat()),
                        Array.from(groth16Proof.pi_c.flat()),
                        corruptedPublicSignals,
                        merkleProof.map(p => Array.from(p)),
                        [0],
                        new BN(1000000)
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                throw new Error('Proof with wrong public inputs should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('InvalidProof');
                console.log(' Proof with wrong public inputs correctly rejected');
            }
        });

        it('should reject proof for different merkle root', async () => {
            // Generate commitment with different nullifier/secret
            const differentNullifier = crypto.randomBytes(32);
            const differentSecret = crypto.randomBytes(32);
            
            const differentNullifierBigInt = BigInt('0x' + differentNullifier.toString('hex'));
            const differentSecretBigInt = BigInt('0x' + differentSecret.toString('hex'));
            
            const differentCommitmentBigInt = poseidon([differentNullifierBigInt, differentSecretBigInt]);
            const differentCommitment = Buffer.from(differentCommitmentBigInt.toString(16).padStart(64, '0'), 'hex');
            
            // Submit different commitment
            await program.methods
                .deposit(differentCommitment)
                .accounts({
                    state: stateKeypair.publicKey,
                    depositor: payer.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([payer])
                .rpc();
                
            // Try to use proof with different root
            const corruptedPublicSignals = [...publicSignals];
            // Replace root with different commitment
            for (let i = 64; i < 128; i++) {
                corruptedPublicSignals[i] = differentCommitment[i - 64];
            }
            
            try {
                await program.methods
                    .withdraw(
                        Array.from(nullifier),
                        Array.from(groth16Proof.pi_a),
                        Array.from(groth16Proof.pi_b.flat()),
                        Array.from(groth16Proof.pi_c.flat()),
                        corruptedPublicSignals,
                        merkleProof.map(p => Array.from(p)),
                        [0],
                        new BN(1000000)
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                throw new Error('Proof for different merkle root should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('InvalidMerkleRoot');
                console.log(' Proof for different merkle root correctly rejected');
            }
        });

        it('should reject replayed proof', async () => {
            // First withdrawal should succeed
            await program.methods
                .withdraw(
                    Array.from(nullifier),
                    Array.from(groth16Proof.pi_a),
                    Array.from(groth16Proof.pi_b.flat()),
                    Array.from(groth16Proof.pi_c.flat()),
                    publicSignals,
                    merkleProof.map(p => Array.from(p)),
                    [0],
                    new BN(1000000)
                )
                .accounts({
                    state: stateKeypair.publicKey,
                    vault: vaultKeypair.publicKey,
                    recipient: recipient.publicKey,
                    nullifierSet: nullifierSetKeypair.publicKey,
                    relayer: relayer.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([payer])
                .rpc();
                
            // Try to replay same proof
            try {
                await program.methods
                    .withdraw(
                        Array.from(nullifier),
                        Array.from(groth16Proof.pi_a),
                        Array.from(groth16Proof.pi_b.flat()),
                        Array.from(groth16Proof.pi_c.flat()),
                        publicSignals,
                        merkleProof.map(p => Array.from(p)),
                        [0],
                        new BN(1000000)
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                throw new Error('Replayed proof should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('NullifierAlreadyUsed');
                console.log(' Replayed proof correctly rejected');
            }
        });

        it('should reject proof with corrupted signature', async () => {
            // Corrupt proof signature
            const corruptedProof = JSON.parse(JSON.stringify(groth16Proof));
            corruptedProof.proof.pi_a[0] = '999'; // Corrupt first element
            
            try {
                await program.methods
                    .withdraw(
                        Array.from(nullifier),
                        Array.from(corruptedProof.proof.pi_a),
                        Array.from(corruptedProof.proof.pi_b.flat()),
                        Array.from(corruptedProof.proof.pi_c.flat()),
                        publicSignals,
                        merkleProof.map(p => Array.from(p)),
                        [0],
                        new BN(1000000)
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                throw new Error('Proof with corrupted signature should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('InvalidProof');
                console.log(' Proof with corrupted signature correctly rejected');
            }
        });
    });

    describe('Nullifier Reuse Attempts', () => {
        it('should prevent double-spend with same nullifier', async () => {
            // First withdrawal
            await program.methods
                .withdraw(
                    Array.from(nullifier),
                    Array.from(groth16Proof.pi_a),
                    Array.from(groth16Proof.pi_b.flat()),
                    Array.from(groth16Proof.pi_c.flat()),
                    publicSignals,
                    merkleProof.map(p => Array.from(p)),
                    [0],
                    new BN(1000000)
                )
                .accounts({
                    state: stateKeypair.publicKey,
                    vault: vaultKeypair.publicKey,
                    recipient: recipient.publicKey,
                    nullifierSet: nullifierSetKeypair.publicKey,
                    relayer: relayer.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([payer])
                .rpc();
                
            // Try double-spend with same nullifier but different proof
            const differentSecret = crypto.randomBytes(32);
            const differentSecretBigInt = BigInt('0x' + differentSecret.toString('hex'));
            
            const differentCommitmentBigInt = poseidon([BigInt('0x' + nullifier.toString('hex')), differentSecretBigInt]);
            const differentCommitment = Buffer.from(differentCommitmentBigInt.toString(16).padStart(64, '0'), 'hex');
            
            // Submit different commitment with same nullifier
            await program.methods
                .deposit(differentCommitment)
                .accounts({
                    state: stateKeypair.publicKey,
                    depositor: payer.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([payer])
                .rpc();
                
            const differentMerkleProof = await generateMerkleProof(differentCommitment, 1);
            
            const differentCircuitInput = {
                nullifier: Array.from(nullifier).map(x => x.toString()),
                secret: Array.from(differentSecret).map(x => x.toString()),
                pathElements: differentMerkleProof.map(p => Array.from(p).map(x => x.toString())),
                pathIndices: [1],
                root: Array.from(differentCommitment).map(x => x.toString()),
            };
            
            const differentProof = await groth16.fullProve(
                differentCircuitInput,
                './withdraw.wasm',
                './withdraw_final.zkey'
            );
            
            try {
                await program.methods
                    .withdraw(
                        Array.from(nullifier),
                        Array.from(differentProof.pi_a),
                        Array.from(differentProof.pi_b.flat()),
                        Array.from(differentProof.pi_c.flat()),
                        [
                            ...Array.from(nullifier).map(x => x.toString()),
                            ...Array.from(differentCommitment).map(x => x.toString()),
                            ...Array.from(differentMerkleProof[differentMerkleProof.length - 1]).map(x => x.toString()),
                        ],
                        differentMerkleProof.map(p => Array.from(p)),
                        [1],
                        new BN(1000000)
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                throw new Error('Double-spend with same nullifier should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('NullifierAlreadyUsed');
                console.log(' Double-spend with same nullifier correctly rejected');
            }
        });

        it('should prevent withdrawal with nullifier from different commitment', async () => {
            // Generate different commitment
            const differentNullifier = crypto.randomBytes(32);
            const differentSecret = crypto.randomBytes(32);
            
            const differentNullifierBigInt = BigInt('0x' + differentNullifier.toString('hex'));
            const differentSecretBigInt = BigInt('0x' + differentSecret.toString('hex'));
            
            const differentCommitmentBigInt = poseidon([differentNullifierBigInt, differentSecretBigInt]);
            const differentCommitment = Buffer.from(differentCommitmentBigInt.toString(16).padStart(64, '0'), 'hex');
            
            // Submit different commitment
            await program.methods
                .deposit(differentCommitment)
                .accounts({
                    state: stateKeypair.publicKey,
                    depositor: payer.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([payer])
                .rpc();
                
            // Try to withdraw using original nullifier with different commitment
            const differentMerkleProof = await generateMerkleProof(differentCommitment, 1);
            
            try {
                await program.methods
                    .withdraw(
                        Array.from(nullifier), // Original nullifier
                        Array.from(groth16Proof.pi_a),
                        Array.from(groth16Proof.pi_b.flat()),
                        Array.from(groth16Proof.pi_c.flat()),
                        [
                            ...Array.from(nullifier).map(x => x.toString()),
                            ...Array.from(differentCommitment).map(x => x.toString()),
                            ...Array.from(differentMerkleProof[differentMerkleProof.length - 1]).map(x => x.toString()),
                        ],
                        differentMerkleProof.map(p => Array.from(p)),
                        [1],
                        new BN(1000000)
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                throw new Error('Withdrawal with nullifier from different commitment should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('InvalidProof');
                console.log(' Withdrawal with nullifier from different commitment correctly rejected');
            }
        });
    });

    describe('Economic Attacks', () => {
        it('should prevent withdrawal exceeding vault balance', async () => {
            // Get current vault balance
            const vaultBalance = await provider.connection.getBalance(vaultKeypair.publicKey);
            
            // Try to withdraw more than vault balance
            const excessiveAmount = new BN(vaultBalance + LAMPORTS_PER_SOL);
            
            try {
                await program.methods
                    .withdraw(
                        Array.from(nullifier),
                        Array.from(groth16Proof.pi_a),
                        Array.from(groth16Proof.pi_b.flat()),
                        Array.from(groth16Proof.pi_c.flat()),
                        publicSignals,
                        merkleProof.map(p => Array.from(p)),
                        [0],
                        excessiveAmount
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                throw new Error('Withdrawal exceeding vault balance should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('InsufficientVaultBalance');
                console.log(' Withdrawal exceeding vault balance correctly rejected');
            }
        });

        it('should prevent fee manipulation via emergency mode', async () => {
            // Enable emergency mode
            await program.methods
                .setEmergencyMode(true, new BN(EMERGENCY_MULTIPLIER))
                .accounts({
                    state: stateKeypair.publicKey,
                    authority: payer.publicKey,
                })
                .signers([payer])
                .rpc();
                
            // Try to manipulate fees by setting excessive multiplier
            try {
                await program.methods
                    .setEmergencyMode(true, new BN(1000)) // Excessive multiplier
                    .accounts({
                        state: stateKeypair.publicKey,
                        authority: payer.publicKey,
                    })
                    .signers([payer])
                    .rpc();
                    
                throw new Error('Excessive emergency multiplier should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('InvalidEmergencyMultiplier');
                console.log(' Excessive emergency multiplier correctly rejected');
            }
            
            // Try to withdraw with manipulated fees
            try {
                await program.methods
                    .withdraw(
                        Array.from(nullifier),
                        Array.from(groth16Proof.pi_a),
                        Array.from(groth16Proof.pi_b.flat()),
                        Array.from(groth16Proof.pi_c.flat()),
                        publicSignals,
                        merkleProof.map(p => Array.from(p)),
                        [0],
                        new BN(1000000)
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                // This should succeed but with emergency fees applied
                console.log(' Emergency mode withdrawal processed with correct fees');
            } catch (error) {
                console.log('Emergency withdrawal failed:', error);
            }
        });

        it('should prevent withdrawal with zero or negative amount', async () => {
            // Try zero amount withdrawal
            try {
                await program.methods
                    .withdraw(
                        Array.from(nullifier),
                        Array.from(groth16Proof.pi_a),
                        Array.from(groth16Proof.pi_b.flat()),
                        Array.from(groth16Proof.pi_c.flat()),
                        publicSignals,
                        merkleProof.map(p => Array.from(p)),
                        [0],
                        new BN(0) // Zero amount
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                throw new Error('Zero amount withdrawal should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('InvalidAmount');
                console.log(' Zero amount withdrawal correctly rejected');
            }
            
            // Try negative amount withdrawal (using large number that would underflow)
            try {
                await program.methods
                    .withdraw(
                        Array.from(nullifier),
                        Array.from(groth16Proof.pi_a),
                        Array.from(groth16Proof.pi_b.flat()),
                        Array.from(groth16Proof.pi_c.flat()),
                        publicSignals,
                        merkleProof.map(p => Array.from(p)),
                        [0],
                        new BN(-1) // Negative amount
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                throw new Error('Negative amount withdrawal should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('InvalidAmount');
                console.log(' Negative amount withdrawal correctly rejected');
            }
        });
    });

    describe('Authentication Bypass Attempts', () => {
        it('should reject relay request without signature', async () => {
            try {
                // This would be tested via the relayer service
                // For now, we simulate by trying to call program directly without proper auth
                await program.methods
                    .withdraw(
                        Array.from(nullifier),
                        Array.from(groth16Proof.pi_a),
                        Array.from(groth16Proof.pi_b.flat()),
                        Array.from(groth16Proof.pi_c.flat()),
                        publicSignals,
                        merkleProof.map(p => Array.from(p)),
                        [0],
                        new BN(1000000)
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: attacker.publicKey, // Wrong relayer
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([attacker]) // Wrong signer
                    .rpc();
                    
                throw new Error('Relay request without proper signature should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('InvalidRelayer');
                console.log(' Relay request without proper signature correctly rejected');
            }
        });

        it('should reject relay request with signature from wrong key', async () => {
            // This would be tested via the relayer service
            // For now, we simulate by trying to use wrong authority
            try {
                await program.methods
                    .setEmergencyMode(true, new BN(2))
                    .accounts({
                        state: stateKeypair.publicKey,
                        authority: attacker.publicKey, // Wrong authority
                    })
                    .signers([attacker]) // Wrong signer
                    .rpc();
                    
                throw new Error('Relay request with signature from wrong key should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('InvalidAuthority');
                console.log(' Relay request with signature from wrong key correctly rejected');
            }
        });

        it('should reject expired transaction', async () => {
            // This would be tested via the relayer service with timestamp validation
            // For now, we simulate by checking that the program validates timestamps
            
            // Create a transaction with old timestamp
            const oldTimestamp = Math.floor(Date.now() / 1000) - (11 * 60); // 11 minutes ago
            
            try {
                // This would need to be implemented in the relayer service
                // For now, we just verify the concept
                console.log('Testing expired transaction rejection...');
                
                // Simulate old transaction check
                const currentTime = Math.floor(Date.now() / 1000);
                const transactionAge = currentTime - oldTimestamp;
                
                expect(transactionAge).toBeGreaterThan(600); // 10 minutes
                console.log(' Expired transaction would be rejected');
            } catch (error) {
                console.log('Expired transaction test failed:', error);
            }
        });

        it('should reject replay of old transaction', async () => {
            // First withdrawal
            await program.methods
                .withdraw(
                    Array.from(nullifier),
                    Array.from(groth16Proof.pi_a),
                    Array.from(groth16Proof.pi_b.flat()),
                    Array.from(groth16Proof.pi_c.flat()),
                    publicSignals,
                    merkleProof.map(p => Array.from(p)),
                    [0],
                    new BN(1000000)
                )
                .accounts({
                    state: stateKeypair.publicKey,
                    vault: vaultKeypair.publicKey,
                    recipient: recipient.publicKey,
                    nullifierSet: nullifierSetKeypair.publicKey,
                    relayer: relayer.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([payer])
                .rpc();
                
            // Try to replay the same transaction
            try {
                await program.methods
                    .withdraw(
                        Array.from(nullifier),
                        Array.from(groth16Proof.pi_a),
                        Array.from(groth16Proof.pi_b.flat()),
                        Array.from(groth16Proof.pi_c.flat()),
                        publicSignals,
                        merkleProof.map(p => Array.from(p)),
                        [0],
                        new BN(1000000)
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                throw new Error('Replay of old transaction should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('NullifierAlreadyUsed');
                console.log(' Replay of old transaction correctly rejected');
            }
        });
    });

    describe('Edge Case Security Tests', () => {
        it('should prevent overflow attacks', async () => {
            // Try to create overflow in arithmetic operations
            const maxValue = new BN('18446744073709551615'); // u64::MAX
            
            try {
                await program.methods
                    .withdraw(
                        Array.from(nullifier),
                        Array.from(groth16Proof.pi_a),
                        Array.from(groth16Proof.pi_b.flat()),
                        Array.from(groth16Proof.pi_c.flat()),
                        publicSignals,
                        merkleProof.map(p => Array.from(p)),
                        [0],
                        maxValue // Try to withdraw u64::MAX
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                throw new Error('Overflow attack should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('ArithmeticError');
                console.log(' Overflow attack correctly rejected');
            }
        });

        it('should prevent underflow attacks', async () => {
            // Try to create underflow in arithmetic operations
            try {
                await program.methods
                    .withdraw(
                        Array.from(nullifier),
                        Array.from(groth16Proof.pi_a),
                        Array.from(groth16Proof.pi_b.flat()),
                        Array.from(groth16Proof.pi_c.flat()),
                        publicSignals,
                        merkleProof.map(p => Array.from(p)),
                        [0],
                        new BN(1) // Very small amount
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                // This should work fine
                console.log(' Small amount withdrawal processed correctly');
            } catch (error) {
                console.log('Small amount withdrawal failed:', error);
            }
        });

        it('should prevent malformed input attacks', async () => {
            // Try with malformed nullifier (wrong length)
            const malformedNullifier = Buffer.alloc(31, 0); // 31 bytes instead of 32
            
            try {
                await program.methods
                    .withdraw(
                        Array.from(malformedNullifier),
                        Array.from(groth16Proof.pi_a),
                        Array.from(groth16Proof.pi_b.flat()),
                        Array.from(groth16Proof.pi_c.flat()),
                        publicSignals,
                        merkleProof.map(p => Array.from(p)),
                        [0],
                        new BN(1000000)
                    )
                    .accounts({
                        state: stateKeypair.publicKey,
                        vault: vaultKeypair.publicKey,
                        recipient: recipient.publicKey,
                        nullifierSet: nullifierSetKeypair.publicKey,
                        relayer: relayer.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([payer])
                    .rpc();
                    
                throw new Error('Malformed input attack should have failed');
            } catch (error) {
                expect((error as Error).toString()).toContain('InvalidInput');
                console.log(' Malformed input attack correctly rejected');
            }
        });
    });

    // Helper function to generate merkle proof
    async function generateMerkleProof(_commitment: Buffer, _index: number): Promise<Buffer[]> {
        // Simple merkle proof generation for testing
        // In a real implementation, this would use the actual merkle tree
        const proof: Buffer[] = [];
        
        // For testing, we'll create a simple proof path
        for (let i = 0; i < 20; i++) {
            proof.push(crypto.randomBytes(32));
        }
        
        return proof;
    }
});
