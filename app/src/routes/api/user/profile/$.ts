import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'
import { convertNonRegisteredToFamilyMembers } from '@/lib/family/family'

export const Route = createFileRoute('/api/user/profile/$')({ 
  server: {
    handlers: {
      PUT: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return Response.json(
            { error: 'Unauthorized' },
            { status: 401 }
          )
        }

        try {
          const body = await request.json()
          const { name, icNumber, phoneNumber, address, claimNonRegistered } = body

          // Validate required fields
          if (!name || !icNumber || !phoneNumber || !address) {
            return Response.json(
              { error: 'Missing required fields' },
              { status: 400 }
            )
          }

          // Validate IC number is exactly 12 digits
          if (!/^\d{12}$/.test(icNumber)) {
            return Response.json(
              { error: 'IC number must be exactly 12 digits' },
              { status: 400 }
            )
          }

          // Get the current user's IC number
          const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { icNumber: true },
          })

          // Check if IC number is already taken by another user
          if (icNumber !== currentUser?.icNumber) {
            const existingUser = await prisma.user.findFirst({
              where: {
                icNumber,
                id: { not: session.user.id },
              },
            })

            if (existingUser) {
              return Response.json(
                { error: 'IC number already registered to another user' },
                { status: 409 }
              )
            }

            // Check if IC exists in NonRegisteredFamilyMember
            const existingNonRegistered = await prisma.nonRegisteredFamilyMember.findFirst({
              where: { icNumber },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            })

            // If IC exists in NonRegisteredFamilyMember and user hasn't confirmed claim
            if (existingNonRegistered && !claimNonRegistered) {
              // Return the non-registered data for user to confirm
              const allNonRegistered = await prisma.nonRegisteredFamilyMember.findMany({
                where: { icNumber },
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              })

              return Response.json({
                requiresClaim: true,
                nonRegisteredData: allNonRegistered.map((nr) => ({
                  id: nr.id,
                  name: nr.name,
                  icNumber: nr.icNumber,
                  address: nr.address,
                  phoneNumber: nr.phoneNumber,
                  relation: nr.relation,
                  addedBy: {
                    id: nr.user.id,
                    name: nr.user.name,
                    email: nr.user.email,
                  },
                })),
              }, { status: 200 })
            }
          }

          // Update user using Prisma with transaction to handle IcRegistry
          const updatedUser = await prisma.$transaction(async (tx) => {
            // If user had a previous IC number, delete it from registry
            if (currentUser?.icNumber && currentUser.icNumber !== icNumber) {
              await tx.icRegistry.delete({
                where: { icNumber: currentUser.icNumber },
              }).catch(() => {
                // Ignore if it doesn't exist (for legacy data)
              })
            }

            // Check if we need to claim non-registered family member
            if (claimNonRegistered && icNumber !== currentUser?.icNumber) {
              // The IC registry entry already exists from NonRegisteredFamilyMember
              // We just need to delete the NonRegisteredFamilyMember records
              // and create the family relationships
              
              // First update the user
              const user = await tx.user.update({
                where: { id: session.user.id },
                data: {
                  name,
                  icNumber,
                  phoneNumber,
                  address,
                },
              })

              return user
            }

            // Create new IC registry entry if it doesn't exist (normal flow)
            if (icNumber !== currentUser?.icNumber) {
              await tx.icRegistry.upsert({
                where: { icNumber },
                create: { icNumber },
                update: {},
              })
            }

            // Update the user
            return tx.user.update({
              where: { id: session.user.id },
              data: {
                name,
                icNumber,
                phoneNumber,
                address,
              },
            })
          })

          // If claiming non-registered, convert to family relationships
          if (claimNonRegistered && icNumber !== currentUser?.icNumber) {
            await convertNonRegisteredToFamilyMembers(session.user.id, icNumber)
          }

          return Response.json({
            success: true,
            user: {
              id: updatedUser.id,
              name: updatedUser.name,
              email: updatedUser.email,
              icNumber: updatedUser.icNumber,
              phoneNumber: updatedUser.phoneNumber,
              address: updatedUser.address,
              image: updatedUser.image,
            },
          })
        } catch (error) {
          console.error('Error updating profile:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        return Response.json({ user: session.user })
      },
    },
  },
})
