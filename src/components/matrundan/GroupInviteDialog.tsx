import * as React from "react";
import { Check, Copy, Mail, Share2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createGroupInvitation,
  createGroupMemberInvitations,
  listGroupInviteCandidates,
  listOwnGroupInvitations,
  revokeGroupInvitation,
  type GroupInviteCandidate,
  type OwnGroupInvitation,
} from "@/lib/matrundan/live-admin";
import { formatDate } from "@/lib/matrundan/store";
import { APP_NAME } from "@/lib/matrundan/version";

const INITIAL_CANDIDATE_LIMIT = 6;

function ownInvitationLabel(invitation: OwnGroupInvitation): string {
  if (invitation.invite_kind === "internal") {
    return invitation.invited_user_name?.trim() || "Matrundan-medlem";
  }
  if (invitation.invite_kind === "email") {
    return invitation.invited_email?.trim() || "E-postinbjudan";
  }
  return "Öppen inbjudningslänk";
}

export function GroupInviteDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
}) {
  const [candidates, setCandidates] = React.useState<GroupInviteCandidate[]>([]);
  const [ownInvites, setOwnInvites] = React.useState<OwnGroupInvitation[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [creatingLink, setCreatingLink] = React.useState(false);
  const [lastLink, setLastLink] = React.useState<string | null>(null);
  const [lastEmail, setLastEmail] = React.useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = React.useState<string | null>(null);
  const [candidateQuery, setCandidateQuery] = React.useState("");
  const [showAllCandidates, setShowAllCandidates] = React.useState(false);
  const dialogContentRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [nextCandidates, nextOwnInvites] = await Promise.all([
        listGroupInviteCandidates(groupId),
        listOwnGroupInvitations(groupId),
      ]);
      setCandidates(nextCandidates);
      setOwnInvites(nextOwnInvites);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte läsa inbjudningar.");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  React.useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setEmail("");
      setLastLink(null);
      setLastEmail(null);
      setCandidateQuery("");
      setShowAllCandidates(false);
      return;
    }
    void load();
  }, [load, open]);

  function toggleCandidate(candidate: GroupInviteCandidate) {
    if (candidate.invitation_state === "pending") return;
    setSelectedIds((current) =>
      current.includes(candidate.user_id)
        ? current.filter((id) => id !== candidate.user_id)
        : [...current, candidate.user_id],
    );
  }

  async function sendInternalInvites() {
    if (selectedIds.length === 0) return;
    setSending(true);
    try {
      const result = await createGroupMemberInvitations(groupId, selectedIds);
      const created = result.created_count;
      toast.success(
        created === 1
          ? "Inbjudan skickad."
          : created > 1
            ? String(created) + " inbjudningar skickade."
            : "De valda personerna var redan inbjudna.",
      );
      setSelectedIds([]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte skicka inbjudan.");
    } finally {
      setSending(false);
    }
  }

  async function createLinkInvite() {
    setCreatingLink(true);
    try {
      const trimmed = email.trim();
      const invitation = await createGroupInvitation(groupId, trimmed || null);
      const link = window.location.origin + "/inbjudan/" + invitation.token;
      setLastLink(link);
      setLastEmail(trimmed || null);
      setEmail("");
      toast.success("Inbjudningslänken är skapad.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte skapa inbjudningslänk.");
    } finally {
      setCreatingLink(false);
    }
  }

  async function revoke(invitationId: string) {
    setBusyInviteId(invitationId);
    try {
      await revokeGroupInvitation(invitationId);
      toast.success("Inbjudan återkallad.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte återkalla inbjudan.");
    } finally {
      setBusyInviteId(null);
    }
  }

  async function copyLink() {
    if (!lastLink) return;
    try {
      await navigator.clipboard.writeText(lastLink);
      toast.success("Länk kopierad.");
    } catch {
      toast.error("Kunde inte kopiera länken.");
    }
  }

  function shareLink() {
    if (!lastLink) return;
    const data: ShareData = {
      title: APP_NAME,
      text: "Häng med i gruppen " + groupName + " på " + APP_NAME + ".",
      url: lastLink,
    };
    if ("share" in navigator) void navigator.share(data).catch(() => {});
    else void copyLink();
  }

  function openMailClient() {
    if (!lastLink || !lastEmail) return;
    const subject = encodeURIComponent("Inbjudan till " + groupName + " på " + APP_NAME);
    const body = encodeURIComponent(
      "Hej!\n\nJag vill bjuda in dig till gruppen " +
        groupName +
        " på " +
        APP_NAME +
        ".\nGå med här: " +
        lastLink +
        "\n\nLänken gäller i sju dagar och kan bara användas av den här e-postadressen.",
    );
    window.location.href = "mailto:" + lastEmail + "?subject=" + subject + "&body=" + body;
  }

  const pendingOwnInvites = ownInvites.filter((invitation) => invitation.state === "active");
  const orderedCandidates = React.useMemo(
    () => [
      ...candidates.filter((candidate) => candidate.invitation_state !== "pending"),
      ...candidates.filter((candidate) => candidate.invitation_state === "pending"),
    ],
    [candidates],
  );
  const normalizedCandidateQuery = candidateQuery.trim().toLocaleLowerCase("sv-SE");
  const filteredCandidates = React.useMemo(() => {
    if (!normalizedCandidateQuery) return orderedCandidates;
    return orderedCandidates.filter((candidate) => {
      const haystack = [candidate.display_name, ...candidate.shared_group_names]
        .join(" ")
        .toLocaleLowerCase("sv-SE");
      return haystack.includes(normalizedCandidateQuery);
    });
  }, [normalizedCandidateQuery, orderedCandidates]);
  const visibleCandidates =
    normalizedCandidateQuery || showAllCandidates
      ? filteredCandidates
      : filteredCandidates.slice(0, INITIAL_CANDIDATE_LIMIT);
  const candidateListNeedsScaling = orderedCandidates.length > INITIAL_CANDIDATE_LIMIT;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogContentRef}
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          dialogContentRef.current?.focus();
        }}
        className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Bjud in till {groupName}</DialogTitle>
          <DialogDescription>
            Bjud in någon du redan delar en grupp med, eller skicka en länk till någon annan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <div>
              <h3 className="text-sm font-medium">Från dina andra grupper</h3>
              <p className="text-xs text-muted-foreground">
                Personen väljer själv om den vill gå med.
              </p>
            </div>

            {loading ? (
              <div className="rounded-xl border border-border/70 p-3 text-sm text-muted-foreground">
                Laddar personer…
              </div>
            ) : candidates.length === 0 ? (
              <div className="rounded-xl border border-border/70 p-3 text-sm text-muted-foreground">
                Ingen mer från dina andra grupper att bjuda in just nu.
              </div>
            ) : (
              <div className="space-y-2">
                {candidateListNeedsScaling ? (
                  <Input
                    aria-label="Sök bland personer"
                    placeholder="Sök bland personer"
                    value={candidateQuery}
                    onChange={(event) => setCandidateQuery(event.target.value)}
                  />
                ) : null}

                {normalizedCandidateQuery && visibleCandidates.length === 0 ? (
                  <div className="rounded-xl border border-border/70 p-3 text-sm text-muted-foreground">
                    Ingen person matchar sökningen.
                  </div>
                ) : null}

                {visibleCandidates.map((candidate) => {
                  const selected = selectedIds.includes(candidate.user_id);
                  const pending = candidate.invitation_state === "pending";
                  return (
                    <button
                      key={candidate.user_id}
                      type="button"
                      aria-pressed={selected}
                      disabled={pending || sending}
                      onClick={() => toggleCandidate(candidate)}
                      className={
                        "flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                        (selected
                          ? "border-primary bg-primary/5"
                          : "border-border/70 hover:bg-muted/50") +
                        (pending ? " opacity-70" : "")
                      }
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-lg">
                        {candidate.avatar_url ? (
                          <img
                            src={candidate.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          candidate.avatar_emoji || candidate.display_name.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{candidate.display_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {candidate.shared_group_names.length === 1
                            ? "Ni är båda med i " + candidate.shared_group_names[0]
                            : "Ni delar " +
                              String(candidate.shared_group_names.length) +
                              " grupper"}
                        </span>
                      </span>
                      {pending ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Redan inbjuden
                        </span>
                      ) : selected ? (
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-4 w-4" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}

                {candidateListNeedsScaling && !showAllCandidates && !normalizedCandidateQuery ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowAllCandidates(true)}
                  >
                    Visa alla {orderedCandidates.length}
                  </Button>
                ) : null}
              </div>
            )}

            {candidates.some((candidate) => candidate.invitation_state !== "pending") ? (
              <Button
                className="w-full"
                disabled={sending || selectedIds.length === 0}
                onClick={() => void sendInternalInvites()}
              >
                <UserPlus className="h-4 w-4" />
                {sending
                  ? "Skickar…"
                  : selectedIds.length > 1
                    ? "Skicka " + String(selectedIds.length) + " inbjudningar"
                    : "Skicka inbjudan"}
              </Button>
            ) : null}
          </section>

          <section className="space-y-3 border-t border-border/60 pt-4">
            <div>
              <h3 className="text-sm font-medium">Bjud in med länk</h3>
              <p className="text-xs text-muted-foreground">
                För någon som inte redan finns i en grupp med dig.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="group-invite-email">E-post (valfritt)</Label>
              <Input
                id="group-invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vän@example.se"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Utan e-post kan flera använda länken. Med e-post kan bara den adressen använda den,
                en gång.
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              disabled={creatingLink}
              onClick={() => void createLinkInvite()}
            >
              <Share2 className="h-4 w-4" />
              {creatingLink ? "Skapar…" : "Skapa inbjudningslänk"}
            </Button>

            {lastLink ? (
              <Card className="space-y-2 rounded-xl border-border/70 bg-muted/30 p-3">
                <div className="text-xs font-medium">Dela länken nu</div>
                <div className="break-all rounded-lg bg-background p-2 text-xs">{lastLink}</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void copyLink()}>
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
              </Card>
            ) : null}
          </section>

          {pendingOwnInvites.length > 0 ? (
            <section className="space-y-2 border-t border-border/60 pt-4">
              <h3 className="text-sm font-medium">Dina väntande inbjudningar</h3>
              <div className="divide-y divide-border/60 rounded-xl border border-border/70">
                {pendingOwnInvites.map((invitation) => (
                  <div key={invitation.id} className="flex min-w-0 items-center gap-2 p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {ownInvitationLabel(invitation)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Går ut {formatDate(invitation.expires_at)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyInviteId === invitation.id}
                      onClick={() => void revoke(invitation.id)}
                    >
                      Återkalla
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
