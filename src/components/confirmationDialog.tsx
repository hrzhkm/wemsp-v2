import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ConfirmationDialogProps {
  cancelLabel: string
  confirmLabel: string
  description: string
  isPending: boolean
  onConfirm: () => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}

export function ConfirmationDialog(props: ConfirmationDialogProps) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => !props.isPending && props.onOpenChange(open)}
    >
      <DialogContent showCloseButton={!props.isPending}>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={props.isPending}
          >
            {props.cancelLabel}
          </Button>
          <Button
            variant="destructive"
            onClick={props.onConfirm}
            disabled={props.isPending}
          >
            {props.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {props.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
