import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadEncryptedJsonToIpfs } from '@/lib/storage/ipfs'

const originalEnv = process.env

describe('Pinata IPFS adapter', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PINATA_JWT: 'jwt',
      PINATA_GATEWAY: 'gateway.example',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ IpfsHash: 'bafy123' })),
    )
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllGlobals()
  })

  it('uploads JSON to Pinata and returns an ipfs URI', async () => {
    const result = await uploadEncryptedJsonToIpfs(
      { version: 1, ciphertext: 'encrypted' },
      { name: 'agreement-a1.enc.json' },
    )

    expect(result).toEqual({
      cid: 'bafy123',
      uri: 'ipfs://bafy123',
      gatewayUrl: 'https://gateway.example/ipfs/bafy123',
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('sends the encrypted envelope as pinata content', async () => {
    await uploadEncryptedJsonToIpfs(
      { version: 1, ciphertext: 'encrypted' },
      { name: 'agreement-a1.enc.json' },
    )

    const requestInit = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(String(requestInit.body))

    expect(body.pinataContent).toEqual({ version: 1, ciphertext: 'encrypted' })
    expect(body.pinataMetadata.name).toBe('agreement-a1.enc.json')
    expect(JSON.stringify(body)).not.toContain('plaintext-agreement')
  })

  it('fails closed when PINATA_JWT is missing', async () => {
    delete process.env.PINATA_JWT

    await expect(
      uploadEncryptedJsonToIpfs({ version: 1 }, { name: 'x.json' }),
    ).rejects.toThrowError(/PINATA_JWT/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails safely when Pinata does not return a CID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({})),
    )

    await expect(
      uploadEncryptedJsonToIpfs({ version: 1 }, { name: 'x.json' }),
    ).rejects.toThrowError(/IPFS upload failed/)
  })
})
