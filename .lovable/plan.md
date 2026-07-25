# Matrundan — konkretisering av gamification (produkt/UX, ingen kod)

Ren rekommendation. Inga filer, ingen version, ingen changelog ändras.

---

## 1. Nivågränser — inte ren Fibonacci

Fibonacci (1, 2, 3, 5, 8, 13, 21, 34, 55) ger fin matematisk känsla men fel kurva för Matrundan: stegen 1→2→3 är för täta (tre nivåuppgraderingar under gruppens första månad känns billigt) och slutet växer för långsamt jämfört med hur sällan besök faktiskt sker.

Anta 1–4 gruppbesök/månad och att en aktiv medlem deltar i ~60–70%. Det ger ~15–25 deltagna besök/år för en engagerad person. Kurvan bör:
- ge **första uppgraderingen direkt efter första besöket** (belöning för att komma igång)
- ge **andra uppgraderingen inom första månaden** för aktiva
- göra **mellannivåerna kännbara** (~kvartal till år)
- göra **topnivån till ett flerårigt mål** som håller även när appen blir publik och några användare besöker mycket oftare

Rekommenderade **kumulativa** trösklar (deltagna besök i gruppen):

```text
0    Nyfiken smakare        (start)
1    Smakletare             (första besöket — omedelbar belöning)
4    Krogspanaren           (~första månaden för aktiva)
10   Fikafantast            (~kvartal)
20   Mataventyrare          (~halvår–år)
40   Matkonnässör           (~år+ för aktiva)
75   Matrundans mästare     (flerårigt mål, håller för publik produkt)
```

Sju nivåer. Kurvan är ungefär geometrisk (×2–2.5) efter första steget, inte Fibonacci. Trösklarna är runda tal — lättare att kommunicera än 1/3/8/21.

Motiv att avvika från Fibonacci: appen mäter i **händelser med lång periodicitet**, inte kontinuerlig aktivitet. Fibonacci passar bättre för dagliga streaks och XP.

## 2. Nivånamn — tre serier + rekommendation

**Serie A — Utforskare (rekommenderad).** Bygger på "spanar/letar/upptäcker", fungerar för alla kategorier, har glimten i ögat utan att bli barnsligt:

```text
Nyfiken smakare
Smakletare
Krogspanaren
Fikafantast
Mataventyrare
Matkonnässör
Matrundans mästare
```

**Serie B — Sällskapet.** Mer social ton, mindre koppling till mat specifikt:

```text
Nykomling vid bordet
Bordsgäst
Stammis
Rundans följeslagare
Middagsstrateg
Sällskapets sakkunnige
Rundans hövding
```

**Serie C — Vardagsheroisk.** Torrare svensk humor:

```text
Provsmakaren
Menyläsaren
Krogspanaren
Notaförhandlaren
Måltidsveteranen
Matrundans orakel
Matrundans mästare
```

**Rekommendation: Serie A.** Skäl:
- "Krogspanaren" som användaren gillade sitter mitt i serien där den gör mest nytta (första "riktiga" nivån).
- Fungerar för café/pub/matvagn — "spanare/letare/äventyrare" är kategorineutralt.
- Blandar allvar och lek utan att bli krystat.
- Skiljer sig lexikalt från badges (badges använder verbfraser/ögonblick, nivåer använder personroller).

## 3. Badges — exakt 5 för v1

Kriterier: fira **ögonblick och variation**, inte volym (det gör nivåerna). Ingen ska kunna game:as genom app-klick. Ingen "lade till 10 ställen"-badge — det driver spam.

1. **Första besöket** — deltog i sitt första registrerade besök i gruppen. *Varför:* välkomstögonblick, kompletterar nivå 1 med en visuell markör.
2. **Provsmakare** — deltagit i besök i minst 4 olika kategorier (restaurang, café, bageri, snabbmat, pub, matvagn). *Varför:* belönar bredd utan att kräva alla 6 (matvagn/pub finns inte i alla städer).
3. **Kökskosmopolit** — deltagit i besök som täcker minst 5 olika kök (fältet `cuisines`). *Varför:* belönar kulinarisk variation oberoende av kategori; skiljer sig från Provsmakare som mäter formatet.
4. **Återvändare** — deltog i tredje besöket på samma ställe. *Varför:* firar att gruppen har favoriter; motverkar "unika ställen"-fixering.
5. **Kurator** — föreslog ett ställe som gruppen senare faktiskt besökte (≥1). *Varför:* belönar bidrag utan att belöna spam — ett förslag som ingen bryr sig om ger ingenting.

**Uttryckligen bortvalt:**
- "Hela gänget samlat" (alla deltar) — omöjligt när gruppen växer och skalar dåligt för publik produkt. Passar bättre som grupphöjdpunkt (§5).
- "Snabb bokare" / "Föreslog Nästa stopp som besöktes inom en vecka" — överlappar Kurator och tidspressar flödet.
- Ren "unika ställen"-badge — nivåerna räknar redan deltagna besök; unika ställen visas som separat statistik i profilen (mätvärde, inte badge).

Fem räcker. Sex är taket; bättre lägga till en efter första skarpa användning än att inflatera nu.

## 4. UI — placering

**Medlemslista (Gruppen-fliken):**
- Liten nivå-chip efter namnet: `Lv 3 · Krogspanaren` i muted färg. Ingen progressbar, inga badge-ikoner här (för mycket brus i listan).
- Hela kortet fortsatt klickbart → öppnar MemberProfileSheet.

**MemberProfileSheet:**
- Överst: avatar + namn + nivå-chip. Under chippen: **liten diskret text** "3 besök till nästa nivå" (progress som text, inte som bar). *Motiv att visa progress:* användaren vill se att systemet finns och rör sig; risk för fel incitament dämpas av att det bara syns i egen/andras profil, inte på hem/matställen. Om det visar sig driva farmning i skarpt läge — dölj för andra, behåll för egen profil.
- Nyckeltal-rad: Besök · Unika ställen · Föreslagna. (Unika ställen som separat siffra löser användarens punkt om att inte blanda in dem i nivån.)
- Badges-rad: horisontell rad med intjänade badges som små emoji-chips med tooltip/label. Ej intjänade visas **inte** (ingen "låst"-lista — det signalerar checklist-beteende).
- Sedan: senaste besök, favorit just nu, smakprofil, senaste aktivitet (som idag).

**Hem och Matställen:** ingen nivå- eller badge-yta. Skyddar kärnflödet.

## 5. Gruppens höjdpunkter — 6 mallar

Rotera 1–2 åt gången i Gruppen-fliken. Alla ska ge meningsfull text även vid låg aktivitet; de som kräver tröskel visas inte förrän tröskeln är nådd (inget tomt kort).

1. **"Ni har tillsammans besökt {N} ställen"** — alltid tillgänglig (N≥1).
2. **"Er mest besökta plats är {Ställe} med {N} besök"** — kräver N≥2 på något ställe.
3. **"Ni har provat {N} olika kök"** — kräver N≥3.
4. **"Senaste månaden: {N} besök tillsammans"** — kräver N≥1 senaste 30 dagarna.
5. **"{Namn} föreslog {Ställe} som ni sedan besökte"** — kräver att en kurator-koppling finns; roterar mellan medlemmar.
6. **"Nästa stopp: {Ställe}"** — alltid tillgänglig om `nextPlaceId` är satt (fungerar som mjuk påminnelse).

**Uttryckligen inte:** "flest besök", "flest förslag", "flest kommentarer" — rangordnar medlemmar och krockar med beslutet att inte ha leaderboard.

## 6. Ordningsföljd: demo → Supabase → Geoapify

Rekommendation:

1. **Färdigställ gamification-UX i demo först.** Skäl: nivå- och badge-logik är rent härledd från `visits` + `participantIds`, som redan finns i datamodellen. Ingen ny tabell krävs. Att iterera visuellt i demo är snabbt och billigt. Risk för omarbete är låg eftersom regeln (härled, lagra ej) redan är etablerad.
2. **Supabase därefter.** När UX sitter är datamodellen bekräftad; migreringen blir mekanisk. Supabase före gamification skulle tvinga fram schema-beslut innan UX validerat att de behövs.
3. **Geoapify sist.** Sökning är en ortogonal förbättring som inte påverkar gamification eller gruppmodellen. Att göra den sist håller UX-iterationen snabb (ingen API-latens/nyckelhantering i demo).

**Behåll demo-läget efter Supabase-koppling.** Konkret: en `?demo=1`-flagga eller en toggle i Om-appen som laddar in-memory state istället för Supabase. Skäl: gör onboarding/marknadsföring lättare (klickbar demo utan konto), snabbar upp lokal utveckling, och ger en säkerhetsventil när backenden är nere. Håll demon read-only-liknande (skriv till minne, aldrig till Supabase) för att undvika förvirring.

## 7. Rekommenderat nästa implementationspaket

**Ingår i samma steg (gamification v1 i demo):**
- Härlederingslogik i store: nivå per medlem+grupp, intjänade badges, unika-ställen-count.
- Nivå-chip i medlemslistan.
- Nivå-chip + progress-text + badges-rad + unika-ställen-siffra i MemberProfileSheet.
- "Gruppens höjdpunkter"-sektion i Gruppen-fliken med de 6 mallarna och rotationslogik.
- Diskret toast "Du är nu Krogspanaren" vid nästa appöppning efter nivåuppgradering.
- Version bump + changelog-post.

**Väntar uttryckligen:**
- Supabase-koppling.
- Geoapify-koppling.
- Privat livstidsräknare/global profil.
- Badge nr 6 (lägg till efter första skarpa användning om det behövs).
- Säsongsutmaningar, streaks, publika leaderboards.

**Öppen produktfråga innan implementation:** ingen kritisk. Kvar att bekräfta med användaren:
- Godkänner nivåkurvan 1/4/10/20/40/75 (avviker från Fibonacci)?
- Godkänner Serie A som nivånamn?
- Godkänner de 5 badgesen (vill användaren lägga till "hela gänget samlat" som badge trots överlapp med grupphöjdpunkt §5.4)?

När dessa tre är bekräftade är vi redo för implementation.
