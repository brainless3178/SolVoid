#!/usr/bin/env npx ts-node
/**
 * Initialize SolVoid Program State
 * Run after program deployment
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('=======================================');
    console.log('   SolVoid Program Initialization');
    console.log('=======================================\n');

    // Load keypair
    const keypairPath = process.env.KEYPAIR_PATH || `${process.env.HOME}/.config/solana/id.json`;
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));

    console.log(`Authority: ${keypair.publicKey.toBase58()}`);

    // Connection
    const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    console.log(`RPC: ${rpcUrl}`);

    // Check balance
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`Balance: ${balance / 1e9} SOL\n`);

    if (balance < 0.1 * 1e9) {
        console.error('ERROR: Insufficient balance. Need at least 0.1 SOL.');
        process.exit(1);
    }

    // Program ID
    const programId = new PublicKey(process.env.PROGRAM_ID || '3QcKRYWquzbBR3UpKeh4aKVCSpoHy89UT8gyovzRzzan');
    console.log(`Program ID: ${programId.toBase58()}`);

    // Check if program exists
    const programInfo = await connection.getAccountInfo(programId);
    if (!programInfo) {
        console.error('ERROR: Program not found. Deploy first with: ./scripts/deploy-program.sh');
        process.exit(1);
    }
    console.log('Program found!\n');

    // Load IDL
    const idlPath = './target/idl/solvoid_zk.json';
    if (!fs.existsSync(idlPath)) {
        console.error('ERROR: IDL not found. Run: anchor build');
        process.exit(1);
    }
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

    // Setup Anchor
    const wallet = new Wallet(keypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    const program = new Program(idl, programId, provider);

    // Derive PDAs
    const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], programId);
    const [rootHistoryPda] = PublicKey.findProgramAddressSync([Buffer.from('root_history')], programId);
    const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault')], programId);

    console.log('PDAs:');
    console.log(`  State: ${statePda.toBase58()}`);
    console.log(`  Root History: ${rootHistoryPda.toBase58()}`);
    console.log(`  Vault: ${vaultPda.toBase58()}\n`);

    // Check if already initialized
    const stateInfo = await connection.getAccountInfo(statePda);
    if (stateInfo) {
        console.log('Program already initialized!');
        process.exit(0);
    }

    // Initialize
    console.log('Initializing program state...');
    try {
        const tx = await (program.methods as any)
            .initialize(keypair.publicKey)
            .accounts({
                state: statePda,
                authority: keypair.publicKey,
                systemProgram: PublicKey.default,
            })
            .rpc();

        console.log(`Success! Signature: ${tx}\n`);
    } catch (error: any) {
        console.error('Initialization failed:', error.message);
        process.exit(1);
    }

    // Initialize root history
    console.log('Initializing root history...');
    try {
        const tx = await (program.methods as any)
            .initializeRootHistory()
            .accounts({
                rootHistory: rootHistoryPda,
                authority: keypair.publicKey,
                systemProgram: PublicKey.default,
            })
            .rpc();

        console.log(`Success! Signature: ${tx}\n`);
    } catch (error: any) {
        console.error('Root history initialization failed:', error.message);
    }

    console.log('=======================================');
    console.log('   Initialization Complete!');
    console.log('=======================================');
    console.log('\nNext: Run scripts/initialize-verifier.ts');
}

main().catch(console.error);
