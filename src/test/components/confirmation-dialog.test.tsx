import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmationDialog } from '@/components/confirmationDialog'

describe('ConfirmationDialog', () => {
  it('uses an accessible dialog and runs confirmation explicitly', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <ConfirmationDialog
        open
        onOpenChange={vi.fn()}
        title="Delete asset?"
        description="This action cannot be undone."
        confirmLabel="Delete asset"
        cancelLabel="Cancel"
        isPending={false}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete asset' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
