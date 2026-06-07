import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

import { auth } from '../src/lib/auth'
import { parseAdminEmails } from '../src/lib/admin-allowlist'

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

/**
 * Promotes any already-registered users whose email is in the ADMIN_EMAILS
 * allowlist to ADMIN. Complements ensureAdminAccount() for additional admins
 * who signed up through the normal flow.
 */
async function promoteAllowlistedAdmins() {
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS)
  if (adminEmails.length === 0) {
    console.log('ℹ️  ADMIN_EMAILS is empty; no additional users promoted to ADMIN.')
    return
  }

  const result = await prisma.user.updateMany({
    where: { email: { in: adminEmails, mode: 'insensitive' } },
    data: { role: 'ADMIN' },
  })
  console.log(`✅ Promoted ${result.count} allowlisted user(s) to ADMIN`)
  console.log(`   Allowlist: ${adminEmails.join(', ')}`)
}

async function main() {
  console.log('🌱 Seeding database...')
  await ensureAdminAccount()
  await promoteAllowlistedAdmins()
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
