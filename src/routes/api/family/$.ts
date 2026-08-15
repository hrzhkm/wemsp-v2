import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import {
  createBidirectionalFamilyRelation,
  deleteBidirectionalFamilyRelation,
  deleteNonRegisteredFamilyMember,
  getFamilyMembers,
  getNonRegisteredFamilyMembers,
  updateBidirectionalFamilyRelation,
  updateNonRegisteredFamilyMember,
} from '@/lib/family/family'
import { prisma } from '@/db'
import {
  parseFamilyRelation,
  validateNonRegisteredFamilyInput,
} from '@/lib/family/familyValidation'

const errorResponse = (error: string, status: number, code?: string) =>
  Response.json({ error, ...(code ? { code } : {}) }, { status })

const isIcConflict = (error: unknown) =>
  (typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002') ||
  (error instanceof Error && error.message.includes('IC number already exists'))

export const familyHandlers = {
  GET: async ({ request }: { request: Request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || session.user.id

    if (userId !== session.user.id) {
      return new Response('Forbidden', { status: 403 })
    }

    try {
      const [registeredMembers, nonRegisteredMembers] = await Promise.all([
        getFamilyMembers(userId),
        getNonRegisteredFamilyMembers(userId),
      ])

      const formattedRegistered = registeredMembers.map((member) => ({
        id: member.id,
        type: 'registered' as const,
        userId: member.userId,
        familyMemberUserId: member.familyMemberUserId,
        name: member.familyMemberUser.name,
        email: member.familyMemberUser.email,
        relation: member.relation as any,
        image: member.familyMemberUser.image,
        icNumber: member.familyMemberUser.icNumber,
      }))

      const formattedNonRegistered = nonRegisteredMembers.map((member) => ({
        id: member.id,
        type: 'non-registered' as const,
        name: member.name,
        icNumber: member.icNumber,
        phoneNumber: member.phoneNumber,
        address: member.address,
        relation: member.relation as any,
      }))

      return Response.json({
        registered: formattedRegistered,
        nonRegistered: formattedNonRegistered,
      })
    } catch (error) {
      console.error('Error fetching family members:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  },

  POST: async ({ request }: { request: Request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }

    try {
      const body = await request.json()
      const { type, memberData } = body

      if (type === 'registered') {
        const { familyMemberUserId, relation } = memberData

        const parsedRelation = parseFamilyRelation(relation)
        if (!familyMemberUserId || !parsedRelation) {
          return errorResponse('Invalid family member details', 400)
        }
        if (familyMemberUserId === session.user.id) {
          return errorResponse(
            'You cannot add yourself as a family member',
            400,
          )
        }

        // Verify the target user exists
        const targetUser = await prisma.user.findUnique({
          where: { id: familyMemberUserId },
        })

        if (!targetUser) {
          return new Response('Target user not found', { status: 404 })
        }

        // Check if relationship already exists
        const existing = await prisma.familyMember.findFirst({
          where: {
            userId: session.user.id,
            familyMemberUserId,
          },
        })

        if (existing) {
          return new Response('Relationship already exists', {
            status: 409,
          })
        }

        await createBidirectionalFamilyRelation(
          session.user.id,
          familyMemberUserId,
          parsedRelation,
        )

        return Response.json(
          { message: 'Family member added' },
          { status: 201 },
        )
      } else if (type === 'non-registered') {
        const parsed = validateNonRegisteredFamilyInput(memberData)
        if (!parsed) {
          return errorResponse('Invalid family member details', 400)
        }

        // Check if IC number already exists in the registry
        const existingIc = await prisma.icRegistry.findUnique({
          where: { icNumber: parsed.icNumber },
        })

        if (existingIc) {
          return Response.json(
            {
              error: 'This IC number is unavailable',
              code: 'IC_UNAVAILABLE',
            },
            { status: 409 },
          )
        }

        // Create both IcRegistry entry and NonRegisteredFamilyMember in a transaction
        await prisma.$transaction(async (tx) => {
          // First create the IC registry entry
          await tx.icRegistry.create({
            data: { icNumber: parsed.icNumber },
          })

          // Then create the non-registered family member
          await tx.nonRegisteredFamilyMember.create({
            data: {
              userId: session.user.id,
              ...parsed,
            },
          })
        })

        return Response.json(
          { message: 'Family member added' },
          { status: 201 },
        )
      }

      return new Response('Invalid type', { status: 400 })
    } catch (error) {
      if (isIcConflict(error)) {
        return errorResponse(
          'This IC number is unavailable',
          409,
          'IC_UNAVAILABLE',
        )
      }
      console.error('Error adding family member')
      return errorResponse('Internal Server Error', 500)
    }
  },

  DELETE: async ({ request }: { request: Request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }

    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const id = url.searchParams.get('id')

    if (!type || !id) {
      return new Response('Missing type or id', { status: 400 })
    }

    try {
      if (type === 'registered') {
        // id is the familyMemberUserId for registered members
        await deleteBidirectionalFamilyRelation(session.user.id, id)
      } else if (type === 'non-registered') {
        const deleted = await deleteNonRegisteredFamilyMember(
          session.user.id,
          parseInt(id),
        )
        if (!deleted) return errorResponse('Family member not found', 404)
      } else {
        return new Response('Invalid type', { status: 400 })
      }

      return Response.json(
        { message: 'Family member deleted' },
        { status: 200 },
      )
    } catch (error) {
      console.error('Error deleting family member:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  },

  PUT: async ({ request }: { request: Request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }

    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const id = url.searchParams.get('id')

    if (!type || !id) {
      return new Response('Missing type or id', { status: 400 })
    }

    try {
      const body = await request.json()

      if (type === 'registered') {
        const relation = parseFamilyRelation(body.relation)

        if (!relation) {
          return new Response('Missing relation', { status: 400 })
        }

        await updateBidirectionalFamilyRelation(session.user.id, id, relation)
      } else if (type === 'non-registered') {
        const parsed = validateNonRegisteredFamilyInput(body)
        if (!parsed) {
          return errorResponse('Invalid family member details', 400)
        }

        const updated = await updateNonRegisteredFamilyMember(
          session.user.id,
          parseInt(id),
          parsed,
        )
        if (!updated) return errorResponse('Family member not found', 404)
      } else {
        return new Response('Invalid type', { status: 400 })
      }

      return Response.json(
        { message: 'Family member updated' },
        { status: 200 },
      )
    } catch (error) {
      if (isIcConflict(error)) {
        return errorResponse(
          'This IC number is unavailable',
          409,
          'IC_UNAVAILABLE',
        )
      }
      console.error('Error updating family member')
      return errorResponse('Internal Server Error', 500)
    }
  },
}

export const Route = createFileRoute('/api/family/$')({
  server: { handlers: familyHandlers },
})
