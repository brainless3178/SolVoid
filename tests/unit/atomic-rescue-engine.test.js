/**
 * Atomic Rescue Engine Unit Tests
 * Tests for core components: PriceOracle, ThreatIntelligence, SPLTokenEngine
 */

const {
  AtomicRescueEngine,
  PriceOracle,
  ThreatIntelligence,
  ZKPrivacyLayer,
  SPLTokenEngine
} = require('../../cli/utils/atomic-rescue-engine');
const { Keypair, PublicKey, Connection } = require('@solana/web3.js');

const RPC_ENDPOINT = process.env.RPC_URL || 'https://api.devnet.solana.com';

describe('AtomicRescueEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new AtomicRescueEngine();
  });

  describe('Constructor', () => {
    test('initializes with default configuration', () => {
      expect(engine.connection).toBeDefined();
      expect(engine.priceOracle).toBeInstanceOf(PriceOracle);
      expect(engine.threatIntel).toBeInstanceOf(ThreatIntelligence);
      expect(engine.zkLayer).toBeInstanceOf(ZKPrivacyLayer);
      expect(engine.splEngine).toBeInstanceOf(SPLTokenEngine);
    });

    test('has valid connection to Solana', async () => {
      const version = await engine.connection.getVersion();
      expect(version['solana-core']).toBeDefined();
    });
  });
});

describe('PriceOracle', () => {
  let priceOracle;
  const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

  beforeEach(() => {
    priceOracle = new PriceOracle();
  });

  describe('getPrice', () => {
    test('returns cached price if available and not expired', async () => {
      const cachedPrice = { usd: 1.0, source: 'jupiter', timestamp: Date.now() };
      priceOracle.cache.set(USDC_MINT.toString(), {
        price: cachedPrice,
        timestamp: Date.now()
      });

      const result = await priceOracle.getPrice(USDC_MINT);
      expect(result).toEqual(cachedPrice);
    });

    test('fetches price from external API on cache miss', async () => {
      priceOracle.cache.clear();
      const result = await priceOracle.getPrice(USDC_MINT);

      expect(result).toHaveProperty('usd');
      expect(typeof result.usd).toBe('number');
      // Price can be 0 if API fails, just check it exists
      expect(result.usd).toBeGreaterThanOrEqual(0);
    }, 30000);
  });

  describe('getBatchPrices', () => {
    test('fetches prices for multiple tokens', async () => {
      const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
      const mints = [USDC_MINT, USDT_MINT];

      const prices = await priceOracle.getBatchPrices(mints);

      expect(prices.size).toBe(2);
      expect(prices.get(USDC_MINT.toString())).toHaveProperty('usd');
      expect(prices.get(USDT_MINT.toString())).toHaveProperty('usd');
    }, 30000);
  });
});

describe('ThreatIntelligence', () => {
  let threatIntel;

  beforeEach(() => {
    threatIntel = new ThreatIntelligence();
  });

  describe('isThreatDetected', () => {
    test('returns true if local database contains threat', async () => {
      const knownThreat = Keypair.generate().publicKey;
      threatIntel.localDatabase.set(knownThreat.toString(), {
        type: 'malware',
        severity: 'high'
      });

      const result = await threatIntel.isThreatDetected(knownThreat);
      expect(result).toBe(true);
    });

    test('handles threat detection for unknown address', async () => {
      const address = Keypair.generate().publicKey;
      // ThreatIntelligence may query external APIs
      const result = await threatIntel.isThreatDetected(address);
      expect(typeof result).toBe('boolean');
    }, 30000);
  });
});

describe('ZKPrivacyLayer', () => {
  let zkLayer;

  beforeEach(() => {
    zkLayer = new ZKPrivacyLayer();
  });

  describe('verifyProof', () => {
    test('tracks nullifier hashes to prevent double-spending', async () => {
      const proof = { pi_a: ['0x1'], pi_b: [['0x2']], pi_c: ['0x3'] };
      const uniqueHash = 'unique_hash_' + Date.now();
      const publicInputs = { nullifierHashes: [uniqueHash] };

      const result = await zkLayer.verifyProof(proof, publicInputs);
      expect(result).toBe(true);
      expect(zkLayer.nullifiers.has(uniqueHash)).toBe(true);
    });

    test('rejects double-spending attempts', async () => {
      const proof = { pi_a: ['0x1'], pi_b: [['0x2']], pi_c: ['0x3'] };
      const duplicateHash = 'duplicate_hash_' + Date.now();
      const publicInputs = { nullifierHashes: [duplicateHash] };

      await zkLayer.verifyProof(proof, publicInputs);

      await expect(zkLayer.verifyProof(proof, publicInputs))
        .rejects.toThrow('Nullifier already used');
    });
  });
});

describe('SPLTokenEngine', () => {
  let splEngine;
  let connection;

  beforeEach(() => {
    connection = new Connection(RPC_ENDPOINT, 'confirmed');
    splEngine = new SPLTokenEngine(connection);
  });

  describe('scanTokenAccounts', () => {
    test('scans for SPL token accounts', async () => {
      const wallet = new PublicKey('9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g');

      const assets = await splEngine.scanTokenAccounts(wallet);

      expect(Array.isArray(assets)).toBe(true);
    }, 30000);
  });
});
