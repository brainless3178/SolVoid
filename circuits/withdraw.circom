pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "merkleTree.circom";

// SolVoid Withdraw Circuit
// bind amount to commitment -> stop inflation hacks
// bind relayer/recipient to output -> stop theft hacks
// split pks since field elements are < 256 bits
template PrivacyZero(levels) {
    // Public inputs (The Statement)
    signal input root;
    signal input nullifierHash;
    signal input recipient_low; 
    signal input recipient_high; 
    signal input relayer_low;
    signal input relayer_high;
    signal input fee;
    signal input amount;

    // output to bind signals - dont let them float!
    signal output statementHash;

    // Private inputs
    signal input secret;
    signal input nullifier;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // check commitment. must include amount.
    component commitmentHasher = Poseidon(3);
    commitmentHasher.inputs[0] <== secret;
    commitmentHasher.inputs[1] <== nullifier;
    commitmentHasher.inputs[2] <== amount;
    signal commitment;
    commitment <== commitmentHasher.out;
    
    // check nullifier hash
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHasher.inputs[1] <== 1; // salt
    nullifierHash === nullifierHasher.out;

    // merkle tree check
    component treeVerifier = MerkleTreeChecker(levels);
    treeVerifier.leaf <== commitment;
    treeVerifier.root <== root;
    for (var i = 0; i < levels; i++) {
        treeVerifier.pathElements[i] <== pathElements[i];
        treeVerifier.pathIndices[i] <== pathIndices[i];
    }

    // link everything to the output hash
    component statementHasher = Poseidon(8);
    statementHasher.inputs[0] <== recipient_low;
    statementHasher.inputs[1] <== recipient_high;
    statementHasher.inputs[2] <== relayer_low;
    statementHasher.inputs[3] <== relayer_high;
    statementHasher.inputs[4] <== fee;
    statementHasher.inputs[5] <== root;
    statementHasher.inputs[6] <== amount;
    statementHasher.inputs[7] <== nullifierHash;
    
    statementHash <== statementHasher.out;
}

component main { 
    public [root, nullifierHash, recipient_low, recipient_high, relayer_low, relayer_high, fee, amount]
} = PrivacyZero(8);
