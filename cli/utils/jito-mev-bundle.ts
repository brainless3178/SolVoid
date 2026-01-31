import { Connection, PublicKey, Transaction, Keypair, SystemProgram } from '@solana/web3.js';
import fetch from 'cross-fetch';

export class JitoMEVBundle {
    private endpoints = {
        mainnet: 'https://mainnet.block-engine.jito.wtf',
        amsterdam: 'https://amsterdam.block-engine.jito.wtf',
        frankfurt: 'https://frankfurt.block-engine.jito.wtf',
        ny: 'https://ny.block-engine.jito.wtf',
        tokyo: 'https://tokyo.block-engine.jito.wtf'
    };

    private currentEndpoint: string;
    private bundleTip: number = 100000; // 0.0001 SOL

    constructor() {
        this.currentEndpoint = this.endpoints.mainnet;
    }

    async executeRescueBundle(transactions: Transaction[], keypair: Keypair) {
        const encodedTransactions = transactions.map(tx => tx.serialize().toString('base64'));

        const payload = {
            jsonrpc: '2.0',
            id: 1,
            method: 'sendBundle',
            params: [encodedTransactions]
        };

        const response = await fetch(`${this.currentEndpoint}/api/v1/bundles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.error) throw new Error(result.error.message);
        return result.result;
    }
}
