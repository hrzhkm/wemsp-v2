import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

import { auth } from '../src/lib/auth/auth'

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
 * Idempotent AND authoritative: on every run the credential-account password
 * is re-synced to ADMIN_PASSWORD (using better-auth's own hasher), so changing
 * ADMIN_PASSWORD in the env and re-seeding actually updates the login password.
 */
async function ensureAdminAccount() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME || 'System Admin'

  // Never fall back to predictable credentials: a seed run with missing env
  // vars must fail loudly instead of provisioning a guessable ADMIN account.
  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set before running db:seed.',
    )
  }

  const existing = await prisma.user.findUnique({ where: { email } })

  if (!existing) {
    try {
      await auth.api.signUpEmail({ body: { email, password, name } })
      console.log(`✅ Created admin account: ${email}`)
    } catch (e) {
      // Don't swallow the failure: rethrow so main() exits non-zero instead
      // of reporting success while admin provisioning actually failed.
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`Failed to create admin account via better-auth: ${msg}`)
    }
  } else {
    console.log(
      `ℹ️  Admin account ${email} already exists; syncing password, role, verification.`,
    )
  }

  await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN', emailVerified: true },
  })

  // Re-sync the credential password to ADMIN_PASSWORD on every run, using
  // better-auth's own hasher so the stored hash verifies at login. This makes
  // the env value authoritative instead of only being set at creation time.
  const user = await prisma.user.findUnique({ where: { email } })
  if (user) {
    const authContext = await (
      auth as unknown as {
        $context: Promise<{
          password: { hash: (plain: string) => Promise<string> }
        }>
      }
    ).$context
    const hashedPassword = await authContext.password.hash(password)
    const result = await prisma.account.updateMany({
      where: { userId: user.id, providerId: 'credential' },
      data: { password: hashedPassword },
    })
    if (result.count === 0) {
      console.warn(
        '⚠️  No credential account found to set the password on. ' +
          'The admin may only have a social (e.g. Google) account.',
      )
    }
  }

  console.log(
    `✅ ${email} is now ADMIN and email-verified (password login ready).`,
  )
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
