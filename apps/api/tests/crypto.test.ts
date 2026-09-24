import { afterEach, describe, expect, it } from 'bun:test';
import { decryptToken, decryptTokenFull, encryptToken } from 'utils/crypto';

const originalSecret = process.env.MARQUINHOS_SECRET_KEY;

afterEach(() => {
  process.env.MARQUINHOS_SECRET_KEY = originalSecret;
});

describe('token encryption with a passphrase secret', () => {
  it('round-trips a token', () => {
    process.env.MARQUINHOS_SECRET_KEY = 'passphrase-one';
    const encrypted = encryptToken('discord-access')!;
    expect(decryptToken(encrypted)).toBe('discord-access');
  });

  it('stops accepting tokens once the secret changes', () => {
    process.env.MARQUINHOS_SECRET_KEY = 'passphrase-one';
    const encrypted = encryptToken('discord-access')!;
    process.env.MARQUINHOS_SECRET_KEY = 'passphrase-two';
    expect(decryptToken(encrypted)).toBeNull();
  });

  // Unauthenticated requests reach decryption, so deriving the key (scrypt,
  // ~50ms) per call would let anyone stall the event loop.
  it('derives the key once, not per call', () => {
    process.env.MARQUINHOS_SECRET_KEY = 'passphrase-three';
    const started = performance.now();
    for (let i = 0; i < 20; i++) decryptTokenFull('a:b:c');
    expect(performance.now() - started).toBeLessThan(500);
  });
});
