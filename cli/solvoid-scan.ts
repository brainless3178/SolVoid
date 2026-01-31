#!/usr/bin/node

/**
 * SolVoid CLI: Primary command-line interface for the protocol.
 * Orchestrates user interactions with our SDK, Relayer, and ZK proving pipeline.
 */

import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import fetch from 'cross-fetch';
import { SolVoidClient, WalletAdapter } from '../sdk/client';
import { DataOrigin, DataTrust, Unit, enforce, PublicKeySchema, IdlSchema } from '../sdk/integrity';
import { registerGhostCommand } from './commands/ghost';
import { registerRescueCommand } from './commands/rescue';
import { Command } from 'commander';

dotenv.config();

const CLI_METADATA = {
    origin: DataOrigin.CLI_ARG,
    trust: DataTrust.UNTRUSTED,
    createdAt: Date.now(),
    owner: 'CLI User'
};

/**
 * Registry for protocol administration and emergency control functions.
 */
function registerAdminCommand(program: Command, client: SolVoidClient) {
    const admin = program.command('admin').description('Protocol Administration & Emergency Controls');

    admin
        .command('trigger-emergency')
        .description('Trigger protocol-wide emergency fee multiplier')
        .argument('<multiplier>', 'Fee multiplier (1-10)')
        .argument('<reason>', 'Reason for emergency')
        .action(async (multiplier, reason) => {
            console.log(`Triggering emergency status (Multiplier: x${multiplier}) for: ${reason}`);
            const tx = await client.triggerEmergencyMode(BigInt(multiplier), reason);
            console.log(`Emergency mode active. Signature: ${tx}`);
        });

    admin
        .command('disable-emergency')
        .description('Deactivate emergency mode and reset fees')
        .action(async () => {
            console.log('Deactivating emergency mode...');
            const tx = await client.disableEmergencyMode();
            console.log(`Emergency mode disabled. Signature: ${tx}`);
        });

    admin
        .command('pause')
        .description('Pause all withdrawals via Circuit Breaker')
        .action(async () => {
            console.log('Triggering Circuit Breaker...');
            const tx = await client.triggerCircuitBreaker();
            console.log(`Protocol state: PAUSED. Signature: ${tx}`);
        });

    admin
        .command('resume')
        .description('Resume withdrawals and reset circuit breaker')
        .action(async () => {
            console.log('Resetting Circuit Breaker...');
            const tx = await client.resetCircuitBreaker();
            console.log(`Protocol state: RESUMED. Signature: ${tx}`);
        });
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command || args.includes('--help')) {
        console.log(`
SolVoid: The Digital Fortress for Solana

Commands:
  protect <address>    Execute a comprehensive privacy leak audit
  rescue <address>     Initiate atomic asset recovery for compromised wallets
  shield <amount>      Execute a private deposit (Surgical Shielding)
  withdraw <secret> <nullifier> <recipient>   Execute an unlinkable ZK withdrawal
  ghost <address>      Calculate decentralized Privacy Ghost Score
`);
        process.exit(0);
    }

    if (command === 'ghost') {
        const { Command } = await import('commander');
        const program = new Command();
        registerGhostCommand(program);
        program.parse();
        return;
    }

    if (command === 'rescue') {
        const { Command } = await import('commander');
        const program = new Command();
        registerRescueCommand(program);
        program.parse();
        return;
    }

    /**
     * Environment-driven configuration initialization with fallback values.
     */
    const rpcUrl = args.includes('--rpc') ? args[args.indexOf('--rpc') + 1] : (process.env.RPC_URL || 'https://api.mainnet-beta.solana.com');
    const programId = args.includes('--program') ? args[args.indexOf('--program') + 1] : (process.env.PROGRAM_ID || 'Fg6PaFpoGXkYsidMpSsu3SWJYEHp7rQU9YSTFNDQ4F5i');
    const relayerUrl = args.includes('--relayer') ? args[args.indexOf('--relayer') + 1] : (process.env.SHADOW_RELAYER_URL || 'http://localhost:3000');

    /** Node-side configuration boundary enforcement. */
    if (!rpcUrl || !programId) throw new Error("Configuration Error: Missing RPC_URL or PROGRAM_ID environment variables.");

    const wallet = Keypair.generate();
    const config = {
        rpcUrl: rpcUrl ?? '',
        programId: programId ?? '',
        relayerUrl: relayerUrl ?? ''
    };
    const client = new SolVoidClient(config, wallet as unknown as WalletAdapter);

    const program = new Command();
    program.name('solvoid-scan').description('SolVoid Digital Fortress CLI');

    /** Global CLI option registration. */
    program.option('--rpc <url>', 'Override specified Solana RPC URL', rpcUrl);
    program.option('--program <id>', 'Override target SolVoid Program ID', programId);
    program.option('--relayer <url>', 'Override target Shadow Relayer URL', relayerUrl);

    /** Modular subcommand orchestration. */
    registerGhostCommand(program);
    registerRescueCommand(program);
    registerAdminCommand(program, client);

    if (command === 'ghost' || command === 'rescue' || command === 'admin') {
        program.parse(process.argv);
        return;
    }

    try {
        switch (command) {
            case 'protect': {
                const rawAddress = args[1];
                if (!rawAddress) throw new Error("Argument Error: Target address is required.");

                /** Parameter validation: CLI-to-SDK boundary enforcement. */
                const enforcedAddr = enforce(PublicKeySchema, rawAddress, CLI_METADATA);
                const address = new PublicKey(enforcedAddr.value);

                console.log(`\nInitiating privacy audit for ${address.toBase58()}...`);

                const passport = await client.getPassport(address.toBase58());
                const results = await client.protect(address);

                console.log(`\n--- PRIVACY PASSPORT ---`);
                const scoreColor = passport.overallScore < 50 ? '\x1b[31m' : passport.overallScore < 80 ? '\x1b[33m' : '\x1b[32m';
                console.log(`Overall Privacy Score: ${scoreColor}${passport.overallScore}/100\x1b[0m`);
                console.log(`Attained Badges: ${passport.badges.map(b => b.icon + ' ' + b.name).join(', ') || 'None'}`);

                results.forEach((res) => {
                    console.log(`\n---------------------------------------------------------`);
                    console.log(`Audit Signature: ${res.signature}`);
                    if (res.leaks.length > 0) {
                        res.leaks.forEach((leak) => {
                            const sevColor = leak.severity === 'CRITICAL' ? '\x1b[31m' : '\x1b[33m';
                            console.log(`  - [${sevColor}${leak.severity}\x1b[0m] ${leak.description}`);
                        });
                    }
                });
                break;
            }

            case 'rescue': {
                const rawAddress = args[1];
                if (!rawAddress) throw new Error("Argument Error: Target address is required.");

                const enforcedAddr = enforce(PublicKeySchema, rawAddress, CLI_METADATA);
                const address = new PublicKey(enforcedAddr.value);

                console.log(`\nExecuting recovery analysis for: ${address.toBase58()}`);
                const result = await client.rescue(address);

                if (result.status === 'analysis_complete') {
                    console.log(`\nAnalysis Result: Detected ${result.leakCount} leak vectors.`);
                    console.log(`Current Score: ${result.currentScore} -> Remediation Potential: ${result.potentialScore}`);
                } else {
                    console.log(`\n${result.message}`);
                }
                break;
            }

            case 'shield': {
                const amountSolRaw = args[1];
                if (!amountSolRaw) throw new Error("Argument Error: Shielding amount is required.");

                const amountSol = parseFloat(amountSolRaw);
                if (isNaN(amountSol) || amountSol <= 0) throw new Error("Precision Error: Invalid SOL amount.");

                /** Unit transformation: SOL to atomic Lamports for protocol precision. */
                const amountLamports = Math.floor(amountSol * 1_000_000_000);

                console.log(`Executing surgical shield for ${amountSol} SOL (${amountLamports} Lamports)...`);
                const { commitmentData } = await client.shield(amountLamports);

                console.log('\n--- CRYPTOGRAPHIC SECRETS (EXTREMELY SENSITIVE) ---');
                console.log('Secret Key:', commitmentData.secret);
                console.log('Nullifier Key:', commitmentData.nullifier);
                console.log('Commitment Hash:', commitmentData.commitmentHex);
                break;
            }

            case 'withdraw': {
                const secret = args[1];
                const nullifier = args[2];
                const rawRecipient = args[3];
                const amountRaw = args[4];

                if (!secret || !nullifier || !rawRecipient || !amountRaw) throw new Error("Argument Error: All withdrawal primitives are required.");

                const enforcedRecipient = enforce(PublicKeySchema, rawRecipient, CLI_METADATA);
                const recipient = enforcedRecipient.value;
                const amount = BigInt(Math.floor(parseFloat(amountRaw) * 1_000_000_000));

                console.log(`Preparing ZK witness for ${amountRaw} SOL withdrawal to ${recipient}...`);

                /** State synchronization: Retrieving commitment tree from relay network. */
                const response = await fetch(`${relayerUrl}/commitments`);
                if (!response.ok) throw new Error(`Relay Failure: ${response.statusText}`);

                const data = (await response.json()) as { commitments: string[] };
                const commitmentsHex = data.commitments;

                /** Groth16 Prover initialization using standardized artifacts. */
                const wasmPath = process.env.ZK_WASM_PATH || './circuits/withdraw_js/withdraw.wasm';
                const zkeyPath = process.env.ZK_ZKEY_PATH || './circuits/build/withdraw_final.zkey';
                const result = await client.prepareWithdrawal(
                    secret,
                    nullifier,
                    amount,
                    new PublicKey(recipient),
                    commitmentsHex,
                    wasmPath,
                    zkeyPath
                );

                console.log('\nZK Withdrawal Proof Successfully Generated:');
                console.log('Nullifier Hash:', result.nullifierHash);
                console.log('Root Hash:', result.root);
                console.log('Proof Wire Format:', JSON.stringify(result.proof, null, 2));
                break;
            }

            default:
                console.error(`Execution Error: Unknown command identifier '${command}'`);
                process.exit(1);
        }
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Critical Execution Failure';
        console.error('\x1b[31mError:\x1b[0m', msg);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
