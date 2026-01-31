import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { Buffer } from 'buffer';
import { PrivacyShield } from './privacy/shield';
import { PrivacyPipeline } from './pipeline';
import { PassportManager } from './passport/manager';
import { EventBus } from './events/bus';
import { PoseidonHasher, PoseidonUtils } from './crypto/poseidon';
import {
    DataOrigin,
    DataTrust,
    Unit,
    IdlSchema,
    enforce,
    PublicKeySchema
} from './integrity';
import { ScanResult } from './pipeline';

/**
 * Interface definition for protocol configuration parameters.
 */
export interface SolVoidConfig {
    readonly rpcUrl: string;
    readonly programId: string;
    readonly relayerUrl?: string;
}

/**
 * Standard wallet adapter interface required for transaction orchestration.
 */
export interface WalletAdapter {
    readonly publicKey: PublicKey | null;
    readonly signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
    readonly signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
}

/**
 * SolVoidClient: Main orchestration layer for protocol interactions.
 * Implements browser-compatible ZK primitives and state management.
 */
export class SolVoidClient {
    private readonly pipeline: PrivacyPipeline;
    private readonly passport: PassportManager;
    private readonly connection: Connection;
    private readonly protocolShield: PrivacyShield;

    constructor(config: SolVoidConfig, wallet: WalletAdapter) {
        this.connection = new Connection(config.rpcUrl, 'confirmed');
        this.passport = new PassportManager();

        /**
         * Schema-enforced IDL definition. 
         * We maintain a minimal IDL structure for cross-version Anchor compatibility.
         * Discriminators are sha256("global:<instruction_name>").slice(0, 8)
         */
        const idlUnvalidated = {
            version: "0.1.0",
            name: "solvoid_zk",
            instructions: [
                { name: "trigger_emergency_mode", discriminator: [126, 216, 208, 35, 143, 119, 70, 133], accounts: [{ name: "state", isMut: true, isSigner: false }, { name: "economic_state", isMut: true, isSigner: false }, { name: "authority", isMut: false, isSigner: true }], args: [{ name: "multiplier", type: "u64" }, { name: "reason", type: "string" }] },
                { name: "disable_emergency_mode", discriminator: [43, 167, 224, 195, 40, 132, 68, 80], accounts: [{ name: "state", isMut: true, isSigner: false }, { name: "economic_state", isMut: true, isSigner: false }, { name: "authority", isMut: false, isSigner: true }], args: [] },
                { name: "trigger_circuit_breaker", discriminator: [18, 87, 214, 42, 239, 136, 160, 81], accounts: [{ name: "state", isMut: true, isSigner: false }, { name: "economic_state", isMut: true, isSigner: false }, { name: "authority", isMut: false, isSigner: true }], args: [] },
                { name: "reset_circuit_breaker", discriminator: [225, 48, 84, 136, 90, 146, 26, 149], accounts: [{ name: "state", isMut: true, isSigner: false }, { name: "economic_state", isMut: true, isSigner: false }, { name: "authority", isMut: false, isSigner: true }], args: [] }
            ],
            accounts: [],
            types: [],
            errors: [],
            metadata: {
                address: config.programId
            }
        };

        const enforcedIdl = enforce(IdlSchema, idlUnvalidated, {
            origin: DataOrigin.INTERNAL_LOGIC,
            trust: DataTrust.TRUSTED,
            createdAt: Date.now(),
            owner: 'System'
        });

        // Initialize core privacy operations with enforced configuration
        this.protocolShield = new PrivacyShield(this.connection, enforcedIdl.value, wallet, config.programId);
        this.pipeline = new PrivacyPipeline(this.connection, this.protocolShield);
    }

    /**
     * Executes a comprehensive privacy audit for a specified Solana address.
     * Analyzes transaction history to identify potential anonymity leaks.
     */
    public async protect(address: PublicKey): Promise<ScanResult[]> {
        enforce(PublicKeySchema, address.toBase58(), {
            origin: DataOrigin.INTERNAL_LOGIC,
            trust: DataTrust.TRUSTED,
            createdAt: Date.now(),
            owner: 'Client'
        });

        const results = await this.pipeline.processAddress(address);

        if (results.length > 0) {
            const avgScore = results.reduce((acc, r) => acc + r.privacyScore, 0) / results.length;
            this.passport.updateScore(address.toBase58(), Math.round(avgScore));
        }

        return results;
    }

    /**
     * Retrieves the Privacy Passport for a specified address.
     * Passport data includes aggregated scores and earned reputation badges.
     */
    public async getPassport(address: string) {
        enforce(PublicKeySchema, address, {
            origin: DataOrigin.UI_INPUT,
            trust: DataTrust.UNTRUSTED,
            createdAt: Date.now(),
            owner: 'User'
        });
        return this.passport.getPassport(address);
    }

    /**
     * Initiates a security audit to identify remediable privacy vulnerabilities.
     * Evaluates leak surface area and provides potential score improvement metrics.
     */
    public async rescue(address: PublicKey) {
        EventBus.info('Initiating rescue analysis...', { address: address.toBase58() });

        const results = await this.protect(address);
        const allLeaks = results.flatMap((r) => r.leaks);

        if (allLeaks.length === 0) {
            return { status: 'secure', message: 'No detectable privacy leaks identified.' };
        }

        EventBus.info(`Identified ${allLeaks.length} distinct privacy leaks requiring remediation.`);

        const avgScore = results.length > 0
            ? Math.round(results.reduce((acc, r) => acc + r.privacyScore, 0) / results.length)
            : 100;

        return {
            status: 'analysis_complete' as const,
            leakCount: allLeaks.length,
            currentScore: avgScore,
            potentialScore: Math.min(95, avgScore + 40),
            message: 'Analysis complete. Transaction remediation should be routed through our relay nodes.'
        };
    }

    /**
     * Generates a Poseidon commitment for a shielded deposit.
     * Amount must be supplied in atomic units (Lamports).
     */
    public async shield(amountLamports: number) {
        if (!Number.isInteger(amountLamports) || amountLamports <= 0) {
            throw new Error(`Execution failed: Amount must be a positive integer in Lamports.`);
        }

        EventBus.info(`Generating Poseidon commitment for ${amountLamports} atomic units...`);
        const commitmentData = await this.protocolShield.generateCommitment(amountLamports);

        EventBus.emit('COMMITMENT_CREATED', 'Shielding commitment generated', {
            commitment: commitmentData.commitmentHex
        });

        return {
            status: 'commitment_ready' as const,
            commitmentData,
            message: 'Commitment successfully calculated and schema-validated.',
            units: Unit.LAMPORT
        };
    }

    /**
     * Prepares the cryptographic witness for a ZK withdrawal.
     * Executes snarkjs prover logic to generate a Groth16 proof against the current Merkle root.
     */
    public async prepareWithdrawal(
        secretHex: string,
        nullifierHex: string,
        amount: bigint,
        recipient: PublicKey,
        allCommitmentsHex: string[],
        wasmPath: string,
        zkeyPath: string
    ) {
        EventBus.info('Initializing Groth16 witness generation...');

        if (!/^[0-9a-fA-F]{64}$/.test(secretHex)) throw new Error("Format error: Secret must be 32-byte hex");
        if (!/^[0-9a-fA-F]{64}$/.test(nullifierHex)) throw new Error("Format error: Nullifier must be 32-byte hex");

        const secret = Buffer.from(secretHex, 'hex');
        const nullifier = Buffer.from(nullifierHex, 'hex');

        /**
         * Commitment reconstruction: Poseidon(secret, nullifier, amount).
         * Must match identical arity in withdrawal circuit.
         */
        const commitment = await PoseidonHasher.computeCommitment(secret, nullifier, amount);
        const commitmentHex = PoseidonUtils.bufferToHex(commitment);

        const index = allCommitmentsHex.indexOf(commitmentHex);
        if (index === -1) {
            EventBus.error('Commitment verification failed: Hash mismatch or state synchronization error.');
            throw new Error(`State error: Supplied commitment data does not exist in the current tree.`);
        }

        EventBus.info('Calculating membership witness (Merkle Proof)...');
        const merklePath = await this.protocolShield.getMerkleProof(index, allCommitmentsHex);

        /**
         * Reconstructs the Merkle Root from siblings.
         * Enforces strict leaf-to-root traversal with Poseidon hashing.
         */
        const calculateMerkleRoot = async (commitmentIndex: number, allCommitments: string[], merklePath: any): Promise<string> => {
            let currentHash = PoseidonUtils.hexToBuffer(allCommitments[commitmentIndex]);

            for (let i = 0; i < merklePath.proof.length; i++) {
                const sibling = PoseidonUtils.hexToBuffer(merklePath.proof[i]);
                if (merklePath.indices[i] === 0) {
                    const leftCopy = Buffer.alloc(32);
                    const rightCopy = Buffer.alloc(32);
                    currentHash.copy(leftCopy);
                    sibling.copy(rightCopy);
                    currentHash = await PoseidonHasher.hashTwoInputs(leftCopy, rightCopy);
                } else {
                    const leftCopy = Buffer.alloc(32);
                    const rightCopy = Buffer.alloc(32);
                    sibling.copy(leftCopy);
                    currentHash.copy(rightCopy);
                    currentHash = await PoseidonHasher.hashTwoInputs(leftCopy, rightCopy);
                }
            }

            return PoseidonUtils.bufferToHex(currentHash);
        };

        const rootHex = await calculateMerkleRoot(index, allCommitmentsHex, merklePath);

        const fees = BigInt(0); // Standard relay fee (configurable)

        const { proof, publicSignals } = await this.protocolShield.generateZKProof(
            secretHex,
            nullifierHex,
            rootHex,
            Number(amount),
            recipient,
            PublicKey.default,
            Number(fees),
            merklePath,
            wasmPath,
            zkeyPath
        );

        const nullifierHash = PoseidonUtils.bufferToHex(await PoseidonHasher.computeNullifierHash(nullifier));

        return {
            proof,
            publicSignals,
            nullifierHash,
            root: rootHex
        };
    }

    /**
     * Triggers protocol-wide emergency fee multiplier.
     * Requirement: Administrative authority authorization.
     */
    public async triggerEmergencyMode(multiplier: bigint, reason: string): Promise<string> {
        const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], this.protocolShield.getProgramId());
        const [economicStatePda] = PublicKey.findProgramAddressSync([Buffer.from('economic_state')], this.protocolShield.getProgramId());

        return await (this.protocolShield as any).program.methods
            .triggerEmergencyMode(new BN(multiplier.toString()), reason)
            .accounts({
                state: statePda,
                economicState: economicStatePda,
                authority: (this.protocolShield as any).program.provider.publicKey,
            })
            .rpc();
    }

    /**
     * Deactivates emergency mode and resets protocol fees.
     */
    public async disableEmergencyMode(): Promise<string> {
        const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], this.protocolShield.getProgramId());
        const [economicStatePda] = PublicKey.findProgramAddressSync([Buffer.from('economic_state')], this.protocolShield.getProgramId());

        return await (this.protocolShield as any).program.methods
            .disableEmergencyMode()
            .accounts({
                state: statePda,
                economicState: economicStatePda,
                authority: (this.protocolShield as any).program.provider.publicKey,
            })
            .rpc();
    }

    /**
     * Pauses all withdrawals via the protocol Circuit Breaker.
     */
    public async triggerCircuitBreaker(): Promise<string> {
        const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], this.protocolShield.getProgramId());
        const [economicStatePda] = PublicKey.findProgramAddressSync([Buffer.from('economic_state')], this.protocolShield.getProgramId());

        return await (this.protocolShield as any).program.methods
            .triggerCircuitBreaker()
            .accounts({
                state: statePda,
                economicState: economicStatePda,
                authority: (this.protocolShield as any).program.provider.publicKey,
            })
            .rpc();
    }

    /**
     * Resets the Circuit Breaker and resumes protocol operations.
     */
    public async resetCircuitBreaker(): Promise<string> {
        const [statePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], this.protocolShield.getProgramId());
        const [economicStatePda] = PublicKey.findProgramAddressSync([Buffer.from('economic_state')], this.protocolShield.getProgramId());

        return await (this.protocolShield as any).program.methods
            .resetCircuitBreaker()
            .accounts({
                state: statePda,
                economicState: economicStatePda,
                authority: (this.protocolShield as any).program.provider.publicKey,
            })
            .rpc();
    }
}
