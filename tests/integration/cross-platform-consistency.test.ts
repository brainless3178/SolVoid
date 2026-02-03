import { execSync } from 'child_process';
import { PoseidonHasher, PoseidonUtils } from '../../sdk/crypto/poseidon';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import * as path from 'path';

/**
 * Cross-platform Merkle Tree Consistency Test
 * Verifies that Rust and TypeScript Poseidon implementations produce identical results
 */

interface TestData {
    inputs: Array<{
        left: string; // hex string
        right: string; // hex string
        expected_hash: string; // hex string
    }>;
    merkle_data: {
        leaves: string[]; // hex strings
        expected_root: string; // hex string
    };
}

interface RustTestResults {
    hash_results: string[]; // hex strings
    merkle_root: string; // hex string
}

class CrossPlatformConsistencyTest {
    private static readonly RUST_TEST_PROGRAM = path.join('tests', 'integration', 'cross_platform_test.rs');
    private static readonly TEST_DATA_FILE = path.join('tests', 'integration', 'test_data.json');
    private static readonly RUST_RESULTS_FILE = path.join('tests', 'integration', 'rust_results.json');

    /**
     * Generate deterministic test data for both platforms
     */
    private static generateTestData(): TestData {
        // Use deterministic values for reproducible testing
        const testInputs = [
            {
                left: '0000000000000000000000000000000000000000000000000000000000000001',
                right: '0000000000000000000000000000000000000000000000000000000000000002',
                expected_hash: '' // Will be filled by Rust
            },
            {
                left: '0000000000000000000000000000000000000000000000000000000000000003',
                right: '0000000000000000000000000000000000000000000000000000000000000004',
                expected_hash: ''
            },
            {
                left: 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe',
                right: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
                expected_hash: ''
            },
            {
                left: '8000000000000000000000000000000000000000000000000000000000000000',
                right: '0000000000000000000000000000000000000000000000000000000000000000',
                expected_hash: ''
            }
        ];

        // Generate 4 leaves for 4-level Merkle tree (16 leaves total)
        const leaves = [];
        for (let i = 0; i < 16; i++) {
            const value = i + 1;
            const hex = value.toString(16).padStart(64, '0');
            leaves.push(hex);
        }

        return {
            inputs: testInputs,
            merkle_data: {
                leaves,
                expected_root: '' // Will be filled by Rust
            }
        };
    }

    /**
     * Create Rust test program to compute Poseidon hashes
     */
    private static createRustTestProgram(): void {
        const rustCode = `
use std::fs;
use serde::{Deserialize, Serialize};
use solvoid::poseidon::PoseidonHasher;

#[derive(Serialize, Deserialize)]
struct TestData {
    inputs: Vec<TestInput>,
    merkle_data: MerkleData,
}

#[derive(Serialize, Deserialize)]
struct TestInput {
    left: String,
    right: String,
    expected_hash: String,
}

#[derive(Serialize, Deserialize)]
struct MerkleData {
    leaves: Vec<String>,
    expected_root: String,
}

#[derive(Serialize)]
struct RustTestResults {
    hash_results: Vec<String>,
    merkle_root: String,
}

fn hex_to_bytes(hex: &str) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    for (i, byte) in (0..hex.len()).step_by(2).enumerate() {
        bytes[i] = u8::from_str_radix(&hex[byte..byte + 2], 16).unwrap();
    }
    bytes
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Read test data
    let test_data: TestData = serde_json::from_str(
        &fs::read_to_string("tests/integration/test_data.json")?
    )?;

    let mut hash_results = Vec::new();

    // Test individual hash computations
    for input in &test_data.inputs {
        let left = hex_to_bytes(&input.left);
        let right = hex_to_bytes(&input.right);
        
        let hash = PoseidonHasher::hash_two_inputs(&left, &right)?;
        let hash_hex = bytes_to_hex(&hash);
        hash_results.push(hash_hex);
    }

    // Build 4-level Merkle tree
    let mut current_level: Vec<[u8; 32]> = test_data.merkle_data.leaves
        .iter()
        .map(|leaf| hex_to_bytes(leaf))
        .collect();

    // Build tree level by level (4 levels for 16 leaves)
    for _level in 0..4 {
        let mut next_level = Vec::new();
        
        for i in (0..current_level.len()).step_by(2) {
            let left = current_level[i];
            let right = if i + 1 < current_level.len() {
                current_level[i + 1]
            } else {
                [0u8; 32] // Zero padding for odd number of nodes
            };
            
            let parent = PoseidonHasher::hash_two_inputs(&left, &right)?;
            next_level.push(parent);
        }
        
        current_level = next_level;
    }

    let merkle_root = bytes_to_hex(&current_level[0]);

    // Save results
    let results = RustTestResults {
        hash_results,
        merkle_root,
    };

    fs::write(
        "tests/integration/rust_results.json",
        serde_json::to_string_pretty(&results)?
    )?;

    println!("Rust computations completed successfully");
    Ok(())
}
`;

        writeFileSync(this.RUST_TEST_PROGRAM, rustCode);
    }

    /**
     * Run Rust test program to compute hashes
     */
    private static async runRustTest(): Promise<RustTestResults> {
        try {
            // Build and run Rust test from integration directory
            const integrationDir = path.join(process.cwd(), 'tests', 'integration');
            execSync('cargo run --bin cross_platform_test', {
                cwd: integrationDir,
                stdio: 'inherit'
            });

            // Read results
            const results = JSON.parse(readFileSync(this.RUST_RESULTS_FILE, 'utf8'));
            return results;
        } catch (error) {
            throw new Error(`Rust test execution failed: ${error}`);
        }
    }

    /**
     * Compute hashes using TypeScript implementation
     */
    private static async computeTypeScriptHashes(testData: TestData): Promise<{
        hash_results: string[];
        merkle_root: string;
    }> {
        const hash_results = [];

        // Test individual hash computations
        for (const input of testData.inputs) {
            const left = PoseidonUtils.hexToBuffer(input.left);
            const right = PoseidonUtils.hexToBuffer(input.right);

            const hash = await PoseidonHasher.hashTwoInputs(left, right);
            const hashHex = PoseidonUtils.bufferToHex(hash);
            hash_results.push(hashHex);
        }

        // Build 4-level Merkle tree
        let currentLevel = testData.merkle_data.leaves.map(leaf =>
            PoseidonUtils.hexToBuffer(leaf)
        );

        // Build tree level by level
        for (let level = 0; level < 4; level++) {
            const nextLevel = [];

            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                const right = (i + 1 < currentLevel.length)
                    ? currentLevel[i + 1]
                    : PoseidonUtils.zeroBuffer(); // Zero padding

                const parent = await PoseidonHasher.hashTwoInputs(left, right);
                nextLevel.push(parent);
            }

            currentLevel = nextLevel;
        }

        const merkle_root = PoseidonUtils.bufferToHex(currentLevel[0]);

        return {
            hash_results,
            merkle_root
        };
    }

    /**
     * Compare results and assert consistency
     */
    private static compareResults(
        rustResults: RustTestResults,
        tsResults: { hash_results: string[]; merkle_root: string }
    ): void {
        console.log(' Comparing Rust and TypeScript results...\n');

        // Compare individual hash results
        console.log(' Individual Hash Results:');
        for (let i = 0; i < rustResults.hash_results.length; i++) {
            const rustHash = rustResults.hash_results[i];
            const tsHash = tsResults.hash_results[i];
            const matches = rustHash === tsHash;

            console.log(`  Test ${i + 1}: ${matches ? '' : ''}`);
            if (!matches) {
                console.log(`    Rust:    ${rustHash}`);
                console.log(`    TS:      ${tsHash}`);
                throw new Error(`Hash mismatch in test ${i + 1}`);
            }
        }

        // Compare Merkle root
        console.log('\n Merkle Tree Root:');
        const rootMatches = rustResults.merkle_root === tsResults.merkle_root;
        console.log(`  Root: ${rootMatches ? '' : ''}`);

        if (!rootMatches) {
            console.log(`    Rust:    ${rustResults.merkle_root}`);
            console.log(`    TS:      ${tsResults.merkle_root}`);
            throw new Error('Merkle root mismatch');
        }

        console.log('\n All hash computations match between Rust and TypeScript!');
    }

    /**
     * Main test execution
     */
    static async run(): Promise<void> {
        console.log(' Starting Cross-Platform Poseidon Consistency Test\n');

        try {
            // 1. Generate test data
            console.log(' Generating test data...');
            const testData = this.generateTestData();
            writeFileSync(this.TEST_DATA_FILE, JSON.stringify(testData, null, 2));
            console.log(' Test data generated\n');

            // 2. Create and run Rust test
            console.log(' Running Rust Poseidon computations...');
            this.createRustTestProgram();
            const rustResults = await this.runRustTest();
            console.log(' Rust computations completed\n');

            // 3. Run TypeScript computations
            console.log(' Running TypeScript Poseidon computations...');
            const tsResults = await this.computeTypeScriptHashes(testData);
            console.log(' TypeScript computations completed\n');

            // 4. Compare results
            this.compareResults(rustResults, tsResults);

            // 5. Cleanup
            try {
                unlinkSync(this.RUST_TEST_PROGRAM);
                unlinkSync(this.TEST_DATA_FILE);
                unlinkSync(this.RUST_RESULTS_FILE);
            } catch (e) {
                // Ignore cleanup errors
            }

            console.log('\n Cleanup completed');
            console.log(' Cross-platform consistency test PASSED!');

        } catch (error) {
            console.error('\n Cross-platform consistency test FAILED:', error);
            throw error;
        }
    }
}

// Export for use in test framework
export { CrossPlatformConsistencyTest };

// Jest test wrapper
describe('Cross-Platform Poseidon Consistency', () => {
    // Skip these tests if Rust toolchain is not available
    const hasRustToolchain = (() => {
        try {
            require('child_process').execSync('cargo --version', { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    })();

    it('should produce identical hashes between Rust and TypeScript (requires Rust)', async () => {
        if (!hasRustToolchain) {
            console.log('Skipping: Rust toolchain not available');
            return;
        }
        await CrossPlatformConsistencyTest.run();
    }, 120000); // 2 minute timeout for Rust compilation
});

// Run test if this file is executed directly
if (require.main === module) {
    CrossPlatformConsistencyTest.run().catch(console.error);
}
