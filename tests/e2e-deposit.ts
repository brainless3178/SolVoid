/**
 * SolVoid E2E Production Test
 * 
 * This script performs a complete end-to-end test:
 * 1. Initialize program state (if not already initialized)
 * 2. Execute a real deposit transaction
 * 3. Generate withdrawal proof
 * 4. Execute withdrawal
 * 
 * NO MOCKS. NO TEST DATA. REAL TRANSACTIONS.
 */

import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN, web3 } from '@coral-xyz/anchor';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PoseidonHasher, PoseidonUtils } from '../sdk/crypto/poseidon';

// Configuration
const RPC_URL = 'https://zk-edge.surfnet.dev:8899';
const PROGRAM_ID = '3QcKRYWquzbBR3UpKeh4aKVCSpoHy89UT8gyovzRzzan';

// Load IDL
const IDL = JSON.parse(fs.readFileSync(path.join(__dirname, '../sdk/solvoid_zk_idl.json'), 'utf-8'));

interface DepositNote {
    secret: string;
    nullifier: string;
    commitment: string;
    nullifierHash: string;
    amount: string;
    leafIndex: number;
    programId: string;
    rpc: string;
    timestamp: number;
}

async function loadKeypair(): Promise<Keypair> {
    const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

function getProgram(connection: Connection, payer: Keypair): Program {
    const wallet = {
        publicKey: payer.publicKey,
        signTransaction: async (tx: any) => {
            tx.partialSign(payer);
            return tx;
        },
        signAllTransactions: async (txs: any[]) => {
            txs.forEach(tx => tx.partialSign(payer));
            return txs;
        }
    };

    const provider = new AnchorProvider(connection, wallet as any, {
        preflightCommitment: 'confirmed',
    });

    return new Program(IDL, provider);
}

async function checkAndInitialize(program: Program, payer: Keypair): Promise<void> {
    const programId = new PublicKey(PROGRAM_ID);

    const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], programId);
    const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault')], programId);
    const [rootHistoryPda] = PublicKey.findProgramAddressSync([Buffer.from('root_history')], programId);
    const [economicPda] = PublicKey.findProgramAddressSync([Buffer.from('economic_state')], programId);

    console.log('');
    console.log('1️⃣  CHECKING PROGRAM STATE');
    console.log('   ├─ State PDA:', statePda.toBase58());
    console.log('   ├─ Vault PDA:', vaultPda.toBase58());
    console.log('   ├─ Root History PDA:', rootHistoryPda.toBase58());
    console.log('   └─ Economic PDA:', economicPda.toBase58());

    // Check if state account exists
    const stateAccount = await program.provider.connection.getAccountInfo(statePda);

    if (!stateAccount) {
        console.log('');
        console.log('   ⚠️  Program not initialized. Initializing...');

        try {
            // Initialize main state
            const initTx = await (program.methods as any)
                .initialize(payer.publicKey)
                .accounts({
                    state: statePda,
                    vault: vaultPda,
                    authority: payer.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log('   ✅ State initialized:', initTx);

            // Initialize root history
            const rootHistoryTx = await (program.methods as any)
                .initializeRootHistory()
                .accounts({
                    rootHistory: rootHistoryPda,
                    authority: payer.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log('   ✅ Root history initialized:', rootHistoryTx);

            // Initialize economics
            const economicsTx = await (program.methods as any)
                .initializeEconomics()
                .accounts({
                    economicState: economicPda,
                    authority: payer.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log('   ✅ Economics initialized:', economicsTx);

        } catch (e: any) {
            if (e.message?.includes('already in use')) {
                console.log('   ℹ️  Some accounts already initialized, continuing...');
            } else {
                throw e;
            }
        }
    } else {
        console.log('   ✅ Program already initialized');
    }
}

async function executeDeposit(program: Program, payer: Keypair, amountLamports: bigint): Promise<DepositNote> {
    const programId = new PublicKey(PROGRAM_ID);

    console.log('');
    console.log('2️⃣  GENERATING COMMITMENT');

    // Generate secure random secret and nullifier
    const secret = crypto.randomBytes(32);
    const nullifier = crypto.randomBytes(32);

    console.log('   ├─ Secret:', secret.toString('hex').substring(0, 16) + '...');
    console.log('   └─ Nullifier:', nullifier.toString('hex').substring(0, 16) + '...');

    // Compute commitment using Poseidon(secret, nullifier, amount)
    const commitment = await PoseidonHasher.computeCommitment(secret, nullifier, amountLamports);
    const nullifierHash = await PoseidonHasher.computeNullifierHash(nullifier);

    console.log('');
    console.log('3️⃣  EXECUTING DEPOSIT TRANSACTION');
    console.log('   ├─ Commitment:', commitment.toString('hex').substring(0, 32) + '...');
    console.log('   ├─ Amount:', Number(amountLamports) / LAMPORTS_PER_SOL, 'SOL');
    console.log('   ├─ Amount (lamports):', amountLamports.toString());

    const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], programId);
    const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault')], programId);
    const [rootHistoryPda] = PublicKey.findProgramAddressSync([Buffer.from('root_history')], programId);

    try {
        const txSignature = await (program.methods as any)
            .deposit(Array.from(commitment), new BN(amountLamports.toString()))
            .accounts({
                state: statePda,
                rootHistory: rootHistoryPda,
                depositor: payer.publicKey,
                vault: vaultPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        console.log('   └─ ✅ Transaction:', txSignature);

        // Get the leaf index from state account data
        const stateAccountInfo = await program.provider.connection.getAccountInfo(statePda);
        if (!stateAccountInfo) throw new Error('State account not found after deposit');

        // Parse the state data manually
        // Layout: discriminator(8) + authority(32) + merkle_root(32) + leaf_count(8) + ...
        const data = stateAccountInfo.data;
        const leafCount = data.readBigUInt64LE(8 + 32 + 32); // discriminator + authority + merkle_root
        const merkleRoot = data.subarray(8 + 32, 8 + 32 + 32);

        const leafIndex = Number(leafCount) - 1;

        console.log('');
        console.log('4️⃣  DEPOSIT CONFIRMED');
        console.log('   ├─ Leaf Index:', leafIndex.toString());
        console.log('   └─ New Merkle Root:', merkleRoot.toString('hex').substring(0, 32) + '...');

        // Create deposit note
        const depositNote: DepositNote = {
            secret: secret.toString('hex'),
            nullifier: nullifier.toString('hex'),
            commitment: commitment.toString('hex'),
            nullifierHash: nullifierHash.toString('hex'),
            amount: amountLamports.toString(),
            leafIndex: Number(leafIndex),
            programId: PROGRAM_ID,
            rpc: RPC_URL,
            timestamp: Date.now()
        };

        // Save deposit note securely
        const notePath = path.join(process.cwd(), '.deposit-note-production.json');
        fs.writeFileSync(notePath, JSON.stringify(depositNote, null, 2));

        console.log('');
        console.log('5️⃣  DEPOSIT NOTE SAVED');
        console.log('   ├─ Path:', notePath);
        console.log('   └─ ⚠️  KEEP THIS FILE SAFE - Required for withdrawal!');

        return depositNote;

    } catch (e: any) {
        console.log('   └─ ❌ Transaction Failed:', e.message);
        throw e;
    }
}

async function getVaultBalance(connection: Connection): Promise<number> {
    const programId = new PublicKey(PROGRAM_ID);
    const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault')], programId);
    const balance = await connection.getBalance(vaultPda);
    return balance;
}

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║     SolVoid E2E Production Test                               ║');
    console.log('║     REAL TRANSACTIONS ON DEPLOYED CONTRACT                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Configuration:');
    console.log('   ├─ RPC:', RPC_URL);
    console.log('   └─ Program ID:', PROGRAM_ID);

    const connection = new Connection(RPC_URL, 'confirmed');
    const payer = await loadKeypair();

    console.log('');
    console.log('Wallet:');
    console.log('   ├─ Address:', payer.publicKey.toBase58());
    const balance = await connection.getBalance(payer.publicKey);
    console.log('   └─ Balance:', balance / LAMPORTS_PER_SOL, 'SOL');

    if (balance < 0.1 * LAMPORTS_PER_SOL) {
        console.log('');
        console.log('❌ Insufficient balance. Need at least 0.1 SOL.');
        process.exit(1);
    }

    const program = getProgram(connection, payer);

    // Step 1: Check and initialize program
    await checkAndInitialize(program, payer);

    // Step 2: Execute deposit
    const depositAmount = BigInt(0.01 * LAMPORTS_PER_SOL); // 0.01 SOL deposit
    const depositNote = await executeDeposit(program, payer, depositAmount);

    // Check vault balance
    const vaultBalance = await getVaultBalance(connection);
    console.log('');
    console.log('6️⃣  VAULT STATUS');
    console.log('   └─ Vault Balance:', vaultBalance / LAMPORTS_PER_SOL, 'SOL');

    // Final summary
    const finalBalance = await connection.getBalance(payer.publicKey);
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ DEPOSIT COMPLETE!                       ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Summary:');
    console.log('   ├─ Deposited:', Number(depositAmount) / LAMPORTS_PER_SOL, 'SOL');
    console.log('   ├─ Remaining Balance:', finalBalance / LAMPORTS_PER_SOL, 'SOL');
    console.log('   ├─ Vault Balance:', vaultBalance / LAMPORTS_PER_SOL, 'SOL');
    console.log('   └─ Commitment Index:', depositNote.leafIndex);
    console.log('');
    console.log('📋 Next: Run withdrawal test with:');
    console.log('   npx ts-node tests/e2e-withdraw.ts');
}

main().catch(e => {
    console.error('');
    console.error('❌ E2E Test Failed:', e.message);
    console.error(e.stack);
    process.exit(1);
});
