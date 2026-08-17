'use client'

import { useEffect, useState } from 'react'
import { Clock, ExternalLink, Hash, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import type { LatestTransaction } from '@/services/latestTransactions'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  getLatestTransactions,
  getTransactionDescription,
  getTransactionTypeDisplayName,
} from '@/services/latestTransactions'
import { CONTRACT_ADDRESS } from '@/lib/blockchain/config'

export default function LatestTransactions() {
  const [transactions, setTransactions] = useState<Array<LatestTransaction>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    const fetchTransactions = async (isInitialLoad = false) => {
      try {
        if (isInitialLoad) {
          setLoading(true)
        }
        setError(null)
        const latestTxs = await getLatestTransactions(5) // Get latest 5 transactions
        setTransactions(latestTxs)
        setLastUpdate(new Date())
      } catch (err) {
        console.error('Error fetching latest transactions:', err)
        setError(
          'Failed to load blockchain transactions. This may be due to network connectivity or The Graph API being temporarily unavailable.',
        )
      } finally {
        if (isInitialLoad) {
          setLoading(false)
        }
      }
    }

    // Initial fetch
    fetchTransactions(true)

    // Set up periodic refresh every 30 seconds
    const interval = setInterval(() => fetchTransactions(false), 30000)

    // Cleanup interval on component unmount
    return () => clearInterval(interval)
  }, [])

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'created':
        return 'default'
      case 'signed':
        return 'secondary'
      case 'admin_signed':
        return 'success'
      case 'completed':
        return 'success'
      case 'signer_added':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const formatTransactionHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`
  }

  return (
    <div id="blockchain" className="bg-white py-20 w-full">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Blockchain Transparency</h2>
          <p className="text-gray-600 text-lg max-w-3xl mx-auto">
            All agreements and transactions are recorded on the blockchain for
            complete transparency and immutability. View the latest activity
            from our smart contract.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Hash className="h-4 w-4" />
            <span>Contract: {CONTRACT_ADDRESS}</span>
            <Button variant="ghost" size="sm" asChild className="p-0 h-auto">
              <a
                href={`https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>

        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Latest Blockchain Transactions
            </CardTitle>
            <CardDescription>
              Recent activity from our smart contract on Base Sepolia testnet
              {lastUpdate && (
                <span className="block text-xs text-gray-400 mt-1">
                  Last updated: {format(lastUpdate, 'HH:mm:ss')}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading transactions...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-4">{error}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setError(null)
                    setLoading(true)
                    const fetchTransactions = async () => {
                      try {
                        const latestTxs = await getLatestTransactions(5)
                        setTransactions(latestTxs)
                        setLastUpdate(new Date())
                      } catch (err) {
                        console.error(
                          'Error fetching latest transactions:',
                          err,
                        )
                        setError(
                          'Failed to load blockchain transactions. This may be due to network connectivity or The Graph API being temporarily unavailable.',
                        )
                      } finally {
                        setLoading(false)
                      }
                    }
                    fetchTransactions()
                  }}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No transactions found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge
                          variant={getBadgeVariant(transaction.type) as any}
                        >
                          {getTransactionTypeDisplayName(transaction.type)}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {format(transaction.timestamp, 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 truncate">
                        {getTransactionDescription(transaction)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          Block #{transaction.blockNumber}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500 font-mono">
                          {formatTransactionHash(transaction.transactionHash)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="ml-4 flex-shrink-0"
                    >
                      <a
                        href={`https://sepolia.basescan.org/tx/${transaction.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ))}

                <div className="text-center pt-4">
                  <Button variant="outline" asChild>
                    <a
                      href={`https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View All Transactions
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
