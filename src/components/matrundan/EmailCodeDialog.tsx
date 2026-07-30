/**
 * Inloggning med sexsiffrig e-postkod.
 *
 * Koden loggar bara in användaren. Gruppinbjudningar hanteras separat via
 * inbjudningslänken och får aldrig blandas ihop med inloggningskoden.
 */
import * as React from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useSession } from "@/lib/matrundan/session";

const RESEND_SECONDS = 45;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function EmailCodeDialog({
  open,
  onOpenChange,
  redirectPath,
  onSignedIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectPath?: string;
  onSignedIn?: () => void;
}) {
  const { sendEmailCode, verifyEmailCode } = useSession();
  const [step, setStep] = React.useState<"email" | "code">("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (!open) {
      setStep("email");
      setCode("");
      setBusy(false);
      setCooldown(0);
    }
  }, [open]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function requestCode(event?: React.FormEvent) {
    event?.preventDefault();
    if (busy || cooldown > 0) return;
    if (!isValidEmail(email)) {
      toast.error("Skriv en giltig e-postadress.");
      return;
    }
    setBusy(true);
    try {
      await sendEmailCode(email, redirectPath ? { redirectPath } : undefined);
      setStep("code");
      setCode("");
      setCooldown(RESEND_SECONDS);
      toast.success("Vi har skickat en sexsiffrig kod till din e-post.");
    } catch {
      toast.error("Kunde inte skicka koden. Försök igen om en stund.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(value: string) {
    if (busy) return;
    setBusy(true);
    try {
      await verifyEmailCode(email, value);
      toast.success("Du är inloggad.");
      onOpenChange(false);
      onSignedIn?.();
    } catch {
      setCode("");
      toast.error("Koden stämmer inte eller har gått ut. Begär en ny kod.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Logga in med e-postkod
          </DialogTitle>
          <DialogDescription>
            {step === "email"
              ? "Vi skickar en sexsiffrig kod till din e-post. Ingen app och inget lösenord behövs."
              : `Skriv in koden vi skickade till ${email}.`}
          </DialogDescription>
        </DialogHeader>

        {step === "email" ? (
          <form onSubmit={requestCode} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">E-postadress</Label>
              <Input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="du@example.com"
                className="min-w-0"
              />
            </div>
            <Button type="submit" className="min-h-11 w-full" disabled={busy}>
              {busy ? "Skickar kod…" : "Skicka kod"}
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (value.length === 6) void submitCode(value);
                }}
                disabled={busy}
                aria-label="Sexsiffrig inloggningskod"
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} className="h-11 w-10" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              className="min-h-11 w-full"
              disabled={busy || code.length !== 6}
              onClick={() => void submitCode(code)}
            >
              {busy ? "Loggar in…" : "Logga in"}
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <button
                type="button"
                className="min-h-9 hover:text-foreground"
                onClick={() => setStep("email")}
              >
                Ändra e-postadress
              </button>
              <button
                type="button"
                className="min-h-9 disabled:opacity-60 hover:text-foreground"
                disabled={busy || cooldown > 0}
                onClick={() => void requestCode()}
              >
                {cooldown > 0 ? `Skicka ny kod om ${cooldown} s` : "Skicka ny kod"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
