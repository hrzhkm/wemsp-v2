import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'
import { buildAgreementPdf } from '@/lib/agreement/agreementPdf'

export const documentHandlers = {
  GET: async ({
    request,
    params,
  }: {
    request: Request
    params: { id: string }
  }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    const sessionUser = session?.user as { id?: string } | undefined
    if (!sessionUser?.id) {
      return new Response('Unauthorized', { status: 401 })
    }

    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { id: true, role: true },
      })

      if (!dbUser) {
        return new Response('Unauthorized', { status: 401 })
      }

      const agreement = await prisma.agreement.findFirst({
        where: buildAgreementDocumentWhere(
          params.id,
          dbUser.id,
          dbUser.role === 'ADMIN',
        ),
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          witness: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assets: {
            include: {
              asset: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  description: true,
                  value: true,
                },
              },
            },
          },
          beneficiaries: {
            include: {
              familyMember: {
                select: {
                  id: true,
                  relation: true,
                  familyMemberUser: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
              nonRegisteredFamilyMember: {
                select: {
                  id: true,
                  name: true,
                  relation: true,
                },
              },
            },
          },
        },
      })

      if (!agreement) {
        return Response.json({ error: 'Agreement not found' }, { status: 404 })
      }

      const pdf = await buildAgreementPdf(agreement)
      const fileName = `agreement-${sanitizeFileName(agreement.id)}.pdf`

      return new Response(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': String(pdf.byteLength),
          'Cache-Control': 'private, no-store',
        },
      })
    } catch (error) {
      console.error('Error generating agreement document:', error)
      return Response.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  },
}

function buildAgreementDocumentWhere(
  agreementId: string,
  userId: string,
  isAdmin: boolean,
) {
  if (isAdmin) {
    return { id: agreementId }
  }

  return {
    id: agreementId,
    OR: [
      { ownerId: userId },
      {
        beneficiaries: {
          some: {
            familyMember: {
              familyMemberUserId: userId,
            },
          },
        },
      },
    ],
  }
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

export const Route = createFileRoute('/api/agreement/$id/document/$')({
  server: {
    handlers: documentHandlers,
  },
})
