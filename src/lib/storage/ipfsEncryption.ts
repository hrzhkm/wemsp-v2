import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const DEFAULT_KEY_REF = 'server:v1'

export interface IpfsEncryptionEnvelope {
  version: number
  algorithm: string
  keyRef: string
  contentType: string
  iv: string
  authTag: string
  ciphertext: string
}

export interface EncryptForIpfsOptions {
  key: Buffer
  contentType: string
  keyRef?: string
}

export class IpfsEncryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IpfsEncryptionError'
  }
}

function assertKeyLength(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new IpfsEncryptionError('IPFS encryption key must be 32 bytes')
  }
}

export function parseIpfsEncryptionKey(encodedKey: string): Buffer {
  const trimmed = encodedKey.trim()
  if (!trimmed) {
    throw new IpfsEncryptionError('IPFS_ENCRYPTION_KEY is required')
  }

  const key = /^[0-9a-fA-F]{64}$/.test(trimmed)
    ? Buffer.from(trimmed, 'hex')
    : Buffer.from(trimmed, 'base64')

  assertKeyLength(key)
  return key
}

export function getIpfsEncryptionKeyFromEnv(): Buffer {
  const key = process.env.IPFS_ENCRYPTION_KEY
  if (!key) {
    throw new IpfsEncryptionError('IPFS_ENCRYPTION_KEY is required')
  }
  return parseIpfsEncryptionKey(key)
}

export function encryptForIpfs(
  plaintext: Buffer,
  options: EncryptForIpfsOptions,
): IpfsEncryptionEnvelope {
  assertKeyLength(options.key)

  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, options.key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    version: 1,
    algorithm: ALGORITHM,
    keyRef: options.keyRef || DEFAULT_KEY_REF,
    contentType: options.contentType,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }
}

export function decryptIpfsEnvelope(
  envelope: IpfsEncryptionEnvelope,
  key: Buffer,
): Buffer {
  assertKeyLength(key)

  if (envelope.version !== 1 || envelope.algorithm !== ALGORITHM) {
    throw new IpfsEncryptionError('Unsupported IPFS encryption envelope')
  }

  try {
    const iv = Buffer.from(envelope.iv, 'base64')
    const authTag = Buffer.from(envelope.authTag, 'base64')
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64')

    if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
      throw new Error('Invalid envelope layout')
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch (error) {
    if (error instanceof IpfsEncryptionError) throw error
    throw new IpfsEncryptionError('Failed to decrypt IPFS envelope')
  }
}
