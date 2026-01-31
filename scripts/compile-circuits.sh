#!/bin/bash

# ============================================================================
# ZK CIRCUIT COMPILATION SCRIPT
# ============================================================================

set -e

echo " Compiling ZK Circuits for SolVoid Atomic Rescue..."

# Check if circom is installed
if ! command -v circom &> /dev/null; then
    echo " circom not found. Installing..."
    npm install -g circom
fi

# Create directories
mkdir -p circuits/build
mkdir -p circuits/keys

# Install circomlib if not present
if [ ! -d "node_modules/circomlib" ]; then
    echo " Installing circomlib..."
    npm install circomlib
fi

echo ""
echo " Compiling Rescue Circuit..."

# Compile rescue circuit
circom ../circuits/rescue.circom \
    --r1cs \
    --wasm \
    --c \
    --sym \
    -l ../../node_modules/circomlib/circuits \
    -o ../circuits/build/ \
    --O2

echo " Rescue circuit compiled successfully!"

echo ""
echo " Compiling Withdraw Circuit..."

# Compile withdraw circuit
circom ../circuits/withdraw.circom \
    --r1cs \
    --wasm \
    --c \
    --sym \
    -l ../../node_modules/circomlib/circuits \
    -o ../circuits/build/ \
    --O2

echo " Withdraw circuit compiled successfully!"

echo ""
echo " Generating ZK Keys..."

# Generate powers of tau ceremony file (if not exists)
if [ ! -f "pot14_final.ptau" ]; then
    echo " Generating powers of tau (this may take a while)..."
    npx snarkjs powersoftau new bn128 14 pot14_0000.ptau -v
    npx snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="First contribution" -v
    npx snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau -v
    echo " Powers of tau ceremony completed!"
fi

# Generate rescue circuit zkey
echo " Generating rescue circuit zkey..."
npx snarkjs groth16 setup ../circuits/build/rescue.r1cs ../pot14_final.ptau ../circuits/keys/rescue_0000.zkey
npx snarkjs zkey contribute ../circuits/keys/rescue_0000.zkey ../circuits/keys/rescue_0001.zkey --name="1st Contributor Name" -v
npx snarkjs zkey export verificationkey ../circuits/keys/rescue_0001.zkey ../circuits/keys/rescue_verification_key.json

# Copy final zkey
cp ../circuits/keys/rescue_0001.zkey ../circuits/keys/rescue.zkey

echo " Rescue circuit zkey generated!"

# Generate withdraw circuit zkey
echo " Generating withdraw circuit zkey..."
npx snarkjs groth16 setup ../circuits/build/withdraw.r1cs ../pot14_final.ptau ../circuits/keys/withdraw_0000.zkey
npx snarkjs zkey contribute ../circuits/keys/withdraw_0000.zkey ../circuits/keys/withdraw_0001.zkey --name="1st Contributor Name" -v
npx snarkjs zkey export verificationkey ../circuits/keys/withdraw_0001.zkey ../circuits/keys/withdraw_verification_key.json

# Copy final zkey
cp ../circuits/keys/withdraw_0001.zkey ../circuits/keys/withdraw.zkey

echo " Withdraw circuit zkey generated!"

echo ""
echo " Copying files to project root..."

# Copy WASM and ZKEY files to project root for easy access
cp ../circuits/build/rescue.wasm ./
cp ../circuits/build/withdraw.wasm ./
cp ../circuits/keys/rescue.zkey ./
cp ../circuits/keys/withdraw.zkey ./

echo ""
echo " ZK Circuit Compilation Complete!"
echo ""
echo " Generated Files:"
echo "   • rescue.wasm - Rescue circuit WASM"
echo "   • rescue.zkey - Rescue circuit proving key"
echo "   • withdraw.wasm - Withdraw circuit WASM"
echo "   • withdraw.zkey - Withdraw circuit proving key"
echo "   • rescue_verification_key.json - Rescue verification key"
echo "   • withdraw_verification_key.json - Withdraw verification key"
echo ""
echo " Verification keys are ready for on-chain deployment!"
echo " WASM files are ready for proof generation!"
