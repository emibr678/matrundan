/**
 * Publik sida för att välja ett nytt lösenord efter en återställningslänk.
 */
import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  hasCurrentAccountSession,
  subscribeToPasswordRecovery,
  updateOwnPassword,
} from "@/lib/matrundan/account-client";

export const Route = createFileRoute("/nytt-losenord")({
  head: () => ({
    meta: [
      { title: "Välj nytt lösenord · Matrundan" },
      {
        name: "description",
        content: "Sätt ett nytt lösenord för ditt Matrundan-konto och kom tillbaka till gruppen.",
      },
      { property: "og:title", content: "Välj nytt lösenord · Matrundan" },
      {
        property: "og:description",
        content: "Sätt ett nytt lösenord för ditt Matrundan-konto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewPasswordPage,
});

const MIN_PASSWORD_LENGTH = 8;

function NewPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = React.useState(false);
  const [hasRecovery, setHasRecovery] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeToPasswordRecovery(() => {
      if (!cancelled) {
        setHasRecovery(true);
        setReady(true);
      }
    });
    void hasCurrentAccountSession().then((hasSession) => {
      if (cancelled) return;
      if (hasSession) setHasRecovery(true);
      setReady(true);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Lösenordet behöver minst ${MIN_PASSWORD_LENGTH} tecken.`);
      return;
    }
    setBusy(true);
    try {
      await updateOwnPassword(password);
      toast.success("Lösenordet är uppdaterat.");
      void navigate({ to: "/" });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      toast.error(
        message.includes("pwned") || message.includes("compromised")
          ? "Lösenordet finns i kända läckor. Välj ett annat."
          : "Kunde inte uppdatera lösenordet. Begär en ny återställningslänk.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <Card className="w-full rounded-3xl p-6">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <KeyRound className="h-5 w-5 text-primary" />
          Välj nytt lösenord
        </h1>

        {!ready ? (
          <p className="mt-3 text-sm text-muted-foreground">Läser in…</p>
        ) : !hasRecovery ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Länken är slut eller har redan använts. Begär en ny återställningslänk från
              inloggningen.
            </p>
            <Button className="mt-5 min-h-11 w-full" onClick={() => void navigate({ to: "/" })}>
              Till Matrundan
            </Button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nytt lösenord</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minst 8 tecken"
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
            <Button type="submit" className="min-h-11 w-full" disabled={busy}>
              {busy ? "Sparar…" : "Spara nytt lösenord"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
