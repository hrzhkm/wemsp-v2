import { beforeEach, describe, expect, it, vi } from 'vitest'
import { serveAssetDocument } from '@/lib/storage/assetDocument'

const mocks = vi.hoisted(() => ({
  findAsset: vi.fn(),
  findFamily: vi.fn(),
  findUser: vi.fn(),
  getFile: vi.fn(),
  getSession: vi.fn(),
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
vi.mock('@/lib/storage/aws', () => ({
  getFileFromS3: mocks.getFile,
  getFileUrl: (key: string) => `/api/file/${key}`,
}))

describe('serveAssetDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires authentication', async () => {
    mocks.getSession.mockResolvedValue(null)
    expect(
      (
        await serveAssetDocument(
          new Request('http://localhost/file'),
          'documents/a.pdf',
        )
      ).status,
    ).toBe(401)
  })

  it('hides documents from unrelated users', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'outsider' } })
    mocks.findUser.mockResolvedValue({ id: 'outsider', role: 'USER' })
    mocks.findAsset.mockResolvedValue({ userId: 'owner' })
    mocks.findFamily.mockResolvedValue(null)

    const response = await serveAssetDocument(
      new Request('http://localhost/file'),
      'documents/a.pdf',
    )
    expect(response.status).toBe(404)
    expect(mocks.getFile).not.toHaveBeenCalled()
  })

  it.each([
    ['owner', 'USER', null],
    ['admin', 'ADMIN', null],
    ['relative', 'USER', { id: 1 }],
  ])('serves private files to an authorized %s', async (id, role, family) => {
    mocks.getSession.mockResolvedValue({ user: { id } })
    mocks.findUser.mockResolvedValue({ id, role })
    mocks.findAsset.mockResolvedValue({ userId: 'owner' })
    mocks.findFamily.mockResolvedValue(family)
    mocks.getFile.mockResolvedValue({
      body: Buffer.from('pdf'),
      contentLength: 3,
      contentType: 'application/pdf',
      fileName: 'asset.pdf',
    })

    const response = await serveAssetDocument(
      new Request('http://localhost/file'),
      'documents/a.pdf',
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})
