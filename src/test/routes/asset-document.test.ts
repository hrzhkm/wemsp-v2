import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  extractDocumentKey,
  promoteTemporaryDocument,
  reencryptAssetDocument,
  serveAssetDocument,
  uploadAssetDocument,
  validatePdf,
} from '@/lib/storage/assetDocument'
import {
  decryptDocument,
  encryptDocument,
  generateFek,
} from '@/lib/storage/encryption'

const mocks = vi.hoisted(() => ({
  copyObject: vi.fn(),
  findAsset: vi.fn(),
  findFamily: vi.fn(),
  findUser: vi.fn(),
  getObject: vi.fn(),
  getSession: vi.fn(),
  putObject: vi.fn(),
  recoverFek: vi.fn(),
}))

vi.mock('@/lib/auth/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}))
vi.mock('@/db', () => ({
  prisma: {
    asset: { findFirst: mocks.findAsset },
    familyMember: { findFirst: mocks.findFamily },
    user: { findUnique: mocks.findUser },
  },
}))
vi.mock('@/lib/s3', () => ({
  copyObject: mocks.copyObject,
  deleteObject: vi.fn(),
  getObject: mocks.getObject,
  putObject: mocks.putObject,
}))
vi.mock('@/lib/storage/documentEncryption', () => ({
  recoverDocumentFek: mocks.recoverFek,
}))

const KEY = 'asset-documents/owner/123e4567-e89b-12d3-a456-426614174000.enc'

describe('asset document storage', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['empty', new File([], 'empty.pdf', { type: 'application/pdf' })],
    [
      'spoofed',
      new File(['not a pdf'], 'spoofed.pdf', { type: 'application/pdf' }),
    ],
    ['wrong MIME', new File(['%PDF-1.7'], 'wrong.txt', { type: 'text/plain' })],
    [
      'oversized',
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', {
        type: 'application/pdf',
      }),
    ],
  ])('rejects an %s PDF', async (_label, file) => {
    await expect(validatePdf(file)).rejects.toThrow()
  })

  it('encrypts valid PDFs before upload with opaque keys', async () => {
    const fek = generateFek()
    mocks.recoverFek.mockResolvedValue(fek)
    const plaintext = Buffer.from('%PDF-1.7\ncontent')
    const file = {
      arrayBuffer: async () => plaintext,
      name: 'identity.pdf',
      size: plaintext.length,
      type: 'application/pdf',
    } as unknown as File

    const uploaded = await uploadAssetDocument('owner', file)
    const ciphertext = mocks.putObject.mock.calls[0][1] as Buffer

    expect(uploaded.key).toMatch(/^asset-documents\/owner\/[0-9a-f-]{36}\.enc$/)
    expect(ciphertext.subarray(0, 5).toString()).not.toBe('%PDF-')
    expect(decryptDocument(ciphertext, fek).toString()).toBe(
      '%PDF-1.7\ncontent',
    )
  })

  it('only promotes temporary objects owned by the user', async () => {
    const own =
      '/api/file/tmp/asset-documents/user-1/123e4567-e89b-12d3-a456-426614174000.enc'
    await promoteTemporaryDocument('user-1', own)
    expect(mocks.copyObject).toHaveBeenCalledTimes(1)
    await expect(promoteTemporaryDocument('user-2', own)).rejects.toThrow(
      'Invalid document reference',
    )
    expect(() =>
      extractDocumentKey('https://attacker.example/file.enc'),
    ).toThrow()
  })

  it('decrypts with the former owner and re-encrypts with the new owner FEK', async () => {
    const oldFek = generateFek()
    const newFek = generateFek()
    mocks.getObject.mockResolvedValue(
      encryptDocument(Buffer.from('%PDF-transfer'), oldFek),
    )
    mocks.recoverFek.mockImplementation(async (id: string) =>
      id === 'old' ? oldFek : newFek,
    )

    await reencryptAssetDocument(
      '/api/file/asset-documents/old/123e4567-e89b-12d3-a456-426614174000.enc',
      'old',
      'new',
    )

    const ciphertext = mocks.putObject.mock.calls[0][1] as Buffer
    expect(decryptDocument(ciphertext, newFek).toString()).toBe('%PDF-transfer')
  })
})

describe('serveAssetDocument', () => {
  const fek = generateFek()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findAsset.mockResolvedValue({ userId: 'owner' })
    mocks.recoverFek.mockResolvedValue(fek)
    mocks.getObject.mockResolvedValue(
      encryptDocument(Buffer.from('%PDF-private'), fek),
    )
  })

  it('requires authentication', async () => {
    mocks.getSession.mockResolvedValue(null)
    expect(
      (await serveAssetDocument(new Request('http://localhost/file'), KEY))
        .status,
    ).toBe(401)
  })

  it('hides documents from unrelated users', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'outsider' } })
    mocks.findUser.mockResolvedValue({ id: 'outsider', role: 'USER' })
    mocks.findFamily.mockResolvedValue(null)
    expect(
      (await serveAssetDocument(new Request('http://localhost/file'), KEY))
        .status,
    ).toBe(404)
    expect(mocks.getObject).not.toHaveBeenCalled()
  })

  it.each([
    ['owner', 'USER', null],
    ['admin', 'ADMIN', null],
    ['relative', 'USER', { id: 1 }],
  ])(
    'decrypts private files for an authorized %s',
    async (id, role, family) => {
      mocks.getSession.mockResolvedValue({ user: { id } })
      mocks.findUser.mockResolvedValue({ id, role })
      mocks.findFamily.mockResolvedValue(family)
      const response = await serveAssetDocument(
        new Request('http://localhost/file'),
        KEY,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
        '%PDF-private',
      )
    },
  )

  it('returns 404 for tampered ciphertext', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'owner' } })
    mocks.findUser.mockResolvedValue({ id: 'owner', role: 'USER' })
    const ciphertext = encryptDocument(Buffer.from('%PDF-private'), fek)
    ciphertext[ciphertext.length - 1] ^= 1
    mocks.getObject.mockResolvedValue(ciphertext)
    expect(
      (await serveAssetDocument(new Request('http://localhost/file'), KEY))
        .status,
    ).toBe(404)
  })
})
