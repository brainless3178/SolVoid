// cli/utils/asset-scanner.ts
// Asset Scanner
// Comprehensively scans all wallet assets for atomic rescue

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { EnhancedPythPriceFeed } from './enhanced-pyth-feed';

export interface AssetSummary {
  sol: {
    balance: string;
    lamports: number;
    valueUSD: string;
  };
  tokens: TokenAsset[];
  nfts: NFTAsset[];
  total: {
    count: number;
    value: number;
    valueUSD: string;
  };
}

export interface TokenAsset {
  mint: string;
  symbol: string;
  name: string;
  amount: string;
  decimals: number;
  valueUSD: string;
  address: string;
}

export interface NFTAsset {
  mint: string;
  name: string;
  collection: string;
  address: string;
  amount: string; // Always 1 for NFTs
}

export class AssetScanner {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Comprehensive asset scan
   */
  async scan(address: PublicKey): Promise<AssetSummary> {
    const [sol, tokens, nfts] = await Promise.all([
      this.scanSOL(address),
      this.scanTokens(address),
      this.scanNFTs(address)
    ]);

    const totalValueUSD = parseFloat(sol.valueUSD) + tokens.reduce((sum, t) => sum + parseFloat(t.valueUSD), 0);

    return {
      sol,
      tokens,
      nfts,
      total: {
        count: 1 + tokens.length + nfts.length,
        value: totalValueUSD,
        valueUSD: totalValueUSD.toFixed(2)
      }
    };
  }

  /**
   * Scan SOL balance
   */
  private async scanSOL(address: PublicKey): Promise<AssetSummary['sol']> {
    const balance = await this.connection.getBalance(address);
    const solBalance = balance / LAMPORTS_PER_SOL;

    const pyth = new EnhancedPythPriceFeed(this.connection);
    const priceData = await pyth.getPrice(new PublicKey('So11111111111111111111111111111111111111112'));
    const solPrice = priceData.usd || 100; // Fallback to 100 if oracle fails
    const valueUSD = (solBalance * solPrice).toFixed(2);

    return {
      balance: solBalance.toFixed(4),
      lamports: balance,
      valueUSD
    };
  }

  /**
   * Scan all SPL tokens
   */
  private async scanTokens(address: PublicKey): Promise<TokenAsset[]> {
    const tokens: TokenAsset[] = [];

    try {
      // Get all token accounts owned by address
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        address,
        { programId: TOKEN_PROGRAM_ID }
      );

      for (const account of tokenAccounts.value) {
        const parsedInfo = account.account.data.parsed.info;
        const mint = parsedInfo.mint;
        const amount = parsedInfo.tokenAmount.uiAmount;
        const decimals = parsedInfo.tokenAmount.decimals;

        // Skip empty accounts
        if (amount === 0) continue;

        // Check if it's an NFT (amount = 1, decimals = 0)
        if (amount === 1 && decimals === 0) {
          continue; // This will be handled by scanNFTs
        }

        // Get token metadata (symbol, name)
        const metadata = await this.getTokenMetadata(mint);

        tokens.push({
          mint,
          symbol: metadata.symbol || 'UNKNOWN',
          name: metadata.name || 'Unknown Token',
          amount: amount.toString(),
          decimals,
          valueUSD: this.estimateTokenValue(metadata.symbol || 'UNKNOWN', amount).toFixed(2),
          address: account.pubkey.toBase58()
        });
      }
    } catch (error) {
      console.error('Error scanning tokens:', error);
    }

    return tokens;
  }

  /**
   * Scan all NFTs
   */
  private async scanNFTs(address: PublicKey): Promise<NFTAsset[]> {
    const nfts: NFTAsset[] = [];

    try {
      // Get all token accounts
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        address,
        { programId: TOKEN_PROGRAM_ID }
      );

      for (const account of tokenAccounts.value) {
        const parsedInfo = account.account.data.parsed.info;
        const mint = parsedInfo.mint;
        const amount = parsedInfo.tokenAmount.uiAmount;
        const decimals = parsedInfo.tokenAmount.decimals;

        // NFT: amount = 1, decimals = 0
        if (amount === 1 && decimals === 0) {
          const metadata = await this.getNFTMetadata(mint);

          if (metadata) {
            nfts.push({
              mint,
              name: metadata.name || 'Unknown NFT',
              collection: metadata.collection || 'Uncategorized',
              address: account.pubkey.toBase58(),
              amount: '1'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error scanning NFTs:', error);
    }

    return nfts;
  }

  /**
   * Get token metadata from mint
   */
  private async getTokenMetadata(mint: string): Promise<{
    symbol?: string;
    name?: string;
  }> {
    // In production, this would:
    // 1. Check Metaplex metadata account
    // 2. Query token registry
    // 3. Use Jupiter/CoinGecko API

    // Known tokens for demo
    const knownTokens: Record<string, { symbol: string; name: string }> = {
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
        symbol: 'USDC',
        name: 'USD Coin'
      },
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
        symbol: 'USDT',
        name: 'Tether USD'
      },
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
        symbol: 'BONK',
        name: 'Bonk'
      }
    };

    return knownTokens[mint] || { symbol: 'UNKNOWN', name: 'Unknown Token' };
  }

  /**
   * Get NFT metadata
   */
  private async getNFTMetadata(mint: string): Promise<{
    name?: string;
    collection?: string;
  } | null> {
    try {
      // In production, this would:
      // 1. Derive Metaplex metadata PDA
      // 2. Fetch and parse metadata account
      // 3. Fetch JSON metadata from URI

      // For now, return basic info
      return {
        name: `NFT ${mint.slice(0, 8)}...`,
        collection: 'Unknown Collection'
      };
    } catch {
      return null;
    }
  }

  /**
   * Estimate token value in USD
   */
  private estimateTokenValue(symbol: string, amount: number): number {
    // Simplified price estimation
    // In production, use real-time prices from Jupiter/CoinGecko

    const prices: Record<string, number> = {
      'USDC': 1.00,
      'USDT': 1.00,
      'BONK': 0.00001,
      'JUP': 0.50,
      'WIF': 1.20,
      'PYTH': 0.30
    };

    return (prices[symbol] || 0) * amount;
  }

  /**
   * Quick scan for emergency situations (only critical assets)
   */
  async quickScan(address: PublicKey): Promise<{
    sol: number;
    tokenCount: number;
    nftCount: number;
  }> {
    const [solBalance, tokenAccounts] = await Promise.all([
      this.connection.getBalance(address),
      this.connection.getParsedTokenAccountsByOwner(
        address,
        { programId: TOKEN_PROGRAM_ID }
      )
    ]);

    let tokenCount = 0;
    let nftCount = 0;

    for (const account of tokenAccounts.value) {
      const parsedInfo = account.account.data.parsed.info;
      const amount = parsedInfo.tokenAmount.uiAmount;
      const decimals = parsedInfo.tokenAmount.decimals;

      if (amount > 0) {
        if (amount === 1 && decimals === 0) {
          nftCount++;
        } else {
          tokenCount++;
        }
      }
    }

    return {
      sol: solBalance,
      tokenCount,
      nftCount
    };
  }

  /**
   * Estimate total rescue time based on asset count
   */
  estimateRescueTime(assets: AssetSummary, emergencyMode: boolean): number {
    const baseTime = emergencyMode ? 0.5 : 2; // seconds
    const perToken = 0.1; // seconds per token
    const perNFT = 0.1; // seconds per NFT

    return baseTime +
      (assets.tokens.length * perToken) +
      (assets.nfts.length * perNFT);
  }
}
