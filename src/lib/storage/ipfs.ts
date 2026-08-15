export interface IpfsUploadResult {
  cid: string
  uri: string
  gatewayUrl: string | null
}

export interface UploadEncryptedJsonOptions {
  name: string
}

export class IpfsUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IpfsUploadError'
  }
}

function getPinataJwt(): string {
  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    throw new IpfsUploadError('PINATA_JWT is required for IPFS upload')
  }
  return jwt
}

function buildGatewayUrl(cid: string): string | null {
  const gateway = process.env.PINATA_GATEWAY?.trim()
  if (!gateway) return null

  const normalizedGateway = gateway
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')

  return `https://${normalizedGateway}/ipfs/${cid}`
}

export async function uploadEncryptedJsonToIpfs(
  payload: unknown,
  options: UploadEncryptedJsonOptions,
): Promise<IpfsUploadResult> {
  const jwt = getPinataJwt()

  const response = await fetch(
    'https://api.pinata.cloud/pinning/pinJSONToIPFS',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pinataMetadata: {
          name: options.name,
        },
        pinataContent: payload,
      }),
    },
  )

  if (!response.ok) {
    throw new IpfsUploadError('IPFS upload failed')
  }

  const data = (await response.json()) as { IpfsHash?: string }
  const cid = data.IpfsHash
  if (!cid) {
    throw new IpfsUploadError('IPFS upload failed')
  }

  return {
    cid,
    uri: `ipfs://${cid}`,
    gatewayUrl: buildGatewayUrl(cid),
  }
}
