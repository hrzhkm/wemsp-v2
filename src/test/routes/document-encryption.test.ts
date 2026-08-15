import { beforeEach, describe, expect, it, vi } from 'vitest'
import { documentEncryptionHandlers } from '@/routes/api/user/document-encryption/$'
import { DocumentEncryptionError } from '@/lib/storage/documentEncryption'

const mocks = vi.hoisted(() => {
  class MockDocumentEncryptionError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message)
    }
  }
  return {
    configure: vi.fn(),
    Error: MockDocumentEncryptionError,
    getSession: vi.fn(),
    status: vi.fn(),
    update: vi.fn(),
  }
})

vi.mock('@/lib/auth/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}))
vi.mock('@/lib/storage/documentEncryption', () => ({
  configureDocumentEncryption: mocks.configure,
  DocumentEncryptionError: mocks.Error,
  getDocumentEncryptionStatus: mocks.status,
  normalizeDocumentAnswer: (answer: string) =>
    answer.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase(),
  updateDocumentEncryption: mocks.update,
}))

function jsonRequest(method: string, body: object) {
  return new Request('http://localhost/api/user/document-encryption', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('document encryption settings route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('requires authentication', async () => {
    mocks.getSession.mockResolvedValue(null)
    const response = await documentEncryptionHandlers.GET({
      request: new Request('http://localhost'),
    })
    expect(response.status).toBe(401)
  })

  it('returns only configuration metadata', async () => {
    mocks.status.mockResolvedValue({
      configured: true,
      questionId: 'firstSchool',
      keyVersion: 1,
    })
    const response = await documentEncryptionHandlers.GET({
      request: new Request('http://localhost'),
    })
    expect(await response.json()).toEqual({
      configured: true,
      questionId: 'firstSchool',
      keyVersion: 1,
    })
  })

  it('rejects mismatched initial answers without configuring a key', async () => {
    const response = await documentEncryptionHandlers.POST({
      request: jsonRequest('POST', {
        questionId: 'firstSchool',
        answer: 'A sufficiently long answer',
        confirmAnswer: 'A different long answer',
      }),
    })
    expect(response.status).toBe(400)
    expect(mocks.configure).not.toHaveBeenCalled()
  })

  it('normalizes confirmation before initial setup', async () => {
    mocks.configure.mockResolvedValue({
      questionId: 'firstSchool',
      keyVersion: 1,
    })
    const response = await documentEncryptionHandlers.POST({
      request: jsonRequest('POST', {
        questionId: 'firstSchool',
        answer: '  My First School Name  ',
        confirmAnswer: 'my first school name',
      }),
    })
    expect(response.status).toBe(201)
    expect(mocks.configure).toHaveBeenCalledWith(
      'user-1',
      'firstSchool',
      '  My First School Name  ',
    )
  })

  it('returns a safe validation error for a wrong current answer', async () => {
    mocks.update.mockRejectedValue(
      new DocumentEncryptionError(
        'WRONG_ANSWER',
        'Current answer is incorrect',
      ),
    )
    const response = await documentEncryptionHandlers.PUT({
      request: jsonRequest('PUT', {
        currentAnswer: 'Wrong current answer',
        questionId: 'memorablePlace',
        newAnswer: 'A sufficiently long new answer',
        confirmNewAnswer: 'A sufficiently long new answer',
      }),
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Current answer is incorrect',
    })
  })
})
