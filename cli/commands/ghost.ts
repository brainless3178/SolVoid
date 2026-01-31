import { Command } from 'commander';
import { PublicKey } from '@solana/web3.js';
import { SolVoidClient } from '../../sdk/client';
import { GhostScoreCalculator } from '../utils/ghost-calculator';
import { GhostArt } from '../utils/ghost-art';
import { BadgeGenerator } from '../utils/badge-generator';
import chalk from 'chalk';

/**
 * Registry for the Privacy Ghost Score command suite.
 * Provides visual privacy metrics and ZK-verified reputation artifacts.
 */
export function registerGhostCommand(program: Command) {
  program
    .command('ghost')
    .description('Generate Privacy Ghost Score and ZK-verified reputation artifacts')
    .argument('<address>', 'Wallet address for privacy analysis')
    .option('--badge', 'Generate a cryptographically verifiable privacy badge')
    .option('--json', 'Return raw score data in JSON format')
    .option('--share', 'Generate social metadata and sharing strings')
    .option('--verify <proof>', 'Validate an external ZK privacy proof')
    .action(async (address: string, options) => {
      try {
        if (options.verify) {
          handleProofVerification(options.verify);
          return;
        }

        console.log(chalk.cyan(' Initiating wallet privacy analysis...\n'));

        /** Use standardized protocol configuration from global options. */
        const client = new SolVoidClient(
          {
            rpcUrl: program.opts().rpc || 'https://api.mainnet-beta.solana.com',
            programId: program.opts().program || 'Fg6PaFpoGXkYsidMpSsu3SWJYEHp7rQU9YSTFNDQ4F5i',
            relayerUrl: program.opts().relayer || 'http://localhost:3000'
          },
          {} as any
        );

        console.log(chalk.gray('   Scanning transaction history for anonymity leaks...'));
        const scanResults = await client.protect(new PublicKey(address));

        console.log(chalk.gray('   Executing Ghost Score calculation logic...'));
        const ghostScore = GhostScoreCalculator.calculate(scanResults);

        console.log(chalk.gray('   Finalizing visual report generation...\n'));

        if (options.json) {
          console.log(JSON.stringify({
            address,
            ghostScore,
            timestamp: Date.now(),
            scanResults
          }, null, 2));
          return;
        }

        /** Render terminal-optimized visualization of privacy metrics. */
        console.log(GhostArt.formatGhostScore(ghostScore));

        if (options.badge || options.share) {
          await handleBadgeGeneration(address, ghostScore, options.share);
        }

        console.log(chalk.cyan('\n Protocol Recommendations:'));
        if (ghostScore.score < 70) {
          console.log(chalk.yellow('   Shielding additional transactions is recommended to increase anonymity set.'));
          console.log(chalk.yellow('   Execution: solvoid shield <amount>'));
        } else {
          console.log(chalk.green('   Privacy threshold met. ZK badge generation is recommended.'));
          console.log(chalk.green('   Execution: solvoid ghost <address> --badge --share'));
        }

      } catch (error: any) {
        console.error(chalk.red('\n Critical error during score generation:'), error.message);
        console.error(chalk.gray('\nDiagnostic Checklist:'));
        console.error(chalk.gray('  • Verify target address format (Base58)'));
        console.error(chalk.gray('  • Verify RPC endpoint connectivity'));
        console.error(chalk.gray('  • Attempt retry with custom --rpc override'));
        process.exit(1);
      }
    });
}

/**
 * Orchestrates cryptographically verifiable badge generation.
 */
async function handleBadgeGeneration(
  address: string,
  ghostScore: any,
  showShare: boolean
): Promise<void> {
  console.log(chalk.cyan('\n Initializing ZK Privacy Badge generation...\n'));

  const badge = await BadgeGenerator.generate(address, ghostScore);

  console.log(GhostArt.formatBadge(badge));

  if (showShare) {
    console.log(chalk.bold(' Social Metadata (X/Twitter):'));
    console.log(chalk.gray(''.repeat(60)));
    console.log(chalk.blue(badge.twitterText));
    console.log(chalk.gray(''.repeat(60)));
    console.log();

    console.log(chalk.bold(' Integration Metadata (Discord):'));
    console.log(chalk.gray(''.repeat(60)));
    console.log(badge.discordText);
    console.log(chalk.gray(''.repeat(60)));
    console.log();

    console.log(chalk.bold(' ZK Privacy Proof:'));
    console.log(chalk.gray(''.repeat(60)));
    console.log(chalk.gray(badge.proofData.slice(0, 80) + '...'));
    console.log(chalk.dim('\n(Cryptographic attestation of score threshold.'));
    console.log(chalk.dim('Does not reveal identity-linked data)'));
    console.log(chalk.gray(''.repeat(60)));
    console.log();

    console.log(chalk.cyan(' Verification Protocol:'));
    console.log(`Third-party verification available via:`);
    console.log(chalk.green(`solvoid ghost --verify "${badge.proofData.slice(0, 40)}..."`));
    console.log();
  }
}

/**
 * Validates the cryptographic integrity of a privacy badge.
 */
function handleProofVerification(proofData: string): void {
  console.log(chalk.cyan('\n Executing ZK Proof Verification...\n'));

  const verification = BadgeGenerator.verifyBadge(proofData);

  if (verification) {
    console.log(chalk.green(' Proof Status: VALID\n'));
    console.log(chalk.bold('Attestation Details:'));
    console.log(`  Verification State: ${chalk.cyan('SUCCESSFUL')}`);
    console.log(chalk.green('A wallet holder has proven their privacy score range'));
    console.log(chalk.green('without exposing identity-linked transaction history.'));
  } else {
    console.log(chalk.red(' Proof Status: INVALID or EXPIRED\n'));
    console.log(chalk.yellow('Failure Modes:'));
    console.log('  • Data corruption identified in proof payload');
    console.log('  • Proof integrity compromised via tampering');
  }

  console.log();
}

/**
 * Provides technical documentation for the ghost command module.
 */
export function getGhostCommandHelp(): string {
  return `
${chalk.bold.cyan('Privacy Ghost Scoring System')}

Executes a comprehensive privacy analysis (0-100) of the target wallet.

${chalk.bold('Implementation:')}
  solvoid ghost <address>              Execute basic analysis
  solvoid ghost <address> --badge      Generate ZK-verified badge
  solvoid ghost <address> --share      Generate sharing metadata
  solvoid ghost <address> --json       Return raw automation data
  solvoid ghost --verify <proof>       Validate external proof

${chalk.bold('Examples:')}
  # Core Analysis
  solvoid ghost 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM

  # Reputation Generation
  solvoid ghost 9WzDXw... --badge

${chalk.bold('Anonymity Thresholds:')}
  90-100  ${chalk.green(' Invisible')}   - Maximum anonymity set
  70-89   ${chalk.cyan('  Translucent')} - High privacy standard
  50-69   ${chalk.yellow('  Visible')}     - Minimal protection confirmed
  30-49   ${chalk.red(' Exposed')}     - Privacy leaks detected
  0-29    ${chalk.red.bold(' Glass House')} - Critical identity linkage
`;
}
