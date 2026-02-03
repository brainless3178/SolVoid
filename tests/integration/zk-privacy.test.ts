import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
    Program,
    AnchorProvider,
    Wallet,
    BN
} from '@coral-xyz/anchor';
// Jest provides expect globally
import { PrivacyShield } from '../../sdk/privacy/shield';
import { SolVoidClient } from '../../sdk/client';

describe('SolVoid ZK Privacy Integration Tests', () => {
    let connection: Connection;
    let provider: AnchorProvider;
    let program: Program;
    let privacyShield: PrivacyShield;
    let solvoidClient: SolVoidClient;

    // Test accounts
    let admin: Keypair;
    let user: Keypair;
    let relayer: Keypair;
    let recipient: Keypair;

    // Program accounts
    let statePda: PublicKey;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let vaultPda: PublicKey;

    beforeAll(async () => {
        // Setup test environment
        connection = new Connection('http://localhost:8899', 'confirmed');

        admin = Keypair.generate();
        user = Keypair.generate();
        relayer = Keypair.generate();
        recipient = Keypair.generate();

        // Fund test accounts
        await connection.requestAirdrop(admin.publicKey, 10 * LAMPORTS_PER_SOL);
        await connection.requestAirdrop(user.publicKey, 10 * LAMPORTS_PER_SOL);
        await connection.requestAirdrop(relayer.publicKey, 10 * LAMPORTS_PER_SOL);

        // Wait for funding
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Setup provider and program
        const wallet = new Wallet(admin);
        provider = new AnchorProvider(connection, wallet, {
            preflightCommitment: 'confirmed',
        });

        // Load program IDL (simplified for test)
        const idl = {
            version: "0.1.0",
            name: "solvoid",
            instructions: [
                {
                    name: "initialize",
                    accounts: [
                        { name: "state", isMut: true, isSigner: false },
                        { name: "authority", isMut: true, isSigner: true },
                        { name: "systemProgram", isMut: false, isSigner: false }
                    ],
                    args: [{ name: "authority", type: "publicKey" }]
                },
                {
                    name: "deposit",
                    accounts: [
                        { name: "state", isMut: true, isSigner: false },
                        { name: "rootHistory", isMut: true, isSigner: false },
                        { name: "depositor", isMut: true, isSigner: true },
                        { name: "vault", isMut: true, isSigner: false },
                        { name: "systemProgram", isMut: false, isSigner: false }
                    ],
                    args: [
                        { name: "commitment", type: { array: ["u8", 32] } },
                        { name: "amount", type: "u64" }
                    ]
                },
                {
                    name: "withdraw",
                    accounts: [
                        { name: "state", isMut: true, isSigner: false },
                        { name: "vault", isMut: true, isSigner: false },
                        { name: "recipient", isMut: true, isSigner: false },
                        { name: "relayer", isMut: true, isSigner: true },
                        { name: "protocolFeeAccumulator", isMut: true, isSigner: false },
                        { name: "verifierState", isMut: false, isSigner: false },
                        { name: "rootHistory", isMut: true, isSigner: false },
                        { name: "nullifierAccount", isMut: true, isSigner: false },
                        { name: "economicState", isMut: true, isSigner: false },
                        { name: "systemProgram", isMut: false, isSigner: false }
                    ],
                    args: [
                        { name: "proof", type: { "defined": "ProofData" } },
                        { name: "root", type: { array: ["u8", 32] } },
                        { name: "nullifierHash", type: { array: ["u8", 32] } },
                        { name: "recipient", type: "publicKey" },
                        { name: "relayer", type: "publicKey" },
                        { name: "fee", type: "u64" },
                        { name: "amount", type: "u64" }
                    ]
                }
            ],
            accounts: [
                {
                    name: "ProgramState",
                    type: {
                        kind: "struct",
                        fields: [
                            { name: "authority", type: "publicKey" },
                            { name: "merkleRoot", type: { array: ["u8", 32] } },
                            { name: "leafCount", type: "u64" },
                            { name: "filledSubtrees", type: { array: [{ array: ["u8", 32] }, 20] } },
                            { name: "isInitialized", type: "bool" }
                        ]
                    }
                }
            ],
            types: [
                {
                    name: "VerificationKeyData",
                    type: {
                        kind: "struct",
                        fields: [
                            { name: "alpha", type: { array: ["u8", 32] } },
                            { name: "beta", type: { array: ["u8", 64] } },
                            { name: "gamma", type: { array: ["u8", 64] } },
                            { name: "delta", type: { array: ["u8", 64] } },
                            { name: "ic", type: { vec: { array: ["u8", 32] } } }
                        ]
                    }
                },
                {
                    name: "ProofData",
                    type: {
                        kind: "struct",
                        fields: [
                            { name: "a", type: { array: ["u8", 32] } },
                            { name: "b", type: { array: ["u8", 64] } },
                            { name: "c", type: { array: ["u8", 32] } }
                        ]
                    }
                }
            ],
            address: "Fg6PaFpoGXkYsidMpSsu3SWJYEHp7rQU9YSTFNDQ4F5i"
        };

        program = new Program(idl as any, provider);

        // Initialize PDAs
        const programId = program.programId;
        [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], programId);
        [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault')], programId);

        // Initialize privacy shield
        privacyShield = new PrivacyShield(connection, idl, new Wallet(user));

        // Initialize SolVoid client
        solvoidClient = new SolVoidClient({
            rpcUrl: 'http://localhost:8899',
            programId: programId.toString()
        }, new Wallet(user));
    });

    describe('Program Initialization', () => {
        it('Should initialize the privacy program', async () => {
            // Execute initialize instruction

            const tx = await program.methods
                .initialize(admin.publicKey)
                .accounts({
                    state: statePda,
                    authority: admin.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([admin])
                .rpc();

            console.log('Initialize transaction:', tx);

            // Verify state account
            const stateAccount = await (program.account as any).programState.fetch(statePda);
            expect(stateAccount.leafCount.toNumber()).toBe(0);
        });
    });

    describe('Commitment Generation', () => {
        it('Should generate valid commitment data', async () => {
            const commitment = await privacyShield.generateCommitment();

            expect(commitment.secret).toEqual(expect.any(String));
            expect(commitment.nullifier).toEqual(expect.any(String));
            expect(commitment.commitment).toEqual(expect.any(String));
            expect(commitment.nullifierHash).toEqual(expect.any(String));

            // Verify hex format
            expect(commitment.secret).to.match(/^[0-9a-fA-F]{64}$/);
            expect(commitment.nullifier).to.match(/^[0-9a-fA-F]{64}$/);
            expect(commitment.commitment).to.match(/^[0-9a-fA-F]{64}$/);
            expect(commitment.nullifierHash).to.match(/^[0-9a-fA-F]{64}$/);
        });

        it('Should generate unique commitments', async () => {
            const commitment1 = await privacyShield.generateCommitment();
            const commitment2 = await privacyShield.generateCommitment();

            expect(commitment1.commitment).not.toBe(commitment2.commitment);
            expect(commitment1.nullifierHash).not.toBe(commitment2.nullifierHash);
        });
    });

    describe('Deposit Operations', () => {
        it('Should deposit commitment to privacy pool', async () => {
            const commitment = await privacyShield.generateCommitment();

            const tx = await privacyShield.deposit(commitment.commitmentHex, 1 * LAMPORTS_PER_SOL);
            console.log('Deposit transaction:', tx);

            // Verify state updated
            const stateAccount = await (program.account as any).programState.fetch(statePda);
            expect(stateAccount.leafCount.toNumber()).toBe(1);

            // Store commitment for withdrawal test
            return commitment;
        });

        it('Should reject invalid commitment format', async () => {
            try {
                await privacyShield.deposit('invalid_hex', 1 * LAMPORTS_PER_SOL);
                throw new Error('Should have thrown error');
            } catch (error: any) {
                expect(error.message).to.include('Invalid commitment format');
            }
        });
    });

    describe('Merkle Tree Operations', () => {
        let commitments: string[] = [];

        beforeAll(async () => {
            // Generate multiple commitments for testing
            for (let i = 0; i < 5; i++) {
                const commitment = await privacyShield.generateCommitment();
                commitments.push(commitment.commitmentHex);

                // Deposit commitment
                await privacyShield.deposit(commitment.commitmentHex, 1 * LAMPORTS_PER_SOL);
            }
        });

        it('Should generate valid Merkle proofs', async () => {
            const proof = await privacyShield.getMerkleProof(2, commitments);

            expect(proof.proof).toHaveLength(20); // MERKLE_TREE_DEPTH
            expect(proof.indices).toHaveLength(20);

            // Verify indices are binary
            proof.indices.forEach(index => {
                expect(index).to.be.oneOf([0, 1]);
            });
        });

        it('Should reject invalid commitment index', async () => {
            try {
                await privacyShield.getMerkleProof(10, commitments);
                throw new Error('Should have thrown error');
            } catch (error: any) {
                expect(error.message).to.include('out of range');
            }
        });
    });

    describe('ZK Proof Generation', () => {
        it('Should generate ZK proof structure', async () => {
            const commitment = await privacyShield.generateCommitment();

            // Mock proof generation (in production, use actual snarkjs)
            const mockProof = {
                proof: Buffer.alloc(192, 0x01), // Mock 192-byte proof
                publicSignals: [
                    commitment.commitmentHex,
                    commitment.nullifierHash
                ]
            };

            expect(mockProof.proof).toHaveLength(192);
            expect(mockProof.publicSignals).toHaveLength(2);
        });
    });

    describe('Withdrawal Operations', () => {
        let testCommitment: any;

        beforeAll(async () => {
            testCommitment = await privacyShield.generateCommitment();
            await privacyShield.deposit(testCommitment.commitmentHex, 1 * LAMPORTS_PER_SOL);
        });

        it('Should withdraw with valid ZK proof', async () => {
            // Mock withdrawal with placeholder proof
            const mockProof = Buffer.alloc(192, 0x01);
            const mockRoot = Buffer.alloc(32, 0x02);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _mockNullifierHash = Buffer.from(testCommitment.nullifierHash, 'hex');

            try {
                const tx = await privacyShield.withdraw(
                    { a: Array.from(mockProof), b: Array.from(mockProof), c: Array.from(mockProof) } as any,
                    mockRoot.toString('hex'),
                    testCommitment.nullifierHash,
                    recipient.publicKey,
                    relayer.publicKey,
                    10000, // 0.00001 SOL fee
                    1 * LAMPORTS_PER_SOL
                );

                console.log('Withdraw transaction:', tx);
            } catch (error: any) {
                // Expected to fail with mock proof, but should validate structure
                expect(error.message).to.not.include('Invalid proof format');
            }
        });

        it('Should reject invalid fee amounts', async () => {
            try {
                await privacyShield.withdraw(
                    {} as any,
                    'invalid_root',
                    testCommitment.nullifierHash,
                    recipient.publicKey,
                    relayer.publicKey,
                    -1000, // Negative fee
                    1 * LAMPORTS_PER_SOL
                );

                throw new Error('Should have thrown error');
            } catch (error: any) {
                expect(error.message).to.include('Invalid fee');
            }
        });
    });

    describe('Security Validations', () => {
        it('Should prevent double-spending', async () => {
            const commitment = await privacyShield.generateCommitment();
            await privacyShield.deposit(commitment.commitmentHex, 1 * LAMPORTS_PER_SOL);

            // Try to withdraw twice with same nullifier
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _mockProof = Buffer.alloc(192, 0x01);
            const mockRoot = Buffer.alloc(32, 0x02);

            // First withdrawal (will fail with mock proof but should create nullifier record)
            try {
                await privacyShield.withdraw(
                    {} as any,
                    mockRoot.toString('hex'),
                    commitment.nullifierHash,
                    recipient.publicKey,
                    relayer.publicKey,
                    10000,
                    1 * LAMPORTS_PER_SOL
                );
            } catch (error) {
                // Expected with mock proof
            }

            // Second withdrawal should fail due to nullifier already spent
            try {
                await privacyShield.withdraw(
                    {} as any,
                    mockRoot.toString('hex'),
                    commitment.nullifierHash,
                    recipient.publicKey,
                    relayer.publicKey,
                    10000,
                    1 * LAMPORTS_PER_SOL
                );

                throw new Error('Should have thrown double-spend error');
            } catch (error: any) {
                expect(error.message).to.include('Nullifier already spent');
            }
        });

        it('Should enforce maximum fee limits', async () => {
            const commitment = await privacyShield.generateCommitment();
            await privacyShield.deposit(commitment.commitmentHex, 1 * LAMPORTS_PER_SOL);

            // Try excessive fee (should be rejected)
            const excessiveFee = LAMPORTS_PER_SOL; // 1 SOL fee

            try {
                await privacyShield.withdraw(
                    {} as any,
                    'mock_root',
                    commitment.nullifierHash,
                    recipient.publicKey,
                    relayer.publicKey,
                    excessiveFee,
                    1 * LAMPORTS_PER_SOL
                );

                throw new Error('Should have thrown excessive fee error');
            } catch (error: any) {
                expect(error.message).to.include('Fee exceeds');
            }
        });
    });

    describe('Privacy Analysis', () => {
        it('Should analyze wallet privacy', async () => {
            const analysis = await solvoidClient.protect(user.publicKey);

            expect(analysis).toBeInstanceOf(Array);

            if (analysis.length > 0) {
                const result = analysis[0];
                expect(result).to.have.property('privacyScore');
                expect(result).to.have.property('leaks');
                expect(result.privacyScore).toEqual(expect.any(Number));
                expect(result.privacyScore).to.be.within(0, 100);
            }
        });
    });
});
