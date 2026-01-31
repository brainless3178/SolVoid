#!/bin/bash
# SolVoid Program Deployment Script
# Run this when network congestion is low

set -e

echo "========================================="
echo "    SolVoid Program Deployment"
echo "========================================="
echo ""

# Check balance
BALANCE=$(solana balance | cut -d' ' -f1)
echo "Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 4" | bc -l) )); then
    echo "ERROR: Insufficient balance. Need at least 4 SOL for deployment."
    echo "Current balance: $BALANCE SOL"
    exit 1
fi

# Clean up any orphaned buffers
echo ""
echo "Checking for orphaned buffers..."
BUFFERS=$(solana program show --buffers 2>/dev/null | grep -c "SOL" || echo "0")
if [ "$BUFFERS" -gt "0" ]; then
    echo "Found $BUFFERS orphaned buffer(s). Recovering SOL..."
    solana program show --buffers | grep SOL | awk '{print $1}' | while read ADDR; do
        solana program close "$ADDR" 2>/dev/null || true
    done
    NEW_BALANCE=$(solana balance | cut -d' ' -f1)
    echo "New balance after recovery: $NEW_BALANCE SOL"
fi

# Deploy program
echo ""
echo "Deploying program..."
echo "This may take several minutes depending on network conditions."
echo ""

solana program deploy target/deploy/solvoid_zk.so --with-compute-unit-price 5000

echo ""
echo "========================================="
echo "    Deployment Complete!"
echo "========================================="
echo ""

# Verify deployment
PROGRAM_ID=$(grep "declare_id!" programs/solvoid-zk/src/lib.rs | cut -d'"' -f2)
echo "Program ID: $PROGRAM_ID"
solana program show "$PROGRAM_ID"

echo ""
echo "Next steps:"
echo "1. Run: npx ts-node scripts/initialize-program.ts"
echo "2. Run: npx ts-node scripts/initialize-verifier.ts"
echo "3. Run: npx ts-node scripts/initialize-economics.ts"
