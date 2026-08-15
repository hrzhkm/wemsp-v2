import { describe, expect, it } from 'vitest'
import type {WrappedKey} from '@/lib/storage/encryption';
import {
  AUTH_TAG_BYTES,
  EncryptionError,
  IV_BYTES,
  KEY_BYTES,
  
  decryptDocument,
  encryptDocument,
  generateFek,
  rewrapFek,
  unwrapFek,
  wrapFek
} from '@/lib/storage/encryption'

const SECRET = 'My first pet was named Rex'

describe('encryption — Tier 1 document cipher', () => {
  it('round-trips a document through encrypt then decrypt', () => {
    const fek = generateFek()
    const plaintext = Buffer.from('sensitive agreement contents', 'utf8')

    const encrypted = encryptDocument(plaintext, fek)
    const decrypted = decryptDocument(encrypted, fek)

    expect(decrypted.equals(plaintext)).toBe(true)
  })

  it('produces output with the [IV][AuthTag][Ciphertext] layout', () => {
    const fek = generateFek()
    const plaintext = Buffer.from('abc', 'utf8')

    const encrypted = encryptDocument(plaintext, fek)

    // ciphertext length for GCM equals plaintext length
    expect(encrypted.length).toBe(IV_BYTES + AUTH_TAG_BYTES + plaintext.length)
  })

  it('uses a random IV per call so ciphertext differs', () => {
    const fek = generateFek()
    const plaintext = Buffer.from('same input', 'utf8')

    const a = encryptDocument(plaintext, fek)
    const b = encryptDocument(plaintext, fek)

    expect(a.equals(b)).toBe(false)
  })

  it('throws DECRYPTION_FAILED when ciphertext is tampered with', () => {
    const fek = generateFek()
    const encrypted = encryptDocument(Buffer.from('tamper me'), fek)

    // flip a byte in the ciphertext region
    encrypted[IV_BYTES + AUTH_TAG_BYTES] ^= 0xff

    expect(() => decryptDocument(encrypted, fek)).toThrowError(
      expect.objectContaining({ code: 'DECRYPTION_FAILED' }),
    )
  })

  it('throws DECRYPTION_FAILED when decrypting with the wrong key', () => {
    const encrypted = encryptDocument(Buffer.from('secret'), generateFek())
    const wrongKey = generateFek()

    expect(() => decryptDocument(encrypted, wrongKey)).toThrowError(
      expect.objectContaining({ code: 'DECRYPTION_FAILED' }),
    )
  })

  it('throws INVALID_KEY_LENGTH when the key is not 32 bytes', () => {
    const shortKey = Buffer.alloc(16)

    expect(() => encryptDocument(Buffer.from('x'), shortKey)).toThrowError(
      expect.objectContaining({ code: 'INVALID_KEY_LENGTH' }),
    )
  })

  it('throws INVALID_PAYLOAD when the encrypted buffer is too short', () => {
    const fek = generateFek()
    const tooShort = Buffer.alloc(IV_BYTES + AUTH_TAG_BYTES - 1)

    expect(() => decryptDocument(tooShort, fek)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PAYLOAD' }),
    )
  })
})

describe('encryption — Tier 2 FEK management', () => {
  it('generates a 32-byte random FEK', () => {
    const a = generateFek()
    const b = generateFek()

    expect(a.length).toBe(KEY_BYTES)
    expect(a.equals(b)).toBe(false)
  })

  it('wraps then unwraps a FEK back to the original', () => {
    const fek = generateFek()

    const wrapped = wrapFek(fek, SECRET)
    const unwrapped = unwrapFek(wrapped, SECRET)

    expect(unwrapped.equals(fek)).toBe(true)
  })

  it('produces a WrappedKey with reference-shaped fields', () => {
    const wrapped: WrappedKey = wrapFek(generateFek(), SECRET)

    expect(wrapped.salt.length).toBeGreaterThan(0)
    expect(wrapped.iv.length).toBe(IV_BYTES)
    expect(wrapped.authTag.length).toBe(AUTH_TAG_BYTES)
    expect(wrapped.algorithm).toBe('aes-256-gcm')
    expect(wrapped.keyVersion).toBe(1)
  })

  it('throws UNWRAP_FAILED when unwrapping with the wrong secret', () => {
    const wrapped = wrapFek(generateFek(), SECRET)

    expect(() => unwrapFek(wrapped, 'a different answer')).toThrowError(
      expect.objectContaining({ code: 'UNWRAP_FAILED' }),
    )
  })

  it('normalizes the secret so casing/spacing differences still unwrap', () => {
    const fek = generateFek()
    const wrapped = wrapFek(fek, '  My First Pet Was Named REX ')

    const unwrapped = unwrapFek(wrapped, 'my first pet was named rex')

    expect(unwrapped.equals(fek)).toBe(true)
  })

  it.each([['empty string', ''], ['only whitespace', '   \t \n  ']])(
    'throws EMPTY_SECRET when wrapping with a %s secret',
    (_label, secret) => {
      expect(() => wrapFek(generateFek(), secret)).toThrowError(
        expect.objectContaining({ code: 'EMPTY_SECRET' }),
      )
    },
  )

  it('throws EMPTY_SECRET (not UNWRAP_FAILED) when unwrapping with an empty secret', () => {
    const wrapped = wrapFek(generateFek(), SECRET)

    expect(() => unwrapFek(wrapped, '   ')).toThrowError(
      expect.objectContaining({ code: 'EMPTY_SECRET' }),
    )
  })
})

describe('encryption — re-wrap on secret change', () => {
  it('preserves the FEK across a re-wrap and keeps documents decryptable', () => {
    const fek = generateFek()
    const document = Buffer.from('agreement that must survive a secret change')
    const encrypted = encryptDocument(document, fek)

    const wrapped = wrapFek(fek, SECRET)
    const rewrapped = rewrapFek(wrapped, SECRET, 'A brand new answer')

    // old secret no longer works
    expect(() => unwrapFek(rewrapped, SECRET)).toThrowError(
      expect.objectContaining({ code: 'UNWRAP_FAILED' }),
    )

    // FEK recovered via new secret is identical and still decrypts the document
    const recovered = unwrapFek(rewrapped, 'A brand new answer')
    expect(recovered.equals(fek)).toBe(true)
    expect(decryptDocument(encrypted, recovered).equals(document)).toBe(true)
  })
})

describe('EncryptionError', () => {
  it('is an Error subclass carrying a code', () => {
    const err = new EncryptionError('INVALID_KEY_LENGTH', 'bad key')

    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('INVALID_KEY_LENGTH')
    expect(err.name).toBe('EncryptionError')
  })
})
