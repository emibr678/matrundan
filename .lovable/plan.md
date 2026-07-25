# Matrundan — gamification-strategi (produkt/UX, ingen kod)

Detta är en ren rekommendation. Inga filer, ingen version, ingen changelog ändras.

## TL;DR

Behåll nivåer, men gör om dem: **per-grupp, deltagandebaserat, sekundärt**. Lägg till en liten uppsättning **upplevelsebaserade badges**. Ha **en enda mjuk "höjdpunkter"-lista** i Gruppen-fliken i stället för klassisk leaderboard. Ingen global XP, ingen cross-group-exponering i v1.

---

## 1. Gör varierande konstellationer nivåer mer meningsfulla?

Ja, men inte som vi först tänkte. När 6 personer sällan är samlade blir "antal besök jag var med på" en **rättvisare** mätare än "antal besök i gruppen totalt" (som straffar den som missar middagar). Det gör också nivån personlig utan att bli en ren aktivitetstävling — du går upp när **du faktiskt varit med och ätit**, inte när du klickat mest i appen.

Risk: den som organiserar mycket men sällan hinner delta kan känna sig osynlig. Lös det med en separat badge för bidrag (se §5), inte via nivåsystemet.

## 2. Unika ställen, deltagna besök eller kombination?

**Deltagna besök som primär mätare.** Enkelt, ärligt, matchar kärnflödet (lägg till → välj → besök → betygsätt). Unika ställen fungerar sämre för Matrundan eftersom återbesök till favoriter är en del av poängen — att gå på Bhoga tre gånger ska inte "räknas mindre".

Undvik XP-poäng med olika vikter. Det är krångligt att förklara och lätt att game:a. En räknare, en tröskel.

## 3. Per grupp, globalt eller två lager?

**Per grupp i v1.** Skäl:
- Gruppisolering är kärnprincipen; global nivå läcker beteende mellan grupper.
- Integritet: en användare i två grupper vill inte att grupp B ser hur aktiv hen är i grupp A.
- Enkelhet: en siffra per medlemskap, inget aggregat.

Förbered datamodellen för ett framtida "livstidsmärke" som **bara användaren själv ser** på sin egen profil (privat räknare). Bygg det inte i UI:t nu.

## 4. Vad ser andra om aktivitet i andra grupper?

**Ingenting.** Inte antal grupper, inte total nivå, inte "aktiv i X grupper". Det bryter mot gruppens intima känsla och öppnar för jämförelser Matrundan inte ska handla om. När produkten går publik: fortsatt default off, ev. opt-in "visa min publika matprofil" — men det är en v2-fråga.

## 5. Badges vs nivåer

Båda, med olika roll:

- **Nivå** = din takt i just den här gruppen. En siffra, ett namn, växer långsamt.
- **Badges** = minnesvärda ögonblick, inte prestation. T.ex. "Första besöket", "Provat alla kategorier", "Fem fika i rad", "Besökt gruppens Nästa stopp inom en vecka", "Återvändare" (tredje besök på samma ställe).

**Skilj tydligt** upplevelsebadges (belönar att äta tillsammans) från admin-badges (belönar att fylla i appen). Ha få eller inga av det senare — max en diskret "Kurator" för den som lagt till många ställen. Annars driver appen fel beteende: folk lägger in ställen de aldrig tänkt besöka.

## 6. Leaderboard?

Klassisk leaderboard: **nej.** Det gör Matrundan till en tävling och krockar med att alla inte kan delta lika ofta.

Istället: **"Gruppens höjdpunkter"** — en liten sektion i Gruppen-fliken som roterar mjuka fakta:
- "Ni har tillsammans besökt 24 ställen"
- "Sara har föreslagit flest ställen den här månaden"
- "Emilia har varit med på flest middagar i höst"

Det firar bidrag utan rangordnad lista. Ingen "vinnare", ingen "sist".

## 7. Registrering: flera deltagare, historiska besök, dubbletter

Kärnregel: **ett besök = en händelse med N deltagare.** Nivån ökar för alla i `participantIds`, inte bara `createdBy`. Detta är redan datamodellens form — bra.

- **Historiska besök:** tillåt datum i det förflutna. Räkna dem normalt. Ingen "streak"-mekanik som straffar sena inlägg.
- **Dubbletter:** mjuk varning i UI om samma plats + samma datum finns; låt användaren bekräfta. Inget hårt block — gruppen kan ha ätit där två gånger samma dag.
- **Fel/ånger:** vem som helst i `participantIds` får ta bort sig själv; `createdBy` eller admin får ta bort hela besöket. Nivåer räknas om deterministiskt från besökslistan, så borttagning "återlämnar" nivån utan bokföring.
- **Retroaktiva nivåuppgraderingar:** visa en diskret toast först nästa gång användaren öppnar appen ("Du är nu Fikafantast"), inte mitt i registreringsflödet.

## 8. Vad byggs nu, vad förbereds, vad väntar?

**Bygg i demo-UX nu:**
- Nivå per medlemskap, synlig på medlemsprofilen och som liten chip bredvid namnet i medlemslistan.
- 4–6 upplevelsebadges med tydliga triggers.
- "Gruppens höjdpunkter"-sektion (statisk logik, ingen tävling).

**Förbered i datamodell inför Supabase:**
- `visit_participants` som separat tabell (redan planerat) — nivån härleds därifrån, lagras inte.
- Fält för privat livstidsräknare per profil, ej exponerat.
- Badge-definitioner som konfiguration, inte hårdkodat per användare.

**Vänta:**
- Global profil, cross-group-synlighet, publika leaderboards, säsongsutmaningar, streaks. Kräver verklig användardata för att kalibrera trösklar och undvika fel incitament.

## 9. Konkret förslag: nivåer och namn

Deltagna besök i gruppen → nivå. Trösklar valda för att ge snabb första belöning och sedan sakta ner:

```text
0    Nyfiken smakare
1    Smakletare
5    Fikafantast
15   Mataventyrare
30   Matkonnässör
60   Matrundans mästare
```

Sex nivåer räcker. Namnen är lekfulla, svenska, könsneutrala, inte översatta från engelska "foodie".

**UI-prioritering:**
- Medlemsprofil-sheet: nivå-chip högst upp, badges under nyckeltalen, inte överst.
- Medlemslistan i Gruppen: liten chip efter namnet, ingen progressbar.
- Hem och Matställen: **ingen** nivå-yta. Skyddar kärnflödet.
- Ingen notis "du är nära nästa nivå" — det driver fel beteende.

## 10. Långsiktig differentiering mot Google Maps / TheFork / Tripadvisor

Matrundans försvarbara kärna är **den privata, delade minnesboken för en liten grupp**. Håll fast vid tre principer när produkten skalar:

1. **Grupp först, inte plats först.** Konkurrenter börjar med "hitta en restaurang". Matrundan börjar med "vad ska vi göra tillsammans nästa gång". Nivåer och badges får aldrig flytta fokus från gruppen till platsen.
2. **Ingen publik recension.** Betyg är gruppens, inte världens. Även när produkten går publik: default privat, delning är opt-in per grupp, aldrig per plats.
3. **Kvalitativa minnen över kvantitativa poäng.** Kommentarer, foton, "vi var där när Nora fyllde år" är viktigare än stjärnsnitt. Gamification ska förstärka minnet, inte ersätta det.

Risker att bevaka:
- **Badge-inflation:** för många triggers gör att inget känns värt något. Håll listan kort och redigera hellre än att lägga till.
- **Nivåfixering:** om folk börjar registrera besök de inte varit på för att gå upp i nivå, är systemet trasigt. Motverkas av deltagarbaserad räkning + mjuk dubblettvarning.
- **Publik glidning:** varje gång någon föreslår "visa top-restauranger i stan" — säg nej. Det finns tio appar för det. Det finns ingen för det Matrundan gör.

---

## Rekommendation i en mening

Nivå per grupp baserad på deltagna besök, sex lekfulla svenska nivåer, en handfull upplevelsebadges, "Gruppens höjdpunkter" istället för leaderboard, ingen cross-group-synlighet i v1 — och behåll disciplinen att gamification alltid är sekundärt till lägg till → välj → besök → betygsätt.

Säg till om du vill att jag konkretiserar badge-listan eller ritar upp exakt var chip/badges placeras i Gruppen-vyn innan vi någonsin rör kod.
