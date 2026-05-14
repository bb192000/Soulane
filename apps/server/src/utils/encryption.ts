import crypto from 'crypto';

export class CryptoError extends Error {
  constructor(public code: 'MISSING_KEY' | 'INVALID_KEY_LENGTH' | 'MALFORMED_PAYLOAD' | 'DECRYPTION_FAILED', message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

const ALGORITHM = 'aes-256-gcm';
const CURRENT_VERSION = 'v1';

function getEncryptionKey(): Buffer {
  const keyBase64 = process.env.ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new CryptoError('MISSING_KEY', 'ENCRYPTION_KEY environment variable is missing.');
  }

  const keyBuffer = Buffer.from(keyBase64, 'base64');
  if (keyBuffer.length !== 32) {
    throw new CryptoError('INVALID_KEY_LENGTH', 'ENCRYPTION_KEY must be exactly 32 bytes when decoded from base64.');
  }

  return keyBuffer;
}

export function encrypt(text: string, aadContext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Bind context using Associated Authenticated Data
  cipher.setAAD(Buffer.from(aadContext, 'utf8'));

  let encrypted = cipher.update(text, 'utf8', 'base64url');
  encrypted += cipher.final('base64url');
  
  const authTag = cipher.getAuthTag().toString('base64url');
  
  // Format: v1.iv.authTag.ciphertext
  return `${CURRENT_VERSION}.${iv.toString('base64url')}.${authTag}.${encrypted}`;
}

export function decrypt(payload: string, aadContext: string): string {
  const parts = payload.split('.');
  
  if (parts.length !== 4) {
    throw new CryptoError('MALFORMED_PAYLOAD', 'Invalid encrypted payload format. Expected 4 segments.');
  }

  const [version, ivBase64, authTagBase64, encryptedBase64] = parts;

  if (version !== CURRENT_VERSION) {
    // Future handling for key rotation / different versions
    throw new CryptoError('DECRYPTION_FAILED', `Unsupported crypto version: ${version}`);
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivBase64, 'base64url');
    const authTag = Buffer.from(authTagBase64, 'base64url');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    // Validate bound context
    decipher.setAAD(Buffer.from(aadContext, 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedBase64, 'base64url', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new CryptoError('DECRYPTION_FAILED', 'Failed to decrypt payload or context validation failed.');
  }
}
