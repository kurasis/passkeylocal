/**
 * Replaces Node's `crypto` module in the browser bundle. kdbxweb uses WebCrypto
 * whenever `crypto.subtle` exists (always, in a secure context); reaching any
 * of these functions means WebCrypto is missing, so fail closed.
 */
function unavailable(): never {
  throw new Error('WebCrypto is required');
}
export const createHash = unavailable;
export const createHmac = unavailable;
export const createCipheriv = unavailable;
export const createDecipheriv = unavailable;
export const randomBytes = unavailable;
export default { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes };
