import {
    Connection,
    PublicKey,
    SystemProgram,
} from '@solana/web3.js';
import { Buffer } from 'buffer';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import * as crypto from 'crypto';
import { PoseidonHasher, PoseidonUtils } from '../crypto/poseidon';
import { WalletAdapter } from '../client';
import { z } from 'zod';
import {
    IdlSchema,
    enforce,
    DataOrigin,
    DataTrust,
    CommitmentDataSchema,
    MerkleProofSchema
} from '../integrity';

/**
 * Merkle tree depth for our sparse implementation.
 * Must remain synchronized with the PROOF_LEVELS parameter in our Circom circuits.
 */
const MERKLE_TREE_DEPTH = 20;

export type CommitmentData = z.infer<typeof CommitmentDataSchema>;
export type MerkleProof = z.infer<typeof MerkleProofSchema>;

/**
 * PrivacyShield: Core implementation for ZK operations and program interaction.
 * Manages commitment generation, Merkle proof calculation, and ZK proof orchestration.
 */
export class PrivacyShield {
    private readonly program: Program<any>;
    private programId?: PublicKey;

    constructor(connection: Connection, idlIn: unknown, wallet: WalletAdapter, programId?: string) {
        /**
         * Enforces strict IDL schema validation to ensure protocol interface stability.
         */
        const idl = enforce(IdlSchema, idlIn, {
            origin: DataOrigin.INTERNAL_LOGIC,
            trust: DataTrust.TRUSTED,
            createdAt: Date.now(),
            owner: 'PrivacyShield'
        }).value as any;

        if (programId && !idl.address) {
            idl.address = programId;
        }

        /**
         * Environment-agnostic Buffer polyfills for web/desktop compatibility.
         */
        if (typeof globalThis !== 'undefined' && !globalThis.Buffer) {
            globalThis.Buffer = Buffer;
        }
        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).window !== 'undefined') {
            const win = (globalThis as any).window;
            if (!win.Buffer) {
                win.Buffer = Buffer;
            }
        }
        if (typeof global !== 'undefined' && !global.Buffer) {
            global.Buffer = Buffer;
        }

        const provider = new AnchorProvider(connection, wallet as any, {
            preflightCommitment: 'confirmed',
        });

        this.program = new Program(idl, provider);

        if (programId) {
            this.programId = new PublicKey(programId);
        }
    }

    public getProgramId(): PublicKey {
        return this.programId || this.program.programId;
    }

    /**
     * Internal Poseidon hash helper for binary node computation.
     */
    private async poseidonHash(left: Buffer, right: Buffer): Promise<Buffer> {
        return await PoseidonHasher.hashTwoInputs(left, right);
    }

    /**
     * Initializes the protocol state PDA. 
     * Requirement: Executed once per program lifetime.
     */
    public async initialize(authority: PublicKey): Promise<string> {
        const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], this.getProgramId());

        return await (this.program.methods as any)
            .initialize(authority)
            .accounts({
                state: statePda,
                authority: this.program.provider.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
    }

    /**
     * Registers the Groth16 verification key on-chain.
     */
    public async initializeVerifier(vk: any): Promise<string> {
        const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], this.getProgramId());
        const [verifierPda] = PublicKey.findProgramAddressSync([Buffer.from('verifier'), statePda.toBuffer()], this.getProgramId());

        return await (this.program.methods as any)
            .initializeVerifier(vk)
            .accounts({
                verifierState: verifierPda,
                state: statePda,
                authority: this.program.provider.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
    }

    /**
     * Sets up the Merkle root history tracker for proof verification.
     */
    public async initializeRootHistory(): Promise<string> {
        const [rootHistoryPda] = PublicKey.findProgramAddressSync([Buffer.from('root_history')], this.getProgramId());

        return await (this.program.methods as any)
            .initializeRootHistory()
            .accounts({
                rootHistory: rootHistoryPda,
                authority: this.program.provider.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
    }

    /**
     * Configures the protocol's economic parameters and fee accumulators.
     */
    public async initializeEconomics(): Promise<string> {
        const [economicPda] = PublicKey.findProgramAddressSync([Buffer.from('economic_state')], this.getProgramId());

        return await (this.program.methods as any)
            .initializeEconomics()
            .accounts({
                economicState: economicPda,
                authority: this.program.provider.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
    }

    /**
     * Activates emergency status to adjust protocol multipliers during high-threat events.
     */
    public async triggerEmergencyMode(multiplier: bigint, reason: string): Promise<string> {
        const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], this.getProgramId());
        const [economicPda] = PublicKey.findProgramAddressSync([Buffer.from('economic_state')], this.getProgramId());

        return await (this.program.methods as any)
            .triggerEmergencyMode(new BN(multiplier.toString()), reason)
            .accounts({
                state: statePda,
                economicState: economicPda,
                authority: this.program.provider.publicKey,
            })
            .rpc();
    }

    public async disableEmergencyMode(): Promise<string> {
        const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], this.getProgramId());
        const [economicPda] = PublicKey.findProgramAddressSync([Buffer.from('economic_state')], this.getProgramId());

        return await (this.program.methods as any)
            .disableEmergencyMode()
            .accounts({
                state: statePda,
                economicState: economicPda,
                authority: this.program.provider.publicKey,
            })
            .rpc();
    }

    /**
     * Triggers the protocol-wide circuit breaker, halting withdrawal processing.
     */
    public async triggerCircuitBreaker(): Promise<string> {
        const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], this.getProgramId());
        const [economicPda] = PublicKey.findProgramAddressSync([Buffer.from('economic_state')], this.getProgramId());

        return await (this.program.methods as any)
            .triggerCircuitBreaker()
            .accounts({
                state: statePda,
                economicState: economicPda,
                authority: this.program.provider.publicKey,
            })
            .rpc();
    }

    public async resetCircuitBreaker(): Promise<string> {
        const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], this.getProgramId());
        const [economicPda] = PublicKey.findProgramAddressSync([Buffer.from('economic_state')], this.getProgramId());

        return await (this.program.methods as any)
            .resetCircuitBreaker()
            .accounts({
                state: statePda,
                economicState: economicPda,
                authority: this.program.provider.publicKey,
            })
            .rpc();
    }

    /**
     * Generates a new commitment for an unlinked deposit.
     * Uses cryptographically secure random bytes for secret and nullifier keys.
     */
    public async generateCommitment(amount: number = 0): Promise<CommitmentData> {
        const secret = crypto.randomBytes(32);
        const nullifier = crypto.randomBytes(32);

        // Compute Poseidon(secret, nullifier, amount)
        const commitment = await PoseidonHasher.computeCommitment(secret, nullifier, BigInt(amount));

        // Compute Poseidon(nullifier, 1n) for nullifier hash
        const nullifierHash = await PoseidonHasher.computeNullifierHash(nullifier);

        const dataUnvalidated = {
            secret: secret.toString('hex'),
            nullifier: nullifier.toString('hex'),
            commitment: commitment.toString('hex'),
            nullifierHash: nullifierHash.toString('hex'),
            commitmentHex: commitment.toString('hex'),
        };

        return enforce(CommitmentDataSchema, dataUnvalidated, {
            origin: DataOrigin.INTERNAL_LOGIC,
            trust: DataTrust.TRUSTED,
            createdAt: Date.now(),
            owner: 'PrivacyShield'
        }).value;
    }

    /**
     * Executes the on-chain deposit. 
     * Requirements: Commitment must be calculated via generateCommitment API.
     */
    public async deposit(commitmentHex: string, amount: number): Promise<string> {
        if (!/^[0-9a-fA-F]{64}$/.test(commitmentHex)) throw new Error("Format error: Commitment must be 32-byte hex");
        const commitment = Buffer.from(commitmentHex, 'hex');

        const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], this.getProgramId());
        const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault')], this.getProgramId());
        const [rootHistoryPda] = PublicKey.findProgramAddressSync([Buffer.from('root_history')], this.getProgramId());

        return await (this.program.methods as any)
            .deposit(Array.from(commitment), new BN(amount))
            .accounts({
                state: statePda,
                rootHistory: rootHistoryPda,
                depositor: this.program.provider.publicKey,
                vault: vaultPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
    }

    /**
     * Calculates the Merkle witness (Path and indices) for a specified commitment.
     * Supports sparse tree construction using pre-calculated zero-hashes.
     */
    public async getMerkleProof(commitmentIndex: number, allCommitmentsHex: readonly string[]): Promise<MerkleProof> {
        if (commitmentIndex < 0 || commitmentIndex >= allCommitmentsHex.length) {
            throw new Error(`Range error: Index ${commitmentIndex} is out of bounds.`);
        }

        const allCommitments = allCommitmentsHex.map(c => PoseidonUtils.hexToBuffer(c));

        /**
         * Pre-calculate zero-hashes for sparse tree paths.
         */
        const zeros: Buffer[] = [];
        let currentZero = PoseidonUtils.zeroBuffer();
        for (let i = 0; i < MERKLE_TREE_DEPTH; i++) {
            const zeroCopy = Buffer.alloc(32);
            currentZero.copy(zeroCopy);
            zeros.push(zeroCopy);
            currentZero = await this.poseidonHash(currentZero, currentZero);
        }

        const proof: Buffer[] = [];
        const indices: number[] = [];
        let index = commitmentIndex;

        let nodes = [...allCommitments];

        for (let level = 0; level < MERKLE_TREE_DEPTH; level++) {
            if (nodes.length === 0) {
                proof.push(zeros[level]!);
                indices.push(0);
                continue;
            }

            if (index % 2 === 0) {
                const sibling = (index + 1 < nodes.length) ? (nodes[index + 1] ?? zeros[level]!) : zeros[level]!;
                const siblingCopy = Buffer.alloc(32);
                sibling.copy(siblingCopy);
                proof.push(siblingCopy);
                indices.push(0);
            } else {
                const leftSibling = nodes[index - 1] ?? zeros[level]!;
                const leftCopy = Buffer.alloc(32);
                leftSibling.copy(leftCopy);
                proof.push(leftCopy);
                indices.push(1);
            }

            const nextLevelNodes: Buffer[] = [];
            for (let i = 0; i < nodes.length; i += 2) {
                const left = nodes[i]!;
                const right = (i + 1 < nodes.length) ? (nodes[i + 1] ?? zeros[level]!) : zeros[level]!;

                const parent = await this.poseidonHash(left, right);
                nextLevelNodes.push(parent);
            }
            nodes = nextLevelNodes as any[];
            index = Math.floor(index / 2);
        }

        while (proof.length < MERKLE_TREE_DEPTH) {
            proof.push(zeros[proof.length]!);
            indices.push(0);
        }

        const proofData = {
            proof: proof.map(p => PoseidonUtils.bufferToHex(p)),
            indices
        };

        return enforce(MerkleProofSchema, proofData, {
            origin: DataOrigin.INTERNAL_LOGIC,
            trust: DataTrust.TRUSTED,
            createdAt: Date.now(),
            owner: 'PrivacyShield'
        }).value;
    }

    /**
     * High-level wrapper for Groth16 proof generation.
     * Decomposes public inputs and executes snarkjs prover.
     */
    public async generateZKProof(
        secretHex: string,
        nullifierHex: string,
        rootHex: string,
        amount: number,
        recipient: PublicKey,
        relayer: PublicKey,
        fee: number,
        merklePath: MerkleProof,
        wasmPath: string,
        zkeyPath: string
    ): Promise<{ proof: any, publicSignals: any }> {
        const snarkjs = require('snarkjs');

        if (process.env.SKIP_ZK_PROOFS === 'true') {
            return {
                proof: { pi_a: ["0", "0", "0"], pi_b: [["0", "0"], ["0", "0"], ["0", "0"]], pi_c: ["0", "0", "0"] },
                publicSignals: []
            };
        }

        const rootBigInt = BigInt('0x' + rootHex);
        const nullifierHashBuffer = await PoseidonHasher.computeNullifierHash(Buffer.from(nullifierHex, 'hex'));
        const nullifierHashBigInt = BigInt('0x' + nullifierHashBuffer.toString('hex'));
        const secretBigInt = BigInt('0x' + secretHex);
        const nullifierBigInt = BigInt('0x' + nullifierHex);

        /**
         * Slice 32-byte public keys into 16-byte dual elements for circuit field compatibility.
         */
        const recipientBytes = recipient.toBuffer();
        const relayerBytes = relayer.toBuffer();

        const recipientLow = BigInt('0x' + recipientBytes.slice(16, 32).toString('hex'));
        const recipientHigh = BigInt('0x' + recipientBytes.slice(0, 16).toString('hex'));
        const relayerLow = BigInt('0x' + relayerBytes.slice(16, 32).toString('hex'));
        const relayerHigh = BigInt('0x' + relayerBytes.slice(0, 16).toString('hex'));

        const pathElementsBigInt = merklePath.proof.map(p => BigInt('0x' + p).toString());

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            {
                root: rootBigInt.toString(),
                nullifierHash: nullifierHashBigInt.toString(),
                recipient_low: recipientLow.toString(),
                recipient_high: recipientHigh.toString(),
                relayer_low: relayerLow.toString(),
                relayer_high: relayerHigh.toString(),
                fee: fee.toString(),
                amount: amount.toString(),
                secret: secretBigInt.toString(),
                nullifier: nullifierBigInt.toString(),
                pathElements: pathElementsBigInt,
                pathIndices: merklePath.indices
            },
            wasmPath,
            zkeyPath
        );

        /**
         * G1/G2 point serialization to SolVoid ProofData format.
         * Ensures byte-alignment with on-chain verifier expectations.
         */
        const proofAG1 = Buffer.from(BigInt(proof.pi_a[0]).toString(16).padStart(64, '0'), 'hex');

        const proofBG2 = Buffer.concat([
            Buffer.from(BigInt(proof.pi_b[0][1]).toString(16).padStart(64, '0'), 'hex'),
            Buffer.from(BigInt(proof.pi_b[0][0]).toString(16).padStart(64, '0'), 'hex')
        ]);

        const proofCG1 = Buffer.from(BigInt(proof.pi_c[0]).toString(16).padStart(64, '0'), 'hex');

        return {
            proof: {
                proofAG1: Array.from(proofAG1),
                proofBG2: Array.from(proofBG2),
                proofCG1: Array.from(proofCG1),
            },
            publicSignals
        };
    }

    /**
     * Submits a ZK withdrawal transaction to our on-chain verifier.
     * Validates proof against current root and suppresses double-spending via nullifier PDA.
     */
    public async withdraw(
        proof: any,
        rootHex: string,
        nullifierHashHex: string,
        recipient: PublicKey,
        relayer: PublicKey,
        feeLamports: number,
        amountLamports: number
    ): Promise<string> {
        const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], this.getProgramId());
        const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault')], this.getProgramId());
        const [rootHistoryPda] = PublicKey.findProgramAddressSync([Buffer.from('root_history')], this.getProgramId());
        const [treasuryPda] = PublicKey.findProgramAddressSync([Buffer.from('treasury')], this.getProgramId());
        const [economicPda] = PublicKey.findProgramAddressSync([Buffer.from('economic_state')], this.getProgramId());
        const [verifierPda] = PublicKey.findProgramAddressSync([Buffer.from('verifier'), statePda.toBuffer()], this.getProgramId());

        const [nullifierPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('nullifier'), Buffer.from(nullifierHashHex, 'hex')],
            this.getProgramId()
        );

        return await (this.program.methods as any)
            .withdraw(
                proof,
                Array.from(Buffer.from(rootHex, 'hex')),
                Array.from(Buffer.from(nullifierHashHex, 'hex')),
                recipient,
                relayer,
                new BN(feeLamports),
                new BN(amountLamports)
            )
            .accounts({
                state: statePda,
                vault: vaultPda,
                recipient,
                relayer,
                protocolFeeAccumulator: treasuryPda,
                verifierState: verifierPda,
                rootHistory: rootHistoryPda,
                nullifierAccount: nullifierPda,
                economicState: economicPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
    }
}
