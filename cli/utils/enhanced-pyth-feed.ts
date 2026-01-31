import { Connection, PublicKey } from '@solana/web3.js';
const { PythHttpClient, getPythProgramKeyForCluster } = require('@pythnetwork/client');

export interface PriceData {
    usd: number;
    source: string;
    timestamp: number;
    confidence: number;
    priceFeed?: string;
    publishTime?: number;
}

export class EnhancedPythPriceFeed {
    private connection: Connection;
    private pythConnection: any = null;
    private priceCache: Map<string, { price: PriceData; timestamp: number }> = new Map();
    private cacheExpiry = 30000; // 30 seconds

    private priceFeedMappings: Map<string, string> = new Map([
        // SOL
        ['So11111111111111111111111111111111111111112', '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c27bcde8'],
        // USDC
        ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', '0xeaa020c61cc479712813461ce153894a96a6c003b1a9d3b8bd7c9070d06068e30'],
        // USDT
        ['Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'],
        // BONK
        ['DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', '0xd2aeea1b1016cd6453782546b7c0de2af3ebba6d5a2a0ecb12baa1b6bd3a5d5'],
    ]);

    constructor(connection: Connection) {
        this.connection = connection;
    }

    private async initializePyth() {
        try {
            const pythPublicKey = getPythProgramKeyForCluster('mainnet-beta');
            this.pythConnection = new PythHttpClient(this.connection, pythPublicKey);
        } catch (error: any) {
            console.warn('Failed to initialize Pyth:', error.message);
        }
    }

    async getPrice(mintAddress: PublicKey): Promise<PriceData> {
        const cacheKey = mintAddress.toString();
        const cached = this.priceCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.price;
        }

        try {
            if (!this.pythConnection) await this.initializePyth();

            const feedAddress = this.priceFeedMappings.get(cacheKey);
            if (!feedAddress) throw new Error(`No mapping for ${cacheKey}`);

            const data = await this.pythConnection.getAssetPrices([new PublicKey(feedAddress)]);
            const price = data[0];

            const result: PriceData = {
                usd: price.price,
                source: 'pyth',
                timestamp: Date.now(),
                confidence: 1.0,
                publishTime: Date.now()
            };

            this.priceCache.set(cacheKey, { price: result, timestamp: Date.now() });
            return result;
        } catch (error) {
            if (cached) return cached.price;
            return { usd: 0, source: 'error', timestamp: Date.now(), confidence: 0 };
        }
    }
}
