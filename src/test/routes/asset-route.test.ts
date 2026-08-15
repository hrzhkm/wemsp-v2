import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assetHandlers } from '@/routes/api/asset/$'

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('@/lib/auth/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}))
vi.mock('@/db', () => ({ prisma: {} }))
vi.mock('@/lib/storage/aws', () => ({
  deleteFileFromS3: vi.fn(),
  extractKeyFromUrl: vi.fn(),
  generateS3Key: vi.fn(),
  getFileUrl: vi.fn(),
  uploadFileToS3: vi.fn(),
}))

describe('assetHandlers.POST', () => {
  beforeEach(() =>
    mocks.getSession.mockResolvedValue({ user: { id: 'user_1' } }),
  )

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
})
