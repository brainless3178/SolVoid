#!/usr/bin/env node

// CRITICAL: Buffer polyfill must be applied BEFORE loading any modules
// This fixes the "@coral-xyz/anchor Expected Buffer" error
const { Buffer } = require('buffer');
if (typeof globalThis !== 'undefined' && !globalThis.Buffer) {
    globalThis.Buffer = Buffer;
}
if (typeof global !== 'undefined' && !global.Buffer) {
    global.Buffer = Buffer;
}

// CLI Entry Point for SolVoid Privacy Scanner
const cli = require('../dist/cli/solvoid-scan.js');

// Call main since require.main !== module when loaded via require
if (cli.main) {
    cli.main().catch((err) => {
        console.error('CLI Error:', err.message || err);
        process.exit(1);
    });
}
