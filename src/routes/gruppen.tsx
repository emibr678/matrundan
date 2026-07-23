import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Mail, Share2, LogIn, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useStore } from "@/lib/matrundan/store";
import { CHANGELOG } from "@/lib/matrundan/demo-data";

export const Route = createFileRoute("/gruppen")({
  head: () => ({
    meta: [
      { title: "Gruppen · Matrundan" },
      {
        name: "description",
        content: "Medlemmar, roller, inbjudningar och inställningar för din grupp.",
      },
      { property: "og:title", content: "Gruppen · Matrundan" },
      { property: "og:description", content: "Gruppmedlemmar och inställningar." },
    ],
  }),
  component: GroupPage,
});

function GroupPage() {
  const { state, resetDemo } = useStore();
  const [invite, setInvite] = React.useState("");
  const inviteLink = React.useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/inbjudan/${state.group.id}?kod=matr-${state.group.id.slice(-4)}`
        : "",
    [state.group.id],
  );

  const currentUser = state.members.find((m) => m.id === state.currentUserId);
  const isAdmin = currentUser?.role === "ägare" || currentUser?.role === "admin";

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Inbjudningslänk kopierad");
    } catch {
      toast.error("Kunde inte kopiera");
    }
  };

  return (
    <div className="space-y-5 pt-2 pb-4">
      <section>
        <Card className="overflow-hidden rounded-3xl border-border/70 p-0">
          <div className="flex items-center gap-4 bg-gradient-to-br from-sage/50 to-secondary p-5">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-background text-4xl shadow-sm">
              {state.group.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Privat grupp
              </div>
              <h1 className="font-display text-2xl font-semibold leading-tight">
                {state.group.name}
              </h1>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {state.members.length} medlemmar · {state.group.city}
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg">Medlemmar</h2>
        <Card className="divide-y divide-border/60 rounded-2xl border-border/70 p-0">
          {state.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-2xl">
                {m.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.name}</span>
                  {m.id === state.currentUserId ? (
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      Du
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs capitalize text-muted-foreground">{m.role}</div>
              </div>
              <RoleBadge role={m.role} />
            </div>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg">Bjud in</h2>
        <Card className="space-y-3 rounded-2xl border-border/70 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite">E-post</Label>
            <div className="flex gap-2">
              <Input
                id="invite"
                type="email"
                placeholder="vän@example.se"
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
              />
              <Button
                onClick={() => {
                  if (!invite.trim()) return toast.error("Ange en e-post");
                  toast.success("Inbjudan skickad (demo)");
                  setInvite("");
                }}
              >
                <Mail className="h-4 w-4" /> Skicka
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Delbar länk</Label>
            <div className="flex gap-2">
              <Input readOnly value={inviteLink} className="font-mono text-xs" />
              <Button variant="outline" onClick={copyInvite}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Endast personer med länk och godkänd inbjudan blir medlemmar. Kan kopplas
            till Google-inloggning när backend aktiveras.
          </p>
        </Card>
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg">Konto</h2>
        <Card className="space-y-2 rounded-2xl border-border/70 p-4">
          <Button variant="outline" className="w-full justify-start" disabled>
            <LogIn className="h-4 w-4" /> Logga in med Google (aktiveras med backend)
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive"
            onClick={() => {
              if (confirm("Nollställ demo-data?")) {
                resetDemo();
                toast.success("Demo-data återställd");
              }
            }}
          >
            <RotateCcw className="h-4 w-4" /> Återställ demo-data
          </Button>
        </Card>
      </section>

      {isAdmin ? (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-lg">Administration</h2>
          </div>
          <Card className="rounded-2xl border-border/70 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Appversion</div>
                <div className="text-xs text-muted-foreground">
                  Matrundan {state.version}
                </div>
              </div>
              <Badge variant="outline" className="rounded-full">
                v{state.version}
              </Badge>
            </div>
            <Accordion type="single" collapsible>
              <AccordionItem value="changelog" className="border-none">
                <AccordionTrigger className="py-2 text-sm">
                  Versionsnyheter
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {CHANGELOG.map((c) => (
                      <div key={c.version}>
                        <div className="text-xs font-medium">
                          v{c.version} · {c.date}
                        </div>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                          {c.items.map((it, i) => (
                            <li key={i}>{it}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function RoleBadge({ role }: { role: "ägare" | "admin" | "medlem" }) {
  const cls =
    role === "ägare"
      ? "bg-primary/15 text-primary border-primary/30"
      : role === "admin"
        ? "bg-mustard/40 text-mustard-foreground border-mustard/50"
        : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`rounded-full text-[11px] ${cls}`}>
      {role}
    </Badge>
  );
}
