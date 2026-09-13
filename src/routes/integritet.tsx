import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { appPageTitle } from "@/lib/app-environment";

export const Route = createFileRoute("/integritet")({
  head: () => ({
    meta: [
      { title: appPageTitle("Integritet") },
      {
        name: "description",
        content: "Så hanterar Matrundan personuppgifter och innehåll i privata grupper.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl pb-16 pt-6">
      <div className="mb-6">
        <p className="text-sm font-medium text-primary">Integritet</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Dina uppgifter i Matrundan</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          Matrundan är ett kostnadsfritt hobbyprojekt för vänner och familjer. Den här sidan
          beskriver på vanlig svenska vilka uppgifter appen använder och vad som händer om du
          raderar ditt konto.
        </p>
      </div>

      <div className="space-y-4">
        <PrivacySection title="Uppgifter som sparas">
          <p>
            När du loggar in sparas grundläggande profiluppgifter från Google, till exempel namn,
            e-postadress och profilbild. I appen sparas också dina gruppmedlemskap och det innehåll
            du själv lägger till: exempelvis matställen, favoriter, kommentarer, betyg,
            besöksdeltagande, planeringssvar och uppladdade bilder.
          </p>
        </PrivacySection>

        <PrivacySection title="Varför uppgifterna används">
          <p>
            Uppgifterna behövs för att du ska kunna logga in, tillhöra rätt privata grupper och
            använda gruppens gemensamma listor, planer och besökshistorik. Matrundan är inte en
            offentlig betygssajt och visar inte gruppens innehåll för andra grupper.
          </p>
        </PrivacySection>

        <PrivacySection title="Tjänster som hjälper appen">
          <p>
            Google används för inloggning. Supabase används för konto, databas och bildlagring.
            Geoapify används när du söker efter områden eller matställen. Dessa leverantörer kan
            behandla teknisk information som krävs för att leverera sina tjänster.
          </p>
        </PrivacySection>

        <PrivacySection title="Session och lagring">
          <p>
            Din inloggningssession sparas lokalt i webbläsaren så att du kan förbli inloggad.
            Exempelgruppen använder bara tillfällig lagring i den aktuella fliken. Gruppdata sparas
            så länge den behövs för gruppens historik eller tills den tas bort enligt funktionerna i
            appen.
          </p>
        </PrivacySection>

        <PrivacySection title="När du raderar kontot">
          <p>
            Du kan radera ditt konto själv under din profil. Ditt namn, din profilbild, dina
            kommentarer, favoriter och uppladdade bilder tas bort. Numeriska betyg och deltagande i
            genomförda besök bevaras anonymt som{" "}
            <span className="font-medium">Tidigare medlem</span>, så att övriga medlemmars
            gemensamma historik fortfarande stämmer.
          </p>
          <p>
            Äger du en grupp med andra aktiva medlemmar måste du först välja en ny ägare. Grupper
            där du är ensam medlem raderas permanent efter en extra bekräftelse.
          </p>
        </PrivacySection>

        <PrivacySection title="Support">
          <p>
            Projektet har för närvarande ingen kontaktperson eller garanterad support. De viktigaste
            integritetsvalen, inklusive kontoborttagning, finns därför direkt i appen.
          </p>
        </PrivacySection>
      </div>

      <Link
        to="/"
        className="mt-8 inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-primary hover:bg-primary/10"
      >
        Tillbaka till Matrundan
      </Link>
    </article>
  );
}

function PrivacySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-border/70 p-5 shadow-sm">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </Card>
  );
}
