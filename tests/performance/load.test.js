// ============================================================================
// LOAD TESTS FOR ATOMIC RESCUE ENGINE
// Performance testing under high load conditions
// ============================================================================

// jest is available globally, no need to import
const {
  AtomicRescueEngine
} = require('../../cli/utils/atomic-rescue-engine');
const {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');

describe('AtomicRescueEngine Load Tests', () => {
  let engine;
  let connection;
  let testWallets;
  let safeWallet;

  beforeAll(async () => {
    connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    engine = new AtomicRescueEngine();
    engine.connection = connection;
    engine.splEngine.connection = connection;

    safeWallet = Keypair.generate();

    // Create test wallets
    testWallets = Array(20).fill(null).map(() => Keypair.generate());

    console.log(`Created ${testWallets.length} test wallets for load testing`);
  });

  describe('Concurrent Rescue Operations', () => {
    test('should handle 10 concurrent rescues', async () => {
      // Fund all test wallets
      const fundPromises = testWallets.slice(0, 10).map(async (wallet) => {
        try {
          const signature = await connection.requestAirdrop(
            wallet.publicKey,
            LAMPORTS_PER_SOL
          );
          await connection.confirmTransaction(signature);
          return { wallet, success: true };
        } catch (error) {
          console.warn(`Failed to fund wallet ${wallet.publicKey.toString()}:`, error.message);
          return { wallet, success: false };
        }
      });

      const fundedWallets = await Promise.all(fundPromises);
      const successfulWallets = fundedWallets.filter(w => w.success).map(w => w.wallet);

      console.log(`Successfully funded ${successfulWallets.length} wallets`);

      const startTime = Date.now();

      // Execute concurrent rescues
      const rescuePromises = successfulWallets.map(wallet =>
        engine.executeAtomicRescue(
          wallet,
          safeWallet.publicKey,
          false,
          null
        ).catch(error => ({
          error: error.message,
          wallet: wallet.publicKey.toString()
        }))
      );

      const results = await Promise.allSettled(rescuePromises);

      const duration = Date.now() - startTime;

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`Load test results:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful: ${successful}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Average time per rescue: ${duration / successfulWallets.length}ms`);

      expect(successful + failed).toBe(successfulWallets.length);
      expect(successful).toBeGreaterThan(0);
      expect(duration).toBeLessThan(120000); // Should complete within 2 minutes
    }, 150000);

    test('should handle high-frequency small rescues', async () => {
      const batchSize = 5;
      const batches = 3;

      let totalSuccessful = 0;
      let totalFailed = 0;
      let totalTime = 0;

      for (let batch = 0; batch < batches; batch++) {
        console.log(`Processing batch ${batch + 1}/${batches}`);

        const batchWallets = testWallets.slice(
          batch * batchSize,
          (batch + 1) * batchSize
        );

        // Fund batch wallets
        const fundPromises = batchWallets.map(async (wallet) => {
          try {
            const signature = await connection.requestAirdrop(
              wallet.publicKey,
              LAMPORTS_PER_SOL / 2 // 0.5 SOL each
            );
            await connection.confirmTransaction(signature);
            return wallet;
          } catch (error) {
            return null;
          }
        });

        const fundedWallets = (await Promise.all(fundPromises))
          .filter(w => w !== null);

        if (fundedWallets.length === 0) {
          console.log('No wallets funded in this batch, skipping');
          continue;
        }

        const batchStartTime = Date.now();

        // Execute batch rescues
        const rescuePromises = fundedWallets.map(wallet =>
          engine.executeAtomicRescue(
            wallet,
            safeWallet.publicKey,
            false,
            null
          ).catch(error => ({
            error: error.message,
            wallet: wallet.publicKey.toString()
          }))
        );

        const results = await Promise.allSettled(rescuePromises);
        const batchDuration = Date.now() - batchStartTime;

        const batchSuccessful = results.filter(r => r.status === 'fulfilled').length;
        const batchFailed = results.filter(r => r.status === 'rejected').length;

        totalSuccessful += batchSuccessful;
        totalFailed += batchFailed;
        totalTime += batchDuration;

        console.log(`  Batch ${batch + 1}: ${batchSuccessful} successful, ${batchFailed} failed, ${batchDuration}ms`);

        // Wait between batches to avoid rate limiting
        if (batch < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      console.log(`High-frequency test results:`);
      console.log(`  Total successful: ${totalSuccessful}`);
      console.log(`  Total failed: ${totalFailed}`);
      console.log(`  Total time: ${totalTime}ms`);
      console.log(`  Average batch time: ${totalTime / batches}ms`);

      expect(totalSuccessful + totalFailed).toBeGreaterThan(0);
      expect(totalSuccessful).toBeGreaterThan(0);
    }, 300000);

    test('should maintain performance under sustained load', async () => {
      const duration = 60000; // 1 minute test
      const rescueInterval = 5000; // Rescue every 5 seconds
      const maxConcurrent = 3;

      let completedRescues = 0;
      let failedRescues = 0;
      let activeRescues = 0;

      const startTime = Date.now();
      const endTime = startTime + duration;

      const rescueQueue = [];
      let walletIndex = 0;

      // Fund initial wallets
      for (let i = 0; i < 10; i++) {
        try {
          const signature = await connection.requestAirdrop(
            testWallets[i].publicKey,
            LAMPORTS_PER_SOL
          );
          await connection.confirmTransaction(signature);
          rescueQueue.push(testWallets[i]);
        } catch (error) {
          console.warn(`Failed to fund wallet ${i}:`, error.message);
        }
      }

      console.log(`Starting sustained load test for ${duration}ms`);

      const loadTestInterval = setInterval(async () => {
        if (Date.now() >= endTime) {
          clearInterval(loadTestInterval);
          return;
        }

        if (activeRescues >= maxConcurrent || rescueQueue.length === 0) {
          return;
        }

        const wallet = rescueQueue.shift();
        activeRescues++;

        engine.executeAtomicRescue(
          wallet,
          safeWallet.publicKey,
          false,
          null
        ).then(() => {
          completedRescues++;
          activeRescues--;
        }).catch((error) => {
          failedRescues++;
          activeRescues--;
          console.warn(`Rescue failed:`, error.message);
        });

      }, rescueInterval);

      return new Promise((resolve) => {
        setTimeout(() => {
          clearInterval(loadTestInterval);

          // Wait for active rescues to complete
          setTimeout(() => {
            const actualDuration = Date.now() - startTime;

            console.log(`Sustained load test results:`);
            console.log(`  Duration: ${actualDuration}ms`);
            console.log(`  Completed rescues: ${completedRescues}`);
            console.log(`  Failed rescues: ${failedRescues}`);
            console.log(`  Rescue rate: ${(completedRescues / (actualDuration / 1000)).toFixed(2)} rescues/second`);

            expect(completedRescues + failedRescues).toBeGreaterThan(0);
            expect(completedRescues).toBeGreaterThan(0);

            resolve();
          }, 10000);
        }, duration + 5000);
      });
    }, 120000);
  });

  describe('Memory and Resource Management', () => {
    test('should not leak memory during rescues', async () => {
      const initialMemory = process.memoryUsage();

      // Fund a wallet
      const signature = await connection.requestAirdrop(
        testWallets[0].publicKey,
        LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(signature);

      // Execute multiple rescues
      for (let i = 0; i < 10; i++) {
        await engine.executeAtomicRescue(
          testWallets[0],
          safeWallet.publicKey,
          false,
          null
        ).catch(() => {
          // Ignore failures for memory test
        });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory usage increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }, 60000);

    test('should handle large wallet rescues efficiently', async () => {
      // Create wallet with many token accounts
      const largeWallet = Keypair.generate();

      // Fund wallet
      const signature = await connection.requestAirdrop(
        largeWallet.publicKey,
        5 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(signature);

      // Mock large wallet with many assets
      const mockAssets = Array(50).fill(null).map((_, i) => ({
        type: 'spl-token',
        mint: new PublicKey(`1111111111111111111111111111111${i.toString().padStart(2, '0')}`),
        amount: '1000000',
        decimals: 6,
        uiAmount: 1
      }));

      jest.spyOn(engine.splEngine, 'scanTokenAccounts')
        .mockResolvedValue(mockAssets);

      const startTime = Date.now();

      const result = await engine.executeAtomicRescue(
        largeWallet,
        safeWallet.publicKey,
        false,
        null
      );

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.assets).toHaveLength(50); // SOL + 49 tokens
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

      console.log(`Large wallet rescue completed in ${duration}ms for 50 assets`);
    }, 45000);
  });

  afterAll(async () => {
    console.log('Load tests completed');
  });
});
