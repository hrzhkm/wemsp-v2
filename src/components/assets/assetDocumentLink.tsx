import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'

interface AssetDocumentLinkProps extends ComponentProps<typeof Button> {
  href: string
}

export function AssetDocumentLink({
  children,
  href,
  ...buttonProps
}: AssetDocumentLinkProps) {
  return (
    <Button asChild {...buttonProps}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    </Button>
  )
}
