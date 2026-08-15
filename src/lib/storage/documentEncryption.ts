import {
  ALGORITHM,
  KEY_BYTES,
  KEY_VERSION,
  generateFek,
  unwrapFek,
  unwrapFekWithKey,
  wrapFek,
  wrapFekWithKey,
} from './encryption'
import type { WrappedKey } from './encryption'
import { prisma } from '@/db'

export const DOCUMENT_QUESTION_IDS = [
  'firstSchool',
  'childhoodFriend',
  'memorablePlace',
] as const
export type DocumentQuestionId = (typeof DOCUMENT_QUESTION_IDS)[number]

export class DocumentEncryptionError extends Error {
  constructor(
    readonly code:
      | 'INVALID_INPUT'
      | 'NOT_CONFIGURED'
      | 'ALREADY_CONFIGURED'
      | 'WRONG_ANSWER',
    message: string,
  ) {
    super(message)
    this.name = 'DocumentEncryptionError'
  }
}

export function normalizeDocumentAnswer(answer: string): string {
  return answer.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function validateDocumentAnswer(answer: unknown): string {
  if (typeof answer !== 'string') {
    throw new DocumentEncryptionError(
      'INVALID_INPUT',
      'Answer must be 12–128 characters',
    )
  }
  const normalized = normalizeDocumentAnswer(answer)
  if (normalized.length < 12 || normalized.length > 128) {
    throw new DocumentEncryptionError(
      'INVALID_INPUT',
      'Answer must be 12–128 characters',
    )
  }
  return normalized
}

export function validateQuestionId(questionId: unknown): DocumentQuestionId {
  if (!DOCUMENT_QUESTION_IDS.includes(questionId as DocumentQuestionId)) {
    throw new DocumentEncryptionError(
      'INVALID_INPUT',
      'Invalid security question',
    )
  }
  return questionId as DocumentQuestionId
}

export function getDocumentRecoveryKey(): Buffer {
  const value = process.env.DOCUMENT_RECOVERY_KEY?.trim()
  if (!value) throw new Error('Document recovery key is not configured')
  const key = /^[a-f\d]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64')
  if (key.length !== KEY_BYTES)
    throw new Error('Document recovery key is invalid')
  return key
}

function answerWrapped(record: {
  answerWrappedFek: Uint8Array
  answerSalt: Uint8Array
  answerIv: Uint8Array
  answerAuthTag: Uint8Array
  algorithm: string
  keyVersion: number
}): WrappedKey {
  return {
    wrappedKey: Buffer.from(record.answerWrappedFek),
    salt: Buffer.from(record.answerSalt),
    iv: Buffer.from(record.answerIv),
    authTag: Buffer.from(record.answerAuthTag),
    algorithm: record.algorithm,
    keyVersion: record.keyVersion,
  }
}

function bytes(value: Buffer): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(value)
}

export async function getDocumentEncryptionStatus(userId: string) {
  const record = await prisma.userDocumentEncryptionKey.findUnique({
    where: { userId },
    select: { questionId: true, keyVersion: true },
  })
  return record
    ? {
        configured: true,
        questionId: record.questionId,
        keyVersion: record.keyVersion,
      }
    : { configured: false, questionId: null, keyVersion: null }
}

export async function configureDocumentEncryption(
  userId: string,
  questionId: unknown,
  answer: unknown,
) {
  const question = validateQuestionId(questionId)
  const secret = validateDocumentAnswer(answer)
  const fek = generateFek()
  const answerWrap = wrapFek(fek, secret)
  const recoveryWrap = wrapFekWithKey(fek, getDocumentRecoveryKey())
  try {
    return await prisma.userDocumentEncryptionKey.create({
      data: {
        userId,
        questionId: question,
        answerWrappedFek: bytes(answerWrap.wrappedKey),
        answerSalt: bytes(answerWrap.salt),
        answerIv: bytes(answerWrap.iv),
        answerAuthTag: bytes(answerWrap.authTag),
        recoveryWrappedFek: bytes(recoveryWrap.wrappedKey),
        recoveryIv: bytes(recoveryWrap.iv),
        recoveryAuthTag: bytes(recoveryWrap.authTag),
        algorithm: ALGORITHM,
        keyVersion: KEY_VERSION,
        recoveryKeyVersion: 1,
      },
      select: { questionId: true, keyVersion: true },
    })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new DocumentEncryptionError(
        'ALREADY_CONFIGURED',
        'Document encryption is already configured',
      )
    }
    throw error
  }
}

export async function updateDocumentEncryption(
  userId: string,
  currentAnswer: unknown,
  questionId: unknown,
  newAnswer: unknown,
) {
  const question = validateQuestionId(questionId)
  const currentSecret = validateDocumentAnswer(currentAnswer)
  const newSecret = validateDocumentAnswer(newAnswer)
  const record = await prisma.userDocumentEncryptionKey.findUnique({
    where: { userId },
  })
  if (!record)
    throw new DocumentEncryptionError(
      'NOT_CONFIGURED',
      'Document encryption is not configured',
    )

  let fek: Buffer
  try {
    fek = unwrapFek(answerWrapped(record), currentSecret)
  } catch {
    throw new DocumentEncryptionError(
      'WRONG_ANSWER',
      'Current answer is incorrect',
    )
  }
  const wrapped = wrapFek(fek, newSecret)
  return prisma.userDocumentEncryptionKey.update({
    where: { userId },
    data: {
      questionId: question,
      answerWrappedFek: bytes(wrapped.wrappedKey),
      answerSalt: bytes(wrapped.salt),
      answerIv: bytes(wrapped.iv),
      answerAuthTag: bytes(wrapped.authTag),
    },
    select: { questionId: true, keyVersion: true },
  })
}

export async function recoverDocumentFek(userId: string): Promise<Buffer> {
  const record = await prisma.userDocumentEncryptionKey.findUnique({
    where: { userId },
  })
  if (!record)
    throw new DocumentEncryptionError(
      'NOT_CONFIGURED',
      'Document encryption is not configured',
    )
  if (record.algorithm !== ALGORITHM || record.recoveryKeyVersion !== 1) {
    throw new Error('Unsupported document encryption key version')
  }
  return unwrapFekWithKey(
    {
      wrappedKey: Buffer.from(record.recoveryWrappedFek),
      iv: Buffer.from(record.recoveryIv),
      authTag: Buffer.from(record.recoveryAuthTag),
    },
    getDocumentRecoveryKey(),
  )
}
