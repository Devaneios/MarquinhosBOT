export function getTokenCipherConfig() {
  return {
    secret: process.env.MARQUINHOS_SECRET_KEY,
    salt: process.env.MARQUINHOS_CRYPTO_SALT,
  };
}
