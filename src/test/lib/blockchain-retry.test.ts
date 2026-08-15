import { afterEach, describe, expect, it, vi } from 'vitest'

import { isTransientError, withRetry } from '@/lib/blockchain/contract'

const makeError = (code: string, message: string) =>
  Object.assign(new Error(message), { code, shortMessage: message })

describe('isTransientError', () => {
  it('classifies ethers transient error codes', () => {
    expect(isTransientError(makeError('TIMEOUT', 'request timeout'))).toBe(true)
    expect(isTransientError(makeError('NETWORK_ERROR', 'network error'))).toBe(true)
    expect(isTransientError(makeError('SERVER_ERROR', 'server error'))).toBe(true)
  })

  it('classifies DNS/connection failures by message', () => {
    expect(isTransientError(new Error('getaddrinfo EAI_AGAIN base-sepolia.g.alchemy.com'))).toBe(true)
    expect(isTransientError(new Error('socket hang up'))).toBe(true)
    expect(isTransientError(new Error('request timeout'))).toBe(true)
  })

  it('treats contract reverts and other errors as non-transient', () => {
    expect(isTransientError(makeError('CALL_EXCEPTION', 'execution reverted: OwnerAlreadySigned'))).toBe(false)
    expect(isTransientError(new Error('execution reverted: AgreementIdAlreadyExists'))).toBe(false)
    expect(isTransientError(null)).toBe(false)
    expect(isTransientError(new Error('random failure'))).toBe(false)
  })
})

describe('withRetry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('retries transient failures and succeeds', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(makeError('TIMEOUT', 'request timeout'))
      .mockRejectedValueOnce(new Error('getaddrinfo EAI_AGAIN'))
      .mockResolvedValueOnce('ok')

    const result = await withRetry(op)
    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(3)
  })

  it('throws after exhausting retries', async () => {
    const op = vi.fn().mockRejectedValue(makeError('TIMEOUT', 'request timeout'))

    await expect(withRetry(op)).rejects.toMatchObject({ code: 'TIMEOUT' })
    expect(op.mock.calls.length).toBeGreaterThan(1)
  }, 20000)

  it('does not retry non-transient errors', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(makeError('CALL_EXCEPTION', 'execution reverted: OwnerAlreadySigned'))

    await expect(withRetry(op)).rejects.toMatchObject({ code: 'CALL_EXCEPTION' })
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('invokes onRetry before each retry', async () => {
    const onRetry = vi.fn()
    const op = vi
      .fn()
      .mockRejectedValueOnce(makeError('TIMEOUT', 'request timeout'))
      .mockResolvedValueOnce('ok')

    await withRetry(op, { onRetry })
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
