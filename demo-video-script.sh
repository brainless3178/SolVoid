#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
#  SolVoid Demo Video Script
#  Run this while screen recording to showcase the entire protocol
# ═══════════════════════════════════════════════════════════════════════════════

# Colors for nice output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Pause function - waits for Enter key
pause() {
    echo ""
    echo -e "${YELLOW}▶ Press ENTER to continue...${NC}"
    read
    clear
}

# Section header
section() {
    echo ""
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Command display
run_cmd() {
    echo -e "${GREEN}$ $1${NC}"
    echo ""
    eval $1
    echo ""
}

clear
echo -e "${PURPLE}"
cat << "EOF"
   ███████╗ ██████╗ ██╗    ██╗   ██╗ ██████╗ ██╗██████╗ 
   ██╔════╝██╔═══██╗██║    ██║   ██║██╔═══██╗██║██╔══██╗
   ███████╗██║   ██║██║    ██║   ██║██║   ██║██║██║  ██║
   ╚════██║██║   ██║██║    ╚██╗ ██╔╝██║   ██║██║██║  ██║
   ███████║╚██████╔╝███████╗╚████╔╝ ╚██████╔╝██║██████╔╝
   ╚══════╝ ╚═════╝ ╚══════╝ ╚═══╝   ╚═════╝ ╚═╝╚═════╝ 
   
   Privacy Lifecycle Management Platform - Demo
EOF
echo -e "${NC}"
pause

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: Project Overview
# ═══════════════════════════════════════════════════════════════════════════════
section "1. PROJECT STRUCTURE"

run_cmd "ls -la"
pause

run_cmd "cat package.json | head -25"
pause

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: Build & Compile
# ═══════════════════════════════════════════════════════════════════════════════
section "2. BUILD & COMPILE"

echo -e "${BLUE}Building TypeScript SDK & CLI...${NC}"
run_cmd "npm run build"
pause

echo -e "${BLUE}Checking Rust/Anchor Program...${NC}"
run_cmd "ls -la programs/solvoid-zk/src/"
pause

echo -e "${BLUE}Anchor keys...${NC}"
run_cmd "anchor keys list"
pause

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: ZK Circuits
# ═══════════════════════════════════════════════════════════════════════════════
section "3. ZK CIRCUITS (Zero-Knowledge Proofs)"

echo -e "${BLUE}Circuit source code...${NC}"
run_cmd "cat circuits/withdraw.circom | head -40"
pause

echo -e "${BLUE}Compiled circuit artifacts...${NC}"
run_cmd "ls -la circuits/build/"
pause

echo -e "${BLUE}Verification key (Groth16)...${NC}"
run_cmd "cat verification_key.json | head -25"
pause

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: Testnet/Devnet Setup
# ═══════════════════════════════════════════════════════════════════════════════
section "4. TESTNET/DEVNET SETUP"

echo -e "${BLUE}Configure Solana CLI for Devnet...${NC}"
run_cmd "solana config set --url devnet"
pause

echo -e "${BLUE}Check wallet balance...${NC}"
run_cmd "solana balance"
pause

echo -e "${BLUE}Request airdrop (faucet)...${NC}"
run_cmd "solana airdrop 1"
pause

echo -e "${BLUE}Verify new balance...${NC}"
run_cmd "solana balance"
pause

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: CLI Commands Demo
# ═══════════════════════════════════════════════════════════════════════════════
section "5. CLI COMMANDS - Privacy Analysis"

echo -e "${BLUE}Privacy Ghost Score Analysis...${NC}"
echo -e "${YELLOW}(Analyzing a real mainnet whale wallet - Binance)${NC}"
run_cmd "cd cli && npx ts-node solvoid-scan.ts ghost 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
pause

echo -e "${BLUE}Generate Privacy Badge...${NC}"
run_cmd "cd cli && npx ts-node solvoid-scan.ts ghost 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM --badge"
pause

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6: Rescue Dry-Run Demo
# ═══════════════════════════════════════════════════════════════════════════════
section "6. ATOMIC RESCUE ENGINE (Dry-Run)"

echo -e "${BLUE}Rescue simulation (no real transaction)...${NC}"
echo -e "${YELLOW}This shows what would happen in an emergency rescue${NC}"
run_cmd "cd cli && npx ts-node solvoid-scan.ts rescue 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM --dry-run"
pause

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 7: Run Tests
# ═══════════════════════════════════════════════════════════════════════════════
section "7. SECURITY TESTING"

echo -e "${BLUE}Security Test Suite Validation...${NC}"
run_cmd "./scripts/security-test-suite.sh"
pause

echo -e "${BLUE}Rust Program Tests...${NC}"
run_cmd "cd programs/solvoid-zk && cargo test 2>&1 | head -50"
pause

echo -e "${BLUE}Hash Consistency Verification...${NC}"
run_cmd "./scripts/verify-hash-consistency.sh 2>&1 | head -30"
pause

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 8: Anchor/Solana Program
# ═══════════════════════════════════════════════════════════════════════════════
section "8. SOLANA PROGRAM (On-Chain)"

echo -e "${BLUE}Program source code (lib.rs)...${NC}"
run_cmd "head -80 programs/solvoid-zk/src/lib.rs"
pause

echo -e "${BLUE}Economics module (circuit breaker, fees)...${NC}"
run_cmd "head -60 programs/solvoid-zk/src/economics.rs"
pause

echo -e "${BLUE}Program keypair...${NC}"
run_cmd "anchor keys list"
pause

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 9: Dashboard
# ═══════════════════════════════════════════════════════════════════════════════
section "9. DASHBOARD (Web Interface)"

echo -e "${BLUE}Dashboard components...${NC}"
run_cmd "ls -la dashboard/src/components/"
pause

echo -e "${YELLOW}Starting Dashboard server...${NC}"
echo -e "${YELLOW}Open http://localhost:3000 in browser${NC}"
echo ""
echo -e "${GREEN}$ npm run dashboard:dev${NC}"
echo ""
echo -e "${YELLOW}(Dashboard would start here - Ctrl+C to stop)${NC}"
pause

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 10: Documentation
# ═══════════════════════════════════════════════════════════════════════════════
section "10. DOCUMENTATION"

echo -e "${BLUE}Trust Assumptions Document...${NC}"
run_cmd "head -60 TRUST_ASSUMPTIONS_FREEZE.md"
pause

echo -e "${BLUE}Mainnet Launch Checklist...${NC}"
run_cmd "head -60 MAINNET_LAUNCH_CHECKLIST.md"
pause

# ═══════════════════════════════════════════════════════════════════════════════
# FINALE
# ═══════════════════════════════════════════════════════════════════════════════
clear
echo -e "${GREEN}"
cat << "EOF"

   ╔═══════════════════════════════════════════════════════════════╗
   ║                                                               ║
   ║   ███████╗ ██████╗ ██╗    ██╗   ██╗ ██████╗ ██╗██████╗        ║
   ║   ██╔════╝██╔═══██╗██║    ██║   ██║██╔═══██╗██║██╔══██╗       ║
   ║   ███████╗██║   ██║██║    ██║   ██║██║   ██║██║██║  ██║       ║
   ║   ╚════██║██║   ██║██║    ╚██╗ ██╔╝██║   ██║██║██║  ██║       ║
   ║   ███████║╚██████╔╝███████╗╚████╔╝ ╚██████╔╝██║██████╔╝       ║
   ║   ╚══════╝ ╚═════╝ ╚══════╝ ╚═══╝   ╚═════╝ ╚═╝╚═════╝        ║
   ║                                                               ║
   ║               DEMO COMPLETE - Thank you!                      ║
   ║                                                               ║
   ║   Features Demonstrated:                                      ║
   ║   ✓ TypeScript SDK & CLI                                      ║
   ║   ✓ Rust/Anchor Solana Program                                ║
   ║   ✓ ZK Circuits (Groth16)                                     ║
   ║   ✓ Privacy Ghost Score                                       ║
   ║   ✓ Atomic Rescue Engine                                      ║
   ║   ✓ Security Test Suite                                       ║
   ║   ✓ Circuit Breaker & Economics                               ║
   ║   ✓ Production Documentation                                  ║
   ║                                                               ║
   ╚═══════════════════════════════════════════════════════════════╝

EOF
echo -e "${NC}"
echo ""
echo -e "${CYAN}  SolVoid v1.3.0 - Privacy Lifecycle Management${NC}"
echo ""
