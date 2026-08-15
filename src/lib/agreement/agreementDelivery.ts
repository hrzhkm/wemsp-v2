import { buildAgreementPdf } from './agreementPdf'
import { prisma } from '@/db'
import { sendEmail } from '@/lib/email'

export interface AgreementDocumentDeliveryResult {
  recipients: Array<string>
  deliveredTo: Array<string>
}

const AGREEMENT_DOCUMENT_INCLUDE = {
  owner: {
    select: { id: true, name: true, email: true },
  },
  witness: {
    select: { id: true, name: true, email: true },
  },
  assets: {
    include: {
      asset: {
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          value: true,
        },
      },
    },
  },
  beneficiaries: {
    include: {
      familyMember: {
        select: {
          id: true,
          relation: true,
          familyMemberUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      nonRegisteredFamilyMember: {
        select: { id: true, name: true, relation: true },
      },
    },
  },
} as const

/**
 * Generate the finalized agreement document and email it to the owner and
 * registered beneficiaries. Best-effort: callers must not let a delivery
 * failure roll back agreement finalization.
 */
export async function sendFinalizedAgreementDocument(
  agreementId: string,
): Promise<AgreementDocumentDeliveryResult> {
  const agreement = await prisma.agreement.findUnique({
    where: { id: agreementId },
    include: AGREEMENT_DOCUMENT_INCLUDE,
  })

  if (!agreement) {
    throw new Error('Agreement not found')
  }

  const pdf = await buildAgreementPdf(agreement)

  const recipientUsers = [
    { userId: agreement.ownerId, email: agreement.owner.email },
    ...agreement.beneficiaries.flatMap((beneficiary) =>
      beneficiary.familyMember?.familyMemberUser
        ? [
            {
              userId: beneficiary.familyMember.familyMemberUser.id,
              email: beneficiary.familyMember.familyMemberUser.email,
            },
          ]
        : [],
    ),
  ]

  const uniqueRecipients = new Map<string, string>()
  for (const recipient of recipientUsers) {
    if (recipient.email) {
      uniqueRecipients.set(recipient.email, recipient.userId)
    }
  }

  const recipients = [...uniqueRecipients.keys()]
  const optedOutUserIds = await getOptedOutStatusUpdateUserIds([
    ...uniqueRecipients.values(),
  ])

  const deliveredTo: Array<string> = []
  for (const [email, userId] of uniqueRecipients) {
    if (optedOutUserIds.has(userId)) {
      continue
    }
    await sendEmail(
      email,
      `WEMSP Agreement Document: ${agreement.title}`,
      buildDocumentEmailBody(agreement.title, agreement.id),
      [
        {
          filename: `agreement-${sanitizeFileName(agreement.id)}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    )
    deliveredTo.push(email)
  }

  await prisma.agreement.update({
    where: { id: agreement.id },
    data: { documentSentAt: new Date() },
  })

  return { recipients, deliveredTo }
}

async function getOptedOutStatusUpdateUserIds(
  userIds: Array<string>,
): Promise<Set<string>> {
  if (userIds.length === 0) {
    return new Set()
  }

  const settings = await prisma.userSetting.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, emailAgreementStatusUpdates: true },
  })

  return new Set(
    settings
      .filter((setting) => setting.emailAgreementStatusUpdates === false)
      .map((setting) => setting.userId),
  )
}

function buildDocumentEmailBody(title: string, agreementId: string): string {
  return [
    `Your WEMSP agreement has been fully signed and is now active.`,
    ``,
    `Agreement: ${title}`,
    `Agreement ID: ${agreementId}`,
    ``,
    `The complete agreement document is attached to this email for your records.`,
    ``,
    `This generated document is an application record for review and audit. Islamic distribution outcomes may require qualified religious, legal, or administrative review.`,
  ].join('\n')
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}
