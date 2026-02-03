// Jest provides expect globally
import { 
    Keypair, 
    SystemProgram, 
    LAMPORTS_PER_SOL,
    Connection
} from '@solana/web3.js';
import { 
    Program,
    AnchorProvider,
    BN,
    Wallet
} from '@coral-xyz/anchor';
import { buildPoseidon } from 'circomlibjs';
import { 
    groth16
} from 'snarkjs';
import fs from 'fs';
import crypto from 'crypto';
import { Solvoid } from '../../target/types/solvoid';

describe('End-to-End Circuit Integration Test', () => {
    let provider: AnchorProvider;
    let program: Program<Solvoid>;
    let payer: Keypair;
    let stateKeypair: Keypair;
    let vaultKeypair: Keypair;
    let nullifierSetKeypair: Keypair;
    let relayer: Keypair;
    let recipient: Keypair;
    
    // Circuit keys and Poseidon hasher
    let poseidon: any;
    
    // Test data
    let nullifier: Buffer;
    let secret: Buffer;
    let commitment: Buffer;
    let merkleProof: Buffer[];
    let groth16Proof: any;
    let publicSignals: any[];
    
    // Constants
    const DEPOSIT_AMOUNT = new BN(1 * LAMPORTS_PER_SOL); // 1 SOL
    const TREE_DEPTH = 20;

    beforeEach(async () => {
        // Setup provider
        payer = Keypair.generate();
        const connection = new Connection('http://localhost:8899', 'confirmed');
        provider = new AnchorProvider(connection, new Wallet(payer), {});
        
        // Load program
        program = program as Program<Solvoid>;
        
        // Initialize Poseidon hasher
        poseidon = await buildPoseidon();
        
        // Generate test keypairs
        stateKeypair = Keypair.generate();
        vaultKeypair = Keypair.generate();
        nullifierSetKeypair = Keypair.generate();
        relayer = Keypair.generate();
        recipient = Keypair.generate();
        
        // Fund accounts
        await provider.connection.requestAirdrop(
            payer.publicKey, 
            10 * LAMPORTS_PER_SOL
        );
        
        await provider.connection.requestAirdrop(
            relayer.publicKey, 
            2 * LAMPORTS_PER_SOL
        );
        
        // Load circuit keys
        await loadCircuitKeys();
    });

    it('Setup Phase: Initialize program and merkle tree', async () => {
        // Read verification key
        const vkBuffer = fs.readFileSync('./verification_key.json');
        const vk = JSON.parse(vkBuffer.toString());
        
        // Initialize program
        const tx = await program.methods
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
        
        console.log('Initialize transaction signature:', tx);
        
        // Initialize NullifierSet
        const nullifierSetTx = await program.methods
            .initializeNullifierSet(payer.publicKey)
            .accounts({
                nullifierSet: nullifierSetKeypair.publicKey,
                authority: payer.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([payer, nullifierSetKeypair])
            .rpc();
        
        console.log('NullifierSet initialize transaction signature:', nullifierSetTx);
        
        // Verify initial state
        const stateAccount = await program.account.globalState.fetch(stateKeypair.publicKey);
        expect(stateAccount.isInitialized).toBe(true);
        expect(stateAccount.depositAmount.toString()).toBe(DEPOSIT_AMOUNT.toString());
        expect(stateAccount.nextIndex.toNumber()).toBe(0);
        
        console.log(' Setup phase completed successfully');
    });

    it('Deposit Phase: Generate and submit commitment', async () => {
        // Generate Poseidon-compatible randomness
        nullifier = crypto.randomBytes(32);
        secret = crypto.randomBytes(32);
        
        // Compute commitment = Poseidon(nullifier, secret)
        const nullifierBigInt = BigInt('0x' + nullifier.toString('hex'));
        const secretBigInt = BigInt('0x' + secret.toString('hex'));
        
        const commitmentBigInt = poseidon([nullifierBigInt, secretBigInt]);
        commitment = Buffer.from(commitmentBigInt.toString(16).padStart(64, '0'), 'hex');
        
        console.log('Generated nullifier:', nullifier.toString('hex'));
        console.log('Generated secret:', secret.toString('hex'));
        console.log('Computed commitment:', commitment.toString('hex'));
        
        // Submit deposit
        const depositTx = await program.methods
            .deposit(commitment)
            .accounts({
                state: stateKeypair.publicKey,
                depositor: payer.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([payer])
            .rpc();
        
        console.log('Deposit transaction signature:', depositTx);
        
        // Verify commitment added to merkle tree
        const stateAccount = await program.account.globalState.fetch(stateKeypair.publicKey);
        expect(stateAccount.nextIndex.toNumber()).toBe(1);
        
        // Verify commitment stored at correct index
        const storedCommitment = stateAccount.commitments[0];
        expect(Buffer.from(storedCommitment)).toEqual(commitment);
        
        console.log(' Deposit phase completed successfully');
        console.log('Commitment stored at index 0');
    });

    it('Withdrawal Phase: Generate proof and submit withdrawal', async () => {
        // Generate merkle proof for commitment
        merkleProof = await generateMerkleProof(commitment, 0);
        
        console.log('Generated merkle proof with', merkleProof.length, 'elements');
        
        // Generate Groth16 proof using circom circuit
        const circuitInput = {
            nullifier: Array.from(nullifier).map(x => x.toString()),
            secret: Array.from(secret).map(x => x.toString()),
            pathElements: merkleProof.map(p => Array.from(p).map(x => x.toString())),
            pathIndices: [0], // Index 0 in binary
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
            ...Array.from(merkleProof[merkleProof.length - 1]).map(x => x.toString()), // Root
        ];
        
        console.log('Generated Groth16 proof');
        console.log('Public signals:', publicSignals.length);
        
        // Submit withdrawal
        const withdrawalTx = await program.methods
            .withdraw(
                Array.from(nullifier),
                Array.from(groth16Proof.pi_a),
                Array.from(groth16Proof.pi_b.flat()),
                Array.from(groth16Proof.pi_c.flat()),
                Array.from(publicSignals),
                merkleProof.map(p => Array.from(p)),
                [0], // Path indices for index 0
                new BN(1000000) // 0.001 SOL relayer fee
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
        
        console.log('Withdrawal transaction signature:', withdrawalTx);
        
        // Verify proof verification succeeded by checking transaction didn't fail
        expect(withdrawalTx).toEqual(expect.any(String));
        
        // Verify funds transferred correctly
        const recipientBalance = await provider.connection.getBalance(recipient.publicKey);
        const expectedAmount = DEPOSIT_AMOUNT.sub(new BN(1000000)); // Deposit - relayer fee
        expect(recipientBalance).to.be.gte(expectedAmount.toNumber());
        
        // Verify nullifier recorded
        const nullifierSetAccount = await program.account.nullifierSet.fetch(nullifierSetKeypair.publicKey);
        const nullifierFound = nullifierSetAccount.nullifiers.some(
            (entry: any) => Buffer.from(entry.nullifier).equals(nullifier)
        );
        expect(nullifierFound).toBe(true);
        
        console.log(' Withdrawal phase completed successfully');
        console.log('Funds transferred to recipient');
        console.log('Nullifier recorded in NullifierSet');
    });

    it('Negative Test: Double withdrawal should fail', async () => {
        try {
            // Try to withdraw same commitment again
            await program.methods
                .withdraw(
                    Array.from(nullifier),
                    Array.from(groth16Proof.pi_a),
                    Array.from(groth16Proof.pi_b.flat()),
                    Array.from(groth16Proof.pi_c.flat()),
                    Array.from(publicSignals),
                    merkleProof.map(p => Array.from(p)),
                    [0], // Path indices for index 0
                    new BN(1000000) // 0.001 SOL relayer fee
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
            
            throw new Error('Double withdrawal should have failed');
        } catch (error) {
            // Verify second withdrawal rejected with NullifierAlreadyUsed
            expect((error as Error).toString()).to.include('NullifierAlreadyUsed');
            console.log(' Double withdrawal correctly rejected');
            console.log('Error:', (error as Error).toString());
        }
    });

    it('Verify complete privacy lifecycle', async () => {
        // Final state verification
        const stateAccount = await program.account.globalState.fetch(stateKeypair.publicKey);
        const nullifierSetAccount = await program.account.nullifierSet.fetch(nullifierSetKeypair.publicKey);
        
        console.log('Final state verification:');
        console.log('- Total deposits:', stateAccount.totalDeposits.toNumber());
        console.log('- Total withdrawals:', stateAccount.totalWithdrawn.toNumber());
        console.log('- NullifierSet entries:', nullifierSetAccount.nullifiers.length);
        console.log('- Merkle root:', Buffer.from(stateAccount.root).toString('hex'));
        
        // Verify lifecycle completed correctly
        expect(stateAccount.totalDeposits.toNumber()).toBe(1);
        expect(stateAccount.totalWithdrawn.toNumber()).toBe(1);
        expect(nullifierSetAccount.nullifiers.length).toBe(1);
        
        console.log(' Complete privacy lifecycle verified successfully');
    });

    async function loadCircuitKeys(): Promise<void> {
        try {
            // Load verification key
            const vkBuffer = fs.readFileSync('./verification_key.json');
            const verificationKey = JSON.parse(vkBuffer.toString());
            
            console.log(' Circuit keys loaded successfully');
        } catch (error) {
            console.warn('Circuit keys not found, generating test keys...');
            await generateTestKeys();
        }
    }

    async function generateTestKeys(): Promise<void> {
        // This would normally be done offline with proper ceremony
        // For testing, we'll create minimal test keys
        console.log('Generating test circuit keys...');
        
        // Create minimal verification key for testing
        const verificationKey = {
            protocol: 'groth16',
            curve: 'bn128',
            nPublic: 3,
            vk_alpha_1: ['1', '1', '1'],
            vk_beta_2: [['1', '1'], ['1', '1']],
            vk_gamma_2: ['1', '1'],
            vk_delta_2: ['1', '1'],
            IC: [['1', '1'], ['1', '1'], ['1', '1']]
        };
        
        console.log(' Test keys generated');
    }

    async function generateMerkleProof(_leaf: Buffer, _leafIndex: number): Promise<Buffer[]> {
        // Generate a simple merkle proof for testing
        // In a real implementation, this would use the actual merkle tree state
        const proof: Buffer[] = [];
        
        // For index 0, we need log2(MAX_LEAVES) levels
        for (let i = 0; i < TREE_DEPTH; i++) {
            // Generate sibling nodes (in real implementation, these come from the tree)
            const sibling = crypto.randomBytes(32);
            proof.push(sibling);
        }
        
        return proof;
    }
});
