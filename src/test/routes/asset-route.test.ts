import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assetHandlers } from '@/routes/api/asset/$'

const mocks = vi.hoisted(() => {
  class MockAssetDocumentError extends Error {}
  return {
    createAsset: vi.fn(),
    deleteAsset: vi.fn(),
    deleteDocument: vi.fn(),
    Error: MockAssetDocumentError,
    findAsset: vi.fn(),
    getSession: vi.fn(),
    uploadDocument: vi.fn(),
  }
})

vi.mock('@/lib/auth/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}))
vi.mock('@/db', () => ({
  prisma: {
    asset: {
      create: mocks.createAsset,
      delete: mocks.deleteAsset,
      findFirst: mocks.findAsset,
    },
  },
}))
vi.mock('@/lib/storage/assetDocument', () => ({
  AssetDocumentError: mocks.Error,
  deleteAssetDocument: mocks.deleteDocument,
  uploadAssetDocument: mocks.uploadDocument,
}))

describe('assetHandlers.POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user_1' } })
    mocks.deleteDocument.mockResolvedValue(undefined)
    mocks.uploadDocument.mockResolvedValue({
      key: 'asset-documents/user_1/123e4567-e89b-12d3-a456-426614174000.enc',
      url: '/api/file/asset-documents/user_1/123e4567-e89b-12d3-a456-426614174000.enc',
    })
  })

  it.each(['0', '-1', 'Infinity', '1abc'])(
    'rejects non-positive or malformed value %s',
    async (value) => {
      const body = new URLSearchParams({
        name: 'Asset',
        type: 'PROPERTY',
        value,
      })

      const response = await assetHandlers.POST({
        request: {
          headers: new Headers(),
          formData: () => Promise.resolve(body),
        } as unknown as Request,
      })
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Value must be a positive number',
      })
    },
  )

  it('deletes a newly uploaded object when the database create fails', async () => {
    mocks.createAsset.mockRejectedValue(new Error('database unavailable'))
    const formData = new FormData()
    formData.set('name', 'House')
    formData.set('type', 'PROPERTY')
    formData.set('value', '100')
    formData.set(
      'document',
      new File(['%PDF-1.7'], 'house.pdf', { type: 'application/pdf' }),
    )

    const response = await assetHandlers.POST({
      request: {
        headers: new Headers(),
        formData: () => Promise.resolve(formData),
      } as unknown as Request,
    })

    expect(response.status).toBe(500)
    expect(mocks.deleteDocument).toHaveBeenCalledWith(
      '/api/file/asset-documents/user_1/123e4567-e89b-12d3-a456-426614174000.enc',
    )
  })

  it('preserves the asset row when document deletion fails', async () => {
    mocks.findAsset.mockResolvedValue({
      id: 7,
      userId: 'user_1',
      documentUrl:
        '/api/file/asset-documents/user_1/123e4567-e89b-12d3-a456-426614174000.enc',
    })
    mocks.deleteDocument.mockRejectedValue(new Error('storage unavailable'))

    const response = await assetHandlers.DELETE({
      request: new Request('http://localhost/api/asset/7', {
        method: 'DELETE',
      }),
    })

    expect(response.status).toBe(500)
    expect(mocks.deleteAsset).not.toHaveBeenCalled()
  })
})
