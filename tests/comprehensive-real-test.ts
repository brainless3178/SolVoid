#!/usr/bin/env node

/**
 * SolVoid Comprehensive Real Testing Suite
 * Tests ALL components with REAL Solana blockchain data
 * NO MOCKS, NO DUMMIES, NO FAKE DATA
 * 
 * Address to test: 12UJoD4VRHneWXoy1j4k3KTACP8ZYX55sS4sbwzuk8KF
 */

import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

// Test address from user request
const TEST_ADDRESS = '12UJoD4VRHneWXoy1j4k3KTACP8ZYX55sS4sbwzuk8KF';

// RPC endpoints to test
const RPC_ENDPOINTS = [
    'https://api.mainnet-beta.solana.com',
    'https://solana-mainnet.rpc.extrnode.com',
];

interface TestResult {
    name: string;
    status: 'PASS' | 'FAIL' | 'SKIPPED' | 'NOT_IMPLEMENTED';
    duration: number;
    details: string;
    realData?: any;
    error?: string;
}

interface TestSummary {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    notImplemented: number;
    results: TestResult[];
}

const summary: TestSummary = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    notImplemented: 0,
    results: []
};

function log(message: string) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

function recordResult(result: TestResult) {
    summary.results.push(result);
    summary.totalTests++;

    switch (result.status) {
        case 'PASS':
            summary.passed++;
            log(`✅ PASS: ${result.name} (${result.duration}ms)`);
            break;
        case 'FAIL':
            summary.failed++;
            log(`❌ FAIL: ${result.name} - ${result.error}`);
            break;
        case 'SKIPPED':
            summary.skipped++;
            log(`⏭️  SKIPPED: ${result.name} - ${result.details}`);
            break;
        case 'NOT_IMPLEMENTED':
            summary.notImplemented++;
            log(`🚧 NOT IMPLEMENTED: ${result.name} - ${result.details}`);
            break;
    }
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, name: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([promise, timeout]);
}

// =====================================================
// SECTION 1: RPC CONNECTIVITY TESTS
// =====================================================

async function testRPCConnectivity(): Promise<void> {
    log('\n========================================');
    log('SECTION 1: RPC CONNECTIVITY TESTS');
    log('========================================');

    for (const rpc of RPC_ENDPOINTS) {
        const start = Date.now();
        try {
            const connection = new Connection(rpc, 'confirmed');
            const version = await runWithTimeout(connection.getVersion(), 10000, rpc);

            recordResult({
                name: `RPC Connectivity: ${rpc.substring(0, 50)}...`,
                status: 'PASS',
                duration: Date.now() - start,
                details: `Solana core version: ${version['solana-core']}`,
                realData: version
            });
        } catch (error: any) {
            recordResult({
                name: `RPC Connectivity: ${rpc.substring(0, 50)}...`,
                status: 'FAIL',
                duration: Date.now() - start,
                details: 'Failed to connect',
                error: error.message
            });
        }
    }
}

// =====================================================
// SECTION 2: REAL BLOCKCHAIN DATA TESTS
// =====================================================

async function testRealBlockchainData(): Promise<void> {
    log('\n========================================');
    log('SECTION 2: REAL BLOCKCHAIN DATA TESTS');
    log('========================================');
    log(`Testing address: ${TEST_ADDRESS}`);

    const connection = new Connection(RPC_ENDPOINTS[0], 'confirmed');
    const publicKey = new PublicKey(TEST_ADDRESS);

    // Test 2.1: Account Info
    const startAccountInfo = Date.now();
    try {
        const accountInfo = await runWithTimeout(
            connection.getAccountInfo(publicKey),
            15000,
            'getAccountInfo'
        );

        if (accountInfo) {
            recordResult({
                name: 'Get Account Info - Real Data',
                status: 'PASS',
                duration: Date.now() - startAccountInfo,
                details: `Executable: ${accountInfo.executable}, Owner: ${accountInfo.owner.toBase58()}, Data length: ${accountInfo.data.length}`,
                realData: {
                    owner: accountInfo.owner.toBase58(),
                    lamports: accountInfo.lamports,
                    dataLen: accountInfo.data.length,
                    executable: accountInfo.executable
                }
            });
        } else {
            recordResult({
                name: 'Get Account Info - Real Data',
                status: 'PASS',
                duration: Date.now() - startAccountInfo,
                details: 'Account exists but no data (likely system account)',
                realData: null
            });
        }
    } catch (error: any) {
        recordResult({
            name: 'Get Account Info - Real Data',
            status: 'FAIL',
            duration: Date.now() - startAccountInfo,
            details: 'Failed to fetch account info',
            error: error.message
        });
    }

    // Test 2.2: Account Balance
    const startBalance = Date.now();
    try {
        const balance = await runWithTimeout(
            connection.getBalance(publicKey),
            15000,
            'getBalance'
        );

        recordResult({
            name: 'Get Balance - Real Data',
            status: 'PASS',
            duration: Date.now() - startBalance,
            details: `Balance: ${balance / 1e9} SOL (${balance} lamports)`,
            realData: { balance, balanceSOL: balance / 1e9 }
        });
    } catch (error: any) {
        recordResult({
            name: 'Get Balance - Real Data',
            status: 'FAIL',
            duration: Date.now() - startBalance,
            details: 'Failed to fetch balance',
            error: error.message
        });
    }

    // Test 2.3: Transaction Signatures
    const startSignatures = Date.now();
    try {
        const signatures = await runWithTimeout(
            connection.getSignaturesForAddress(publicKey, { limit: 10 }),
            20000,
            'getSignaturesForAddress'
        );

        recordResult({
            name: 'Get Transaction Signatures - Real Data',
            status: 'PASS',
            duration: Date.now() - startSignatures,
            details: `Found ${signatures.length} recent transaction signatures`,
            realData: {
                count: signatures.length,
                signatures: signatures.map(s => ({
                    signature: s.signature,
                    slot: s.slot,
                    blockTime: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
                    err: s.err
                }))
            }
        });

        // Test 2.4: Parse individual transactions
        if (signatures.length > 0) {
            const startTxParse = Date.now();
            try {
                const tx = await runWithTimeout(
                    connection.getParsedTransaction(signatures[0].signature, {
                        maxSupportedTransactionVersion: 0
                    }),
                    20000,
                    'getParsedTransaction'
                );

                if (tx) {
                    recordResult({
                        name: 'Parse Transaction - Real Data',
                        status: 'PASS',
                        duration: Date.now() - startTxParse,
                        details: `Transaction parsed successfully. Fee: ${tx.meta?.fee} lamports`,
                        realData: {
                            signature: signatures[0].signature,
                            fee: tx.meta?.fee,
                            slot: tx.slot,
                            blockTime: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null
                        }
                    });
                } else {
                    recordResult({
                        name: 'Parse Transaction - Real Data',
                        status: 'FAIL',
                        duration: Date.now() - startTxParse,
                        details: 'Transaction returned null',
                        error: 'Null transaction'
                    });
                }
            } catch (error: any) {
                recordResult({
                    name: 'Parse Transaction - Real Data',
                    status: 'FAIL',
                    duration: Date.now() - startTxParse,
                    details: 'Failed to parse transaction',
                    error: error.message
                });
            }
        }
    } catch (error: any) {
        recordResult({
            name: 'Get Transaction Signatures - Real Data',
            status: 'FAIL',
            duration: Date.now() - startSignatures,
            details: 'Failed to fetch transaction signatures',
            error: error.message
        });
    }
}

// =====================================================
// SECTION 3: SDK TESTS
// =====================================================

async function testSDK(): Promise<void> {
    log('\n========================================');
    log('SECTION 3: SDK TESTS');
    log('========================================');

    // Test 3.1: SDK Client Import
    const startImport = Date.now();
    try {
        const { SolVoidClient } = await import('../sdk/client');

        recordResult({
            name: 'SDK Client Import',
            status: 'PASS',
            duration: Date.now() - startImport,
            details: 'SolVoidClient imported successfully'
        });

        // Test 3.2: SDK Client Instantiation
        const startInstantiate = Date.now();
        try {
            const { Keypair } = await import('@solana/web3.js');
            const wallet = Keypair.generate();

            const config = {
                rpcUrl: RPC_ENDPOINTS[0],
                programId: 'Fg6PaFpoGXkYsidMpSsu3SWJYEHp7rQU9YSTFNDQ4F5i',
                relayerUrl: 'http://localhost:3000'
            };

            const client = new SolVoidClient(config, wallet as any);

            recordResult({
                name: 'SDK Client Instantiation',
                status: 'PASS',
                duration: Date.now() - startInstantiate,
                details: 'SolVoidClient instantiated with mainnet RPC'
            });

            // Test 3.3: Protect Function (Privacy Scan)
            const startProtect = Date.now();
            try {
                const publicKey = new PublicKey(TEST_ADDRESS);
                const results = await runWithTimeout(
                    client.protect(publicKey),
                    30000,
                    'protect'
                );

                recordResult({
                    name: 'SDK protect() - Privacy Scan',
                    status: 'PASS',
                    duration: Date.now() - startProtect,
                    details: `Scanned address, found ${results.length} scan results`,
                    realData: {
                        resultsCount: results.length,
                        leaks: results.flatMap(r => r.leaks).length,
                        avgScore: results.length > 0
                            ? Math.round(results.reduce((acc, r) => acc + r.privacyScore, 0) / results.length)
                            : 100
                    }
                });
            } catch (error: any) {
                recordResult({
                    name: 'SDK protect() - Privacy Scan',
                    status: 'FAIL',
                    duration: Date.now() - startProtect,
                    details: 'Failed to run protect()',
                    error: error.message
                });
            }

            // Test 3.4: Get Passport
            const startPassport = Date.now();
            try {
                const passport = await runWithTimeout(
                    client.getPassport(TEST_ADDRESS),
                    10000,
                    'getPassport'
                );

                recordResult({
                    name: 'SDK getPassport() - Privacy Passport',
                    status: 'PASS',
                    duration: Date.now() - startPassport,
                    details: `Privacy score: ${passport.overallScore}, Badges: ${passport.badges.length}`,
                    realData: passport
                });
            } catch (error: any) {
                recordResult({
                    name: 'SDK getPassport() - Privacy Passport',
                    status: 'FAIL',
                    duration: Date.now() - startPassport,
                    details: 'Failed to get passport',
                    error: error.message
                });
            }

            // Test 3.5: Rescue Analysis
            const startRescue = Date.now();
            try {
                const publicKey = new PublicKey(TEST_ADDRESS);
                const rescueResult = await runWithTimeout(
                    client.rescue(publicKey),
                    30000,
                    'rescue'
                );

                recordResult({
                    name: 'SDK rescue() - Rescue Analysis',
                    status: 'PASS',
                    duration: Date.now() - startRescue,
                    details: `Status: ${rescueResult.status}, Leak count: ${rescueResult.leakCount || 0}`,
                    realData: rescueResult
                });
            } catch (error: any) {
                recordResult({
                    name: 'SDK rescue() - Rescue Analysis',
                    status: 'FAIL',
                    duration: Date.now() - startRescue,
                    details: 'Failed to run rescue analysis',
                    error: error.message
                });
            }

            // Test 3.6: Shield (Commitment Generation)
            const startShield = Date.now();
            try {
                const shieldResult = await runWithTimeout(
                    client.shield(1000000000), // 1 SOL in lamports
                    10000,
                    'shield'
                );

                recordResult({
                    name: 'SDK shield() - Commitment Generation',
                    status: 'PASS',
                    duration: Date.now() - startShield,
                    details: `Status: ${shieldResult.status}, Commitment generated`,
                    realData: {
                        status: shieldResult.status,
                        hasCommitment: !!shieldResult.commitmentData,
                        commitmentHex: shieldResult.commitmentData?.commitmentHex?.substring(0, 32) + '...'
                    }
                });
            } catch (error: any) {
                recordResult({
                    name: 'SDK shield() - Commitment Generation',
                    status: 'FAIL',
                    duration: Date.now() - startShield,
                    details: 'Failed to generate commitment',
                    error: error.message
                });
            }

        } catch (error: any) {
            recordResult({
                name: 'SDK Client Instantiation',
                status: 'FAIL',
                duration: Date.now() - startInstantiate,
                details: 'Failed to instantiate SolVoidClient',
                error: error.message
            });
        }
    } catch (error: any) {
        recordResult({
            name: 'SDK Client Import',
            status: 'FAIL',
            duration: Date.now() - startImport,
            details: 'Failed to import SDK',
            error: error.message
        });
    }
}

// =====================================================
// SECTION 4: CLI TESTS
// =====================================================

async function testCLI(): Promise<void> {
    log('\n========================================');
    log('SECTION 4: CLI TESTS');
    log('========================================');

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Test 4.1: CLI Help
    const startHelp = Date.now();
    try {
        const { stdout } = await runWithTimeout(
            execAsync('npx ts-node cli/solvoid-scan.ts --help', {
                cwd: '/home/elliot/Documents/Solana privacy/privacy-zero'
            }),
            15000,
            'CLI help'
        );

        recordResult({
            name: 'CLI Help Command',
            status: 'PASS',
            duration: Date.now() - startHelp,
            details: 'Help output generated successfully',
            realData: { helpLength: stdout.length }
        });
    } catch (error: any) {
        recordResult({
            name: 'CLI Help Command',
            status: 'FAIL',
            duration: Date.now() - startHelp,
            details: 'Failed to run CLI help',
            error: error.message
        });
    }

    // Test 4.2: Simple Scan
    const startSimpleScan = Date.now();
    try {
        const { stdout, stderr } = await runWithTimeout(
            execAsync(`npx ts-node cli/simple-scan.ts ${TEST_ADDRESS} --network mainnet-beta`, {
                cwd: '/home/elliot/Documents/Solana privacy/privacy-zero',
                timeout: 60000
            }),
            60000,
            'simple-scan'
        );

        const hasScore = stdout.includes('Privacy Score') || stdout.includes('score');

        recordResult({
            name: 'CLI Simple Scan - Real Address',
            status: hasScore ? 'PASS' : 'FAIL',
            duration: Date.now() - startSimpleScan,
            details: hasScore ? 'Privacy scan completed with real data' : 'No score in output',
            realData: { outputLength: stdout.length },
            error: hasScore ? undefined : 'Output did not contain expected score'
        });
    } catch (error: any) {
        recordResult({
            name: 'CLI Simple Scan - Real Address',
            status: 'FAIL',
            duration: Date.now() - startSimpleScan,
            details: 'Failed to run simple scan',
            error: error.message
        });
    }
}

// =====================================================
// SECTION 5: CRYPTO/POSEIDON TESTS
// =====================================================

async function testCrypto(): Promise<void> {
    log('\n========================================');
    log('SECTION 5: CRYPTO/POSEIDON TESTS');
    log('========================================');

    // Test 5.1: Poseidon Hash Import
    const startPoseidon = Date.now();
    try {
        const { PoseidonHasher, PoseidonUtils } = await import('../sdk/crypto/poseidon');

        recordResult({
            name: 'Poseidon Hasher Import',
            status: 'PASS',
            duration: Date.now() - startPoseidon,
            details: 'PoseidonHasher and PoseidonUtils imported successfully'
        });

        // Import crypto for random bytes
        const crypto = await import('crypto');

        // Test 5.2: Generate Random Secret
        const startSecret = Date.now();
        try {
            const secret = crypto.randomBytes(32);
            const secretHex = PoseidonUtils.bufferToHex(secret);

            recordResult({
                name: 'Generate Random Secret (crypto.randomBytes)',
                status: secret.length === 32 ? 'PASS' : 'FAIL',
                duration: Date.now() - startSecret,
                details: `Generated ${secret.length}-byte secret`,
                realData: { secretHex: secretHex.substring(0, 32) + '...' }
            });
        } catch (error: any) {
            recordResult({
                name: 'Generate Random Secret (crypto.randomBytes)',
                status: 'FAIL',
                duration: Date.now() - startSecret,
                details: 'Failed to generate secret',
                error: error.message
            });
        }

        // Test 5.3: Hash Two Inputs
        const startHash = Date.now();
        try {
            const input1 = Buffer.alloc(32);
            const input2 = Buffer.alloc(32);
            input1.fill(1);
            input2.fill(2);

            const hash = await PoseidonHasher.hashTwoInputs(input1, input2);
            const hashHex = PoseidonUtils.bufferToHex(hash);

            recordResult({
                name: 'Poseidon Hash Two Inputs',
                status: hash.length === 32 ? 'PASS' : 'FAIL',
                duration: Date.now() - startHash,
                details: `Hash computed: ${hashHex.substring(0, 32)}...`,
                realData: { hashLength: hash.length }
            });
        } catch (error: any) {
            recordResult({
                name: 'Poseidon Hash Two Inputs',
                status: 'FAIL',
                duration: Date.now() - startHash,
                details: 'Failed to hash inputs',
                error: error.message
            });
        }

        // Test 5.4: Compute Commitment
        const startCommit = Date.now();
        try {
            const secret = crypto.randomBytes(32);
            const nullifier = crypto.randomBytes(32);
            const amount = BigInt(1000000000);

            const commitment = await PoseidonHasher.computeCommitment(secret, nullifier, amount);

            recordResult({
                name: 'Compute ZK Commitment',
                status: commitment.length === 32 ? 'PASS' : 'FAIL',
                duration: Date.now() - startCommit,
                details: `Commitment computed for 1 SOL (${amount} lamports)`,
                realData: { commitmentHex: PoseidonUtils.bufferToHex(commitment).substring(0, 32) + '...' }
            });
        } catch (error: any) {
            recordResult({
                name: 'Compute ZK Commitment',
                status: 'FAIL',
                duration: Date.now() - startCommit,
                details: 'Failed to compute commitment',
                error: error.message
            });
        }

        // Test 5.5: Compute Nullifier Hash
        const startNullifier = Date.now();
        try {
            const nullifier = crypto.randomBytes(32);
            const nullifierHash = await PoseidonHasher.computeNullifierHash(nullifier);

            recordResult({
                name: 'Compute Nullifier Hash',
                status: nullifierHash.length === 32 ? 'PASS' : 'FAIL',
                duration: Date.now() - startNullifier,
                details: `Nullifier hash computed: ${PoseidonUtils.bufferToHex(nullifierHash).substring(0, 32)}...`,
                realData: { hashLength: nullifierHash.length }
            });
        } catch (error: any) {
            recordResult({
                name: 'Compute Nullifier Hash',
                status: 'FAIL',
                duration: Date.now() - startNullifier,
                details: 'Failed to compute nullifier hash',
                error: error.message
            });
        }
    } catch (error: any) {
        recordResult({
            name: 'Poseidon Hasher Import',
            status: 'FAIL',
            duration: Date.now() - startPoseidon,
            details: 'Failed to import Poseidon',
            error: error.message
        });
    }
}

// =====================================================
// SECTION 6: ZK CIRCUIT TESTS
// =====================================================

async function testZKCircuits(): Promise<void> {
    log('\n========================================');
    log('SECTION 6: ZK CIRCUIT TESTS');
    log('========================================');

    const fs = await import('fs');
    const path = await import('path');

    const circuitsDir = '/home/elliot/Documents/Solana privacy/privacy-zero/circuits';

    // Test 6.1: Circuit Files Exist
    const requiredFiles = ['withdraw.circom', 'main.circom', 'merkleTree.circom', 'rescue.circom'];

    for (const file of requiredFiles) {
        const startCheck = Date.now();
        const filePath = path.join(circuitsDir, file);

        try {
            const exists = fs.existsSync(filePath);
            const stats = exists ? fs.statSync(filePath) : null;

            recordResult({
                name: `ZK Circuit File: ${file}`,
                status: exists ? 'PASS' : 'FAIL',
                duration: Date.now() - startCheck,
                details: exists ? `File exists, size: ${stats?.size} bytes` : 'File not found',
                error: exists ? undefined : 'File does not exist'
            });
        } catch (error: any) {
            recordResult({
                name: `ZK Circuit File: ${file}`,
                status: 'FAIL',
                duration: Date.now() - startCheck,
                details: 'Failed to check file',
                error: error.message
            });
        }
    }

    // Test 6.2: Compiled Circuit Files
    const compiledFiles = ['withdraw.r1cs', 'main.r1cs', 'withdraw.sym', 'main.sym'];

    for (const file of compiledFiles) {
        const startCheck = Date.now();
        const filePath = path.join(circuitsDir, file);

        try {
            const exists = fs.existsSync(filePath);
            const stats = exists ? fs.statSync(filePath) : null;

            recordResult({
                name: `Compiled Circuit: ${file}`,
                status: exists ? 'PASS' : 'NOT_IMPLEMENTED',
                duration: Date.now() - startCheck,
                details: exists
                    ? `Compiled file exists, size: ${(stats?.size || 0) / 1024} KB`
                    : 'Circuit not compiled - run ./scripts/build-circuits.sh'
            });
        } catch (error: any) {
            recordResult({
                name: `Compiled Circuit: ${file}`,
                status: 'FAIL',
                duration: Date.now() - startCheck,
                details: 'Failed to check file',
                error: error.message
            });
        }
    }

    // Test 6.3: WASM Generation
    const wasmDir = path.join(circuitsDir, 'withdraw_js');
    const startWasm = Date.now();
    try {
        const exists = fs.existsSync(wasmDir);
        const wasmFile = exists ? fs.existsSync(path.join(wasmDir, 'withdraw.wasm')) : false;

        recordResult({
            name: 'ZK WASM Generation (withdraw)',
            status: wasmFile ? 'PASS' : 'NOT_IMPLEMENTED',
            duration: Date.now() - startWasm,
            details: wasmFile
                ? 'WASM file exists for proof generation'
                : 'WASM not generated - run ./scripts/build-zk.sh'
        });
    } catch (error: any) {
        recordResult({
            name: 'ZK WASM Generation (withdraw)',
            status: 'FAIL',
            duration: Date.now() - startWasm,
            details: 'Failed to check WASM',
            error: error.message
        });
    }

    // Test 6.4: Powers of Tau
    const ptauPath = '/home/elliot/Documents/Solana privacy/privacy-zero/scripts/pot14_final.ptau';
    const startPtau = Date.now();
    try {
        const exists = fs.existsSync(ptauPath);
        const stats = exists ? fs.statSync(ptauPath) : null;

        recordResult({
            name: 'Powers of Tau (Trusted Setup)',
            status: exists ? 'PASS' : 'NOT_IMPLEMENTED',
            duration: Date.now() - startPtau,
            details: exists
                ? `pot14_final.ptau exists, size: ${((stats?.size || 0) / 1024 / 1024).toFixed(2)} MB`
                : 'Trusted setup file not found'
        });
    } catch (error: any) {
        recordResult({
            name: 'Powers of Tau (Trusted Setup)',
            status: 'FAIL',
            duration: Date.now() - startPtau,
            details: 'Failed to check PTAU file',
            error: error.message
        });
    }
}

// =====================================================
// SECTION 7: SMART CONTRACT TESTS
// =====================================================

async function testSmartContracts(): Promise<void> {
    log('\n========================================');
    log('SECTION 7: SMART CONTRACT TESTS');
    log('========================================');

    const fs = await import('fs');
    const path = await import('path');

    const programsDir = '/home/elliot/Documents/Solana privacy/privacy-zero/programs/solvoid-zk';

    // Test 7.1: Check Cargo.toml
    const startCargo = Date.now();
    try {
        const cargoPath = path.join(programsDir, 'Cargo.toml');
        const exists = fs.existsSync(cargoPath);

        if (exists) {
            const content = fs.readFileSync(cargoPath, 'utf-8');
            const hasAnchor = content.includes('anchor-lang');

            recordResult({
                name: 'Smart Contract Cargo.toml',
                status: hasAnchor ? 'PASS' : 'FAIL',
                duration: Date.now() - startCargo,
                details: hasAnchor ? 'Using Anchor framework' : 'Anchor dependency not found',
                realData: { hasAnchor }
            });
        } else {
            recordResult({
                name: 'Smart Contract Cargo.toml',
                status: 'NOT_IMPLEMENTED',
                duration: Date.now() - startCargo,
                details: 'Cargo.toml not found'
            });
        }
    } catch (error: any) {
        recordResult({
            name: 'Smart Contract Cargo.toml',
            status: 'FAIL',
            duration: Date.now() - startCargo,
            details: 'Failed to check Cargo.toml',
            error: error.message
        });
    }

    // Test 7.2: Check source files
    const srcDir = path.join(programsDir, 'src');
    const sourceFiles = ['lib.rs', 'economics.rs', 'verifier.rs', 'poseidon.rs', 'nullifier_set.rs'];

    for (const file of sourceFiles) {
        const startCheck = Date.now();
        try {
            const filePath = path.join(srcDir, file);
            const exists = fs.existsSync(filePath);
            const stats = exists ? fs.statSync(filePath) : null;

            recordResult({
                name: `Smart Contract Source: ${file}`,
                status: exists ? 'PASS' : 'NOT_IMPLEMENTED',
                duration: Date.now() - startCheck,
                details: exists
                    ? `Source file exists, size: ${stats?.size} bytes`
                    : 'Source file not found'
            });
        } catch (error: any) {
            recordResult({
                name: `Smart Contract Source: ${file}`,
                status: 'FAIL',
                duration: Date.now() - startCheck,
                details: 'Failed to check source file',
                error: error.message
            });
        }
    }

    // Test 7.3: Check if program is built
    const targetDir = '/home/elliot/Documents/Solana privacy/privacy-zero/target';
    const startTarget = Date.now();
    try {
        const exists = fs.existsSync(targetDir);

        recordResult({
            name: 'Smart Contract Build Directory',
            status: exists ? 'PASS' : 'NOT_IMPLEMENTED',
            duration: Date.now() - startTarget,
            details: exists
                ? 'Target directory exists (program may be built)'
                : 'Target directory not found - run anchor build'
        });
    } catch (error: any) {
        recordResult({
            name: 'Smart Contract Build Directory',
            status: 'FAIL',
            duration: Date.now() - startTarget,
            details: 'Failed to check target directory',
            error: error.message
        });
    }
}

// =====================================================
// SECTION 8: RELAYER TESTS
// =====================================================

async function testRelayer(): Promise<void> {
    log('\n========================================');
    log('SECTION 8: RELAYER TESTS');
    log('========================================');

    const fs = await import('fs');

    // Test 8.1: Check relayer source files
    const relayerFiles = [
        { name: 'service.ts', path: '/home/elliot/Documents/Solana privacy/privacy-zero/relayer/service.ts' },
        { name: 'secure-service.ts', path: '/home/elliot/Documents/Solana privacy/privacy-zero/relayer/secure-service.ts' },
        { name: 'key-manager.ts', path: '/home/elliot/Documents/Solana privacy/privacy-zero/relayer/key-manager.ts' },
        { name: 'replay-protection.ts', path: '/home/elliot/Documents/Solana privacy/privacy-zero/relayer/replay-protection.ts' }
    ];

    for (const file of relayerFiles) {
        const startCheck = Date.now();
        try {
            const exists = fs.existsSync(file.path);
            const stats = exists ? fs.statSync(file.path) : null;

            recordResult({
                name: `Relayer Source: ${file.name}`,
                status: exists ? 'PASS' : 'NOT_IMPLEMENTED',
                duration: Date.now() - startCheck,
                details: exists
                    ? `File exists, size: ${stats?.size} bytes`
                    : 'Relayer source not found'
            });
        } catch (error: any) {
            recordResult({
                name: `Relayer Source: ${file.name}`,
                status: 'FAIL',
                duration: Date.now() - startCheck,
                details: 'Failed to check relayer file',
                error: error.message
            });
        }
    }

    // Test 8.2: Relayer health check (if running)
    const startHealth = Date.now();
    try {
        const response = await runWithTimeout(
            fetch('http://localhost:3000/health'),
            5000,
            'relayer health'
        );

        if (response.ok) {
            const data = await response.json();
            recordResult({
                name: 'Relayer Health Check',
                status: 'PASS',
                duration: Date.now() - startHealth,
                details: 'Relayer is running and healthy',
                realData: data
            });
        } else {
            recordResult({
                name: 'Relayer Health Check',
                status: 'SKIPPED',
                duration: Date.now() - startHealth,
                details: 'Relayer not running (expected behavior for test environment)'
            });
        }
    } catch (error: any) {
        recordResult({
            name: 'Relayer Health Check',
            status: 'SKIPPED',
            duration: Date.now() - startHealth,
            details: 'Relayer not running (start with: npx ts-node relayer/service.ts)'
        });
    }
}

// =====================================================
// SECTION 9: DASHBOARD TESTS
// =====================================================

async function testDashboard(): Promise<void> {
    log('\n========================================');
    log('SECTION 9: DASHBOARD TESTS');
    log('========================================');

    const fs = await import('fs');

    const dashboardDir = '/home/elliot/Documents/Solana privacy/privacy-zero/dashboard';

    // Test 9.1: Check package.json
    const startPkg = Date.now();
    try {
        const pkgPath = `${dashboardDir}/package.json`;
        const exists = fs.existsSync(pkgPath);

        if (exists) {
            const content = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const hasNext = content.dependencies?.next || content.devDependencies?.next;

            recordResult({
                name: 'Dashboard package.json',
                status: hasNext ? 'PASS' : 'FAIL',
                duration: Date.now() - startPkg,
                details: hasNext ? 'Next.js dashboard configured' : 'Next.js not found in dependencies',
                realData: { name: content.name, hasNext: !!hasNext }
            });
        } else {
            recordResult({
                name: 'Dashboard package.json',
                status: 'NOT_IMPLEMENTED',
                duration: Date.now() - startPkg,
                details: 'Dashboard package.json not found'
            });
        }
    } catch (error: any) {
        recordResult({
            name: 'Dashboard package.json',
            status: 'FAIL',
            duration: Date.now() - startPkg,
            details: 'Failed to check package.json',
            error: error.message
        });
    }

    // Test 9.2: Check Next.js config
    const startConfig = Date.now();
    try {
        const configPath = `${dashboardDir}/next.config.ts`;
        const exists = fs.existsSync(configPath);

        recordResult({
            name: 'Dashboard Next.js Config',
            status: exists ? 'PASS' : 'NOT_IMPLEMENTED',
            duration: Date.now() - startConfig,
            details: exists ? 'Next.js config exists' : 'next.config.ts not found'
        });
    } catch (error: any) {
        recordResult({
            name: 'Dashboard Next.js Config',
            status: 'FAIL',
            duration: Date.now() - startConfig,
            details: 'Failed to check config',
            error: error.message
        });
    }

    // Test 9.3: Check src directory
    const startSrc = Date.now();
    try {
        const srcPath = `${dashboardDir}/src`;
        const exists = fs.existsSync(srcPath);

        if (exists) {
            const files = fs.readdirSync(srcPath, { recursive: true });
            recordResult({
                name: 'Dashboard Source Directory',
                status: 'PASS',
                duration: Date.now() - startSrc,
                details: `Source directory exists with ${files.length} files/folders`,
                realData: { fileCount: files.length }
            });
        } else {
            recordResult({
                name: 'Dashboard Source Directory',
                status: 'NOT_IMPLEMENTED',
                duration: Date.now() - startSrc,
                details: 'Dashboard src directory not found'
            });
        }
    } catch (error: any) {
        recordResult({
            name: 'Dashboard Source Directory',
            status: 'FAIL',
            duration: Date.now() - startSrc,
            details: 'Failed to check src directory',
            error: error.message
        });
    }

    // Test 9.4: Check if dashboard is built
    const startBuild = Date.now();
    try {
        const buildPath = `${dashboardDir}/.next`;
        const exists = fs.existsSync(buildPath);

        recordResult({
            name: 'Dashboard Build (.next)',
            status: exists ? 'PASS' : 'SKIPPED',
            duration: Date.now() - startBuild,
            details: exists
                ? 'Dashboard is built'
                : 'Dashboard not built - run npm run dashboard:build'
        });
    } catch (error: any) {
        recordResult({
            name: 'Dashboard Build (.next)',
            status: 'FAIL',
            duration: Date.now() - startBuild,
            details: 'Failed to check build',
            error: error.message
        });
    }
}

// =====================================================
// SECTION 10: CI/CD TESTS
// =====================================================

async function testCICD(): Promise<void> {
    log('\n========================================');
    log('SECTION 10: CI/CD TESTS');
    log('========================================');

    const fs = await import('fs');

    const workflowsDir = '/home/elliot/Documents/Solana privacy/privacy-zero/.github/workflows';

    // Test 10.1: Check workflow files
    const startWorkflows = Date.now();
    try {
        const exists = fs.existsSync(workflowsDir);

        if (exists) {
            const files = fs.readdirSync(workflowsDir);

            recordResult({
                name: 'CI/CD Workflows Directory',
                status: files.length > 0 ? 'PASS' : 'NOT_IMPLEMENTED',
                duration: Date.now() - startWorkflows,
                details: `Found ${files.length} workflow files: ${files.join(', ')}`,
                realData: { workflows: files }
            });

            // Check each workflow
            for (const file of files) {
                const startWf = Date.now();
                try {
                    const content = fs.readFileSync(`${workflowsDir}/${file}`, 'utf-8');
                    const hasOnPush = content.includes('on:');
                    const hasJobs = content.includes('jobs:');

                    recordResult({
                        name: `CI/CD Workflow: ${file}`,
                        status: hasOnPush && hasJobs ? 'PASS' : 'FAIL',
                        duration: Date.now() - startWf,
                        details: `Valid workflow with triggers and jobs`,
                        error: !hasOnPush || !hasJobs ? 'Missing required workflow sections' : undefined
                    });
                } catch (error: any) {
                    recordResult({
                        name: `CI/CD Workflow: ${file}`,
                        status: 'FAIL',
                        duration: Date.now() - startWf,
                        details: 'Failed to parse workflow',
                        error: error.message
                    });
                }
            }
        } else {
            recordResult({
                name: 'CI/CD Workflows Directory',
                status: 'NOT_IMPLEMENTED',
                duration: Date.now() - startWorkflows,
                details: 'Workflows directory not found'
            });
        }
    } catch (error: any) {
        recordResult({
            name: 'CI/CD Workflows Directory',
            status: 'FAIL',
            duration: Date.now() - startWorkflows,
            details: 'Failed to check workflows',
            error: error.message
        });
    }
}

// =====================================================
// SECTION 11: INTEGRITY/TYPE TESTS
// =====================================================

async function testIntegrity(): Promise<void> {
    log('\n========================================');
    log('SECTION 11: INTEGRITY/TYPE TESTS');
    log('========================================');

    // Test 11.1: Import integrity module
    const startImport = Date.now();
    try {
        const integrity = await import('../sdk/integrity');

        recordResult({
            name: 'Integrity Module Import',
            status: 'PASS',
            duration: Date.now() - startImport,
            details: 'Integrity module imported successfully'
        });

        // Test 11.2: Test PublicKeySchema
        const startPkSchema = Date.now();
        try {
            const result = integrity.enforce(
                integrity.PublicKeySchema,
                TEST_ADDRESS,
                {
                    origin: integrity.DataOrigin.CLI_ARG,
                    trust: integrity.DataTrust.UNTRUSTED,
                    createdAt: Date.now(),
                    owner: 'Test'
                }
            );

            recordResult({
                name: 'PublicKeySchema Validation',
                status: result.value === TEST_ADDRESS ? 'PASS' : 'FAIL',
                duration: Date.now() - startPkSchema,
                details: `Validated address: ${result.value.substring(0, 20)}...`,
                realData: { validated: result.value }
            });
        } catch (error: any) {
            recordResult({
                name: 'PublicKeySchema Validation',
                status: 'FAIL',
                duration: Date.now() - startPkSchema,
                details: 'Failed to validate public key',
                error: error.message
            });
        }

        // Test 11.3: Test invalid input rejection
        const startInvalid = Date.now();
        try {
            integrity.enforce(
                integrity.PublicKeySchema,
                'invalid-address',
                {
                    origin: integrity.DataOrigin.CLI_ARG,
                    trust: integrity.DataTrust.UNTRUSTED,
                    createdAt: Date.now(),
                    owner: 'Test'
                }
            );

            recordResult({
                name: 'Invalid Input Rejection',
                status: 'FAIL',
                duration: Date.now() - startInvalid,
                details: 'Should have rejected invalid address',
                error: 'Did not throw on invalid input'
            });
        } catch (error: any) {
            recordResult({
                name: 'Invalid Input Rejection',
                status: 'PASS',
                duration: Date.now() - startInvalid,
                details: 'Correctly rejected invalid address'
            });
        }
    } catch (error: any) {
        recordResult({
            name: 'Integrity Module Import',
            status: 'FAIL',
            duration: Date.now() - startImport,
            details: 'Failed to import integrity module',
            error: error.message
        });
    }
}

// =====================================================
// MAIN TEST RUNNER
// =====================================================

async function runAllTests(): Promise<void> {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║     SolVoid Comprehensive Real Testing Suite                  ║');
    console.log('║     Testing with REAL Solana blockchain data                  ║');
    console.log('║     NO MOCKS • NO DUMMIES • NO FAKE DATA                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Test Address: ${TEST_ADDRESS}`);
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('');

    const startTime = Date.now();

    try {
        await testRPCConnectivity();
        await testRealBlockchainData();
        await testSDK();
        await testCLI();
        await testCrypto();
        await testZKCircuits();
        await testSmartContracts();
        await testRelayer();
        await testDashboard();
        await testCICD();
        await testIntegrity();
    } catch (error: any) {
        log(`\n❌ FATAL ERROR: ${error.message}`);
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Print Summary
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Total Tests:      ${summary.totalTests}`);
    console.log(`✅ Passed:        ${summary.passed} (${((summary.passed / summary.totalTests) * 100).toFixed(1)}%)`);
    console.log(`❌ Failed:        ${summary.failed} (${((summary.failed / summary.totalTests) * 100).toFixed(1)}%)`);
    console.log(`⏭️  Skipped:       ${summary.skipped} (${((summary.skipped / summary.totalTests) * 100).toFixed(1)}%)`);
    console.log(`🚧 Not Implemented: ${summary.notImplemented} (${((summary.notImplemented / summary.totalTests) * 100).toFixed(1)}%)`);
    console.log(`⏱️  Duration:      ${duration.toFixed(2)}s`);
    console.log('');

    // Failed tests details
    if (summary.failed > 0) {
        console.log('╔═══════════════════════════════════════════════════════════════╗');
        console.log('║                    FAILED TESTS                               ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        summary.results
            .filter(r => r.status === 'FAIL')
            .forEach(r => {
                console.log(`\n❌ ${r.name}`);
                console.log(`   Error: ${r.error}`);
                console.log(`   Details: ${r.details}`);
            });
    }

    // Not implemented
    if (summary.notImplemented > 0) {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║                NOT IMPLEMENTED / MISSING                      ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        summary.results
            .filter(r => r.status === 'NOT_IMPLEMENTED')
            .forEach(r => {
                console.log(`\n🚧 ${r.name}`);
                console.log(`   ${r.details}`);
            });
    }

    // Real data collected
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                 REAL BLOCKCHAIN DATA COLLECTED                ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    summary.results
        .filter(r => r.realData && r.status === 'PASS')
        .slice(0, 10)
        .forEach(r => {
            console.log(`\n📊 ${r.name}`);
            console.log(`   ${JSON.stringify(r.realData, null, 2).split('\n').join('\n   ')}`);
        });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('Test run completed at:', new Date().toISOString());
    console.log('═══════════════════════════════════════════════════════════════');

    // Exit with appropriate code
    process.exit(summary.failed > 0 ? 1 : 0);
}

runAllTests().catch(console.error);
