import * as React from "react";
import { LogIn, Mail } from "lucide-react";
import { toast } from "sonner";

import { EmailAuthDialog } from "@/components/matrundan/EmailAuthDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/matrundan/session";

export function CreateGroupAuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { signInWithGoogle, exitExampleMode } = useSession();
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [signingIn, setSigningIn] = React.useState(false);

  async function continueWithGoogle() {
    if (signingIn) return;
    setSigningIn(true);
    onOpenChange(false);
    try {
      await signInWithGoogle();
    } catch {
      toast.error("Kunde inte starta Google-inloggningen.");
      onOpenChange(true);
      setSigningIn(false);
    }
  }

  function continueWithEmail() {
    onOpenChange(false);
    setEmailOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Skapa en egen grupp</DialogTitle>
            <DialogDescription>
              Välj hur du vill logga in. När kontot är klart kan du skapa gruppen och bjuda in
              andra.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={signingIn}
              onClick={() => void continueWithGoogle()}
            >
              <LogIn className="h-4 w-4" />
              {signingIn ? "Öppnar inloggning…" : "Fortsätt med Google"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              onClick={continueWithEmail}
            >
              <Mail className="h-4 w-4" />
              Fortsätt med e-post
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <EmailAuthDialog open={emailOpen} onOpenChange={setEmailOpen} onSignedIn={exitExampleMode} />
    </>
  );
}
