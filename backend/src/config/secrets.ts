/**
 * Secret Management Service
 * 
 * This service provides a unified interface for fetching secrets from various sources.
 * Currently supports environment variables (default).
 * Can be extended to support HashiCorp Vault or AWS Secrets Manager.
 */

// Conditional import for AWS SDK (only loaded if needed)
let AWS: any;
try {
  AWS = require('aws-sdk');
} catch (e) {
  // AWS SDK not installed, will use environment variables
}

export interface SecretConfig {
  databaseUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  redisUrl?: string;
  // Add other secrets as needed
}

/**
 * Load secrets from environment variables (default)
 */
export async function loadSecretsFromEnv(): Promise<SecretConfig> {
  return {
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_SECRET || '',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
    redisUrl: process.env.REDIS_URL,
  };
}

/**
 * Load secrets from AWS Secrets Manager
 * Requires AWS credentials and region configuration
 */
export async function loadSecretsFromAWS(secretPrefix: string = 'ceodashboard'): Promise<SecretConfig> {
  const secretsManager = new AWS.SecretsManager({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  try {
    const [
      dbUrlSecret,
      jwtSecret,
      jwtRefreshSecret,
      redisSecret,
    ] = await Promise.all([
      secretsManager.getSecretValue({ SecretId: `${secretPrefix}/database-url` }).promise(),
      secretsManager.getSecretValue({ SecretId: `${secretPrefix}/jwt-secret` }).promise(),
      secretsManager.getSecretValue({ SecretId: `${secretPrefix}/jwt-refresh-secret` }).promise(),
      secretsManager.getSecretValue({ SecretId: `${secretPrefix}/redis-url` }).promise().catch(() => null),
    ]);

    return {
      databaseUrl: dbUrlSecret.SecretString || '',
      jwtSecret: jwtSecret.SecretString || '',
      jwtRefreshSecret: jwtRefreshSecret.SecretString || '',
      redisUrl: redisSecret?.SecretString,
    };
  } catch (error) {
    console.error('Failed to load secrets from AWS Secrets Manager:', error);
    throw new Error('Failed to load secrets from AWS Secrets Manager');
  }
}

/**
 * Load secrets from HashiCorp Vault
 * Requires Vault address, token, and secret path
 */
export async function loadSecretsFromVault(vaultPath: string = 'secret/ceodashboard'): Promise<SecretConfig> {
  // This is a placeholder implementation
  // Actual implementation would use node-vault or similar library
  const vault = {
    address: process.env.VAULT_ADDR || 'http://localhost:8200',
    token: process.env.VAULT_TOKEN || '',
  };

  try {
    // Placeholder - actual implementation would use vault API
    // const response = await axios.get(`${vault.address}/v1/${vaultPath}`, {
    //   headers: { 'X-Vault-Token': vault.token },
    // });
    // const data = response.data.data;

    console.warn('Vault integration not yet implemented, falling back to environment variables');
    return loadSecretsFromEnv();
  } catch (error) {
    console.error('Failed to load secrets from Vault:', error);
    throw new Error('Failed to load secrets from Vault');
  }
}

/**
 * Main function to load secrets based on configuration
 * Automatically selects the appropriate secret source
 */
export async function loadSecrets(): Promise<SecretConfig> {
  const secretSource = process.env.SECRET_SOURCE || 'env';

  switch (secretSource) {
    case 'aws':
      return loadSecretsFromAWS();
    case 'vault':
      return loadSecretsFromVault();
    case 'env':
    default:
      return loadSecretsFromEnv();
  }
}

/**
 * Validate that all required secrets are present
 */
export function validateSecrets(secrets: SecretConfig): boolean {
  const required = ['databaseUrl', 'jwtSecret', 'jwtRefreshSecret'];
  const missing = required.filter(key => !secrets[key as keyof SecretConfig]);

  if (missing.length > 0) {
    console.error(`Missing required secrets: ${missing.join(', ')}`);
    return false;
  }

  return true;
}

/**
 * Load and validate secrets on application startup
 */
export async function initializeSecrets(): Promise<SecretConfig> {
  try {
    const secrets = await loadSecrets();
    
    if (!validateSecrets(secrets)) {
      throw new Error('Secret validation failed');
    }

    // Set secrets in process.env for backward compatibility
    process.env.DATABASE_URL = secrets.databaseUrl;
    process.env.JWT_SECRET = secrets.jwtSecret;
    process.env.JWT_REFRESH_SECRET = secrets.jwtRefreshSecret;
    if (secrets.redisUrl) {
      process.env.REDIS_URL = secrets.redisUrl;
    }

    return secrets;
  } catch (error) {
    console.error('Failed to initialize secrets:', error);
    throw error;
  }
}
