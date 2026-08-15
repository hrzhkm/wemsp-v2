import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Calendar, History, Loader2, SearchIcon, X } from 'lucide-react'
import { getAdminSession } from '@/middleware'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TransactionEvent {
  type: string
  label: string
  txHash: string
  explorerUrl: string
  blockNumber: number
  occurredAt: string
  tokenId?: number
  beneficiaryId?: string
  detail?: string
  agreement?: {
    id: string
    title: string
  } | null
  ownerName?: string
  beneficiaryName?: string
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  AgreementMinted: 'Minted',
  OwnerSigned: 'Owner Signed',
  BeneficiarySigned: 'Beneficiary Signed',
  WitnessSigned: 'Witness Signed',
  AgreementFinalized: 'Finalized',
  AgreementUpdated: 'Updated',
}

const EVENT_BADGE_VARIANTS: Record<string, string> = {
  AgreementMinted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  OwnerSigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  BeneficiarySigned:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  WitnessSigned:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  AgreementFinalized:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  AgreementUpdated:
    'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
}

export const Route = createFileRoute('/app/admin/transactions/')({
  loader: async () => {
    const admin = await getAdminSession()
    if (!admin) {
      throw redirect({ to: '/app/dashboard' })
    }
    return { admin }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const [events, setEvents] = useState<Array<TransactionEvent>>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (type) params.set('type', type)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (searchQuery) params.set('search', searchQuery)

      const response = await fetch(`/api/admin/transactions?${params}`)
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const applyFilters = () => {
    fetchEvents()
  }

  const clearFilters = () => {
    setType('')
    setFrom('')
    setTo('')
    setSearchQuery('')
    fetchEvents()
  }

  const formatDateTime = (value: string) => {
    return new Date(value).toLocaleString('en-MY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const shortTx = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-6)}`

  const hasFilters = Boolean(type || from || to || searchQuery)

  return (
    <div className="space-y-4">
      {/* Hero header */}
      <Card className="border-border/70 bg-gradient-to-r from-sky-50/60 via-background to-emerald-50/30">
        <CardHeader className="gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              Transaction History
            </div>
            <CardTitle className="text-xl">
              Contract Transactions
            </CardTitle>
            <CardDescription className="mt-1">
              All on-chain lifecycle events recorded on the agreement contract
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card className="border-border/70">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="w-full lg:w-56">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AgreementMinted">Minted</SelectItem>
                  <SelectItem value="OwnerSigned">Owner Signed</SelectItem>
                  <SelectItem value="BeneficiarySigned">
                    Beneficiary Signed
                  </SelectItem>
                  <SelectItem value="WitnessSigned">Witness Signed</SelectItem>
                  <SelectItem value="AgreementFinalized">Finalized</SelectItem>
                  <SelectItem value="AgreementUpdated">Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="From date"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="To date"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Input
                placeholder="Search by agreement or owner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyFilters()
                }}
              />
              <Button onClick={applyFilters} size="icon" variant="outline">
                <SearchIcon className="h-4 w-4" />
              </Button>
              {hasFilters && (
                <Button onClick={clearFilters} size="icon" variant="ghost">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="border-border/70">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/35">
              <TableRow>
                <TableHead>Agreement</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Beneficiary</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Block</TableHead>
                <TableHead className="text-right">Tx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8">
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event, index) => (
                  <TableRow key={`${event.txHash}-${index}`}>
                    <TableCell className="font-medium">
                      {event.agreement ? (
                        <a
                          href={`/app/agreement/view/${event.agreement.id}`}
                          className="text-primary hover:underline"
                        >
                          {event.agreement.title}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">
                          Unknown
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{event.ownerName || '-'}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${EVENT_BADGE_VARIANTS[event.type] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {EVENT_TYPE_LABELS[event.type] || event.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      {event.beneficiaryName || '-'}
                      {event.detail && (
                        <div className="text-xs text-muted-foreground">
                          {event.detail}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(event.occurredAt)}</TableCell>
                    <TableCell>{event.blockNumber}</TableCell>
                    <TableCell className="text-right">
                      <a
                        href={event.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        {shortTx(event.txHash)}
                      </a>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
