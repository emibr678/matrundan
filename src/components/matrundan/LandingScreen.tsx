import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Link2, LogIn, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/matrundan/session";

function invitationToken(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed, window.location.origin);
    const match = url.pathname.match(/^\/inbjudan\/([^/?#]+)$/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch {
    /* Prova som rå kod nedan. */
  }

  if (/^[A-Za-z0-9_-]{8,}$/.test(trimmed)) return trimmed;
  return null;
}

export function LandingScreen() {
  const navigate = useNavigate();
  const { signInWithGoogle } = useSession();
  const [invite, setInvite] = React.useState("");
  const [signingIn, setSigningIn] = React.useState(false);

  async function createGroup() {
    if (signingIn) return;
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      toast.error("Kunde inte starta Google-inloggningen.");
      setSigningIn(false);
    }
  }

  function joinGroup(event: React.FormEvent) {
    event.preventDefault();
    const token = invitationToken(invite);
    if (!token) {
      toast.error("Klistra in en giltig inbjudningslänk eller inbjudningskod.");
      return;
    }
    void navigate({ to: "/inbjudan/$token", params: { token } });
  }

  return (
    <main id="innehall" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-6 md:pt-12">
      <section className="mx-auto max-w-3xl text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Gruppens gemensamma matresa
        </div>
        <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Hitta nästa ställe – och minns rundorna tillsammans.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Samla matställen ni är nyfikna på, välj nästa stopp och bygg en privat historik av era
          verkliga besök.
        </p>
      </section>

      <section className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
        <Card className="rounded-3xl border-border/70 p-5 shadow-sm sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-semibold">Starta en egen grupp</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Logga in, skapa gruppen och bjud sedan in vänner eller familj med en privat länk.
          </p>
          <Button
            className="mt-5 min-h-11 w-full"
            onClick={() => void createGroup()}
            disabled={signingIn}
          >
            <LogIn className="h-4 w-4" />
            {signingIn ? "Öppnar inloggning…" : "Skapa en grupp"}
          </Button>
        </Card>

        <Card className="rounded-3xl border-border/70 p-5 shadow-sm sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mustard/35 text-mustard-foreground">
            <Link2 className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-semibold">Gå med i en grupp</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Använd länken eller koden som gruppens ägare eller admin har skickat till dig.
          </p>
          <form onSubmit={joinGroup} className="mt-5 space-y-2">
            <Label htmlFor="invite-link">Inbjudningslänk eller kod</Label>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <Input
                id="invite-link"
                value={invite}
                onChange={(event) => setInvite(event.target.value)}
                placeholder="Klistra in här"
                autoComplete="off"
                className="min-w-0"
              />
              <Button type="submit" variant="outline" className="min-h-10 shrink-0">
                Fortsätt <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <section className="mx-auto mt-6 max-w-4xl">
        <Card className="flex flex-col items-start gap-4 rounded-3xl border-primary/20 bg-primary/[0.06] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">
              Skrivskyddat exempel
            </div>
            <h2 className="mt-1 font-display text-xl font-semibold">Utforska Fredagsgänget</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Se hur ett fiktivt kompisgäng i Stockholm samlar ställen, väljer nästa stopp och
              bevarar sin gemensamma historik.
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-11 w-full shrink-0 sm:w-auto">
            <a href="/exempel">
              Öppna exempelgruppen <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </Card>
      </section>
    </main>
  );
}
