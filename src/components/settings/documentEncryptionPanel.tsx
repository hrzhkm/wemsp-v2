import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {  useEffect, useState } from 'react'
import { toast } from 'sonner'
import type {FormEvent} from 'react';
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLanguage } from '@/lib/i18n/context'

type Status = {
  configured: boolean
  questionId: string | null
  keyVersion: number | null
}

const QUESTION_IDS = [
  'firstSchool',
  'childhoodFriend',
  'memorablePlace',
] as const

export function DocumentEncryptionPanel() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [questionId, setQuestionId] = useState<string>(QUESTION_IDS[0])
  const [form, setForm] = useState({
    answer: '',
    confirmAnswer: '',
    currentAnswer: '',
  })
  const status = useQuery<Status>({
    queryKey: ['document-encryption'],
    queryFn: async () => {
      const response = await fetch('/api/user/document-encryption')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      return data
    },
  })

  useEffect(() => {
    if (status.data?.questionId) setQuestionId(status.data.questionId)
  }, [status.data?.questionId])

  const save = useMutation({
    mutationFn: async () => {
      const configured = Boolean(status.data?.configured)
      const response = await fetch('/api/user/document-encryption', {
        method: configured ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          configured
            ? {
                currentAnswer: form.currentAnswer,
                questionId,
                newAnswer: form.answer,
                confirmNewAnswer: form.confirmAnswer,
              }
            : {
                questionId,
                answer: form.answer,
                confirmAnswer: form.confirmAnswer,
              },
        ),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      return data as Status
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: (data) => {
      queryClient.setQueryData(['document-encryption'], data)
      setForm({ answer: '', confirmAnswer: '', currentAnswer: '' })
      toast.success(t('settings.documentEncryption.saved'))
    },
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }

  if (status.isPending) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }
  if (status.isError) {
    return (
      <p className="text-sm text-destructive">
        {t('settings.documentEncryption.loadError')}
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {status.data.configured
          ? t('settings.documentEncryption.configuredDescription')
          : t('settings.documentEncryption.setupDescription')}
      </p>
      <FieldGroup>
        {status.data.configured ? (
          <Field>
            <FieldLabel htmlFor="currentDocumentAnswer">
              {t('settings.documentEncryption.currentAnswer')}
            </FieldLabel>
            <Input
              id="currentDocumentAnswer"
              type="password"
              autoComplete="off"
              minLength={12}
              maxLength={128}
              value={form.currentAnswer}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  currentAnswer: event.target.value,
                }))
              }
              required
            />
          </Field>
        ) : null}
        <Field>
          <FieldLabel>{t('settings.documentEncryption.question')}</FieldLabel>
          <Select value={questionId} onValueChange={setQuestionId}>
            <SelectTrigger
              aria-label={t('settings.documentEncryption.question')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {t(`settings.documentEncryption.questions.${id}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="documentAnswer">
            {status.data.configured
              ? t('settings.documentEncryption.newAnswer')
              : t('settings.documentEncryption.answer')}
          </FieldLabel>
          <Input
            id="documentAnswer"
            type="password"
            autoComplete="off"
            minLength={12}
            maxLength={128}
            value={form.answer}
            onChange={(event) =>
              setForm((value) => ({ ...value, answer: event.target.value }))
            }
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmDocumentAnswer">
            {t('settings.documentEncryption.confirmAnswer')}
          </FieldLabel>
          <Input
            id="confirmDocumentAnswer"
            type="password"
            autoComplete="off"
            minLength={12}
            maxLength={128}
            value={form.confirmAnswer}
            onChange={(event) =>
              setForm((value) => ({
                ...value,
                confirmAnswer: event.target.value,
              }))
            }
            required
          />
        </Field>
      </FieldGroup>
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {status.data.configured
            ? t('settings.documentEncryption.update')
            : t('settings.documentEncryption.configure')}
        </Button>
      </div>
    </form>
  )
}
