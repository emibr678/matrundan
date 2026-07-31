# Matrundan

Matrundan är en privat, gruppcentrerad webbapp för vänner och familjer som vill
upptäcka, välja, besöka och minnas matställen tillsammans.

Kärnan är gruppens gemensamma matresa:

1. samla ställen gruppen är nyfiken på;
2. bestäm nästa gemensamma stopp;
3. registrera verkliga besök och faktiska deltagare;
4. bevara privata omdömen, favoriter, foton och historik;
5. använda historiken som inspiration till nästa upplevelse.

Matrundan är inte en offentlig restaurangkatalog, publik recensionsplattform,
individuell matdagbok, social feed eller global ranking.

## Viktigaste funktionerna

- Privata grupper med ägare, administratörer, medlemmar och tokenbaserade
  inbjudningar.
- Gruppens egen lista över matställen att prova och redan besökta favoriter.
- Geoapify-sökning från upp till fem verifierade sökområden med en gemensam
  radie på 1, 2, 3, 5, 10, 25 eller 50 km.
- Alla sparade sökområden är förvalda i sökningen och kan slås av eller på som
  mobilvänliga valbrickor. En tillfällig annan plats kan användas utan att
  gruppinställningen ändras.
- Deduplicerade sökresultat i lista och karta. Nya och tidigare borttagna
  ställen visas som möjliga att lägga till, medan aktiva gruppställen samlas i
  den stängda sektionen **Redan i gruppen**.
- Ägare och administratörer kan dölja en felaktig eller inaktuell providerträff
  enbart för den aktuella gruppen och återställa den under gruppinställningarna.
- Nästa stopp kan väljas manuellt eller slumpas.
- Gruppen kan föreslå datum och valfri tid, svara **Passar**, **Passar inte**
  eller **Osäker** och bekräfta planen utan automatisk majoritetslogik.
- Besök registreras med datum, måltid, faktiska deltagare, omdömen och ett
  valfritt privat foto.
- Kanoniska platser och besök kan delas mellan användarens grupper utan att
  dupliceras eller avslöja ursprungsgrupp, privata kommentarer eller medlemskap.
- Personliga favoriter, privata topplistor, medlemsprofiler och diskret
  gamification som räknar verkligt deltagande och återbesök.
- Push-notiser, installation på hemskärmen, publik integritetssida och
  självbetjänad kontoradering med anonymiserad gemensam historik.

Se [CHANGELOG.md](./CHANGELOG.md) för släppta och ännu inte publicerade
ändringar.

## Körlägen

### Publik landning

Utloggade användare möts av produktens publika start utan att gruppdata laddas.
Här går det att skapa konto, öppna en privat inbjudan eller prova
exempelgruppen.

### Exempelgrupp (`/exempel`)

En interaktiv, helt fiktiv grupp som återanvänder produktens vanliga gränssnitt.
Ändringar sparas endast i den aktuella flikens `sessionStorage` och gör inga
live-skrivningar.

### Intern testsandbox (`?demo=1`)

En separat skrivbar sandbox för utveckling och regressionstester. Den använder
lokal testdata och är inte en publik onboardingväg.

### Live-läge

Aktiveras efter inloggning. Läsning och skrivning går mot Supabase genom
gruppscopade read-models, serverfunktioner och validerade RPC-anrop.

## Arkitektur och integritet

Gruppen är den primära produkt- och integritetsgränsen.

- `places` representerar kanoniska verkliga matställen.
- `group_places` innehåller gruppens relation, metadata och aktiva lista.
- `group_search_areas` innehåller gruppens verifierade sökcentrum.
- `group_hidden_place_suggestions` innehåller gruppens spärrlista för externa
  sökträffar utan att radera det kanoniska matstället.
- `visits` representerar kanoniska verkliga besök.
- `visit_group_links` kopplar original- och mottagargrupper till samma besök.
- `review_group_visibility` styr betygs- och kommentarssynlighet per grupp.
- `visit_media` kopplar ett privat foto till besökets ursprungsgrupp.
- `next_stop_date_proposals` och `next_stop_date_responses` innehåller gruppens
  privata planering.

Den primära live-läsningen går genom `get_group_app_state_v5e`. Känsliga
skrivningar använder validerade `SECURITY DEFINER`-RPC:er med låst
`search_path`, autentisering, medlemskapskontroller och relevanta rollkrav.

Ursprungsgruppens identitet, privata kommentarer och medlemskap lämnar aldrig
servern vid delning. Endast faktiska deltagare får progression; registreraren
får ingen extra kredit och återbesök räknas.

Den kanoniska arkitekturkällan finns i
[docs/architecture.md](./docs/architecture.md).

## Teknik

- TanStack Start, React 19 och Vite 8
- TypeScript och Tailwind CSS v4
- shadcn/ui och Radix UI
- Bun som låst pakethanterare och runtime
- Lovable Cloud och Supabase för autentisering, datalager och privat fillagring
- Geoapify och MapLibre för plats- och kartfunktioner
- Playwright för mobila och tvärbrowserbaserade regressionstester

## Kom igång

Den rekommenderade, reproducerbara starten är:

```bash
bash scripts/bootstrap-agent.sh
bun run dev
```

För en miljö som även ska köra mobila Playwright-tester:

```bash
bash scripts/bootstrap-agent.sh --with-chromium
```

Mer information om runtime, Codex Cloud och miljöunderhåll finns i
[DEVELOPMENT.md](./DEVELOPMENT.md).

## Verifiering

```bash
bun run doctor
bun run verify:changed
bun run verify:agent
bun run verify:full
```

- `verify:changed` kontrollerar ändrade filer, enhetstester, TypeScript och
  produktionsbygge.
- `verify:agent` lägger till relevant Chromium-verifiering för ändrade UI-flöden.
- `verify:full` är den fulla repoövergripande kontrollen för releasekandidater.
- Redo-CI kör dessutom WebKit- och desktopmatrisen när kartkod ändras.

Det kanoniska arbetsflödet för planering, implementation, verifiering, merge och
publicering finns i
[docs/development-workflow.md](./docs/development-workflow.md).

## Repositoryöversikt

```text
src/routes/                    Filbaserade vyer
src/components/matrundan/      Produktkomponenter och dialoger
src/components/ui/             Delade shadcn/Radix-primitiver
src/lib/matrundan/             Domänlogik, read-models och integrationer
supabase/migrations/           Schema, RPC, RLS och Storage
scripts/                       Reproducerbar setup och repoverifiering
tests/e2e/                     Playwright-regressioner
docs/                          Kanonisk arkitektur och utvecklingsflöde
```

Agentinstruktioner finns i [AGENTS.md](./AGENTS.md). Äldre arkitektur- och
changeloghistorik ligger uttryckligen under [docs/archive](./docs/archive/).

## Konfiguration och hemligheter

Publicerbara Supabase-värden kan finnas i `.env`. Service-role-nycklar och andra
privilegierade hemligheter får aldrig exponeras i klientkod eller `VITE_`-
variabler.

`GEOAPIFY_API_KEY` lagras i Lovable Cloud Secrets och används endast av
serverkod. Inga produktionshemligheter ska committas till repot.

## Lovable och publicering

Projektet är kopplat till GitHub. Mergade commits på `main` synkas till Lovable,
men merge, preview-synk, databasdriftsättning och publicering är separata statusar.
Publicering till den publika appen kräver alltid ett uttryckligt godkännande.
