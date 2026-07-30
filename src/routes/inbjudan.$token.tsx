import * as React from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmailAuthDialog } from "@/components/matrundan/EmailAuthDialog";
import {
  acceptGroupInvitation,
  getInvitationPreview,
  type InvitationPreview,
} from "@/lib/matrundan/live-admin";
import { useSession } from "@/lib/matrundan/session";

export const Route = createFileRoute("/inbjudan/$token")({
  head: () => ({
    meta: [
      { title: "Gå med i gruppen · Matrundan" },
      {
        name: "description",
        content: "Acceptera din inbjudan och gå med i gruppen på Matrundan.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading, mode, signInWithGoogle, refreshGroups, selectGroup } = useSession();

  const [preview, setPreview] = React.useState<InvitationPreview | null>(null);
  const [previewErr, setPreviewErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [emailCodeOpen, setEmailCodeOpen] = React.useState(false);
  const submitted = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    setPreviewErr(null);
    getInvitationPreview(token)
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch((e) => {
        if (!cancelled) setPreviewErr(e instanceof Error ? e.message : "Kunde inte läsa inbjudan.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const pendingPath = `/inbjudan/${token}`;

  async function accept() {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    try {
      const res = await acceptGroupInvitation(token);
      await refreshGroups();
      selectGroup(res.group_id);
      toast.success(res.already ? "Du är redan medlem." : "Du är med i gruppen!");
      navigate({ to: "/gruppen" });
    } catch (err) {
      submitted.current = false;
      toast.error(err instanceof Error ? err.message : "Kunde inte acceptera inbjudan.");
    } finally {
      setBusy(false);
    }
  }

  const state = preview?.state ?? (previewErr ? "invalid" : "loading");
  const groupLabel = preview?.group_emoji
    ? `${preview.group_emoji} ${preview.group_name ?? ""}`
    : (preview?.group_name ?? "");

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg items-center px-4 py-10">
      <Card className="w-full rounded-3xl p-6 shadow-sm">
        {state === "loading" ? (
          <div className="text-sm text-muted-foreground">Hämtar inbjudan…</div>
        ) : state === "valid" && preview ? (
          <>
            <div className="text-4xl">{preview.group_emoji ?? "🍽️"}</div>
            <h1 className="mt-3 font-display text-2xl font-semibold">
              Gå med i {preview.group_name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Du har blivit inbjuden till en privat matställeslista.
              {preview.email_bound
                ? " Inbjudan är knuten till en specifik e-postadress – logga in med rätt e-postadress."
                : ""}
            </p>

            <div className="mt-5 space-y-2">
              {loading ? (
                <div className="text-sm text-muted-foreground">Kontrollerar inloggning…</div>
              ) : !user ? (
                <>
                  <Button
                    className="w-full"
                    onClick={() =>
                      void signInWithGoogle({ redirectPath: pendingPath }).catch(() =>
                        toast.error("Kunde inte starta Google-inloggning."),
                      )
                    }
                  >
                    Fortsätt med Google
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setEmailCodeOpen(true)}
                  >
                    Fortsätt med e-postkod
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Inloggningen kopplar ditt konto till gruppen. Inbjudningslänken är separat och
                    används först när du klickar på Gå med.
                  </p>
                </>
              ) : mode !== "live" ? (
                <p className="text-sm text-muted-foreground">
                  Demo-läget kan inte acceptera riktiga inbjudningar. Öppna länken utan ?demo=1.
                </p>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground">
                    Inloggad som <span className="font-medium">{user.email}</span>
                  </div>
                  <Button className="w-full" onClick={accept} disabled={busy}>
                    {busy ? "Går med…" : "Gå med i gruppen"}
                  </Button>
                </>
              )}
            </div>
          </>
        ) : (
          <InviteMessage state={state} groupLabel={groupLabel} />
        )}
      </Card>
      <EmailAuthDialog
        open={emailCodeOpen}
        onOpenChange={setEmailCodeOpen}
        redirectPath={pendingPath}
      />
    </div>
  );
}

function InviteMessage({ state, groupLabel }: { state: string; groupLabel: string }) {
  const msg =
    state === "expired"
      ? "Länken har gått ut. Be gruppens ägare eller admin om en ny inbjudan."
      : state === "revoked"
        ? "Inbjudan har återkallats."
        : state === "accepted"
          ? "Inbjudan är redan använd."
          : "Länken är ogiltig eller finns inte längre.";
  return (
    <>
      <div className="text-4xl">⚠️</div>
      <h1 className="mt-3 font-display text-2xl font-semibold">Kan inte gå med</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {groupLabel ? `${groupLabel}: ` : ""}
        {msg}
      </p>
      <Link
        to="/"
        className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Till Matrundan
      </Link>
    </>
  );
}
