import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Copy,
  Mail,
  Share2,
  LogIn,
  RotateCcw,
  ShieldCheck,
  Settings,
  Heart,
  Sparkles,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useStore, formatDate } from "@/lib/matrundan/store";
import { CHANGELOG } from "@/lib/matrundan/demo-data";

export const Route = createFileRoute("/gruppen")({
  head: () => ({
    meta: [
      { title: "Gruppen · Matrundan" },
      {
        name: "description",
        content:
          "Se vad gänget snackar om, senaste besöken, favoriterna och nästa stopp.",
      },
      { property: "og:title", content: "Gruppen · Matrundan" },
      { property: "og:description", content: "Gänget, aktivitet och favoriter." },
    ],
  }),
  component: GroupPage,
});

function GroupPage() {
  const { state, getPlace, memberById, avgRating, isFavorite } = useStore();
  const next = state.nextPlaceId ? getPlace(state.nextPlaceId) : undefined;

  const activity = state.activity.slice(0, 10);

  // Per medlem: senaste besökta ställe
  const memberActivity = state.members.map((m) => {
    const lastVisit = state.visits
      .filter((v) => v.participantIds.includes(m.id))
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const visitCount = state.visits.filter((v) =>
      v.participantIds.includes(m.id),
    ).length;
    const favCount = state.favorites.filter((f) => f.memberId === m.id).length;
    return { m, lastVisit, visitCount, favCount };
  });

  // Vem favoriserar mest samma ställe (top 3 delade favoriter)
  const favByPlace = new Map<string, number>();
  state.favorites.forEach((f) => {
    favByPlace.set(f.placeId, (favByPlace.get(f.placeId) ?? 0) + 1);
  });
  const sharedFavs = [...favByPlace.entries()]
    .map(([placeId, n]) => ({ place: getPlace(placeId), n }))
    .filter((x) => x.place && x.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-2xl space-y-5 pt-2 pb-4 md:max-w-4xl">
      {/* Hero */}
      <section>
        <Card className="overflow-hidden rounded-3xl border-border/70 p-0">
          <div className="flex items-center gap-4 bg-gradient-to-br from-sage/50 to-secondary p-5">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-background text-4xl shadow-sm">
              {state.group.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-semibold leading-tight md:text-3xl">
                {state.group.name}
              </h1>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {state.members.length} medlemmar · {state.group.city}
              </div>
            </div>
            <SettingsSheet />
          </div>
        </Card>
      </section>

      {/* Nästa stopp */}
      {next ? (
        <section>
          <Link
            to="/matstallen/$placeId"
            params={{ placeId: next.id }}
            className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-3"
          >
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium tracking-wide text-primary">
                Nästa stopp
              </div>
              <div className="truncate font-medium">{next.name}</div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {next.address}
              </div>
            </div>
          </Link>
        </section>
      ) : null}

      {/* Gänget */}
      <section>
        <h2 className="mb-2 font-display text-lg">Gänget</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {memberActivity.map(({ m, lastVisit, visitCount, favCount }) => {
            const place = lastVisit ? getPlace(lastVisit.placeId) : undefined;
            return (
              <Card
                key={m.id}
                className="flex items-center gap-3 rounded-2xl border-border/70 p-3"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-2xl">
                  {m.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{m.name}</span>
                    {m.id === state.currentUserId ? (
                      <Badge
                        variant="secondary"
                        className="rounded-full text-[10px]"
                      >
                        Du
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {place
                      ? `Senast på ${place.name} · ${formatDate(lastVisit!.date)}`
                      : "Inga besök än"}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                  <div>{visitCount} besök</div>
                  <div className="flex items-center justify-end gap-1">
                    <Heart className="h-3 w-3" /> {favCount}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Delade favoriter */}
      {sharedFavs.length > 0 ? (
        <section>
          <h2 className="mb-2 font-display text-lg">Gänget gillar</h2>
          <div className="space-y-2">
            {sharedFavs.map(({ place, n }) =>
              place ? (
                <Link
                  key={place.id}
                  to="/matstallen/$placeId"
                  params={{ placeId: place.id }}
                  className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 transition-colors hover:bg-accent"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mustard/30 text-2xl">
                    {place.photo ?? "🍽️"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{place.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Favorit hos {n} i gänget
                      {avgRating(place.id).count > 0
                        ? ` · ${avgRating(place.id).overall.toFixed(1)} snitt`
                        : ""}
                    </div>
                  </div>
                  <Heart className="h-4 w-4 fill-primary stroke-primary" />
                </Link>
              ) : null,
            )}
          </div>
        </section>
      ) : null}

      {/* Aktivitet */}
      <section>
        <h2 className="mb-2 font-display text-lg">Aktivitet</h2>
        <Card className="divide-y divide-border/60 rounded-2xl border-border/70 p-0">
          {activity.map((a) => {
            const member = memberById(a.memberId);
            return (
              <div key={a.id} className="flex items-start gap-3 p-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-lg">
                  {member?.avatar ?? "🙂"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm leading-snug">{a.text}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(a.at)}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
        {isFavorite ? null : null /* keep import used */}
      </section>
    </div>
  );
}

function SettingsSheet() {
  const { state, resetDemo } = useStore();
  const [open, setOpen] = React.useState(false);
  const [invite, setInvite] = React.useState("");

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/inbjudan/${state.group.id}?kod=matr-${state.group.id.slice(-4)}`
      : "";

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

  const shareInvite = async () => {
    const data = {
      title: "Matrundan",
      text: `Häng med i ${state.group.name} på Matrundan.`,
      url: inviteLink,
    };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> })
          .share(data);
      } catch {
        /* user cancel */
      }
    } else {
      copyInvite();
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          aria-label="Gruppinställningar"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Gruppinställningar</SheetTitle>
          <SheetDescription>Inbjudan, roller, konto och admin.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          <section>
            <h3 className="mb-2 text-sm font-medium">Medlemmar & roller</h3>
            <Card className="divide-y divide-border/60 rounded-2xl border-border/70 p-0">
              {state.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-xl">
                    {m.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{m.name}</div>
                    <div className="text-xs capitalize text-muted-foreground">
                      {m.role}
                    </div>
                  </div>
                  <RoleBadge role={m.role} />
                </div>
              ))}
            </Card>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Bjud in</h3>
            <Card className="space-y-3 rounded-2xl border-border/70 p-4">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={copyInvite} variant="outline">
                  <Copy className="h-4 w-4" /> Kopiera länk
                </Button>
                <Button onClick={shareInvite}>
                  <Share2 className="h-4 w-4" /> Dela…
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Eller skicka via e-post</Label>
                <div className="flex gap-2">
                  <Input
                    id="invite-email"
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
                    aria-label="Skicka inbjudan"
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Endast personer med länk och godkänd inbjudan blir medlemmar.
              </p>
            </Card>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Konto</h3>
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
                <h3 className="text-sm font-medium">Om Matrundan</h3>
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
      </SheetContent>
    </Sheet>
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
