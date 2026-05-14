import crypto from 'crypto';

export class ShadowSecurity {
  private static ALGORITHM = 'aes-256-cbc';
  private static MASTER_SEED = '7860_SENTINEL_PROTECTION'; // Derived from Founder Passkey

  static encrypt(text: string): { iv: string; data: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.ALGORITHM, Buffer.from(this.MASTER_SEED.padEnd(32)), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
      iv: iv.toString('hex'),
      data: encrypted.toString('hex')
    };
  }

  static decrypt(iv: string, data: string): string {
    const decipher = crypto.createDecipheriv(this.ALGORITHM, Buffer.from(this.MASTER_SEED.padEnd(32)), Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(Buffer.from(data, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }
}
