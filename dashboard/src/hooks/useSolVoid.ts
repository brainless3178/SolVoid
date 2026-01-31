"use client";

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SolVoidClient, WalletAdapter } from '../../../sdk/client';
import { PrivacyPassport } from '../../../sdk/passport/manager';
import { ScanResult } from '../../../sdk/pipeline';
import {
    enforce,
    DataOrigin,
    DataTrust,
    PublicKeySchema,
    ProtocolStats
} from '../../../sdk/integrity';
import { formatError } from '../utils/formatError';
import { useNetworkDetection, Network } from './useNetworkDetection';

const DEFAULT_PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID || "Fg6PaFpoGXkYsidMpSsu3SWJYEHp7rQU9YSTFNDQ4F5i";

export const useSolVoid = (overrideProgramId?: string) => {
    const { connection } = useConnection();
    const wallet = useWallet();
    const { publicKey, connected } = wallet;
    const { network, isDetecting } = useNetworkDetection();

    const [passport, setPassport] = useState<PrivacyPassport | null>(null);
    const [leaks, setLeaks] = useState<readonly ScanResult[]>([]);
    const [stats, setStats] = useState<ProtocolStats | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [rpcError, setRpcError] = useState<boolean>(false);

    const programId = overrideProgramId || DEFAULT_PROGRAM_ID;

    const fetchStats = useCallback(async () => {
        try {
            const response = await fetch('/api/solvoid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'getStats',
                    params: { network }
                })
            });

            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch protocol stats:', err);
        }
    }, [network]);

    const scanAddress = useCallback(async (targetAddress: string) => {
        if (!targetAddress) return;

        // Boundary Enforcement: UI -> Logic (Rule 10)
        try {
            enforce(PublicKeySchema, targetAddress, {
                origin: DataOrigin.UI_INPUT,
                trust: DataTrust.UNTRUSTED,
                createdAt: Date.now(),
                owner: 'ScanBar'
            });
        } catch (e: any) {
            setError(`Invalid address: ${e.message}`);
            return;
        }

        setLoading(true);
        setError(null);
        setRpcError(false);
        setLeaks([]);

        try {
            console.log("Scanning address:", targetAddress);
            const response = await fetch('/api/solvoid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'scan',
                    params: {
                        publicKey: publicKey?.toBase58(),
                        targetAddress,
                        network
                    }
                })
            });

            console.log("Scan API response status:", response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Scan API error:", errorText);
                throw new Error(`API Error: ${response.status} - ${errorText}`);
            }

            const scanData = await response.json();
            console.log("Scan data received:", scanData);

            const { results, passport } = scanData;
            setLeaks(results);

            if (passport) {
                setPassport(passport);
            }

            // Refresh stats after scan
            fetchStats();

        } catch (err: unknown) {
            console.error("Forensic scan failed:", err);
            const errorMsg = err instanceof Error ? err.message : 'Unknown forensic error';

            if (errorMsg.includes('403') || errorMsg.includes('Access forbidden') || errorMsg.includes('rate limit')) {
                setRpcError(true);
                setError("RPC_LIMIT_REACHED: Use private relay.");
            } else {
                setError(errorMsg);
            }
        } finally {
            setLoading(false);
        }
    }, [publicKey, network, fetchStats]);

    const executeRescue = useCallback(async (settings?: any) => {
        if (!publicKey) return;
        setLoading(true);
        setError(null);

        try {
            console.log("Executing rescue for:", publicKey.toBase58(), "with settings:", settings);
            const response = await fetch('/api/solvoid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'rescue',
                    params: {
                        targetAddress: publicKey.toBase58(),
                        network,
                        settings: settings || {
                            rentRecovery: true,
                            sweepAll: true,
                            emergencyMode: false,
                            useCompression: true
                        }
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Rescue API Error: ${response.status} - ${errorText}`);
            }

            const rescueData = await response.json();
            console.log("Rescue data received:", rescueData);

            if (rescueData.transaction) {
                console.log("Signing rescue transaction...");
                const txBuffer = Buffer.from(rescueData.transaction, 'base64');
                const transaction = Transaction.from(txBuffer);

                // Request wallet to sign
                const signedTx = await wallet.signTransaction!(transaction);

                // Send signed transaction
                const txid = await connection.sendRawTransaction(signedTx.serialize());
                console.log("Rescue transaction sent:", txid);

                // Wait for confirmation
                await connection.confirmTransaction(txid, 'confirmed');
                rescueData.txid = txid;
            }

            // Refresh scan data after rescue to show updated state
            await scanAddress(publicKey.toBase58());
            return rescueData;

        } catch (err: unknown) {
            console.error("Rescue operation failed:", err);
            setError(err instanceof Error ? err.message : 'Rescue failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [publicKey, network, scanAddress]);

    const shield = useCallback(async (amountLamports: number) => {
        if (!amountLamports || amountLamports <= 0) {
            setError("Invalid amount for shielding");
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            console.log("Initiating shield for:", amountLamports, "lamports");
            const response = await fetch('/api/solvoid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'shield',
                    params: {
                        amountLamports,
                        network
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Shield API Error: ${response.status} - ${errorText}`);
            }

            const shieldData = await response.json();
            console.log("Shield data received:", shieldData);

            return shieldData;

        } catch (err: unknown) {
            console.error("Shield operation failed:", err);
            setError(err instanceof Error ? err.message : 'Shield failed');
            return null;
        } finally {
            setLoading(false);
        }
    }, [network]);

    const withdraw = useCallback(async (secret: string, nullifier: string, amount: string, recipient: string) => {
        if (!secret || !nullifier || !recipient) {
            setError("Missing withdrawal parameters");
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            console.log("Initiating withdrawal for recipient:", recipient);
            const response = await fetch('/api/solvoid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'withdraw',
                    params: {
                        secret,
                        nullifier,
                        amount,
                        recipient,
                        network
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Withdraw API Error: ${response.status} - ${errorText}`);
            }

            const withdrawData = await response.json();
            console.log("Withdraw data received:", withdrawData);
            return withdrawData;

        } catch (err: unknown) {
            console.error("Withdraw operation failed:", err);
            setError(err instanceof Error ? err.message : 'Withdrawal failed');
            return null;
        } finally {
            setLoading(false);
        }
    }, [network]);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 60000); // Refresh stats every minute
        return () => clearInterval(interval);
    }, [fetchStats]);

    useEffect(() => {
        console.log("useSolVoid useEffect:", { connected, publicKey: publicKey?.toBase58() });
        if (connected && publicKey) {
            scanAddress(publicKey.toBase58());
        } else if (!connected) {
            setPassport(null);
            setLeaks([]);
        }
    }, [connected, publicKey?.toBase58(), scanAddress]);

    return {
        address: publicKey?.toBase58() || null,
        passport,
        leaks,
        stats,
        loading,
        error,
        rpcError,
        scanAddress,
        executeRescue,
        shield,
        withdraw
    };
};
