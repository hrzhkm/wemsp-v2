import { createFileRoute } from '@tanstack/react-router'

import { prisma } from '@/db'
import { auth } from '@/lib/auth/auth'

const VALID_REMINDER_DAYS = [1, 3, 7] as const
const VALID_LANGUAGES = ['en', 'ms'] as const

type NotificationPreferencePayload = {
  emailAgreementStatusUpdates: boolean
  emailExpiryReminders: boolean
  emailSignatureRequests: boolean
  emailWitnessConfirmation: boolean
  inAppAgreementStatusUpdates: boolean
  inAppExpiryReminders: boolean
  inAppSignatureRequests: boolean
  inAppWitnessConfirmation: boolean
  preferredLanguage: (typeof VALID_LANGUAGES)[number]
  reminderDays: Array<number>
}

function normalizeReminderDays(reminderDays: unknown): Array<number> {
  if (!Array.isArray(reminderDays)) return [1, 3, 7]
  const values = reminderDays
    .map((value) => Number(value))
    .filter((value) => VALID_REMINDER_DAYS.includes(value as (typeof VALID_REMINDER_DAYS)[number]))
  const normalized = [...new Set(values)].sort((a, b) => a - b)
  return normalized.length > 0 ? normalized : [1, 3, 7]
}

function normalizeLanguage(language: unknown): (typeof VALID_LANGUAGES)[number] | undefined {
  if (typeof language !== 'string') return undefined
  return VALID_LANGUAGES.includes(language as (typeof VALID_LANGUAGES)[number])
    ? (language as (typeof VALID_LANGUAGES)[number])
    : undefined
}

export const Route = createFileRoute('/api/user/notification-preferences/$')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const preferences = await prisma.userSetting.upsert({
          where: { userId: session.user.id },
          create: { userId: session.user.id },
          update: {},
        })

        return Response.json({
          settings: {
            preferredLanguage: normalizeLanguage(preferences.preferredLanguage) || 'en',
            emailSignatureRequests: preferences.emailSignatureRequests,
            inAppSignatureRequests: preferences.inAppSignatureRequests,
            emailAgreementStatusUpdates: preferences.emailAgreementStatusUpdates,
            inAppAgreementStatusUpdates: preferences.inAppAgreementStatusUpdates,
            emailWitnessConfirmation: preferences.emailWitnessConfirmation,
            inAppWitnessConfirmation: preferences.inAppWitnessConfirmation,
            emailExpiryReminders: preferences.emailExpiryReminders,
            inAppExpiryReminders: preferences.inAppExpiryReminders,
            reminderDays: preferences.reminderDays,
          },
        })
      },

      PUT: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let body: Partial<NotificationPreferencePayload>
        try {
          body = (await request.json()) as Partial<NotificationPreferencePayload>
        } catch (error) {
          console.error('Invalid notification preferences payload:', error)
          return Response.json({ error: 'Invalid request payload' }, { status: 400 })
        }

        try {
          const existingSettings = await prisma.userSetting.findUnique({
            where: { userId: session.user.id },
          })

          const nextSettings = {
            preferredLanguage:
              normalizeLanguage(body.preferredLanguage) ||
              normalizeLanguage(existingSettings?.preferredLanguage) ||
              'en',
            emailSignatureRequests:
              typeof body.emailSignatureRequests === 'boolean'
                ? body.emailSignatureRequests
                : (existingSettings?.emailSignatureRequests ?? true),
            inAppSignatureRequests:
              typeof body.inAppSignatureRequests === 'boolean'
                ? body.inAppSignatureRequests
                : (existingSettings?.inAppSignatureRequests ?? true),
            emailAgreementStatusUpdates:
              typeof body.emailAgreementStatusUpdates === 'boolean'
                ? body.emailAgreementStatusUpdates
                : (existingSettings?.emailAgreementStatusUpdates ?? true),
            inAppAgreementStatusUpdates:
              typeof body.inAppAgreementStatusUpdates === 'boolean'
                ? body.inAppAgreementStatusUpdates
                : (existingSettings?.inAppAgreementStatusUpdates ?? true),
            emailWitnessConfirmation:
              typeof body.emailWitnessConfirmation === 'boolean'
                ? body.emailWitnessConfirmation
                : (existingSettings?.emailWitnessConfirmation ?? true),
            inAppWitnessConfirmation:
              typeof body.inAppWitnessConfirmation === 'boolean'
                ? body.inAppWitnessConfirmation
                : (existingSettings?.inAppWitnessConfirmation ?? true),
            emailExpiryReminders:
              typeof body.emailExpiryReminders === 'boolean'
                ? body.emailExpiryReminders
                : (existingSettings?.emailExpiryReminders ?? true),
            inAppExpiryReminders:
              typeof body.inAppExpiryReminders === 'boolean'
                ? body.inAppExpiryReminders
                : (existingSettings?.inAppExpiryReminders ?? true),
            reminderDays:
              body.reminderDays !== undefined
                ? normalizeReminderDays(body.reminderDays)
                : (existingSettings?.reminderDays ?? [1, 3, 7]),
          }

          const preferences = await prisma.userSetting.upsert({
            where: { userId: session.user.id },
            create: {
              userId: session.user.id,
              ...nextSettings,
            },
            update: nextSettings,
          })

          return Response.json({
            settings: {
              preferredLanguage: normalizeLanguage(preferences.preferredLanguage) || 'en',
              emailSignatureRequests: preferences.emailSignatureRequests,
              inAppSignatureRequests: preferences.inAppSignatureRequests,
              emailAgreementStatusUpdates: preferences.emailAgreementStatusUpdates,
              inAppAgreementStatusUpdates: preferences.inAppAgreementStatusUpdates,
              emailWitnessConfirmation: preferences.emailWitnessConfirmation,
              inAppWitnessConfirmation: preferences.inAppWitnessConfirmation,
              emailExpiryReminders: preferences.emailExpiryReminders,
              inAppExpiryReminders: preferences.inAppExpiryReminders,
              reminderDays: preferences.reminderDays,
            },
            success: true,
          })
        } catch (error) {
          console.error('Error updating notification preferences:', error)
          return Response.json({ error: 'Internal Server Error' }, { status: 500 })
        }
      },
    },
  },
})
