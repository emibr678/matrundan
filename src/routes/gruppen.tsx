import * as React from "react";
import {
  createFileRoute,
  Link,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
  Copy,
  Mail,
  Share2,
  RotateCcw,
  Info,
  Settings,
  Heart,
  Sparkles,
  MapPin,
  ChevronRight,
  Trash2,
  Crown,
  LogOut,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { MemberProfileSheet } from "@/components/matrundan/MemberProfileSheet";
import { ActivityRow } from "@/components/matrundan/ActivityRow";
import { AboutDialog } from "@/components/matrundan/AboutDialog";
import { MemberAvatar } from "@/components/matrundan/MemberAvatar";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useStore, formatDate } from "@/lib/matrundan/store";
import { useSession } from "@/lib/matrundan/session";
import {
  createGroupInvitation,
  leaveGroup,
  listGroupInvitations,
  removeGroupMember,
  revokeGroupInvitation,
  setMemberRole,
  transferGroupOwnership,
  updateGroupSettings,
  type InvitationListItem,
} from "@/lib/matrundan/live-admin";
import { APP_VERSION, APP_NAME } from "@/lib/matrundan/version";
import { formatRating } from "@/lib/matrundan/version";
import type { Member } from "@/lib/matrundan/types";

const GROUP_SEARCH_DEFAULTS = { member: "" };
const groupSearchSchema = z.object({
  member: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/gruppen")({
  validateSearch: zodValidator(groupSearchSchema),
  search: { middlewares: [stripSearchParams(GROUP_SEARCH_DEFAULTS)] },
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
  const { state, getPlace, avgRating } = useStore();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/gruppen" });
  const next = state.nextPlaceId ? getPlace(state.nextPlaceId) : undefined;

  const activeMember = React.useMemo(
    () =>
      search.member ? state.members.find((m) => m.id === search.member) ?? null : null,
    [search.member, state.members],
  );

  const closeMember = () => navigate({ search: { member: "" } });
  const activity = state.activity.slice(0, 10);

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
      <section>
        <Card className="overflow-hidden rounded-3xl border-border/70 p-0">
          <div className="flex items-center gap-3 bg-gradient-to-br from-sage/50 to-secondary p-4 sm:gap-4 sm:p-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-background text-3xl shadow-sm sm:h-16 sm:w-16 sm:text-4xl">
              {state.group.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl font-semibold leading-tight sm:text-2xl md:text-3xl">
                {state.group.name}
              </h1>
              <div className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                {state.members.length} medlemmar
                {state.group.city ? ` · ${state.group.city}` : ""}
              </div>
            </div>
            <div className="shrink-0">
              <SettingsSheet />
            </div>
          </div>
        </Card>
      </section>


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

      <section>
        <h2 className="mb-2 font-display text-lg">Gänget</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {memberActivity.map(({ m, lastVisit, visitCount, favCount }) => {
            const place = lastVisit ? getPlace(lastVisit.placeId) : undefined;
            return (
              <Card
                key={m.id}
                className="rounded-2xl border-border/70 p-0 transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-accent/40"
              >
                <button
                  type="button"
                  onClick={() => navigate({ search: { member: m.id } })}
                  className="flex w-full items-center gap-2.5 rounded-2xl p-3 text-left outline-none sm:gap-3"
                  aria-label={`Öppna profil för ${m.name}`}
                >
                  <MemberAvatar member={m} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 max-w-full truncate font-medium">{m.name}</span>
                      {m.id === state.currentUserId ? (
                        <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
                          Du
                        </Badge>
                      ) : null}
                      {m.role !== "medlem" ? (
                        <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">
                          {m.role}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {place
                        ? `Senast på ${place.name} · ${formatDate(lastVisit!.date)}`
                        : "Inga besök än"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
                    <div>{visitCount} besök</div>
                    <div className="flex items-center justify-end gap-1">
                      <Heart className="h-3 w-3" /> {favCount}
                    </div>
                  </div>
                  <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
                </button>
              </Card>

            );
          })}
        </div>
      </section>

      <MemberProfileSheet
        member={activeMember}
        open={!!activeMember}
        onOpenChange={(o) => !o && closeMember()}
      />

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
                        ? ` · ${formatRating(avgRating(place.id).overall)} snitt`
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

      <section>
        <h2 className="mb-2 font-display text-lg">Aktivitet</h2>
        <Card className="divide-y divide-border/60 rounded-2xl border-border/70 p-0">
          {activity.map((a) => (
            <ActivityRow key={a.id} activity={a} />
          ))}
        </Card>
      </section>
    </div>
  );
}

function SettingsSheet() {
  const { state, resetDemo } = useStore();
  const { mode, activeGroupId, activeGroupRole, refreshGroups, user } = useSession();
  const [open, setOpen] = React.useState(false);
  const [about, setAbout] = React.useState(false);
  const isLive = mode === "live" && !!activeGroupId;
  const isOwner = isLive && activeGroupRole === "owner";
  const isAdmin = isLive && (activeGroupRole === "owner" || activeGroupRole === "admin");

  return (
    <>
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
            <SheetDescription>
              {isLive
                ? "Bjud in, hantera roller och profil."
                : "Demo-läge: skrivningar sparas bara lokalt."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 py-4">
            {isAdmin && activeGroupId ? (
              <GroupSettingsSection
                groupId={activeGroupId}
                initialName={state.group.name}
                initialEmoji={state.group.emoji}
                initialLocation={state.group.city}
              />
            ) : null}

            <MembersSection
              members={state.members}
              currentUserId={state.currentUserId}
              isOwner={isOwner}
              isAdmin={isAdmin}
              groupId={activeGroupId}
              onChanged={refreshGroups}
            />

            {isAdmin && activeGroupId ? (
              <InvitationsSection groupId={activeGroupId} />
            ) : null}

            {isLive && activeGroupId ? (
              <LeaveGroupSection
                groupId={activeGroupId}
                isOwner={isOwner}
                onLeft={refreshGroups}
              />
            ) : null}

            {mode === "demo" ? (
              <section>
                <h3 className="mb-2 text-sm font-medium">Demo-data</h3>
                <Card className="rounded-2xl border-border/70 p-4">
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
            ) : null}

            <section>
              <h3 className="mb-2 text-sm font-medium">Om appen</h3>
              <Card className="rounded-2xl border-border/70 p-0">
                <button
                  type="button"
                  onClick={() => setAbout(true)}
                  className="flex w-full items-center gap-3 rounded-2xl p-4 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">Om {APP_NAME}</div>
                    <div className="text-xs text-muted-foreground">
                      Version, vad som är nytt och tidigare uppdateringar.
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    v{APP_VERSION}
                  </Badge>
                </button>
              </Card>
            </section>

            {isLive && user ? (
              <div className="text-[11px] text-muted-foreground">
                Inloggad som {user.email}
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      <AboutDialog open={about} onOpenChange={setAbout} />
    </>
  );
}

// ------- Sections --------

function GroupSettingsSection({
  groupId,
  initialName,
  initialEmoji,
  initialLocation,
}: {
  groupId: string;
  initialName: string;
  initialEmoji: string;
  initialLocation: string;
}) {
  const [name, setName] = React.useState(initialName);
  const [emoji, setEmoji] = React.useState(initialEmoji);
  const [loc, setLoc] = React.useState(initialLocation);
  const [busy, setBusy] = React.useState(false);
  const { refreshGroups } = useSession();

  async function save() {
    setBusy(true);
    try {
      await updateGroupSettings(groupId, name.trim(), emoji, loc.trim() || null);
      await refreshGroups();
      toast.success("Gruppen är uppdaterad.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte spara.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Gruppinställningar</h3>
      <Card className="space-y-3 rounded-2xl border-border/70 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="gs-name">Namn</Label>
          <Input id="gs-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gs-emoji">Emoji</Label>
          <Input
            id="gs-emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gs-loc">Hemområde</Label>
          <Input id="gs-loc" value={loc} onChange={(e) => setLoc(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>
            {busy ? "Sparar…" : "Spara"}
          </Button>
        </div>
      </Card>
    </section>
  );
}

function MembersSection({
  members,
  currentUserId,
  isOwner,
  isAdmin,
  groupId,
  onChanged,
}: {
  members: Member[];
  currentUserId: string;
  isOwner: boolean;
  isAdmin: boolean;
  groupId: string | null;
  onChanged: () => Promise<void>;
}) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = React.useState<Member | null>(null);
  const [transferTarget, setTransferTarget] = React.useState<Member | null>(null);

  async function runRoleChange(m: Member, next: "admin" | "member") {
    if (!groupId) return;
    setBusyId(m.id);
    try {
      await setMemberRole(groupId, m.id, next);
      await onChanged();
      toast.success("Rollen är uppdaterad.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte ändra roll.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    if (!groupId || !removeTarget) return;
    setBusyId(removeTarget.id);
    try {
      await removeGroupMember(groupId, removeTarget.id);
      await onChanged();
      toast.success(`${removeTarget.name} är borttagen.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte ta bort medlem.");
    } finally {
      setBusyId(null);
      setRemoveTarget(null);
    }
  }

  async function confirmTransfer() {
    if (!groupId || !transferTarget) return;
    setBusyId(transferTarget.id);
    try {
      await transferGroupOwnership(groupId, transferTarget.id);
      await onChanged();
      toast.success(`Ägarskap överfört till ${transferTarget.name}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte överföra ägarskap.");
    } finally {
      setBusyId(null);
      setTransferTarget(null);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Medlemmar & roller</h3>
      <Card className="divide-y divide-border/60 rounded-2xl border-border/70 p-0">
        {members.map((m) => {
          const isSelf = m.id === currentUserId;
          const canRemove =
            !isSelf &&
            groupId &&
            m.role !== "ägare" &&
            (isOwner || (isAdmin && m.role === "medlem"));
          return (
            <div key={m.id} className="flex items-center gap-3 p-3">
              <MemberAvatar member={m} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {m.name}
                  {isSelf ? " (du)" : ""}
                </div>
                <div className="text-xs capitalize text-muted-foreground">{m.role}</div>
              </div>
              {isOwner && !isSelf && m.role === "medlem" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === m.id}
                  onClick={() => runRoleChange(m, "admin")}
                  title="Gör till admin"
                >
                  <ShieldCheck className="h-4 w-4" />
                </Button>
              ) : null}
              {isOwner && !isSelf && m.role === "admin" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === m.id}
                  onClick={() => runRoleChange(m, "member")}
                  title="Ta bort admin-roll"
                >
                  <ShieldOff className="h-4 w-4" />
                </Button>
              ) : null}
              {isOwner && !isSelf && m.role !== "ägare" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === m.id}
                  onClick={() => setTransferTarget(m)}
                  title="Överför ägarskap"
                >
                  <Crown className="h-4 w-4" />
                </Button>
              ) : null}
              {canRemove ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === m.id}
                  onClick={() => setRemoveTarget(m)}
                  aria-label={`Ta bort ${m.name}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              ) : null}
            </div>
          );
        })}
      </Card>

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Personen förlorar åtkomsten direkt. Historiska besök och betyg finns kvar
              i gruppen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Ta bort</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!transferTarget}
        onOpenChange={(o) => !o && setTransferTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Överför ägarskap till {transferTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Du blir admin och {transferTarget?.name} blir gruppens ägare. Endast ägaren
              kan hantera admins och överföra ägarskap.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTransfer}>Överför</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function InvitationsSection({ groupId }: { groupId: string }) {
  const [email, setEmail] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [lastLink, setLastLink] = React.useState<string | null>(null);
  const [lastEmail, setLastEmail] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<InvitationListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listGroupInvitations(groupId);
      setItems(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function createInvite(withEmail: boolean) {
    setCreating(true);
    try {
      const trimmed = email.trim();
      const inv = await createGroupInvitation(
        groupId,
        withEmail && trimmed ? trimmed : null,
      );
      const link =
        typeof window !== "undefined"
          ? `${window.location.origin}/inbjudan/${inv.token}`
          : `/inbjudan/${inv.token}`;
      setLastLink(link);
      setLastEmail(withEmail && trimmed ? trimmed : null);
      if (withEmail) setEmail("");
      toast.success("Inbjudan skapad – kopiera länken nu.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte skapa inbjudan.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    setBusyId(id);
    try {
      await revokeGroupInvitation(id);
      await load();
      toast.success("Inbjudan återkallad.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte återkalla.");
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink() {
    if (!lastLink) return;
    try {
      await navigator.clipboard.writeText(lastLink);
      toast.success("Länk kopierad");
    } catch {
      toast.error("Kunde inte kopiera");
    }
  }

  function shareLink() {
    if (!lastLink) return;
    const data: ShareData = {
      title: APP_NAME,
      text: `Häng med i gruppen på ${APP_NAME}.`,
      url: lastLink,
    };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      void (navigator as Navigator & { share: (d: ShareData) => Promise<void> })
        .share(data)
        .catch(() => {});
    } else {
      void copyLink();
    }
  }

  function openMailClient() {
    if (!lastLink || !lastEmail) return;
    const subject = encodeURIComponent(`Inbjudan till ${APP_NAME}`);
    const body = encodeURIComponent(
      `Hej!\n\nJag vill bjuda in dig till vår grupp i ${APP_NAME}.\n` +
        `Gå med här: ${lastLink}\n\nLänken gäller i sju dagar och kan bara användas en gång.`,
    );
    window.location.href = `mailto:${lastEmail}?subject=${subject}&body=${body}`;
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Bjud in</h3>
      <Card className="space-y-3 rounded-2xl border-border/70 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="inv-email">E-post (valfritt)</Label>
          <Input
            id="inv-email"
            type="email"
            placeholder="vän@example.se"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Med e-post: bara den adressen kan använda länken.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => createInvite(false)}
            disabled={creating}
          >
            Skapa öppen länk
          </Button>
          <Button
            onClick={() => createInvite(true)}
            disabled={creating || !email.trim()}
          >
            <Mail className="mr-1 h-4 w-4" /> Skapa för e-post
          </Button>
        </div>

        {lastLink ? (
          <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-sm">
            <div className="mb-2 text-xs font-medium">
              Din inbjudningslänk – visas bara nu
            </div>
            <div className="break-all rounded-md bg-background p-2 text-xs">
              {lastLink}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copyLink}>
                <Copy className="h-4 w-4" /> Kopiera
              </Button>
              <Button size="sm" variant="outline" onClick={shareLink}>
                <Share2 className="h-4 w-4" /> Dela…
              </Button>
              {lastEmail ? (
                <Button size="sm" onClick={openMailClient}>
                  <Mail className="h-4 w-4" /> Öppna e-post
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Vi lagrar inte länken i klartext. Tappar du bort den – skapa en ny.
              {lastEmail
                ? " ”Öppna e-post” fyller i ett förslag i din e-postklient; Matrundan skickar inte e-post själv."
                : ""}
            </p>
          </div>
        ) : null}

        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Aktiva och nyligen använda inbjudningar
          </div>
          {loading ? (
            <div className="text-xs text-muted-foreground">Laddar…</div>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground">Inga inbjudningar än.</div>
          ) : (
            <ul className="divide-y divide-border/60 rounded-xl border border-border/70">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-2 p-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {i.invited_email ?? "Öppen länk"}
                    </div>
                    <div className="text-muted-foreground">
                      {stateLabel(i.state)} · går ut {formatDateShort(i.expires_at)}
                    </div>
                  </div>
                  {i.state === "active" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === i.id}
                      onClick={() => revoke(i.id)}
                    >
                      Återkalla
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </section>
  );
}

function LeaveGroupSection({
  groupId,
  isOwner,
  onLeft,
}: {
  groupId: string;
  isOwner: boolean;
  onLeft: () => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function confirmLeave() {
    setBusy(true);
    try {
      await leaveGroup(groupId);
      await onLeft();
      toast.success("Du har lämnat gruppen.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte lämna gruppen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Lämna gruppen</h3>
      <Card className="rounded-2xl border-border/70 p-4">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive"
          disabled={isOwner}
          onClick={() => setOpen(true)}
        >
          <LogOut className="h-4 w-4" /> Lämna gruppen
        </Button>
        {isOwner ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Som ägare kan du inte lämna gruppen förrän du har överfört ägarskapet.
          </p>
        ) : null}
      </Card>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lämna gruppen?</AlertDialogTitle>
            <AlertDialogDescription>
              Du förlorar åtkomsten direkt. Dina tidigare besök och betyg finns kvar
              i gruppen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave} disabled={busy}>
              {busy ? "Lämnar…" : "Lämna"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function stateLabel(s: InvitationListItem["state"]): string {
  switch (s) {
    case "active":
      return "Aktiv";
    case "accepted":
      return "Använd";
    case "expired":
      return "Utgången";
    case "revoked":
      return "Återkallad";
  }
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("sv-SE");
  } catch {
    return iso;
  }
}
