import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {WrappedKey} from '@/lib/storage/encryption';
import {
  configureDocumentEncryption,
  getDocumentRecoveryKey,
  normalizeDocumentAnswer,
  recoverDocumentFek,
  updateDocumentEncryption,
  validateDocumentAnswer,
  validateQuestionId,
} from '@/lib/storage/documentEncryption'
import {
  
  decryptDocument,
  encryptDocument,
  unwrapFek
} from '@/lib/storage/encryption'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/db', () => ({
  prisma: {
    userDocumentEncryptionKey: {
      create: mocks.create,
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}))

const ORIGINAL_RECOVERY_KEY = process.env.DOCUMENT_RECOVERY_KEY
const ANSWER = 'My first school was Sekolah Kebangsaan'

describe('document encryption key management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DOCUMENT_RECOVERY_KEY = Buffer.alloc(32, 7).toString('base64')
  })

  afterEach(() => {
    if (ORIGINAL_RECOVERY_KEY === undefined)
      delete process.env.DOCUMENT_RECOVERY_KEY
    else process.env.DOCUMENT_RECOVERY_KEY = ORIGINAL_RECOVERY_KEY
  })

  it('normalizes answers and rejects invalid inputs', () => {
    expect(normalizeDocumentAnswer('  MY  First\u00a0School  ')).toBe(
      'my first school',
    )
    expect(() => validateDocumentAnswer('too short')).toThrow()
    expect(() => validateDocumentAnswer('x'.repeat(129))).toThrow()
    expect(() => validateQuestionId('custom-question')).toThrow()
  })

  it.each([undefined, 'not-a-key'])(
    'fails closed for recovery key %s',
    (value) => {
      if (value === undefined) delete process.env.DOCUMENT_RECOVERY_KEY
      else process.env.DOCUMENT_RECOVERY_KEY = value
      expect(() => getDocumentRecoveryKey()).toThrow()
    },
  )

  it('stores two independent FEK wraps and recovers through the server key', async () => {
    let record: any
    mocks.create.mockImplementation(async ({ data }) => {
      record = data
      return { questionId: data.questionId, keyVersion: data.keyVersion }
    })

    await configureDocumentEncryption('user-1', 'firstSchool', ANSWER)
    expect(record.answerWrappedFek).not.toEqual(record.recoveryWrappedFek)
    mocks.findUnique.mockResolvedValue(record)
    const fek = await recoverDocumentFek('user-1')
    const wrapped: WrappedKey = {
      wrappedKey: Buffer.from(record.answerWrappedFek),
      salt: Buffer.from(record.answerSalt),
      iv: Buffer.from(record.answerIv),
      authTag: Buffer.from(record.answerAuthTag),
      algorithm: record.algorithm,
      keyVersion: record.keyVersion,
    }
    expect(unwrapFek(wrapped, ANSWER).equals(fek)).toBe(true)
  })

  it('changes the answer without changing the FEK or document readability', async () => {
    let record: any
    mocks.create.mockImplementation(async ({ data }) => {
      record = data
      return { questionId: data.questionId, keyVersion: data.keyVersion }
    })
    await configureDocumentEncryption('user-1', 'firstSchool', ANSWER)
    mocks.findUnique.mockResolvedValue(record)
    const fek = await recoverDocumentFek('user-1')
    const ciphertext = encryptDocument(Buffer.from('%PDF-existing'), fek)
    mocks.update.mockImplementation(async ({ data }) => {
      record = { ...record, ...data }
      return { questionId: data.questionId, keyVersion: record.keyVersion }
    })

    await updateDocumentEncryption(
      'user-1',
      ANSWER,
      'memorablePlace',
      'The old family home in Kuala Lumpur',
    )
    mocks.findUnique.mockResolvedValue(record)
    const recovered = await recoverDocumentFek('user-1')
    expect(recovered.equals(fek)).toBe(true)
    expect(decryptDocument(ciphertext, recovered).toString()).toBe(
      '%PDF-existing',
    )
  })

  it('rejects duplicate concurrent setup through the userId primary key', async () => {
    mocks.create
      .mockResolvedValueOnce({ questionId: 'firstSchool', keyVersion: 1 })
      .mockRejectedValueOnce({ code: 'P2002' })
    const results = await Promise.allSettled([
      configureDocumentEncryption('user-1', 'firstSchool', ANSWER),
      configureDocumentEncryption('user-1', 'firstSchool', ANSWER),
    ])
    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ])
  })

  it('rejects an incorrect current answer', async () => {
    let record: any
    mocks.create.mockImplementation(async ({ data }) => {
      record = data
      return { questionId: data.questionId, keyVersion: data.keyVersion }
    })
    await configureDocumentEncryption('user-1', 'firstSchool', ANSWER)
    mocks.findUnique.mockResolvedValue(record)
    await expect(
      updateDocumentEncryption(
        'user-1',
        'A completely different answer',
        'firstSchool',
        'The replacement answer is long enough',
      ),
    ).rejects.toMatchObject({ code: 'WRONG_ANSWER' })
  })
})
