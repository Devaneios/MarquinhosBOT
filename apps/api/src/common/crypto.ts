import { Injectable } from '@nestjs/common';
import { AppConfig } from 'config/app.config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

export interface TokenCipherConfig {
  secret?: string;
  salt?: string;
}

// scrypt blocks the event loop for tens of milliseconds, and every request
// with a bearer token reaches decryption, so the derived key is reused
// until the secret or salt changes.
let derivedKey: { secret: string; salt: string; key: Buffer } | null = null;

function getKey(config: TokenCipherConfig): Buffer {
  const secret = config.secret;
  if (!secret) throw new Error('MARQUINHOS_SECRET_KEY is not set');
  // Accept a 64-char hex string as a raw 32-byte key; otherwise derive via scrypt
  if (/^[0-9a-f]{64}$/i.test(secret)) return Buffer.from(secret, 'hex');
  const salt = config.salt ?? 'marquinhos-salt';
  if (derivedKey?.secret !== secret || derivedKey.salt !== salt) {
    derivedKey = { secret, salt, key: scryptSync(secret, salt, 32) };
  }
  return derivedKey.key;
}

const ALGORITHM = 'aes-256-gcm';

export function encryptToken(
  token: string,
  expiresAt: number | undefined,
  config: TokenCipherConfig,
): string | null {
  try {
    const key = getKey(config);
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const plaintext =
      expiresAt !== undefined
        ? JSON.stringify({ t: token, e: expiresAt })
        : token;
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    // Format: base64(iv):base64(gcmTag):base64(ciphertext)
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  } catch {
    return null;
  }
}

function decryptRaw(
  encryptedToken: string,
  config: TokenCipherConfig,
): string | null {
  try {
    const key = getKey(config);
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, ciphertextB64] = parts;
    if (!ivB64 || !tagB64 || !ciphertextB64) return null;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    if (iv.length !== 12 || tag.length !== 16) return null;
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: 16,
    });
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Covers: auth-tag mismatch (tampered), wrong format, missing secret
    return null;
  }
}

export function decryptToken(
  encryptedToken: string,
  config: TokenCipherConfig,
): string | null {
  const raw = decryptRaw(encryptedToken, config);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.t === 'string') return parsed.t;
  } catch {
    // not JSON — legacy plain-string token
  }
  return raw;
}

export function decryptTokenFull(
  encryptedToken: string,
  config: TokenCipherConfig,
): { token: string; expiresAt?: number } | null {
  const raw = decryptRaw(encryptedToken, config);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.t === 'string') {
      return {
        token: parsed.t,
        expiresAt: typeof parsed.e === 'number' ? parsed.e : undefined,
      };
    }
  } catch {
    // not JSON — legacy plain-string token, no expiry
  }
  return { token: raw };
}

@Injectable()
export class TokenCipherService {
  constructor(private readonly config: AppConfig) {}

  encryptToken(token: string, expiresAt?: number): string | null {
    return encryptToken(token, expiresAt, this.configValues);
  }

  decryptToken(encryptedToken: string): string | null {
    return decryptToken(encryptedToken, this.configValues);
  }

  decryptTokenFull(
    encryptedToken: string,
  ): { token: string; expiresAt?: number } | null {
    return decryptTokenFull(encryptedToken, this.configValues);
  }

  private get configValues(): TokenCipherConfig {
    return {
      secret: this.config.marquinhosSecretKey,
      salt: this.config.marquinhosCryptoSalt,
    };
  }
}
