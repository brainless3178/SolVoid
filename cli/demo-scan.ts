#!/usr/bin/env node

/**
 * SolVoid Demo Privacy Scanner - Mock Data Version
 */

import { PublicKey, Connection } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { PrivacyEngine } from '../sdk/privacy-engine';
import { Leak } from '../sdk/types';

dotenv.config();

const connection = new Connection(process.env.RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
const engine = new PrivacyEngine();

interface PrivacyScore {
    score: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    leaks: Leak[];
    totalTransactions: number;
    scannedAt: number;
}

class RealPrivacyScanner {
    async analyzeAddress(address: string): Promise<PrivacyScore> {
        try {
            const pubkey = new PublicKey(address);

            // 1. Fetch real transaction signatures
            const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 10 });

            let allLeaks: Leak[] = [];

            // 2. Deep Inspect each transaction (Real data)
            for (const sigInfo of signatures) {
                const tx = await connection.getTransaction(sigInfo.signature, {
                    maxSupportedTransactionVersion: 0,
                    commitment: 'confirmed'
                });

                if (tx) {
                    // Convert to format engine expects
                    const txJson: any = {
                        message: tx.transaction.message,
                        meta: tx.meta,
                        signatures: tx.transaction.signatures
                    };
                    const leaks = engine.analyzeTransaction(txJson);
                    allLeaks = [...allLeaks, ...leaks];
                }
            }

            const score = engine.calculateScore(allLeaks);
            const riskLevel = score >= 80 ? 'LOW' : score >= 60 ? 'MEDIUM' : 'HIGH';

            return {
                score,
                riskLevel,
                leaks: allLeaks,
                totalTransactions: signatures.length,
                scannedAt: Date.now()
            };
        } catch (error) {
            console.error(' [ERROR] Real scan failed:', error);
            throw error;
        }
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
 SolVoid Privacy Scanner - Demo Version

Usage:
  node demo-scan.js <address> [options]

Options:
  --help, -h     Show this help message
  --demo         Show demo with multiple addresses

Examples:
  node demo-scan.js 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
  node demo-scan.js --demo
        `);
        process.exit(0);
    }

    if (args.includes('--demo')) {
        await runDemo();
        return;
    }

    const address = args[0];

    try {
        console.log(` Analyzing privacy for address: ${address}`);
        console.log(` Using demo data (mock analysis)`);
        console.log('');

        const scanner = new RealPrivacyScanner();
        const result = await scanner.analyzeAddress(address);

        console.log(` Privacy Score: ${result.score}/100`);
        console.log(`  Risk Level: ${result.riskLevel}`);
        console.log(`  Transactions Scanned: ${result.totalTransactions}`);
        console.log('');

        if (result.leaks.length > 0) {
            console.log(' Detected Privacy Leaks:');
            result.leaks.forEach(leak => {
                console.log(`  [${leak.severity}] ${leak.type.toUpperCase()}: ${leak.description}`);
                if (leak.remediation) console.log(`    Remediation: ${leak.remediation}`);
            });
        } else {
            console.log(' No immediate privacy leaks identified in recent history.');
        }

    } catch (error) {
        console.error(' Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}

async function runDemo() {
    const scanner = new RealPrivacyScanner();
    const addresses = [
        '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'So11111111111111111111111111111111111111112'
    ];

    console.log(' SolVoid Privacy Scanner - Demo Mode');
    console.log('=====================================');
    console.log('');

    for (const address of addresses) {
        console.log(` Analyzing: ${address.slice(0, 8)}...${address.slice(-8)}`);

        const spinner = ['', '', '', '', '', '', '', '', '', ''];
        let i = 0;

        const interval = setInterval(() => {
            process.stdout.write(`\r${spinner[i]} Scanning transactions...`);
            i = (i + 1) % spinner.length;
        }, 100);

        const result = await scanner.analyzeAddress(address);
        clearInterval(interval);

        console.log(`\r Analysis complete!`);
        console.log(` Privacy Score: ${result.score}/100 (${result.riskLevel})`);
        console.log(` ${result.totalTransactions.toLocaleString()} transactions analyzed`);
        console.log('');

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('');
    console.log(' Demo Complete!');
    console.log('');
    console.log(' Key Features Demonstrated:');
    console.log('  • Privacy scoring algorithm');
    console.log('  • Transaction pattern analysis');
    console.log('  • Risk assessment');
    console.log('  • Personalized recommendations');
    console.log('');
    console.log(' Try it yourself:');
    console.log('  node demo-scan.js <your-address>');
}

if (require.main === module) {
    main().catch(console.error);
}
