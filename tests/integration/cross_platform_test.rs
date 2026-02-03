
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
