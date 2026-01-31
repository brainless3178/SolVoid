// ============================================================================
// ENVIRONMENT VALIDATION UTILITY
// Validates required environment variables and provides defaults
// ============================================================================

import * as dotenv from 'dotenv';

dotenv.config();

interface OptionalVarConfig {
  default: string;
  description: string;
  validator?: (value: string) => boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config: Record<string, string>;
}

class EnvironmentValidator {
  private requiredVars: string[];
  private optionalVars: Record<string, OptionalVarConfig>;
  private validationErrors: string[];
  private warnings: string[];

  constructor() {
    this.requiredVars = [
      'SOLANA_RPC_MAINNET',
      'ZK_PROGRAM_ID'
    ];

    this.optionalVars = {
      'ALCHEMY_API_KEY': {
        default: '',
        description: 'Alchemy API key for premium RPC access'
      },
      'THREAT_INTEL_API_KEY': {
        default: '',
        description: 'Threat intelligence API key'
      },
      'JUPITER_API_KEY': {
        default: '',
        description: 'Jupiter API key for price oracle'
      },
      'SOLANA_RPC_BACKUP_1': {
        default: 'https://solana-api.projectserum.com',
        description: 'First backup RPC endpoint'
      },
      'SOLANA_RPC_BACKUP_2': {
        default: 'https://rpc.ankr.com/solana',
        description: 'Second backup RPC endpoint'
      },
      'SOLANA_RPC_BACKUP_3': {
        default: '',
        description: 'Third backup RPC endpoint (Alchemy)'
      },
      'MERKLE_TREE_LEVELS': {
        default: '8',
        description: 'Merkle tree levels for ZK commitments',
        validator: (value: string) => {
          const num = parseInt(value);
          return num >= 8 && num <= 30;
        }
      },
      'MAX_RETRY_ATTEMPTS': {
        default: '5',
        description: 'Maximum retry attempts for failed transactions',
        validator: (value: string) => {
          const num = parseInt(value);
          return num >= 1 && num <= 10;
        }
      },
      'TRANSACTION_TIMEOUT_MS': {
        default: '60000',
        description: 'Transaction timeout in milliseconds',
        validator: (value: string) => {
          const num = parseInt(value);
          return num >= 10000 && num <= 300000;
        }
      },
      'COMPUTE_UNIT_LIMIT': {
        default: '1400000',
        description: 'Compute unit limit for large transactions',
        validator: (value: string) => {
          const num = parseInt(value);
          return num >= 200000 && num <= 14000000;
        }
      },
      'PRIORITY_FEE_LAMPORTS': {
        default: '50000',
        description: 'Priority fee in lamports for faster execution',
        validator: (value: string) => {
          const num = parseInt(value);
          return num >= 1000 && num <= 1000000;
        }
      },
      'MAX_PARALLEL_SCANS': {
        default: '10',
        description: 'Maximum parallel asset scans',
        validator: (value: string) => {
          const num = parseInt(value);
          return num >= 1 && num <= 50;
        }
      },
      'SCAN_BATCH_SIZE': {
        default: '50',
        description: 'Batch size for token account scanning',
        validator: (value: string) => {
          const num = parseInt(value);
          return num >= 10 && num <= 200;
        }
      },
      'ENABLE_AUDIT_LOGGING': {
        default: 'true',
        description: 'Enable audit logging',
        validator: (value: string) => ['true', 'false'].includes(value.toLowerCase())
      },
      'LOG_RETENTION_DAYS': {
        default: '90',
        description: 'Log retention period in days',
        validator: (value: string) => {
          const num = parseInt(value);
          return num >= 1 && num <= 365;
        }
      },
      'ENABLE_MONITORING': {
        default: 'true',
        description: 'Enable real-time monitoring',
        validator: (value: string) => ['true', 'false'].includes(value.toLowerCase())
      },
      'ALERT_WEBHOOK_URL': {
        default: '',
        description: 'Webhook URL for alerts (optional)'
      },
      'ALERT_EMAIL': {
        default: '',
        description: 'Email for alerts (optional)',
        validator: (value: string) => {
          if (!value) return true; // Optional
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(value);
        }
      },
      'USE_DEVNET': {
        default: 'false',
        description: 'Use devnet instead of mainnet for testing',
        validator: (value: string) => ['true', 'false'].includes(value.toLowerCase())
      },
      'DEBUG_MODE': {
        default: 'false',
        description: 'Enable debug mode for detailed logging',
        validator: (value: string) => ['true', 'false'].includes(value.toLowerCase())
      },
      'SKIP_ZK_PROOFS': {
        default: 'false',
        description: 'Skip ZK proof generation for faster testing (dev only)',
        validator: (value: string) => ['true', 'false'].includes(value.toLowerCase())
      }
    };

    this.validationErrors = [];
    this.warnings = [];
  }

  validate(): ValidationResult {
    this.validationErrors = [];
    this.warnings = [];

    // Check required variables
    const validatedConfig: Record<string, string> = {};
    for (const varName of this.requiredVars) {
      const value = process.env[varName];
      if (!value || value.trim() === '') {
        this.validationErrors.push(`Required environment variable ${varName} is missing or empty`);
      } else {
        validatedConfig[varName] = value;
      }
    }

    // Check optional variables and apply defaults
    for (const [varName, config] of Object.entries(this.optionalVars)) {
      const value = process.env[varName];

      if (!value || value.trim() === '') {
        if (value === '' && config.default === '') {
          // Empty string is acceptable for variables with empty default
          validatedConfig[varName] = value;
        } else {
          validatedConfig[varName] = config.default;
          if (value !== undefined) {
            this.warnings.push(`Using default value for ${varName}: ${config.default}`);
          }
        }
      } else {
        // Validate the provided value
        if (config.validator && !config.validator(value)) {
          this.validationErrors.push(`Invalid value for ${varName}: ${value}. Expected: ${config.description}`);
          validatedConfig[varName] = config.default;
        } else {
          validatedConfig[varName] = value;
        }
      }
    }

    return {
      isValid: this.validationErrors.length === 0,
      errors: this.validationErrors,
      warnings: this.warnings,
      config: validatedConfig
    };
  }

  printValidation(): ValidationResult {
    const result = this.validate();

    console.log('\n Environment Validation Results:');
    console.log('=====================================');

    if (result.isValid) {
      console.log(' All environment variables are valid!');
    } else {
      console.log(' Validation errors found:');
      result.errors.forEach(error => console.log(`   - ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('\n  Warnings:');
      result.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    console.log('\n Configuration Summary:');
    for (const [key, value] of Object.entries(result.config)) {
      if (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN')) {
        console.log(`   ${key}: [REDACTED]`);
      } else {
        console.log(`   ${key}: ${value}`);
      }
    }

    console.log('=====================================\n');

    return result;
  }
}

export { EnvironmentValidator };
