import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

import { auth } from '../src/lib/auth'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const prisma = new PrismaClient({ adapter })

/**
 * Bootstraps a single admin account with a usable password.
 *
 * The account MUST be created through better-auth (`signUpEmail`) so the
 * password is hashed into better-auth's own format in the `account` table.
 * Writing a hash directly onto the user would never verify at login.
 *
 * After creation we set `emailVerified` (auth requires verification before
 * login) and promote `role` to ADMIN (the field is `input: false`, so it
 * cannot be set via the signup payload and must be elevated server-side).
 *
 * Idempotent: re-running only ensures role + verification on the existing user.
 */
async function ensureAdminAccount() {
  const email = (process.env.ADMIN_EMAIL || 'admin@wemsp.com').toLowerCase()
  const password = process.env.ADMIN_PASSWORD || 'admin12345'
  const name = process.env.ADMIN_NAME || 'System Admin'

  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      '⚠️  ADMIN_PASSWORD not set — using an insecure dev default. ' +
        'Set ADMIN_PASSWORD (and ADMIN_EMAIL) before seeding anything beyond local dev.',
    )
  }

  const existing = await prisma.user.findUnique({ where: { email } })

  if (!existing) {
    try {
      await auth.api.signUpEmail({ body: { email, password, name } })
      console.log(`✅ Created admin account: ${email}`)
    } catch (e) {
      console.error(
        '❌ Failed to create admin account via better-auth:',
        e instanceof Error ? e.message : e,
      )
      return
    }
  } else {
    console.log(`ℹ️  Admin account ${email} already exists; ensuring role + verification.`)
  }

  await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN', emailVerified: true },
  })
  console.log(`✅ ${email} is now ADMIN and email-verified (password login ready).`)
}

async function main() {
  console.log('🌱 Seeding database...')
  await ensureAdminAccount()
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
