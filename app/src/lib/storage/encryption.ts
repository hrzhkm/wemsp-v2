import crypto from 'node:crypto'

/**
 * WEMSP encryption library.
 *
 * Storage-agnostic, DB-agnostic, server-only. Provides a two-tier scheme:
 *
 *  Tier 1 — Document cipher: AES-256-GCM encrypt/decrypt over a Buffer, using the
 *           on-disk layout [IV 12B][AuthTag 16B][Ciphertext]. This format is
 *           cross-compatible with the DLP reference implementation.
 *
 *  Tier 2 — FEK management: a random 32-byte File Encryption Key (FEK) that
 *           directly encrypts documents and never changes. The FEK is never
 *           stored in plaintext; it is wrapped under a wrapping key (KEK) derived
 *           via scrypt from a knowledge factor (the answer to the user's personal
 *           security question). Changing the secret only re-wraps the FEK, so
 *           previously encrypted documents stay decryptable.
 *
 * This module never logs or returns key material, secrets, or plaintext in errors.
 */

export const ALGORITHM = 'aes-256-gcm'
export const KEY_BYTES = 32
export const IV_BYTES = 12
export const AUTH_TAG_BYTES = 16
export const SALT_BYTES = 16
export const KEY_VERSION = 1

// scrypt cost parameters. maxmem must be large enough to fit N.
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const

export type EncryptionErrorCode =
  | 'INVALID_KEY_LENGTH'
  | 'INVALID_PAYLOAD'
  | 'DECRYPTION_FAILED'
  | 'UNWRAP_FAILED'
  | 'EMPTY_SECRET'

/**
 * Typed error so callers can branch on `code` without string matching.
 * Messages intentionally omit any key material, secrets, or plaintext.
 */
export class EncryptionError extends Error {
  readonly code: EncryptionErrorCode

  constructor(code: EncryptionErrorCode, message: string) {
    super(message)
    this.name = 'EncryptionError'
    this.code = code
  }
}

/**
 * A wrapped File Encryption Key. Field names map 1:1 to the reference DB columns
 * (wrapped_key, salt, iv, auth_tag, algorithm, key_version) for direct persistence.
 */
export interface WrappedKey {
  wrappedKey: Buffer
  salt: Buffer
  iv: Buffer
  authTag: Buffer
  algorithm: string
  keyVersion: number
}

function assertKeyLength(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new EncryptionError(
      'INVALID_KEY_LENGTH',
      `Key must be ${KEY_BYTES} bytes`,
    )
  }
}

// ---------------------------------------------------------------------------
// Tier 1 — Document cipher
// ---------------------------------------------------------------------------

/**
 * Encrypt a document buffer with a 32-byte FEK using AES-256-GCM.
 * @returns [IV 12B][AuthTag 16B][Ciphertext]
 */
export function encryptDocument(plaintext: Buffer, fek: Buffer): Buffer {
  assertKeyLength(fek)

  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, fek, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, ciphertext])
}

/**
 * Decrypt a buffer produced by {@link encryptDocument}. The GCM auth tag is
 * verified, so tampering or a wrong key throws DECRYPTION_FAILED.
 */
export function decryptDocument(encrypted: Buffer, fek: Buffer): Buffer {
  assertKeyLength(fek)

  if (encrypted.length < IV_BYTES + AUTH_TAG_BYTES) {
    throw new EncryptionError(
      'INVALID_PAYLOAD',
      'Encrypted payload is too short to contain IV and auth tag',
    )
  }

  const iv = encrypted.subarray(0, IV_BYTES)
  const authTag = encrypted.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES)
  const ciphertext = encrypted.subarray(IV_BYTES + AUTH_TAG_BYTES)

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, fek, iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch {
    throw new EncryptionError(
      'DECRYPTION_FAILED',
      'Failed to decrypt document (auth tag mismatch or wrong key)',
    )
  }
}

// ---------------------------------------------------------------------------
// Tier 2 — FEK management
// ---------------------------------------------------------------------------

/** Generate a fresh, cryptographically random 32-byte File Encryption Key. */
export function generateFek(): Buffer {
  return crypto.randomBytes(KEY_BYTES)
}

/**
 * Normalize a knowledge-factor secret so trivial formatting differences in the
 * user's answer do not break unwrapping. Applied identically on wrap and unwrap.
 */
function normalizeSecret(secret: string): string {
  const normalized = secret
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()

  if (normalized.length === 0) {
    throw new EncryptionError(
      'EMPTY_SECRET',
      'Knowledge-factor secret is empty after normalization',
    )
  }

  return normalized
}

/** Derive an ephemeral 32-byte wrapping key (KEK) from a secret and salt. */
function deriveWrappingKey(secret: string, salt: Buffer): Buffer {
  return crypto.scryptSync(
    normalizeSecret(secret),
    salt,
    KEY_BYTES,
    SCRYPT_PARAMS,
  )
}

/**
 * Wrap a FEK under a wrapping key derived from `secret`. The wrapping key is
 * ephemeral and never returned or persisted.
 */
export function wrapFek(fek: Buffer, secret: string): WrappedKey {
  assertKeyLength(fek)

  const salt = crypto.randomBytes(SALT_BYTES)
  const iv = crypto.randomBytes(IV_BYTES)
  const kek = deriveWrappingKey(secret, salt)

  const cipher = crypto.createCipheriv(ALGORITHM, kek, iv)
  const wrappedKey = Buffer.concat([cipher.update(fek), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    wrappedKey,
    salt,
    iv,
    authTag,
    algorithm: ALGORITHM,
    keyVersion: KEY_VERSION,
  }
}

/**
 * Recover the plaintext FEK from a {@link WrappedKey} using `secret`. A wrong
 * secret or corrupt wrapped key throws UNWRAP_FAILED.
 */
export function unwrapFek(wrapped: WrappedKey, secret: string): Buffer {
  const kek = deriveWrappingKey(secret, wrapped.salt)

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, kek, wrapped.iv)
    decipher.setAuthTag(wrapped.authTag)
    const fek = Buffer.concat([
      decipher.update(wrapped.wrappedKey),
      decipher.final(),
    ])
    assertKeyLength(fek)
    return fek
  } catch (err) {
    if (err instanceof EncryptionError) throw err
    throw new EncryptionError(
      'UNWRAP_FAILED',
      'Failed to unwrap FEK (wrong secret or corrupt wrapped key)',
    )
  }
}

/**
 * Re-wrap a FEK under a new secret when the user changes their security answer.
 * The underlying FEK is unchanged, so existing documents remain decryptable.
 */
export function rewrapFek(
  wrapped: WrappedKey,
  oldSecret: string,
  newSecret: string,
): WrappedKey {
  const fek = unwrapFek(wrapped, oldSecret)
  return wrapFek(fek, newSecret)
}
