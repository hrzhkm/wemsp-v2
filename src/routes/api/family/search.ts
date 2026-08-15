import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'
import {
  isValidMalaysianIc,
  normalizeMalaysianIc,
} from '@/lib/family/malaysianIc'

export const familySearchHandlers = {
  GET: async ({ request }: { request: Request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }

    const url = new URL(request.url)
    const icNumber = normalizeMalaysianIc(
      url.searchParams.get('icNumber') || '',
    )

    if (!isValidMalaysianIc(icNumber)) {
      return Response.json(
        { error: 'Invalid Malaysian IC number' },
        { status: 400 },
      )
    }

    try {
      // Search for registered user with this IC
      const registeredUser = await prisma.user.findUnique({
        where: { icNumber },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      })

      if (registeredUser) {
        // Check if user is trying to add themselves
        if (registeredUser.id === session.user.id) {
          return Response.json({
            type: 'self',
            data: registeredUser,
          })
        }

        // Check if relationship already exists
        const existingRelationship = await prisma.familyMember.findFirst({
          where: {
            userId: session.user.id,
            familyMemberUserId: registeredUser.id,
          },
        })

        if (existingRelationship) {
          return Response.json({
            type: 'exists',
            data: {
              ...registeredUser,
              existingRelation: existingRelationship.relation,
            },
          })
        }

        return Response.json({
          type: 'registered',
          data: registeredUser,
        })
      }

      // Search for non-registered family member with this IC
      const nonRegisteredMember =
        await prisma.nonRegisteredFamilyMember.findFirst({
          where: { icNumber },
          select: { userId: true },
        })

      if (nonRegisteredMember) {
        return Response.json({
          type:
            nonRegisteredMember.userId === session.user.id
              ? 'existing-record'
              : 'unavailable',
        })
      }

      // Not found
      return Response.json({
        type: 'not-found',
      })
    } catch (error) {
      console.error('Error searching for IC:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  },
}

export const Route = createFileRoute('/api/family/search')({
  server: { handlers: familySearchHandlers },
})
