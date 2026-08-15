import crypto from 'node:crypto'
import { decryptDocument, encryptDocument } from './encryption'
import { recoverDocumentFek } from './documentEncryption'
import { prisma } from '@/db'
import { auth } from '@/lib/auth/auth'
import { copyObject, deleteObject, getObject, putObject } from '@/lib/s3'

export const MAX_PDF_BYTES = 10 * 1024 * 1024
const PDF_SIGNATURE = Buffer.from('%PDF-')
const PERMANENT_PREFIX = 'asset-documents'
const TEMP_PREFIX = 'tmp/asset-documents'

export class AssetDocumentError extends Error {
  constructor(
    readonly code: 'INVALID_PDF' | 'INVALID_KEY',
    message: string,
  ) {
    super(message)
    this.name = 'AssetDocumentError'
  }
}

export function getDocumentUrl(key: string): string {
  return `/api/file/${key}`
}

export function extractDocumentKey(url: string): string {
  if (!url.startsWith('/api/file/')) {
    throw new AssetDocumentError('INVALID_KEY', 'Invalid document reference')
  }
  const key = url.slice('/api/file/'.length)
  if (!/^(?:tmp\/)?asset-documents\/[^/]+\/[0-9a-f-]{36}\.enc$/i.test(key)) {
    throw new AssetDocumentError('INVALID_KEY', 'Invalid document reference')
  }
  return key
}

export async function validatePdf(file: File): Promise<Buffer> {
  if (
    file.type !== 'application/pdf' ||
    file.size <= 0 ||
    file.size > MAX_PDF_BYTES
  ) {
    throw new AssetDocumentError(
      'INVALID_PDF',
      file.size > MAX_PDF_BYTES
        ? 'File size exceeds 10MB limit'
        : 'Only non-empty PDF files are allowed',
    )
  }
  const bytes = Buffer.from(await file.arrayBuffer())
  if (!bytes.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    throw new AssetDocumentError('INVALID_PDF', 'Invalid PDF file')
  }
  return bytes
}

function newKey(userId: string, temporary = false): string {
  return `${temporary ? TEMP_PREFIX : PERMANENT_PREFIX}/${userId}/${crypto.randomUUID()}.enc`
}

export async function uploadAssetDocument(
  userId: string,
  file: File,
  temporary = false,
): Promise<{ key: string; url: string }> {
  const plaintext = await validatePdf(file)
  const fek = await recoverDocumentFek(userId)
  const key = newKey(userId, temporary)
  await putObject(key, encryptDocument(plaintext, fek))
  return { key, url: getDocumentUrl(key) }
}

export async function deleteAssetDocument(documentUrl: string): Promise<void> {
  await deleteObject(extractDocumentKey(documentUrl))
}

export async function promoteTemporaryDocument(
  userId: string,
  documentUrl: string,
): Promise<{ key: string; url: string }> {
  const sourceKey = extractDocumentKey(documentUrl)
  if (!sourceKey.startsWith(`${TEMP_PREFIX}/${userId}/`)) {
    throw new AssetDocumentError('INVALID_KEY', 'Invalid document reference')
  }
  const key = newKey(userId)
  await copyObject(sourceKey, key)
  return { key, url: getDocumentUrl(key) }
}

export async function reencryptAssetDocument(
  documentUrl: string,
  formerOwnerId: string,
  newOwnerId: string,
): Promise<{ key: string; url: string }> {
  const oldKey = extractDocumentKey(documentUrl)
  if (!oldKey.startsWith(`${PERMANENT_PREFIX}/${formerOwnerId}/`)) {
    throw new AssetDocumentError('INVALID_KEY', 'Invalid document reference')
  }
  const [ciphertext, oldFek, newFek] = await Promise.all([
    getObject(oldKey),
    recoverDocumentFek(formerOwnerId),
    recoverDocumentFek(newOwnerId),
  ])
  const key = newKey(newOwnerId)
  await putObject(
    key,
    encryptDocument(decryptDocument(ciphertext, oldFek), newFek),
  )
  return { key, url: getDocumentUrl(key) }
}

function notFound() {
  return Response.json({ error: 'Document not found' }, { status: 404 })
}

export async function serveAssetDocument(request: Request, key: string) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user.id)
    return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  })
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const asset = await prisma.asset.findFirst({
    where: { documentUrl: getDocumentUrl(key), documentEncrypted: true },
    select: { userId: true },
  })
  if (!asset) return notFound()

  const isFamily =
    asset.userId !== user.id && user.role !== 'ADMIN'
      ? await prisma.familyMember.findFirst({
          where: {
            OR: [
              { userId: user.id, familyMemberUserId: asset.userId },
              { userId: asset.userId, familyMemberUserId: user.id },
            ],
          },
          select: { id: true },
        })
      : null

  if (user.role !== 'ADMIN' && asset.userId !== user.id && !isFamily) {
    return notFound()
  }

  try {
    const plaintext = decryptDocument(
      await getObject(key),
      await recoverDocumentFek(asset.userId),
    )
    if (!plaintext.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
      return notFound()
    }
    return new Response(Uint8Array.from(plaintext), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline; filename="asset-document.pdf"',
        'Content-Length': String(plaintext.length),
        'Content-Type': 'application/pdf',
      },
    })
  } catch {
    return notFound()
  }
}
