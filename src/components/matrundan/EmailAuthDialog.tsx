/**
 * Inloggning och kontoregistrering med e-post och lösenord.
 *
 * Detta handlar bara om själva kontot. Gruppinbjudningar hanteras separat via
 * inbjudningslänken och får aldrig blandas ihop med inloggningen.
 */
import * as React from "react";
import { Eye, EyeOff, Mail } from "lucide-react";
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
import { useSession } from "@/lib/matrundan/session";

type Mode = "signin" | "signup" | "reset";

const MIN_PASSWORD_LENGTH = 8;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function friendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid login credentials")) {
    return "Fel e-postadress eller lösenord.";
  }
  if (message.includes("email not confirmed")) {
    return "Bekräfta din e-postadress via mejlet vi skickade, sedan kan du logga in.";
  }
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "Det finns redan ett konto med den adressen. Logga in i stället.";
  }
  if (message.includes("pwned") || message.includes("compromised")) {
    return "Lösenordet finns i kända läckor. Välj ett annat.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "För många försök just nu. Vänta en stund och försök igen.";
  }
  return fallback;
}

export function EmailAuthDialog({
  open,
  onOpenChange,
  redirectPath,
  onSignedIn,
  initialMode = "signin",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectPath?: string;
  onSignedIn?: () => void;
  initialMode?: Mode;
}) {
  const { signInWithPassword, signUpWithPassword, sendPasswordReset } = useSession();
  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setMode(initialMode);
      setPassword("");
      setShowPassword(false);
      setBusy(false);
    }
  }, [open, initialMode]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!isValidEmail(email)) {
      toast.error("Skriv en giltig e-postadress.");
      return;
    }
    if (mode !== "reset" && password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Lösenordet behöver minst ${MIN_PASSWORD_LENGTH} tecken.`);
      return;
    }

    setBusy(true);
    try {
      if (mode === "reset") {
        await sendPasswordReset(email);
        toast.success("Vi har skickat en återställningslänk till din e-post.", {
          description: "Kolla även skräpposten – mejlet kommer från en standardavsändare.",
        });
        setMode("signin");
      } else if (mode === "signup") {
        const result = await signUpWithPassword(email, password, {
          displayName: displayName || undefined,
          redirectPath,
        });
        if (result.accountAlreadyExists) {
          toast.error("Det finns redan ett konto med den e-postadressen.", {
            description: "Logga in i stället, eller välj Glömt lösenord.",
          });
          setMode("signin");
          setPassword("");
        } else if (result.needsEmailConfirmation) {
          toast.success("Nästan klart! Bekräfta din e-postadress via mejlet vi skickade.");
          onOpenChange(false);
        } else {
          toast.success("Kontot är skapat. Välkommen!");
          onOpenChange(false);
          onSignedIn?.();
        }
      } else {
        await signInWithPassword(email, password, { redirectPath });
        toast.success("Du är inloggad.");
        onOpenChange(false);
        onSignedIn?.();
      }
    } catch (error) {
      toast.error(friendlyError(error, "Något gick fel. Försök igen om en stund."));
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "signup"
      ? "Skapa konto med e-post"
      : mode === "reset"
        ? "Glömt lösenord"
        : "Logga in med e-post";

  const description =
    mode === "signup"
      ? "Kontot skapas direkt – ingen bekräftelse via mejl behövs. Att gå med i en grupp är ett separat steg via gruppens inbjudningslänk."
      : mode === "reset"
        ? "Skriv din e-postadress så skickar vi en länk där du kan välja ett nytt lösenord. Kolla även skräpposten."
        : "Använd samma e-postadress varje gång så behåller du din historik.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" ? (
            <div className="space-y-1.5">
              <Label htmlFor="auth-name">Namn</Label>
              <Input
                id="auth-name"
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Ditt namn i gruppen"
                maxLength={80}
                className="min-w-0"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="auth-email">E-postadress</Label>
            <Input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="du@example.com"
              maxLength={255}
              className="min-w-0"
            />
          </div>

          {mode !== "reset" ? (
            <div className="space-y-1.5">
              <Label htmlFor="auth-password">Lösenord</Label>
              <div className="relative">
                <Input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === "signup" ? "Minst 8 tecken" : "Ditt lösenord"}
                  className="min-w-0 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ) : null}

          <Button type="submit" className="min-h-11 w-full" disabled={busy}>
            {busy
              ? "Ett ögonblick…"
              : mode === "signup"
                ? "Skapa konto"
                : mode === "reset"
                  ? "Skicka återställningslänk"
                  : "Logga in"}
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          {mode === "signin" ? (
            <>
              <button
                type="button"
                className="min-h-9 hover:text-foreground"
                onClick={() => setMode("signup")}
              >
                Skapa nytt konto
              </button>
              <button
                type="button"
                className="min-h-9 hover:text-foreground"
                onClick={() => setMode("reset")}
              >
                Glömt lösenord?
              </button>
            </>
          ) : (
            <button
              type="button"
              className="min-h-9 hover:text-foreground"
              onClick={() => setMode("signin")}
            >
              Tillbaka till inloggning
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
