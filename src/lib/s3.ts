import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

let client: S3Client | undefined

function config() {
  const endpoint = process.env.R2_ENDPOINT
  const bucket = process.env.R2_BUCKET
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 storage is not configured')
  }
  client ??= new S3Client({
    endpoint,
    region: 'auto',
    credentials: { accessKeyId, secretAccessKey },
  })
  return { bucket, client }
}

export async function putObject(key: string, body: Buffer): Promise<void> {
  const { bucket, client: r2 } = config()
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/octet-stream',
    }),
  )
}

export async function getObject(key: string): Promise<Buffer> {
  const { bucket, client: r2 } = config()
  const result = await r2.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  )
  if (!result.Body) throw new Error('R2 object is unavailable')
  return Buffer.from(await result.Body.transformToByteArray())
}

export async function copyObject(
  sourceKey: string,
  targetKey: string,
): Promise<void> {
  const { bucket, client: r2 } = config()
  const copySource = `${encodeURIComponent(bucket)}/${sourceKey
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
  await r2.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: copySource,
      Key: targetKey,
      ContentType: 'application/octet-stream',
      MetadataDirective: 'REPLACE',
    }),
  )
}

export async function deleteObject(key: string): Promise<void> {
  const { bucket, client: r2 } = config()
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
