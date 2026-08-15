import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import {
  getFamilyMembers,
  getNonRegisteredFamilyMembers,
  deleteBidirectionalFamilyRelation,
  deleteNonRegisteredFamilyMember,
  updateBidirectionalFamilyRelation,
  updateNonRegisteredFamilyMember,
  createBidirectionalFamilyRelation,
} from '@/lib/family/family'
import { prisma } from '@/db'

export const Route = createFileRoute('/api/family/$')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        const url = new URL(request.url)
        const userId = url.searchParams.get('userId') || session.user?.id

        if (userId !== session.user?.id) {
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

            if (!familyMemberUserId || !relation) {
              return new Response('Missing required fields', { status: 400 })
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
              return new Response('Relationship already exists', { status: 409 })
            }

            await createBidirectionalFamilyRelation(
              session.user.id,
              familyMemberUserId,
              relation
            )

            return Response.json({ message: 'Family member added' }, { status: 201 })
          } else if (type === 'non-registered') {
            const { name, icNumber, relation, address, phoneNumber } = memberData

            if (!name || !icNumber || !relation) {
              return new Response('Missing required fields', { status: 400 })
            }

            // Check if IC number already exists in the registry
            const existingIc = await prisma.icRegistry.findUnique({
              where: { icNumber },
            })

            if (existingIc) {
              return Response.json(
                { error: 'IC number already exists in the system' },
                { status: 409 }
              )
            }

            // Create both IcRegistry entry and NonRegisteredFamilyMember in a transaction
            await prisma.$transaction(async (tx) => {
              // First create the IC registry entry
              await tx.icRegistry.create({
                data: { icNumber },
              })

              // Then create the non-registered family member
              await tx.nonRegisteredFamilyMember.create({
                data: {
                  userId: session.user.id,
                  name,
                  icNumber,
                  relation,
                  address: address || null,
                  phoneNumber: phoneNumber || null,
                },
              })
            })

            return Response.json({ message: 'Family member added' }, { status: 201 })
          }

          return new Response('Invalid type', { status: 400 })
        } catch (error) {
          console.error('Error adding family member:', error)
          return new Response('Internal Server Error', { status: 500 })
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
            await deleteNonRegisteredFamilyMember(parseInt(id))
          } else {
            return new Response('Invalid type', { status: 400 })
          }

          return Response.json({ message: 'Family member deleted' }, { status: 200 })
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
            const { relation } = body

            if (!relation) {
              return new Response('Missing relation', { status: 400 })
            }

            await updateBidirectionalFamilyRelation(
              session.user.id,
              id,
              relation
            )
          } else if (type === 'non-registered') {
            const { name, icNumber, relation, address, phoneNumber } = body

            await updateNonRegisteredFamilyMember(parseInt(id), {
              name,
              icNumber,
              relation,
              address: address || null,
              phoneNumber: phoneNumber || null,
            })
          } else {
            return new Response('Invalid type', { status: 400 })
          }

          return Response.json({ message: 'Family member updated' }, { status: 200 })
        } catch (error) {
          console.error('Error updating family member:', error)
          return new Response('Internal Server Error', { status: 500 })
        }
      },
    },
  },
})
