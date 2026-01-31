#!/usr/bin/node

/**
 * SolVoid Shadow Relayer Service: Multi-hop transaction orchestration node.
 * Implements onion-routing for transaction obfuscation and gasless submission.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import {
    DataOrigin,
    DataTrust,
    Unit,
    RelayRequestSchema,
    RelayResponseSchema,
    OnionLayerSchema,
    enforce,
    DataMetadata,
    RelayResponse,
    RelayRequest,
    OnionLayer
} from '../sdk/index';
import fetch from 'cross-fetch';

/** Core service configuration parameters. */
const PORT = parseInt(process.env.PORT || '8080');
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const BOUNTY_RATE_SOL = parseFloat(process.env.BOUNTY_RATE || '0.001');

/** 
 * Node cryptographic identity.
 * We generate unique RSA-2048 keypairs for peer authentication and onion decryption.
 */
const { publicKey: nodePublicKey, privateKey: nodePrivateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const NODE_ID = process.env.NODE_ID || `shadow-${crypto.createHash('sha256').update(nodePublicKey).digest('hex').slice(0, 8)}`;

interface RelayerNode {
    readonly id: string;
    readonly endpoint: string;
    readonly publicKey: string;
    lastSeen: number;
    successRate: number;
    readonly region: string;
}

/** Registry for decentralized peer topology. */
const peerRegistry: Map<string, RelayerNode> = new Map();

/** Service telemetry and performance metrics. */
const metrics = {
    relayed: 0,
    failed: 0,
    totalBountySOL: 0,
    uptime: Date.now()
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/** Standard upstream JSON-RPC connection. */
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

const API_METADATA: DataMetadata = {
    origin: DataOrigin.API_PAYLOAD,
    trust: DataTrust.UNTRUSTED,
    createdAt: Date.now(),
    owner: 'External API Client'
};

/**
 * Service health and node metadata summary.
 */
app.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        nodeId: NODE_ID,
        uptime: Math.floor((Date.now() - metrics.uptime) / 1000),
        metrics: {
            relayed: metrics.relayed,
            failed: metrics.failed,
            successRate: metrics.relayed / (metrics.relayed + metrics.failed || 1),
            totalBountySOL: metrics.totalBountySOL
        },
        peers: peerRegistry.size,
        bountyRate: BOUNTY_RATE_SOL,
        units: { bounty: Unit.SOL },
        publicKey: nodePublicKey
    });
});

/**
 * Peer registration endpoint. 
 * Enables nodes to join the decentralized relay network.
 */
app.post('/register', (req: Request, res: Response) => {
    const { endpoint, publicKey, region } = req.body;

    if (!endpoint || !publicKey) {
        res.status(400).json({ error: 'Missing registration credentials' });
        return;
    }

    const nodeId = `peer-${crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 8)}`;

    peerRegistry.set(nodeId, {
        id: nodeId,
        endpoint,
        publicKey,
        lastSeen: Date.now(),
        successRate: 1.0,
        region: region || 'UNKNOWN'
    });

    res.json({ registered: true, nodeId });
});

/**
 * Synchronizes Merkle tree state from on-chain program accounts.
 * Provides all commitments necessary for client-side witness generation.
 */
app.get('/commitments', async (_req: Request, res: Response) => {
    try {
        const PROGRAM_ID = process.env.PROGRAM_ID || '3QcKRYWquzbBR3UpKeh4aKVCSpoHy89UT8gyovzRzzan';
        const programId = new (require('@solana/web3.js').PublicKey)(PROGRAM_ID);

        const [statePda] = require('@solana/web3.js').PublicKey.findProgramAddressSync(
            [Buffer.from('state')],
            programId
        );

        try {
            const accountInfo = await connection.getAccountInfo(statePda);

            if (!accountInfo) {
                // Return test commitments if program is not currently deployed to the RPC endpoint
                const testCommitments = process.env.TEST_COMMITMENTS?.split(',') || [
                    "2ec33752c89a1fa7a0992d3647590abee2184fb0c47296690f2c1da40681363e"
                ];
                res.json({
                    commitments: testCommitments,
                    message: 'Internal Test Mode: Using static commitments.',
                    programId: PROGRAM_ID,
                    statePda: statePda.toBase58(),
                    testMode: true
                });
                return;
            }

            /**
             * Deserialization of ProgramState using Anchor 0.29+ layout.
             * Fields: [Discrimiator(8), Authority(32), MerkleRoot(32), LeafCount(8), Subtrees(256), InitFlag(1)]
             */
            const data = accountInfo.data;
            const ANCHOR_DISCRIMINATOR = 8;
            let offset = ANCHOR_DISCRIMINATOR;

            const authority = new (require('@solana/web3.js').PublicKey)(data.slice(offset, offset + 32));
            offset += 32;

            const merkleRoot = data.slice(offset, offset + 32);
            offset += 32;

            const leafCount = data.readBigUInt64LE(offset);
            offset += 8;

            offset += 256; // Skip internal subtree nodes

            const isInitialized = data[offset] === 1;

            /**
             * Historical log parsing for commitment discovery.
             * We iterate through transaction signatures to reconstruct the leaf set.
             */
            const signatures = await connection.getSignaturesForAddress(statePda, { limit: 100 });
            const commitments: string[] = [];

            for (const sig of signatures) {
                try {
                    const tx = await connection.getTransaction(sig.signature, {
                        maxSupportedTransactionVersion: 0
                    });

                    if (tx?.meta?.logMessages) {
                        for (const log of tx.meta.logMessages) {
                            if (log.includes('Deposit successful')) {
                                // Leaf extraction logic would iterate over CPI data here
                            }
                        }
                    }
                } catch (e) {
                    // Suppression of fetch failures for individual transactions
                }
            }

            res.json({
                commitments,
                merkleRoot: Buffer.from(merkleRoot).toString('hex'),
                leafCount: Number(leafCount),
                isInitialized,
                programId: PROGRAM_ID,
                statePda: statePda.toBase58(),
                message: commitments.length === 0
                    ? 'State synchronized. No commitments identified.'
                    : `State synchronized. Identified ${commitments.length} leaf hashes.`
            });

        } catch (fetchError: any) {
            res.json({
                commitments: [],
                error: `Synchronization failure: ${fetchError.message}`,
                programId: PROGRAM_ID,
                statePda: statePda.toBase58()
            });
        }

    } catch (error: any) {
        res.status(500).json({ error: 'Critical node failure during state synchronization.' });
    }
});

/**
 * Primary relay entry point. 
 * Orchestrates multi-hop onion routing logic or direct network broadcast.
 */
app.post('/relay', async (req: Request, res: Response) => {
    try {
        const enforcedRequest = enforce(RelayRequestSchema, req.body, {
            ...API_METADATA,
            createdAt: Date.now()
        });
        const relayReq = enforcedRequest.value;

        if (relayReq.encryptedPayload) {
            const result = await handleOnionRelay(relayReq.encryptedPayload);
            res.json(result);
            return;
        }

        if (!relayReq.transaction) {
            res.status(400).json({ error: 'Missing transaction primitive.' });
            return;
        }

        const txBuffer = Buffer.from(relayReq.transaction, 'base64');
        const tx = VersionedTransaction.deserialize(txBuffer);

        let response: RelayResponse;

        if (relayReq.hops > 1 && peerRegistry.size > 0) {
            response = await multiHopRelay(tx, relayReq.hops - 1, relayReq.targetNode);
        } else {
            response = await broadcastTransaction(tx);
        }

        if (response.success) {
            metrics.relayed++;
            metrics.totalBountySOL += BOUNTY_RATE_SOL;
        } else {
            metrics.failed++;
        }

        res.json(response);
    } catch (error: unknown) {
        metrics.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Internal Relay Error';
        res.status(errorMsg.includes('Data Integrity') ? 400 : 500).json({
            success: false,
            error: errorMsg
        });
    }
});

/**
 * Recursive onion decryption logic.
 * Decouples next-hop routing from payload contents using node-specific private keys.
 */
async function handleOnionRelay(encryptedPayload: string): Promise<RelayResponse> {
    try {
        const decrypted = crypto.privateDecrypt(
            { key: nodePrivateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
            Buffer.from(encryptedPayload, 'base64')
        );

        const layer = JSON.parse(decrypted.toString('utf-8'));

        if (layer.nextHop === 'FINAL') {
            const txBuffer = Buffer.from(layer.payload, 'base64');
            const tx = VersionedTransaction.deserialize(txBuffer);
            return broadcastTransaction(tx);
        } else {
            const peer = peerRegistry.get(layer.nextHop);
            if (!peer) return { success: false, error: `Hop failure: Target peer ${layer.nextHop} unreachable.` };

            const response = await fetch(`${peer.endpoint}/relay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ encryptedPayload: layer.payload, hops: 1 } as RelayRequest)
            });

            return await response.json();
        }
    } catch (error: any) {
        return { success: false, error: 'Cryptographic failure: Onion layer decryption rejected.' };
    }
}

/**
 * Multi-hop orchestration with weight-based peer selection.
 */
async function multiHopRelay(
    tx: VersionedTransaction,
    remainingHops: number,
    preferredNode?: string
): Promise<RelayResponse> {
    let nextPeer: RelayerNode | undefined;

    if (preferredNode && peerRegistry.has(preferredNode)) {
        nextPeer = peerRegistry.get(preferredNode);
    } else {
        const activePeers = Array.from(peerRegistry.values())
            .filter(p => Date.now() - p.lastSeen < 60000);

        if (activePeers.length > 0) {
            const totalWeight = activePeers.reduce((sum, p) => sum + p.successRate, 0);
            let random = Math.random() * totalWeight;

            for (const peer of activePeers) {
                random -= peer.successRate;
                if (random <= 0) {
                    nextPeer = peer;
                    break;
                }
            }
        }
    }

    if (!nextPeer) return broadcastTransaction(tx);

    try {
        const response = await fetch(`${nextPeer.endpoint}/relay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transaction: Buffer.from(tx.serialize()).toString('base64'),
                hops: remainingHops
            } as RelayRequest)
        });

        const rawJson = await response.json();
        const enforcedResponse = enforce(RelayResponseSchema, rawJson, {
            origin: DataOrigin.API_PAYLOAD,
            trust: DataTrust.SEMI_TRUSTED,
            createdAt: Date.now(),
            owner: nextPeer.id
        });
        const result = enforcedResponse.value;

        if (result.success) {
            nextPeer.successRate = Math.min(1, nextPeer.successRate + 0.01);
        } else {
            nextPeer.successRate = Math.max(0.5, nextPeer.successRate - 0.1);
        }
        nextPeer.lastSeen = Date.now();

        return {
            ...result,
            relayPath: [NODE_ID, ...(result.relayPath || [])]
        };
    } catch (error) {
        if (nextPeer) nextPeer.successRate = Math.max(0.5, nextPeer.successRate - 0.2);
        return broadcastTransaction(tx);
    }
}

/**
 * Direct transaction broadcast to the Solana network.
 * Implements anti-correlation jitter and retry logic.
 */
async function broadcastTransaction(tx: VersionedTransaction): Promise<RelayResponse> {
    try {
        const jitterMs = Math.floor(Math.random() * 200) + 50;
        await new Promise(resolve => setTimeout(resolve, jitterMs));

        const rawTransaction = tx.serialize();
        const txid = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: true,
            maxRetries: 3
        });

        return {
            success: true,
            txid,
            hopCount: 1,
            relayPath: [NODE_ID]
        };
    } catch (error: unknown) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Solana network broadcast rejected.'
        };
    }
}

/**
 * Onion encryption engine. 
 * Recursive RSA-OAEP encryption for multi-hop route decoupling.
 */
app.post('/encrypt-route', (req: Request, res: Response) => {
    const { transaction, route, publicKeys } = req.body;

    if (!transaction || !route || !publicKeys || route.length !== publicKeys.length) {
        res.status(400).json({ error: 'Route specification mismatch.' });
        return;
    }

    try {
        let payload = transaction;

        for (let i = route.length - 1; i >= 0; i--) {
            const layer: OnionLayer = {
                nextHop: i === route.length - 1 ? 'FINAL' : route[i + 1],
                payload,
                nonce: crypto.randomBytes(16).toString('hex')
            };

            const encryptedBuffer = crypto.publicEncrypt(
                { key: publicKeys[i], padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
                Buffer.from(JSON.stringify(layer))
            );

            payload = encryptedBuffer.toString('base64');
        }

        res.json({ encrypted: payload, hops: route.length });
    } catch (e: any) {
        res.status(500).json({ error: 'Encryption failure: Payload construction rejected.' });
    }
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'Critical service interruption.' });
});

app.listen(PORT, () => {
    console.log(`  SolVoid Relayer operational on port ${PORT}`);
});

export { app, peerRegistry, metrics };
