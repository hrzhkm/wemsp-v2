import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '@/db'
import { requireAdminFromHeaders } from '@/lib/auth/admin-guard'
import { corsHeaders } from '@/lib/cors'

export const Route = createFileRoute('/api/admin/users/$id')({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, { headers: corsHeaders })
      },

      GET: async ({ request }: { request: Request }) => {
        try {
          // Verify admin session
          const admin = await requireAdminFromHeaders(request.headers)
          if (!admin) {
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
          }

          // Extract user ID from URL
          const url = new URL(request.url)
          const pathParts = url.pathname.split('/')
          const userId = pathParts[pathParts.length - 1]

          if (!userId) {
            return Response.json({ error: 'User ID is required' }, { status: 400, headers: corsHeaders })
          }

          // Get user by ID
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              name: true,
              email: true,
              icNumber: true,
              phoneNumber: true,
              address: true,
              emailVerified: true,
              image: true,
              createdAt: true,
              updatedAt: true,
              _count: {
                select: {
                  agreements: true,
                  assets: true,
                  familyMembers: true,
                  nonRegisteredFamilyMembers: true,
                  sessions: true,
                  accounts: true,
                },
              },
            },
          })

          if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })
          }

          return Response.json({ user }, { headers: corsHeaders })
        } catch (error) {
          console.error('Error fetching user:', error)
          return Response.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
        }
      },

      PUT: async ({ request }: { request: Request }) => {
        try {
          // Verify admin session
          const admin = await requireAdminFromHeaders(request.headers)
          if (!admin) {
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
          }

          // Extract user ID from URL
          const url = new URL(request.url)
          const pathParts = url.pathname.split('/')
          const userId = pathParts[pathParts.length - 1]

          if (!userId) {
            return Response.json({ error: 'User ID is required' }, { status: 400, headers: corsHeaders })
          }

          const body = await request.json()
          const { name, email, icNumber, phoneNumber, address, emailVerified } = body

          // Check if user exists
          const existingUser = await prisma.user.findUnique({
            where: { id: userId },
          })

          if (!existingUser) {
            return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })
          }

          // Check if email is being changed and if new email already exists
          if (email && email !== existingUser.email) {
            const emailExists = await prisma.user.findUnique({
              where: { email },
            })

            if (emailExists) {
              return Response.json(
                { error: 'Email already exists' },
                { status: 400, headers: corsHeaders }
              )
            }
          }

          // Handle IC number change
          if (icNumber && icNumber !== existingUser.icNumber) {
            // Check if new IC number already exists
            const icExists = await prisma.icRegistry.findUnique({
              where: { icNumber },
            })

            if (icExists) {
              return Response.json(
                { error: 'IC number already exists' },
                { status: 400, headers: corsHeaders }
              )
            }

            // Delete old IC registry entry if exists
            if (existingUser.icNumber) {
              await prisma.icRegistry.delete({
                where: { icNumber: existingUser.icNumber },
              })
            }

            // Create new IC registry entry
            await prisma.icRegistry.create({
              data: {
                icNumber,
                user: {
                  connect: { id: userId },
                },
              },
            })
          }

          // Update user
          const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
              ...(name && { name }),
              ...(email && { email }),
              ...(phoneNumber !== undefined && { phoneNumber: phoneNumber || null }),
              ...(address !== undefined && { address: address || null }),
              ...(emailVerified !== undefined && { emailVerified }),
            },
            select: {
              id: true,
              name: true,
              email: true,
              icNumber: true,
              phoneNumber: true,
              address: true,
              emailVerified: true,
              image: true,
              createdAt: true,
              updatedAt: true,
            },
          })

          return Response.json({ user: updatedUser }, { headers: corsHeaders })
        } catch (error) {
          console.error('Error updating user:', error)
          return Response.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
        }
      },

      DELETE: async ({ request }: { request: Request }) => {
        try {
          // Verify admin session
          const admin = await requireAdminFromHeaders(request.headers)
          if (!admin) {
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
          }

          // Extract user ID from URL
          const url = new URL(request.url)
          const pathParts = url.pathname.split('/')
          const userId = pathParts[pathParts.length - 1]

          if (!userId) {
            return Response.json({ error: 'User ID is required' }, { status: 400, headers: corsHeaders })
          }

          // Check if user exists
          const existingUser = await prisma.user.findUnique({
            where: { id: userId },
            include: {
              _count: {
                select: {
                  agreements: true,
                  assets: true,
                },
              },
            },
          })

          if (!existingUser) {
            return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })
          }

          // Check if user has agreements or assets
          if (existingUser._count.agreements > 0 || existingUser._count.assets > 0) {
            return Response.json(
              {
                error: 'Cannot delete user with existing agreements or assets',
                details: {
                  agreements: existingUser._count.agreements,
                  assets: existingUser._count.assets,
                },
              },
              { status: 400, headers: corsHeaders }
            )
          }

          // Delete user (cascade will handle related records)
          await prisma.user.delete({
            where: { id: userId },
          })

          return Response.json({ success: true, message: 'User deleted successfully' }, { headers: corsHeaders })
        } catch (error) {
          console.error('Error deleting user:', error)
          return Response.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
        }
      },
    },
  },
})
