import { PrismaClient } from '../src/generated/prisma/client.js'

import { PrismaPg } from '@prisma/adapter-pg'
import { parseAdminEmails } from '../src/lib/admin-allowlist'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing todos
  await prisma.todo.deleteMany()

  // Create example todos
  const todos = await prisma.todo.createMany({
    data: [
      { title: 'Buy groceries' },
      { title: 'Read a book' },
      { title: 'Workout' },
    ],
  })

  console.log(`✅ Created ${todos.count} todos`)

  // Promote allowlisted users to ADMIN. Admins are normal User accounts
  // (created via the shared signup); we only elevate their role here.
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS)
  if (adminEmails.length === 0) {
    console.log('ℹ️  ADMIN_EMAILS is empty; no users promoted to ADMIN.')
  } else {
    const result = await prisma.user.updateMany({
      where: { email: { in: adminEmails, mode: 'insensitive' } },
      data: { role: 'ADMIN' },
    })
    console.log(`✅ Promoted ${result.count} user(s) to ADMIN`)
    console.log(`   Allowlist: ${adminEmails.join(', ')}`)
    console.log('   (Users must sign up first; promotion only affects existing accounts.)')
  }
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
