/**
 * SolVoid E2E Production Test - Raw Transaction Version
 * 
 * This script performs a complete end-to-end test using raw Solana transactions:
 * 1. Initialize program state (if not already initialized)
 * 2. Execute a real deposit transaction
 * 
 * NO MOCKS. NO TEST DATA. REAL TRANSACTIONS.
 */

const { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction, TransactionInstruction, sendAndConfirmTransaction } = require('@solana/web3.js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PoseidonHasher } = require('../dist/sdk/crypto/poseidon');
const BN = require('bn.js');

// Configuration
const RPC_URL = 'https://zk-edge.surfnet.dev:8899';
const PROGRAM_ID = new PublicKey('3QcKRYWquzbBR3UpKeh4aKVCSpoHy89UT8gyovzRzzan');

// Anchor discriminators (first 8 bytes of SHA256 hash of "global:method_name")
// Pre-computed for our methods
const DISCRIMINATORS = {
    initialize: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]), // anchor discriminator for "global:initialize"
    initializeRootHistory: Buffer.from([42, 181, 232, 40, 185, 246, 26, 242]),
    initializeEconomics: Buffer.from([116, 202, 68, 224, 253, 189, 79, 69]),
    deposit: Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]), // anchor discriminator for "global:deposit"
};

// Helper to compute Anchor discriminator
function computeDiscriminator(name) {
    const hash = crypto.createHash('sha256').update(`global:${name}`).digest();
    return hash.slice(0, 8);
}

async function loadKeypair() {
    const keypairPath = path.join(process.env.HOME, '.config/solana/id.json');
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

async function getPDAs() {
    const [statePda, stateBump] = PublicKey.findProgramAddressSync([Buffer.from('state')], PROGRAM_ID);
    const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID);
    const [rootHistoryPda, rootHistoryBump] = PublicKey.findProgramAddressSync([Buffer.from('root_history')], PROGRAM_ID);
    const [economicPda, economicBump] = PublicKey.findProgramAddressSync([Buffer.from('economic_state')], PROGRAM_ID);

    return {
        statePda, stateBump,
        vaultPda, vaultBump,
        rootHistoryPda, rootHistoryBump,
        economicPda, economicBump
    };
}

async function checkAndInitialize(connection, payer) {
    const { statePda, vaultPda, rootHistoryPda, economicPda } = await getPDAs();

    console.log('');
    console.log('1️⃣  CHECKING PROGRAM STATE');
    console.log('   ├─ State PDA:', statePda.toBase58());
    console.log('   ├─ Vault PDA:', vaultPda.toBase58());
    console.log('   ├─ Root History PDA:', rootHistoryPda.toBase58());
    console.log('   └─ Economic PDA:', economicPda.toBase58());

    // Check if state account exists
    const stateAccount = await connection.getAccountInfo(statePda);

    if (!stateAccount) {
        console.log('');
        console.log('   ⚠️  Program not initialized. Initializing...');

        try {
            // Initialize main state - raw instruction construction
            const initDiscriminator = computeDiscriminator('initialize');
            const authorityData = payer.publicKey.toBuffer();

            const initData = Buffer.concat([initDiscriminator, authorityData]);

            const initIx = new TransactionInstruction({
                keys: [
                    { pubkey: statePda, isSigner: false, isWritable: true },
                    { pubkey: vaultPda, isSigner: false, isWritable: true },
                    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: PROGRAM_ID,
                data: initData
            });

            const initTx = new Transaction().add(initIx);
            const initSig = await sendAndConfirmTransaction(connection, initTx, [payer], { commitment: 'confirmed' });
            console.log('   ✅ State initialized:', initSig);

            // Initialize root history
            const rootHistoryDiscriminator = computeDiscriminator('initialize_root_history');
            const rootHistoryIx = new TransactionInstruction({
                keys: [
                    { pubkey: rootHistoryPda, isSigner: false, isWritable: true },
                    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: PROGRAM_ID,
                data: rootHistoryDiscriminator
            });

            const rootHistoryTx = new Transaction().add(rootHistoryIx);
            const rootHistorySig = await sendAndConfirmTransaction(connection, rootHistoryTx, [payer], { commitment: 'confirmed' });
            console.log('   ✅ Root history initialized:', rootHistorySig);

            // Initialize economics
            const economicsDiscriminator = computeDiscriminator('initialize_economics');
            const economicsIx = new TransactionInstruction({
                keys: [
                    { pubkey: economicPda, isSigner: false, isWritable: true },
                    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: PROGRAM_ID,
                data: economicsDiscriminator
            });

            const economicsTx = new Transaction().add(economicsIx);
            const economicsSig = await sendAndConfirmTransaction(connection, economicsTx, [payer], { commitment: 'confirmed' });
            console.log('   ✅ Economics initialized:', economicsSig);

        } catch (e) {
            if (e.message?.includes('already in use') || e.message?.includes('custom program error: 0x0')) {
                console.log('   ℹ️  Some accounts already initialized, continuing...');
            } else {
                console.log('   ❌ Initialization error:', e.message);
                throw e;
            }
        }
    } else {
        console.log('   ✅ Program already initialized');
        console.log('   ├─ Account Size:', stateAccount.data.length, 'bytes');
        console.log('   └─ Owner:', stateAccount.owner.toBase58());
    }
}

async function executeDeposit(connection, payer, amountLamports) {
    const { statePda, vaultPda, rootHistoryPda } = await getPDAs();

    console.log('');
    console.log('2️⃣  GENERATING COMMITMENT');

    // Generate secure random secret and nullifier
    const secret = crypto.randomBytes(32);
    const nullifier = crypto.randomBytes(32);

    console.log('   ├─ Secret:', secret.toString('hex').substring(0, 16) + '...');
    console.log('   └─ Nullifier:', nullifier.toString('hex').substring(0, 16) + '...');

    // Compute commitment using Poseidon(secret, nullifier, amount)
    const commitment = await PoseidonHasher.computeCommitment(secret, nullifier, BigInt(amountLamports));
    const nullifierHash = await PoseidonHasher.computeNullifierHash(nullifier);

    console.log('');
    console.log('3️⃣  EXECUTING DEPOSIT TRANSACTION');
    console.log('   ├─ Commitment:', commitment.toString('hex').substring(0, 32) + '...');
    console.log('   ├─ Amount:', amountLamports / LAMPORTS_PER_SOL, 'SOL');
    console.log('   ├─ Amount (lamports):', amountLamports.toString());

    try {
        // Build deposit instruction
        const depositDiscriminator = computeDiscriminator('deposit');

        // Encode: discriminator (8) + commitment (32) + amount (8)
        const amountBuffer = Buffer.alloc(8);
        amountBuffer.writeBigUInt64LE(BigInt(amountLamports), 0);

        const depositData = Buffer.concat([
            depositDiscriminator,
            commitment,
            amountBuffer
        ]);

        const depositIx = new TransactionInstruction({
            keys: [
                { pubkey: statePda, isSigner: false, isWritable: true },
                { pubkey: rootHistoryPda, isSigner: false, isWritable: true },
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: vaultPda, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data: depositData
        });

        const depositTx = new Transaction().add(depositIx);
        const txSignature = await sendAndConfirmTransaction(connection, depositTx, [payer], {
            commitment: 'confirmed',
            preflightCommitment: 'confirmed'
        });

        console.log('   └─ ✅ Transaction:', txSignature);

        // Get the leaf index from state account data
        const stateAccountInfo = await connection.getAccountInfo(statePda);
        if (!stateAccountInfo) throw new Error('State account not found after deposit');

        // Parse the state data manually
        // Layout: discriminator(8) + authority(32) + merkle_root(32) + leaf_count(8) + ...
        const data = stateAccountInfo.data;
        const leafCount = data.readBigUInt64LE(8 + 32 + 32);
        const merkleRoot = data.subarray(8 + 32, 8 + 32 + 32);

        const leafIndex = Number(leafCount) - 1;

        console.log('');
        console.log('4️⃣  DEPOSIT CONFIRMED');
        console.log('   ├─ Leaf Index:', leafIndex.toString());
        console.log('   └─ New Merkle Root:', merkleRoot.toString('hex').substring(0, 32) + '...');

        // Create deposit note
        const depositNote = {
            secret: secret.toString('hex'),
            nullifier: nullifier.toString('hex'),
            commitment: commitment.toString('hex'),
            nullifierHash: nullifierHash.toString('hex'),
            amount: amountLamports.toString(),
            leafIndex: leafIndex,
            merkleRoot: merkleRoot.toString('hex'),
            txSignature,
            programId: PROGRAM_ID.toBase58(),
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

    } catch (e) {
        console.log('   └─ ❌ Transaction Failed:', e.message);

        // Try to get more detailed error
        if (e.logs) {
            console.log('   Logs:');
            e.logs.forEach(log => console.log('     ', log));
        }
        throw e;
    }
}

async function getVaultBalance(connection) {
    const { vaultPda } = await getPDAs();
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
    console.log('   └─ Program ID:', PROGRAM_ID.toBase58());

    const connection = new Connection(RPC_URL, 'confirmed');
    const payer = await loadKeypair();

    console.log('');
    console.log('Wallet:');
    console.log('   ├─ Address:', payer.publicKey.toBase58());
    const balance = await connection.getBalance(payer.publicKey);
    console.log('   └─ Balance:', balance / LAMPORTS_PER_SOL, 'SOL');

    if (balance < 0.05 * LAMPORTS_PER_SOL) {
        console.log('');
        console.log('❌ Insufficient balance. Need at least 0.05 SOL.');
        process.exit(1);
    }

    // Step 1: Check and initialize program
    await checkAndInitialize(connection, payer);

    // Step 2: Execute deposit (0.01 SOL = 10,000,000 lamports, must be >= 0.001 SOL)
    const depositAmount = 10000000; // 0.01 SOL
    const depositNote = await executeDeposit(connection, payer, depositAmount);

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
    console.log('   ├─ Deposited:', depositAmount / LAMPORTS_PER_SOL, 'SOL');
    console.log('   ├─ Remaining Balance:', finalBalance / LAMPORTS_PER_SOL, 'SOL');
    console.log('   ├─ Vault Balance:', vaultBalance / LAMPORTS_PER_SOL, 'SOL');
    console.log('   └─ Commitment Index:', depositNote.leafIndex);
    console.log('');
    console.log('📋 Next: Run withdrawal test with:');
    console.log('   node tests/e2e-withdraw.js');
}

main().catch(e => {
    console.error('');
    console.error('❌ E2E Test Failed:', e.message);
    if (e.logs) {
        console.error('Program logs:');
        e.logs.forEach(log => console.error('  ', log));
    }
    console.error(e.stack);
    process.exit(1);
});
