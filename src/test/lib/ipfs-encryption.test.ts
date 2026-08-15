import { describe, expect, it } from 'vitest'
import {
  decryptIpfsEnvelope,
  encryptForIpfs,
  getIpfsEncryptionKeyFromEnv,
  parseIpfsEncryptionKey,
} from '@/lib/storage/ipfsEncryption'

const KEY = Buffer.alloc(32, 7).toString('base64')

describe('IPFS encryption envelope', () => {
  it('encrypts JSON into a versioned envelope without plaintext', () => {
    const plaintext = Buffer.from(JSON.stringify({ secret: 'agreement-a1' }))

    const envelope = encryptForIpfs(plaintext, {
      key: parseIpfsEncryptionKey(KEY),
      contentType: 'application/json',
    })

    expect(envelope.version).toBe(1)
    expect(envelope.algorithm).toBe('aes-256-gcm')
    expect(envelope.keyRef).toBe('server:v1')
    expect(envelope.contentType).toBe('application/json')
    expect(JSON.stringify(envelope)).not.toContain('agreement-a1')
  })

  it('decrypts an envelope with the same server key', () => {
    const plaintext = Buffer.from('sensitive metadata')
    const key = parseIpfsEncryptionKey(KEY)
    const envelope = encryptForIpfs(plaintext, {
      key,
      contentType: 'text/plain',
    })

    const decrypted = decryptIpfsEnvelope(envelope, key)

    expect(decrypted.equals(plaintext)).toBe(true)
  })

  it('accepts a 32-byte hex key', () => {
    const key = parseIpfsEncryptionKey(Buffer.alloc(32, 3).toString('hex'))

    expect(key.length).toBe(32)
  })

  it('rejects server keys that are not 32 bytes', () => {
    expect(() =>
      parseIpfsEncryptionKey(Buffer.alloc(16).toString('base64')),
    ).toThrowError(/32 bytes/)
  })

  it('fails closed when IPFS_ENCRYPTION_KEY is missing', () => {
    const previous = process.env.IPFS_ENCRYPTION_KEY
    delete process.env.IPFS_ENCRYPTION_KEY

    try {
      expect(() => getIpfsEncryptionKeyFromEnv()).toThrowError(
        /IPFS_ENCRYPTION_KEY/,
      )
    } finally {
      if (previous === undefined) {
        delete process.env.IPFS_ENCRYPTION_KEY
      } else {
        process.env.IPFS_ENCRYPTION_KEY = previous
      }
    }
  })
})
