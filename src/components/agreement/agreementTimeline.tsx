import {
  History,
  Lock,
  PenLine,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export interface AgreementOnChainEventItem {
  type: string
  label: string
  txHash: string
  explorerUrl: string
  blockNumber: number
  occurredAt: string
  beneficiaryId?: string
  detail?: string
}

interface AgreementTimelineProps {
  events: Array<AgreementOnChainEventItem>
  beneficiaries?: Array<{ id: string; name: string }>
}

const EVENT_ICONS: Record<string, typeof Sparkles> = {
  AgreementMinted: Sparkles,
  OwnerSigned: PenLine,
  BeneficiarySigned: UserCheck,
  WitnessSigned: ShieldCheck,
  AgreementFinalized: Lock,
  AgreementUpdated: RefreshCw,
}

const EVENT_COLORS: Record<string, string> = {
  AgreementMinted:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  OwnerSigned:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  BeneficiarySigned:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  WitnessSigned:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  AgreementFinalized:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  AgreementUpdated:
    'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function resolveBeneficiaryName(
  beneficiaryId: string | undefined,
  beneficiaries: Array<{ id: string; name: string }> | undefined,
): string | null {
  if (!beneficiaryId) return null
  const match = beneficiaries?.find(
    (b) => String(b.id) === String(beneficiaryId),
  )
  return match?.name ?? null
}

export function AgreementTimeline({
  events,
  beneficiaries,
}: AgreementTimelineProps) {
  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Transaction History</CardTitle>
        </div>
        <CardDescription>
          On-chain lifecycle events recorded on the agreement NFT
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No on-chain events recorded yet.
          </p>
        ) : (
          <ol className="relative space-y-4 border-l border-muted pl-5">
            {sorted.map((event, index) => {
              const Icon = EVENT_ICONS[event.type] ?? History
              const color =
                EVENT_COLORS[event.type] ?? 'bg-gray-100 text-gray-700'
              const beneficiaryName = resolveBeneficiaryName(
                event.beneficiaryId,
                beneficiaries,
              )
              return (
                <li key={`${event.txHash}-${index}`} className="relative">
                  <span
                    className={`absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full ${color}`}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <p className="text-sm font-medium">
                        {beneficiaryName
                          ? `${event.label} — ${beneficiaryName}`
                          : event.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(event.occurredAt)}
                        {event.detail ? ` · ${event.detail}` : ''}
                      </p>
                    </div>
                    <a
                      href={event.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline shrink-0"
                    >
                      View tx
                    </a>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
