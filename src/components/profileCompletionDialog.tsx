import { useNavigate, useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ProfileCompletionDialogProps {
  open: boolean
}

export function ProfileCompletionDialog({ open }: ProfileCompletionDialogProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(open)

  useEffect(() => {
    setIsOpen(open)
  }, [open])

  const handleCompleteProfile = () => {
    const currentPath = location.pathname + location.searchStr
    navigate({
      to: '/app/profile/view',
      search: {
        onboarding: true,
        redirect: currentPath,
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-500" />
            </div>
            <div>
              <DialogTitle>Complete Your Profile</DialogTitle>
            </div>
          </div>
          <DialogDescription className="pt-2">
            Before you can access this feature, please complete your profile by providing your IC number, phone number, and address.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-start gap-2">
          <Button
            type="button"
            onClick={handleCompleteProfile}
            className="flex-1 sm:flex-none"
          >
            Complete Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
