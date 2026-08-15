import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AssetDocumentLink } from '@/components/assets/assetDocumentLink'

describe('AssetDocumentLink', () => {
  it('renders a safe real link for a stored document', () => {
    render(
      <AssetDocumentLink href="/api/file/documents/home.pdf">
        View document
      </AssetDocumentLink>,
    )

    const link = screen.getByRole('link', { name: 'View document' })
    expect(link.getAttribute('href')).toBe('/api/file/documents/home.pdf')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
