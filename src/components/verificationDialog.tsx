import { useState } from "react"
import { toast } from "sonner"
import { Mail, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createAuthClient } from "better-auth/client"

const authClient = createAuthClient()

interface VerificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string
  onVerified: () => void
}

export function VerificationDialog({
  open,
  onOpenChange,
  email,
  onVerified,
}: VerificationDialogProps) {
  const [isResending, setIsResending] = useState(false)

  const handleResend = async () => {
    setIsResending(true)

    try {
      const data = await authClient.sendVerificationEmail({
        email,
      })

      if (data.error) {
        toast.error(data.error.message || "Failed to resend verification email.")
      } else {
        toast.success("Verification email sent! Please check your inbox.")
      }
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Verify your email</DialogTitle>
          <DialogDescription className="text-center">
            We've sent a verification link to <span className="font-medium">{email}</span>.
            Please check your inbox and click the link to verify your account.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p>After clicking the link, you'll be automatically signed in and redirected.</p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={isResending}
          >
            {isResending ? "Resending..." : "Resend verification email"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
