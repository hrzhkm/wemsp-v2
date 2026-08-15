import { getFileFromS3, getFileUrl } from './aws'
import { prisma } from '@/db'
import { auth } from '@/lib/auth/auth'

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
    where: { documentUrl: getFileUrl(key) },
    select: { userId: true },
  })
  if (!asset)
    return Response.json({ error: 'Document not found' }, { status: 404 })

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
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    const { body, contentLength, contentType, fileName } =
      await getFileFromS3(key)
    const safeFileName = fileName.replace(/["\r\n]/g, '_')
    return new Response(Uint8Array.from(body), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `inline; filename="${safeFileName}"`,
        'Content-Length': contentLength.toString(),
        'Content-Type': contentType,
      },
    })
  } catch {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }
}
