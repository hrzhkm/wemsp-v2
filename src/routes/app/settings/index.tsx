import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, ChevronRight, KeyRound, Languages, Loader2, Monitor, Search, Shield, Smartphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { authClient } from '@/lib/auth/authClient'
import { useLanguage } from '@/lib/i18n/context'

export const Route = createFileRoute('/app/settings/')({
  component: RouteComponent,
})

type SettingsPanel = 'active-sessions' | 'change-password' | 'language' | 'notifications' | 'two-factor'
type NotificationPreferenceKey =
  | 'emailAgreementStatusUpdates'
  | 'emailExpiryReminders'
  | 'emailSignatureRequests'
  | 'emailWitnessConfirmation'
  | 'inAppAgreementStatusUpdates'
  | 'inAppExpiryReminders'
  | 'inAppSignatureRequests'
  | 'inAppWitnessConfirmation'

type NotificationPreferences = {
  emailAgreementStatusUpdates: boolean
  emailExpiryReminders: boolean
  emailSignatureRequests: boolean
  emailWitnessConfirmation: boolean
  inAppAgreementStatusUpdates: boolean
  inAppExpiryReminders: boolean
  inAppSignatureRequests: boolean
  inAppWitnessConfirmation: boolean
  reminderDays: Array<number>
}

type AppLanguage = 'en' | 'ms'

type UserSettings = NotificationPreferences & {
  preferredLanguage: AppLanguage
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailAgreementStatusUpdates: true,
  emailExpiryReminders: true,
  emailSignatureRequests: true,
  emailWitnessConfirmation: true,
  inAppAgreementStatusUpdates: true,
  inAppExpiryReminders: true,
  inAppSignatureRequests: true,
  inAppWitnessConfirmation: true,
  reminderDays: [1, 3, 7],
}

function RouteComponent() {
  const { language, setLanguage, t } = useLanguage()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const [selectedPanel, setSelectedPanel] = useState<SettingsPanel>('language')
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [revokeOtherSessionsOnPasswordChange, setRevokeOtherSessionsOnPasswordChange] = useState(true)
  const [passwordForm, setPasswordForm] = useState({
    confirmNewPassword: '',
    currentPassword: '',
    newPassword: '',
  })
  const [pendingLanguage, setPendingLanguage] = useState<AppLanguage>(language)
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  )
  const { data: sessionData } = authClient.useSession()
  const currentSessionToken = (sessionData as any)?.session?.token

  const sessionsQuery = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: async () => {
      const response = await (authClient as any).listSessions()
      if (response?.error) {
        throw new Error(response.error.message || t('settings.errors.fetchSessions'))
      }
      return Array.isArray(response?.data) ? response.data : []
    },
  })

  const sessions = useMemo(
    () =>
      (sessionsQuery.data || []).sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [sessionsQuery.data]
  )

  const notificationPreferencesQuery = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const response = await fetch('/api/user/notification-preferences', { method: 'GET' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || t('settings.errors.loadNotificationPreferences'))
      }
      return data.settings as UserSettings
    },
  })

  useEffect(() => {
    if (!notificationPreferencesQuery.data) return
    setNotificationPreferences({
      ...notificationPreferencesQuery.data,
      reminderDays: [...notificationPreferencesQuery.data.reminderDays].sort((a, b) => a - b),
    })
    setPendingLanguage(notificationPreferencesQuery.data.preferredLanguage)
  }, [notificationPreferencesQuery.data])

  const saveNotificationPreferencesMutation = useMutation({
    mutationFn: async (preferences: NotificationPreferences) => {
      const response = await fetch('/api/user/notification-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || t('settings.errors.saveNotificationPreferences'))
      }
      return data.settings as UserSettings
    },
    onError: (error: any) => {
      toast.error(error.message || t('settings.errors.saveNotificationPreferences'))
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(['notification-preferences'], settings)
      setNotificationPreferences({
        ...settings,
        reminderDays: [...settings.reminderDays].sort((a, b) => a - b),
      })
      setPendingLanguage(settings.preferredLanguage)
      toast.success(t('settings.messages.notificationPreferencesUpdated'))
    },
  })

  const saveLanguagePreferencesMutation = useMutation({
    mutationFn: async (nextLanguage: AppLanguage) => {
      const response = await fetch('/api/user/notification-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferredLanguage: nextLanguage,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || t('settings.errors.saveLanguagePreference'))
      }
      return data.settings as UserSettings
    },
    onError: (error: any) => {
      toast.error(error.message || t('settings.errors.saveLanguagePreference'))
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(['notification-preferences'], settings)
      setPendingLanguage(settings.preferredLanguage)
      setLanguage(settings.preferredLanguage)
      toast.success(t('settings.messages.languagePreferenceSaved'))
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const response = await (authClient as any).changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        revokeOtherSessions: revokeOtherSessionsOnPasswordChange,
      })
      if (response?.error) {
        throw new Error(response.error.message || t('settings.errors.changePassword'))
      }
      return response
    },
    onError: (error: any) => {
      toast.error(error.message || t('settings.errors.changePassword'))
    },
    onSuccess: async () => {
      toast.success(t('settings.messages.passwordUpdated'))
      setPasswordForm({
        confirmNewPassword: '',
        currentPassword: '',
        newPassword: '',
      })
      await queryClient.invalidateQueries({ queryKey: ['auth-sessions'] })
      await queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })

  const revokeOtherSessionsMutation = useMutation({
    mutationFn: async () => {
      const response = await (authClient as any).revokeOtherSessions()
      if (response?.error) {
        throw new Error(response.error.message || t('settings.errors.revokeOtherSessions'))
      }
      return response
    },
    onError: (error: any) => {
      toast.error(error.message || t('settings.errors.revokeOtherSessions'))
    },
    onSuccess: async () => {
      toast.success(t('settings.messages.otherSessionsLoggedOut'))
      await queryClient.invalidateQueries({ queryKey: ['auth-sessions'] })
    },
  })

  const revokeSessionMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await (authClient as any).revokeSession({ token })
      if (response?.error) {
        throw new Error(response.error.message || t('settings.errors.revokeSession'))
      }
      return response
    },
    onError: (error: any) => {
      toast.error(error.message || t('settings.errors.revokeSession'))
    },
    onSuccess: async () => {
      toast.success(t('settings.messages.sessionRemoved'))
      await queryClient.invalidateQueries({ queryKey: ['auth-sessions'] })
    },
  })

  const onChangePassword = (event: React.FormEvent) => {
    event.preventDefault()
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmNewPassword) {
      toast.error(t('settings.errors.passwordFieldsRequired'))
      return
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error(t('settings.errors.passwordMinLength'))
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      toast.error(t('settings.errors.passwordsDoNotMatch'))
      return
    }
    changePasswordMutation.mutate()
  }

  const formatDateTime = (value?: string) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString(language === 'ms' ? 'ms-MY' : 'en-US', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const updateNotificationPreference = (key: NotificationPreferenceKey, checked: boolean) => {
    setNotificationPreferences((prev) => ({
      ...prev,
      [key]: checked,
    }))
  }

  const toggleReminderDay = (day: number) => {
    setNotificationPreferences((prev) => {
      const hasDay = prev.reminderDays.includes(day)
      const reminderDays = hasDay
        ? prev.reminderDays.filter((value) => value !== day)
        : [...prev.reminderDays, day]
      return {
        ...prev,
        reminderDays: reminderDays.sort((a, b) => a - b),
      }
    })
  }

  const normalizedNotificationState = useMemo(
    () => ({
      ...notificationPreferences,
      reminderDays: [...notificationPreferences.reminderDays].sort((a, b) => a - b),
    }),
    [notificationPreferences]
  )

  const normalizedServerNotificationState = useMemo(() => {
    const source = notificationPreferencesQuery.data || DEFAULT_NOTIFICATION_PREFERENCES
    return {
      emailAgreementStatusUpdates: source.emailAgreementStatusUpdates,
      emailExpiryReminders: source.emailExpiryReminders,
      emailSignatureRequests: source.emailSignatureRequests,
      emailWitnessConfirmation: source.emailWitnessConfirmation,
      inAppAgreementStatusUpdates: source.inAppAgreementStatusUpdates,
      inAppExpiryReminders: source.inAppExpiryReminders,
      inAppSignatureRequests: source.inAppSignatureRequests,
      inAppWitnessConfirmation: source.inAppWitnessConfirmation,
      reminderDays: [...source.reminderDays].sort((a, b) => a - b),
    }
  }, [notificationPreferencesQuery.data])

  const notificationPreferencesChanged = useMemo(() => {
    return JSON.stringify(normalizedNotificationState) !== JSON.stringify(normalizedServerNotificationState)
  }, [normalizedNotificationState, normalizedServerNotificationState])

  const saveNotificationPreferences = () => {
    saveNotificationPreferencesMutation.mutate(normalizedNotificationState)
  }

  const languageHasChanges = pendingLanguage !== language
  const settingsPanels = useMemo<Record<SettingsPanel, { description: string; title: string }>>(
    () => ({
      'active-sessions': {
        description: t('settings.activeSessionsDescription'),
        title: t('settings.activeSessionsTitle'),
      },
      'change-password': {
        description: t('settings.changePasswordDescription'),
        title: t('settings.changePasswordTitle'),
      },
      language: {
        description: t('settings.languageDescription'),
        title: t('settings.languageTitle'),
      },
      notifications: {
        description: t('settings.notificationsDescription'),
        title: t('settings.notificationsTitle'),
      },
      'two-factor': {
        description: t('settings.twoFactorDescription'),
        title: t('settings.twoFactorTitle'),
      },
    }),
    [t]
  )

  const leftNavItems = useMemo(
    () => [
      {
        description: t('settings.languageDescription'),
        icon: <Languages className="h-4 w-4" />,
        id: 'language' as const,
        label: t('settings.languageTitle'),
      },
      {
        description: t('settings.notificationsDescription'),
        icon: <Bell className="h-4 w-4" />,
        id: 'notifications' as const,
        label: t('settings.notificationsTitle'),
      },
      {
        description: t('settings.changePasswordDescription'),
        icon: <KeyRound className="h-4 w-4" />,
        id: 'change-password' as const,
        label: t('settings.changePasswordTitle'),
      },
      {
        description: t('settings.activeSessionsDescription'),
        icon: <Monitor className="h-4 w-4" />,
        id: 'active-sessions' as const,
        label: t('settings.activeSessionsTitle'),
      },
      {
        description: t('settings.twoFactorDescription'),
        icon: <Smartphone className="h-4 w-4" />,
        id: 'two-factor' as const,
        label: t('settings.twoFactorTitle'),
      },
    ],
    [t]
  )

  const filteredNavItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return leftNavItems
    return leftNavItems.filter(
      (item) =>
        item.label.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term)
    )
  }, [leftNavItems, searchTerm])

  const selectedPanelInfo = settingsPanels[selectedPanel]

  const renderPanelContent = () => {
    if (selectedPanel === 'language') {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant={pendingLanguage === 'en' ? 'default' : 'outline'}
              className="justify-between"
              onClick={() => setPendingLanguage('en')}
            >
              {t('settings.english')}
              {pendingLanguage === 'en' ? <Check className="h-4 w-4" /> : null}
            </Button>

            <Button
              type="button"
              variant={pendingLanguage === 'ms' ? 'default' : 'outline'}
              className="justify-between"
              onClick={() => setPendingLanguage('ms')}
            >
              {t('settings.malay')}
              {pendingLanguage === 'ms' ? <Check className="h-4 w-4" /> : null}
            </Button>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => saveLanguagePreferencesMutation.mutate(pendingLanguage)}
              disabled={!languageHasChanges || saveLanguagePreferencesMutation.isPending}
            >
              {saveLanguagePreferencesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('settings.saving')}
                </>
              ) : (
                t('settings.saveSettings')
              )}
            </Button>
          </div>
        </div>
      )
    }

    if (selectedPanel === 'notifications') {
      const notificationItems: Array<{
        description: string
        emailKey: NotificationPreferenceKey
        inAppKey: NotificationPreferenceKey
        label: string
      }> = [
        {
          label: t('settings.notificationTypes.signatureRequestsTitle'),
          description: t('settings.notificationTypes.signatureRequestsDescription'),
          emailKey: 'emailSignatureRequests',
          inAppKey: 'inAppSignatureRequests',
        },
        {
          label: t('settings.notificationTypes.agreementStatusUpdatesTitle'),
          description: t('settings.notificationTypes.agreementStatusUpdatesDescription'),
          emailKey: 'emailAgreementStatusUpdates',
          inAppKey: 'inAppAgreementStatusUpdates',
        },
        {
          label: t('settings.notificationTypes.witnessConfirmationTitle'),
          description: t('settings.notificationTypes.witnessConfirmationDescription'),
          emailKey: 'emailWitnessConfirmation',
          inAppKey: 'inAppWitnessConfirmation',
        },
        {
          label: t('settings.notificationTypes.expiryRemindersTitle'),
          description: t('settings.notificationTypes.expiryRemindersDescription'),
          emailKey: 'emailExpiryReminders',
          inAppKey: 'inAppExpiryReminders',
        },
      ]

      return (
        <div className="space-y-5">
          {notificationPreferencesQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('settings.loadingNotificationPreferences')}
            </div>
          ) : null}

          {notificationPreferencesQuery.isError ? (
            <p className="text-sm text-destructive">{t('settings.unableToLoadNotificationPreferences')}</p>
          ) : null}

          {!notificationPreferencesQuery.isLoading && !notificationPreferencesQuery.isError ? (
            <>
              <div className="overflow-hidden rounded-lg border border-border/70">
                <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem] gap-2 border-b border-border/70 bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <p>{t('settings.alertType')}</p>
                  <p className="text-center">{t('settings.email')}</p>
                  <p className="text-center">{t('settings.inApp')}</p>
                </div>
                {notificationItems.map((item, index) => (
                  <div
                    key={item.label}
                    className={`grid grid-cols-[minmax(0,1fr)_5rem_5rem] items-center gap-2 px-4 py-3 ${
                      index > 0 ? 'border-t border-border/70' : ''
                    }`}
                  >
                    <div className="pr-2">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={notificationPreferences[item.emailKey]}
                        onCheckedChange={(checked) => updateNotificationPreference(item.emailKey, Boolean(checked))}
                        aria-label={`${item.label} ${t('settings.emailNotificationsSuffix')}`}
                      />
                    </div>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={notificationPreferences[item.inAppKey]}
                        onCheckedChange={(checked) => updateNotificationPreference(item.inAppKey, Boolean(checked))}
                        aria-label={`${item.label} ${t('settings.inAppNotificationsSuffix')}`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-lg border border-border/70 p-4">
                <div>
                  <p className="text-sm font-medium">{t('settings.reminderTimingTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.reminderTimingDescription')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { day: 1, label: t('settings.reminderDays.oneDay') },
                    { day: 3, label: t('settings.reminderDays.threeDays') },
                    { day: 7, label: t('settings.reminderDays.sevenDays') },
                  ].map((item) => (
                    <Button
                      key={item.day}
                      type="button"
                      variant={notificationPreferences.reminderDays.includes(item.day) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleReminderDay(item.day)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={saveNotificationPreferences}
                  disabled={!notificationPreferencesChanged || saveNotificationPreferencesMutation.isPending}
                >
                  {saveNotificationPreferencesMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('settings.saving')}
                    </>
                  ) : (
                    t('settings.saveNotificationPreferences')
                  )}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )
    }

    if (selectedPanel === 'change-password') {
      return (
        <form onSubmit={onChangePassword}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="currentPassword">{t('settings.currentPasswordLabel')}</FieldLabel>
              <Input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    currentPassword: event.target.value,
                  }))
                }
                disabled={changePasswordMutation.isPending}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="newPassword">{t('settings.newPasswordLabel')}</FieldLabel>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    newPassword: event.target.value,
                  }))
                }
                disabled={changePasswordMutation.isPending}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmNewPassword">{t('settings.confirmNewPasswordLabel')}</FieldLabel>
              <Input
                id="confirmNewPassword"
                type="password"
                value={passwordForm.confirmNewPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirmNewPassword: event.target.value,
                  }))
                }
                disabled={changePasswordMutation.isPending}
                required
              />
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={revokeOtherSessionsOnPasswordChange}
                onCheckedChange={(checked) => setRevokeOtherSessionsOnPasswordChange(Boolean(checked))}
                disabled={changePasswordMutation.isPending}
              />
              {t('settings.logOutOtherDevicesAfterPasswordChange')}
            </label>
            <Button type="submit" disabled={changePasswordMutation.isPending} className="w-fit">
              {changePasswordMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('settings.updating')}
                </>
              ) : (
                t('settings.updatePassword')
              )}
            </Button>
          </FieldGroup>
        </form>
      )
    }

    if (selectedPanel === 'active-sessions') {
      return (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={revokeOtherSessionsMutation.isPending || sessionsQuery.isPending}
              onClick={() => revokeOtherSessionsMutation.mutate()}
            >
              {revokeOtherSessionsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('settings.loggingOut')}
                </>
              ) : (
                t('settings.logOutOtherDevices')
              )}
            </Button>
          </div>

          {sessionsQuery.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('settings.loadingSessions')}
            </div>
          ) : null}

          {sessionsQuery.isError ? (
            <p className="text-sm text-destructive">{t('settings.unableToLoadActiveSessions')}</p>
          ) : null}

          {!sessionsQuery.isPending && !sessionsQuery.isError && sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.noActiveSessionsFound')}</p>
          ) : null}

          {sessions.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border/70">
              {sessions.map((session: any, index: number) => {
                const isCurrentSession = Boolean(currentSessionToken && session.token === currentSessionToken)
                return (
                  <div
                    key={session.id}
                    className={`space-y-2 p-4 ${index > 0 ? 'border-t border-border/70' : ''}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {isCurrentSession ? t('settings.currentDevice') : t('settings.signedInDevice')}
                      </div>
                      {!isCurrentSession ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={revokeSessionMutation.isPending}
                          onClick={() => revokeSessionMutation.mutate(session.token)}
                        >
                          {t('settings.logOut')}
                        </Button>
                      ) : (
                        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {t('settings.currentBadge')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{t('settings.createdLabel')}: {formatDateTime(session.createdAt)}</p>
                    <p className="text-xs text-muted-foreground">{t('settings.expiresLabel')}: {formatDateTime(session.expiresAt)}</p>
                    {session.ipAddress ? (
                      <p className="text-xs text-muted-foreground">{t('settings.ipLabel')}: {session.ipAddress}</p>
                    ) : null}
                    {session.userAgent ? (
                      <p className="line-clamp-2 break-words text-xs text-muted-foreground">{session.userAgent}</p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {t('settings.twoFactorNotEnabled')}
        </div>
        <Button type="button" variant="outline" disabled>
          {t('settings.enableTwoFactorComingSoon')}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[120rem] space-y-4 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[30rem_minmax(0,1fr)] lg:items-stretch">
        <Card className="flex flex-col border-border/70 lg:min-h-[36rem]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('settings.title')}
            </CardTitle>
            <CardDescription>{t('settings.browseDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('settings.searchPlaceholder')}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-border/70">
              {filteredNavItems.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">{t('settings.noSettingsMatchSearch')}</div>
              ) : (
                filteredNavItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedPanel(item.id)
                      if (isMobile) {
                        setMobilePanelOpen(true)
                      }
                    }}
                    className={`flex min-h-[5.5rem] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                      selectedPanel === item.id ? 'bg-primary/10' : 'hover:bg-muted/40'
                    } ${index > 0 ? 'border-t border-border/70' : ''}`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 text-muted-foreground">{item.icon}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.label}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hidden min-w-0 w-full flex-col overflow-hidden border-border/70 md:flex md:min-h-[36rem]">
          <CardHeader className="border-b border-border/70">
            <CardTitle>{selectedPanelInfo.title}</CardTitle>
            <CardDescription>{selectedPanelInfo.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pt-6">{renderPanelContent()}</CardContent>
        </Card>
      </div>

      <Sheet open={isMobile && mobilePanelOpen} onOpenChange={setMobilePanelOpen}>
        <SheetContent
          side="right"
          className="inset-0 h-dvh w-[100dvw] max-w-[100dvw] overflow-hidden gap-0 rounded-none border-0 p-0 sm:max-w-[100dvw]"
        >
          <SheetHeader className="border-b border-border/70">
            <SheetTitle>{selectedPanelInfo.title}</SheetTitle>
            <SheetDescription>{selectedPanelInfo.description}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4">{renderPanelContent()}</div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
