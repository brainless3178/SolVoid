"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { PrivacyRadar } from "@/components/PrivacyRadar";
import { ForensicFeed } from "@/components/ForensicFeed";
import { ShadowVault } from "@/components/ShadowVault";
import { MerkleTree3D } from "@/components/MerkleTree3D";
import { CeremonyMonitor } from "@/components/CeremonyMonitor";
import { ShadowNetwork } from "@/components/ShadowNetwork";
import { NetworkHeatmap } from "@/components/NetworkHeatmap";
import { TabNavigation, MobileNavigation, TabValue } from "@/components/TabNavigation";
import { useSolVoid } from "@/hooks/useSolVoid";
import { useNetworkDetection } from "@/hooks/useNetworkDetection";
import { TacticalOperations } from "@/components/TacticalOperations";
import { PathVisualizer } from "@/components/PathVisualizer";
import { ActivityLedger } from "@/components/ActivityLedger";
import { useToast } from "@/components/Toast";
import { Search, Crosshair, AlertCircle, Shield, Zap, Activity, Wallet, ChevronDown, Menu, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from "@solana/web3.js";

import { DEFAULT_RPC } from "@/config/rpc";

// FIXED: Input sanitization utilities to prevent XSS
const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/["'&]/g, '') // Remove quotes and ampersands
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

const isValidSolanaAddress = (address: string): boolean => {
  // Basic Solana address validation
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
};

const truncateAddress = (address: string, startChars: number = 4, endChars: number = 4): string => {
  if (!address || address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}…${address.slice(-endChars)}`;
};

export default function Home() {
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState("");
  const [activeTab, setActiveTab] = useState<TabValue>("dashboard");
  const [mounted, setMounted] = useState(false);
  // FIXED: Sanitize search input to prevent XSS
  const [sanitizedInput, setSanitizedInput] = useState("");
  const [balanceSOL, setBalanceSOL] = useState<number | null>(null);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);

  // Withdrawal State
  const [withdrawSecret, setWithdrawSecret] = useState("");
  const [withdrawNullifier, setWithdrawNullifier] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawRecipient, setWithdrawRecipient] = useState("");
  const { info, error: showError } = useToast();

  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();

  // Only initialize hook on client side
  const solVoidData = typeof window !== 'undefined' ? useSolVoid() : null;
  const {
    address,
    passport,
    leaks,
    stats,
    loading,
    error,
    rpcError,
    scanAddress,
    executeRescue,
    withdraw
  } = solVoidData || {
    address: null,
    passport: null,
    leaks: [],
    stats: null,
    loading: false,
    error: null,
    rpcError: false,
    scanAddress: async () => { },
    executeRescue: async () => { },
    withdraw: async () => { }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close wallet dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletDropdownOpen) {
        setWalletDropdownOpen(false);
      }
    };

    if (walletDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [walletDropdownOpen]);

  // Handle wallet connection
  const handleWalletConnect = () => {
    setVisible(true);
  };

  // Handle shield operation
  const handleShield = async () => {
    if (!publicKey || !balanceSOL || balanceSOL <= 0) {
      showError('Insufficient Balance', 'Requirement: Sufficient SOL balance for shielding execution.');
      return;
    }

    try {
      const amountLamports = Math.floor((balanceSOL * 0.1) * 1e9); // Shield 10% of balance
      const result = await solVoidData?.shield?.(amountLamports);

      if (result) {
        info('Shield Operation Started', 'Remediation active: Privacy shield generation initiated. Refer to telemetry for status.');
      }
    } catch (error) {
      console.error('Shield operation failed:', error);
      showError('Shield Error', 'Execution Failed: Shield operation initialization rejected.');
    }
  };

  // Handle withdrawal
  const handleWithdraw = async () => {
    if (!withdrawSecret || !withdrawNullifier || !withdrawRecipient || !withdrawAmount) {
      showError('Missing Parameters', 'Requirement: All withdrawal parameters must be specified for proof generation.');
      return;
    }

    try {
      // @ts-ignore
      const result = await withdraw(withdrawSecret, withdrawNullifier, withdrawAmount, withdrawRecipient);
      if (result) {
        info('Withdrawal Successful', `Funds relayed to ${withdrawRecipient.slice(0, 4)}...`);
        setWithdrawSecret("");
        setWithdrawNullifier("");
        setWithdrawAmount("");
        setWithdrawRecipient("");
      }
    } catch (e) {
      showError('Withdrawal Failed', 'Could not process proof.');
    }
  };

  // Handle wallet disconnection
  const handleWalletDisconnect = async () => {
    try {
      await disconnect();
      setWalletDropdownOpen(false);
      info('Wallet Disconnected', 'Your wallet has been disconnected successfully.');
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      showError('Disconnection Error', 'Failed to disconnect wallet. Please try again.');
    }
  };

  // Fetch balance when wallet connects
  const { network } = useNetworkDetection();

  useEffect(() => {
    if (!connected || !publicKey || !connection) {
      setBalanceSOL(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const response = await fetch('/api/solvoid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getBalance',
            params: { publicKey: publicKey.toBase58(), network }
          })
        });

        if (response.ok) {
          const balanceData = await response.json();
          setBalanceSOL(balanceData.balance / 1e9); // Convert lamports to SOL
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error);
        setBalanceSOL(null);
      }
    };

    fetchBalance();
  }, [connected, publicKey, connection, network]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset previous error
    // FIXED: Validate and sanitize input
    const trimmedInput = searchInput.trim();
    const sanitized = sanitizeInput(trimmedInput);

    if (!trimmedInput) {
      setSearchError("Please enter a wallet address");
      return;
    }

    // FIXED: Enhanced Solana address validation
    if (!isValidSolanaAddress(sanitized)) {
      setSearchError("Invalid Solana address format");
      return;
    }

    if (sanitized !== trimmedInput) {
      // Input contained potentially dangerous characters
      setSearchError("Invalid characters in address");
      return;
    }

    try {
      await scanAddress(sanitized);
      info('Scan Initiated', `Forensic analysis of ${truncateAddress(sanitized)} has started.`);
      setSearchInput(""); // Clear input after successful scan
      setSanitizedInput("");
    } catch (err) {
      showError('Analysis Error', 'Failed to connect to the Solana cluster for deep inspection.');
      setSearchError("Failed to scan address");
    }
  };

  // Real-time diagnostics
  const [latency, setLatency] = useState<number | null>(null);
  useEffect(() => {
    const measure = async () => {
      const start = Date.now();
      try {
        await fetch(DEFAULT_RPC.DEVNET, { method: 'HEAD', mode: 'no-cors' });
        setLatency(Date.now() - start);
      } catch (e) {
        setLatency(null);
      }
    };
    measure();
    const interval = setInterval(measure, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Shield className="w-12 h-12 text-tactical-cyan animate-pulse" />
          <p className="text-sm text-white/40">Initializing SolVoid...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col relative overflow-x-hidden selection:bg-tactical-cyan/20">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-30 z-0" />
      <div className="fixed inset-0 bg-radial pointer-events-none z-0" />
      <div className="scanner-overlay z-0" />

      {/* Header - Redesigned */}
      <header className="tactical-glass m-3 sm:m-4 p-3 sm:p-4 flex justify-between items-center bg-black/40 relative z-20">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-tactical-cyan/10 rounded-lg border border-tactical-cyan/20">
              <Shield className="text-tactical-cyan w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-glow-cyan">SolVoid</h1>
              <p className="text-[9px] sm:text-[10px] text-white/40 hidden sm:block">Privacy Infrastructure</p>
            </div>
          </div>
          <span className="text-[10px] font-medium px-2 py-1 rounded bg-green-500/10 text-green-500 border border-green-500/20">
            ● OPERATIONAL
          </span>
          <span className={`text-[10px] font-medium px-2 py-1 rounded border ${network === 'ephemeral'
            ? 'bg-tactical-cyan/10 text-tactical-cyan border-tactical-cyan/30 animate-pulse'
            : 'bg-white/5 text-white/40 border-white/10'}`}>
            <Globe className="w-3 h-3 inline-block mr-1.5 opacity-60" />
            {network === 'ephemeral' ? 'PRIVACY HACK (EPHEMERAL)' : network.toUpperCase()}
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-6">
          <div className="relative">
            <button
              onClick={() => {
                if (!connected) { handleWalletConnect(); } else { setWalletDropdownOpen(!walletDropdownOpen); }
              }}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
              disabled={connecting}
            >
              <Wallet className="w-4 h-4 text-white/60" />
              <span className="text-sm text-white/80 font-mono">
                {connecting ? 'Connecting...' : address ? truncateAddress(sanitizeInput(address)) : 'Connect Wallet'}
              </span>
              {connected && <ChevronDown className="w-3 h-3 text-white/40" />}
            </button>
            {connected && address && walletDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 tactical-glass p-2 border border-white/20 z-50">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(sanitizeInput(address));
                    info('Address Copied', 'Wallet address copied to clipboard');
                    setWalletDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 rounded transition-colors text-xs text-white/80"
                >
                  Copy Address
                </button>
                <button
                  onClick={() => {
                    window.open(`https://solscan.io/account/${encodeURIComponent(sanitizeInput(address))}`, '_blank');
                    setWalletDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 rounded transition-colors text-xs text-white/80"
                >
                  View on Solscan
                </button>
                <div className="border-t border-white/10 mt-2 pt-2">
                  <button onClick={handleWalletDisconnect} className="w-full text-left px-3 py-2 hover:bg-red-500/10 rounded transition-colors text-xs text-red-400">
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:hidden">
          <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <Menu className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-3 sm:px-4 pt-4 pb-6 lg:pb-8 relative z-10 max-w-screen-2xl mx-auto w-full">
        {/* Primary Search Section */}
        <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-8">
          <form onSubmit={handleScan} className="w-full">
            <div className="relative group input-with-icons">
              <Search className="input-icon absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 transition-all duration-200 pointer-events-none z-10" />
              <input
                type="text"
                placeholder="Paste wallet or transaction to analyze privacy exposure"
                className={`input-primary pl-12 pr-32 text-lg h-16 sm:h-18 ${searchError ? 'error' : ''}`}
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setSearchError("");
                }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading || !!searchError} className="btn-primary px-6 py-3 text-base font-medium min-w-[140px]">
                  {loading ? "Scanning..." : "Run Forensic Scan"}
                </motion.button>
              </div>
            </div>
          </form>
        </motion.div>

        {/* Tab Navigation */}
        <div className="hidden lg:block mb-8">
          <TabNavigation activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {(searchError || error) && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center gap-2 mb-4 px-3 sm:px-4 py-2 sm:py-3 bg-tactical-red/10 border border-tactical-red/20 rounded-lg">
              <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-tactical-red flex-shrink-0" />
              <p className="text-xs text-tactical-red">{searchError || error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-6">
              {/* Privacy Hack Info Banner */}
              {network === 'ephemeral' && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="tactical-glass p-6 mb-8 border-tactical-cyan/30 bg-tactical-cyan/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><Shield className="w-24 h-24 text-tactical-cyan" /></div>
                  <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center">
                    <div className="w-16 h-16 rounded-2xl bg-tactical-cyan/20 border border-tactical-cyan/30 flex items-center justify-center flex-shrink-0 animate-pulse"><Zap className="w-8 h-8 text-tactical-cyan" /></div>
                    <div>
                      <h2 className="text-xl font-bold text-white mb-2">Privacy Hack: Ephemeral Node Active</h2>
                      <p className="text-white/60 text-sm max-w-2xl">Official <strong>Privacy Hack</strong> track active. Ephemeral cluster isolated for competitive development Jan 12-30.</p>
                    </div>
                    <div className="md:ml-auto flex flex-col gap-2">
                      <button onClick={() => window.open('https://zk-edge.surfnet.dev', '_blank')} className="btn-primary py-2 px-6 text-xs">Hack Official Page</button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="stat-card p-4 sm:p-6"><Shield className="w-5 h-5 text-tactical-cyan mx-auto mb-3" /><div className="stat-label text-xs mb-1">Privacy Index</div><div className="stat-value text-2xl font-bold text-tactical-cyan">{passport?.overallScore ?? '--'}</div></div>
                <div className="stat-card p-4 sm:p-6"><Zap className="w-5 h-5 text-tactical-purple mx-auto mb-3" /><div className="stat-label text-xs mb-1">Active Leaks</div><div className="stat-value text-2xl font-bold text-tactical-purple">{leaks.length || '--'}</div></div>
                <div className="stat-card p-4 sm:p-6"><Activity className="w-5 h-5 text-tactical-green mx-auto mb-3" /><div className="stat-label text-xs mb-1">Status</div><div className="stat-value text-2xl font-bold text-tactical-green">SECURE</div></div>
              </div>

              {/* Main Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-4 space-y-6">
                  <PrivacyRadar score={passport?.overallScore} loading={loading} />
                  <div className="h-[430px]"><ActivityLedger /></div>
                </div>
                <div className="xl:col-span-8 h-[580px] flex flex-col"><ForensicFeed leaks={leaks} onRescue={executeRescue} loading={loading} /></div>
              </div>

              <div className="grid grid-cols-1 mt-6"><ShadowVault commitments={[]} stats={stats} /></div>
            </motion.div>
          )}

          {activeTab === "network" && (
            <motion.div key="network" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-8 h-[450px]"><NetworkHeatmap /></div>
                <div className="xl:col-span-4 h-[450px]"><PathVisualizer hops={5} active={loading} /></div>
                <div className="xl:col-span-12 h-[500px]"><ShadowNetwork /></div>
              </div>
            </motion.div>
          )}

          {activeTab === "tactical" && (
            <motion.div key="tactical" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="py-4">
              <TacticalOperations onRescue={async (settings) => { await executeRescue(settings); }} loading={loading} />
            </motion.div>
          )}

          {activeTab === "shield" && (
            <motion.div key="shield" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <CeremonyMonitor stats={stats} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="tactical-glass p-8 text-center space-y-6">
                  <h3 className="text-xl font-bold text-white uppercase tracking-widest">Shield Transactions</h3>
                  <button className="btn-primary w-full py-4 uppercase font-bold text-sm tracking-widest shadow-[0_0_20px_rgba(0,243,255,0.2)]" onClick={handleShield}>Execute Shield</button>
                </div>
                <div className="tactical-glass p-8">
                  <h4 className="text-xs font-bold text-white/40 uppercase mb-4">Protected Balance</h4>
                  <div className="text-3xl font-bold text-white">{balanceSOL !== null ? `${balanceSOL.toFixed(4)} SOL` : '---'}</div>
                </div>
              </div>

              <div className="tactical-glass p-8 space-y-6 border-t border-white/10 mt-6">
                <h3 className="text-xl font-bold text-white uppercase tracking-widest text-center">Unshield Funds (Withdraw)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" placeholder="Secret Key (Hex 64 chars)" className="input-primary font-mono text-xs" value={withdrawSecret} onChange={(e) => setWithdrawSecret(e.target.value)} />
                  <input type="text" placeholder="Nullifier (Hex 64 chars)" className="input-primary font-mono text-xs" value={withdrawNullifier} onChange={(e) => setWithdrawNullifier(e.target.value)} />
                  <input type="number" placeholder="Amount (Lamports)" className="input-primary font-mono text-xs" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
                  <input type="text" placeholder="Recipient Address" className="input-primary font-mono text-xs" value={withdrawRecipient} onChange={(e) => setWithdrawRecipient(e.target.value)} />
                </div>
                <button className="btn-primary w-full py-4 uppercase font-bold text-sm tracking-widest shadow-[0_0_20px_rgba(255,100,100,0.2)] bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/30" onClick={handleWithdraw}>Execute ZK Withdrawal</button>
              </div>
            </motion.div>
          )}

          {activeTab === "settings" && (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
              <div className="tactical-glass p-8 space-y-8">
                <h3 className="text-xl font-bold text-white uppercase tracking-widest">Client Settings</h3>
                <div className="space-y-6">
                  <div className="space-y-2"><label className="text-[10px] uppercase text-white/40 font-bold">Custom RPC</label><input type="text" className="input-primary" placeholder="https://..." /></div>
                  <div className="space-y-2"><label className="text-[10px] uppercase text-white/40 font-bold">Privacy Persistence</label><select className="input-primary"><option>Standard (3 Hops)</option><option>High (5 Hops)</option></select></div>
                </div>
                <button className="btn-primary w-full py-4 uppercase font-bold">Save Config</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="hidden lg:block tactical-glass mx-4 mb-4 p-4 flex justify-between items-center bg-black/60 relative z-20">
        <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-tactical-green rounded-full shadow-[0_0_8px_#00ff88]" /><span className="text-[10px] text-tactical-green font-bold uppercase tracking-widest">Protocol Operational</span></div>
        <div className="text-[10px] text-white/20 font-mono">SOLVOID_SYSTEM_V.1.3.0_STABLE</div>
      </footer>

      <MobileNavigation activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}
