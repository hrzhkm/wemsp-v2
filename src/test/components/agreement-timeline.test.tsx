import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AgreementTimeline } from '@/components/agreement/agreementTimeline'

const events = [
  {
    type: 'AgreementMinted',
    label: 'Agreement NFT minted',
    txHash: '0xmint',
    explorerUrl: 'https://explorer/0xmint',
    blockNumber: 10,
    occurredAt: '2026-08-15T10:00:00.000Z',
    detail: '2 beneficiaries',
  },
  {
    type: 'OwnerSigned',
    label: 'Owner signed on-chain',
    txHash: '0xowner',
    explorerUrl: 'https://explorer/0xowner',
    blockNumber: 11,
    occurredAt: '2026-08-15T11:00:00.000Z',
  },
  {
    type: 'BeneficiarySigned',
    label: 'Beneficiary signed on-chain',
    txHash: '0xben',
    explorerUrl: 'https://explorer/0xben',
    blockNumber: 12,
    occurredAt: '2026-08-15T12:00:00.000Z',
    beneficiaryId: 'ben_1',
  },
]

describe('AgreementTimeline', () => {
  it('renders an empty state when there are no events', () => {
    render(<AgreementTimeline events={[]} />)
    expect(screen.getByText('No on-chain events recorded yet.')).toBeTruthy()
  })

  it('renders events in chronological order with tx links', () => {
    render(<AgreementTimeline events={[...events].reverse()} />)

    const labels = screen.getAllByText(/signed|minted/i)
    expect(labels.length).toBeGreaterThanOrEqual(3)

    const links = screen.getAllByRole('link', { name: 'View tx' })
    expect(links).toHaveLength(3)
    expect(links[0].getAttribute('href')).toBe('https://explorer/0xmint')
    expect(links[0].getAttribute('target')).toBe('_blank')
  })

  it('resolves beneficiary names from the agreement payload', () => {
    render(
      <AgreementTimeline
        events={events}
        beneficiaries={[{ id: 'ben_1', name: 'Fatimah Zahra' }]}
      />,
    )
    expect(
      screen.getByText('Beneficiary signed on-chain — Fatimah Zahra'),
    ).toBeTruthy()
  })
})
