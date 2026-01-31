pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// SolVoid Rescue Circuit
// Prove knowledge of multiple commitments for batch rescue.
template RescueCommitment() {
    signal input amount;
    signal input assetType;
    signal input secret;
    signal input nullifier;
    
    signal output commitment;
    signal output nullifierHash;

    // commitment = Poseidon(secret, nullifier, amount, assetType)
    component commitmentHasher = Poseidon(4);
    commitmentHasher.inputs[0] <== secret;
    commitmentHasher.inputs[1] <== nullifier;
    commitmentHasher.inputs[2] <== amount;
    commitmentHasher.inputs[3] <== assetType;
    commitment <== commitmentHasher.out;

    // nullifierHash = Poseidon(nullifier, 1)
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHasher.inputs[1] <== 1; // salt
    nullifierHash <== nullifierHasher.out;

    // range checks 
    component amountCheck = Num2Bits(64);
    amountCheck.in <== amount;
}

template BatchRescue(n) {
    // inputs for N assets
    signal input amounts[n];
    signal input assetTypes[n];
    signal input secrets[n];
    signal input nullifiers[n];
    
    // public outputs
    signal output commitments[n];
    signal output nullifierHashes[n];
    signal input recipient; // bind to recipient

    component rescuers[n];
    for (var i = 0; i < n; i++) {
        rescuers[i] = RescueCommitment();
        rescuers[i].amount <== amounts[i];
        rescuers[i].assetType <== assetTypes[i];
        rescuers[i].secret <== secrets[i];
        rescuers[i].nullifier <== nullifiers[i];

        commitments[i] <== rescuers[i].commitment;
        nullifierHashes[i] <== rescuers[i].nullifierHash;
    }

    // bind recipient to the proof so it can't be hijacked
    signal recipientSquare;
    recipientSquare <== recipient * recipient;
}

component main { public [recipient] } = BatchRescue(5);
