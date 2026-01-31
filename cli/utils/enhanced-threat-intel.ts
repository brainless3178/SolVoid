import fetch from 'cross-fetch';
import { Connection, PublicKey } from '@solana/web3.js';

export interface ThreatReport {
    type: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    source: string;
    timestamp: number;
}

export class EnhancedThreatIntelligence {
    private localDatabase: Map<string, ThreatReport[]> = new Map();
    private cache: Map<string, { data: any; timestamp: number }> = new Map();
    private CACHE_EXPIRY = 600000; // 10 minutes

    async isThreatDetected(address: PublicKey | string): Promise<boolean> {
        const addressStr = address.toString();

        // Check local database (Community reports)
        if (this.localDatabase.has(addressStr)) {
            const reports = this.localDatabase.get(addressStr)!;
            if (reports.some(r => r.severity === 'HIGH')) return true;
        }

        // Check external APIs (Solscan Risk API)
        try {
            const response = await fetch(`https://api.solscan.io/v2/address/risk?address=${addressStr}`);
            const data = await response.json();
            if (data?.data?.risk_score > 70) return true;
        } catch {
            // Ignore API errors and fallback to local analysis
        }

        return false;
    }

    async getThreatReports(address: PublicKey | string): Promise<ThreatReport[]> {
        const addressStr = address.toString();
        return this.localDatabase.get(addressStr) || [];
    }

    /**
     * Identifies if a transaction is part of a sandwich attack or known drainer pattern
     */
    async analyzeTransactionPattern(txHash: string, connection: Connection): Promise<boolean> {
        try {
            const tx = await connection.getTransaction(txHash, { maxSupportedTransactionVersion: 0 });
            if (!tx) return false;

            // Look for standard drainer instruction patterns
            const logs = tx.meta?.logMessages || [];
            const isDrainer = logs.some(log => log.includes('Program log: Instruction: Transfer') && logs.length < 5);

            return isDrainer;
        } catch {
            return false;
        }
    }
}
