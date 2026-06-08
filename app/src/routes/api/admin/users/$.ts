import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '@/db'
import { requireAdminFromHeaders } from '@/lib/auth/admin-guard'
import { corsHeaders } from '@/lib/cors'

export const Route = createFileRoute('/api/admin/users/$')({
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

          // Get query parameters for pagination and filtering
          const url = new URL(request.url)
          const page = parseInt(url.searchParams.get('page') || '1')
          const limit = parseInt(url.searchParams.get('limit') || '10')
          const search = url.searchParams.get('search') || ''
          const emailVerified = url.searchParams.get('emailVerified')

          const skip = (page - 1) * limit

          // Build where clause for search
          const where: any = search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { email: { contains: search, mode: 'insensitive' as const } },
                  { icNumber: { contains: search, mode: 'insensitive' as const } },
                ],
              }
            : {}

          if (emailVerified === 'true' || emailVerified === 'false') {
            where.emailVerified = emailVerified === 'true'
          }

          // Get total count for pagination
          const total = await prisma.user.count({ where })

          // Get users with pagination
          const users = await prisma.user.findMany({
            where,
            skip,
            take: limit,
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
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })

          return Response.json({
            users,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          }, { headers: corsHeaders })
        } catch (error) {
          console.error('Error fetching users:', error)
          return Response.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
        }
      },

      POST: async ({ request }: { request: Request }) => {
        try {
          // Verify admin session
          const admin = await requireAdminFromHeaders(request.headers)
          if (!admin) {
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
          }

          const body = await request.json()
          const { name, email, icNumber, phoneNumber, address, emailVerified } = body

          // Validate required fields
          if (!name || !email) {
            return Response.json(
              { error: 'Name and email are required' },
              { status: 400, headers: corsHeaders }
            )
          }

          // Check if email already exists
          const existingUser = await prisma.user.findUnique({
            where: { email },
          })

          if (existingUser) {
            return Response.json(
              { error: 'Email already exists' },
              { status: 400, headers: corsHeaders }
            )
          }

          // Check if IC number already exists (if provided)
          if (icNumber) {
            const existingIc = await prisma.icRegistry.findUnique({
              where: { icNumber },
            })

            if (existingIc) {
              return Response.json(
                { error: 'IC number already exists' },
                { status: 400, headers: corsHeaders }
              )
            }
          }

          // Create user with IC registry (if IC number provided)
          const userData: any = {
            id: crypto.randomUUID(),
            name,
            email,
            phoneNumber: phoneNumber || null,
            address: address || null,
            emailVerified: emailVerified || false,
          }

          if (icNumber) {
            // Create IC registry entry first
            await prisma.icRegistry.create({
              data: {
                icNumber,
                user: {
                  create: userData,
                },
              },
            })
          } else {
            await prisma.user.create({ data: userData })
          }

          // Fetch the created user
          const newUser = await prisma.user.findUnique({
            where: { email },
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

          return Response.json({ user: newUser }, { status: 201, headers: corsHeaders })
        } catch (error) {
          console.error('Error creating user:', error)
          return Response.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
        }
      },
    },
  },
})
