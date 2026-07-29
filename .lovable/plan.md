
# UX- och produktgranskning av Matrundan

Detta är endast en granskning. Inga filer, migrationer, texter eller inställningar ändras. Alla hypoteser i beställningen behandlas kritiskt, inte bekräftande.

## 1. Helhetsbild

Matrundan har rätt produktkärna: en privat gruppyta som svarar på "vad gör vi härnäst" och "vad har vi gjort tillsammans". Problemet är inte att appen har för många funktioner — de flesta funktioner tjänar kärnflödet. Problemet är **bristande prioritering och för platt visuell hierarki**: nästan varje element är ramat, färgat, ikonförsett eller badgat, vilket gör att inget känns primärt. Datumkortet på Hem är det tydligaste exemplet — det försöker vara översikt, omröstning, administration och detaljvy samtidigt.

Grundbedömning: **inte en redesign, utan en tydlighetsiteration**. Skala ner färgade ytor, samla primärhandlingar, gömma sekundära i sheets, och stram upp språket kring "gruppens lista" och "nästa stopp".

## 2. Visuell riktning

Färgriktningen (varm neutral bas, terrakotta primär, salvia bekräftat, senap höjdpunkt) passar produkten väl — den ligger nära den emotionella tonen "gruppens gemensamma matminnen" och skiljer sig medvetet från de kalla blå/lila paletter som dominerar restaurangappar. Behåll riktningen.

Det som behöver skärpas är **regler för när färg får användas**, inte paletten i sig:

- **En primärfärg per vy.** Terrakotta reserveras för den enda primärhandlingen på skärmen (Registrera besök på detaljsidan, Föreslå datum när inget finns, etc.). Aldrig på kort, ramar eller ikoner "för dekoration".
- **Salvia endast som status**, inte som knappfärg. "Bekräftat", "Besökt", "Valt som nästa stopp" — inte som accent på rubriker.
- **Senap endast för sparsam höjdpunkt** (badges, gamification-toppar, "Kvar att prova"-tile). Inte på knappar som "Slumpa" — den knappen är sekundär och bör se sekundär ut.
- **Kort i kort är regelbrottet.** Nästa stopp-kortet innehåller idag hero + datumkort + knapp-sektion, alla med egna bakgrunder/kanter. Välj en yttre behållare med intern avdelning genom whitespace och en enda hårfin linje — inte tre nivåer av rundade rektanglar.
- **Badges bara när statusen inte redan syns i texten.** "Bekräftat"-badge bredvid en rubrik som redan säger "Planerat till" är dubblering.
- **Typografi bär hierarkin**, inte färg. Display-serifen är stark nog för rubriker; sluta färglägga rubriker och ikoner för att skapa vikt.

Konkreta regler för knapphierarki:
- Primär: fylld terrakotta, en per vy.
- Sekundär: outline med neutralt border, mörk text.
- Tertiär: ghost/link, ingen ram.
- Destruktiv: text-only i ghost, aldrig fylld röd knapp på huvudytor.

## 3. Gruppens lista och språk

Hypotesen stämmer: "Lägg till ställe" är oprecist. Bättre: **fliken/sektionen heter "Matställen"** (kort, konkret, redan etablerat i routen) men **copyn runt handlingen ramar in det som gruppens lista**.

Rekommenderat språk:
- Tom lista: "Gruppens lista är tom än. Hitta ett ställe ni är nyfikna på."
- Primärknapp: **"Lägg till i listan"** (kontexten "gruppens lista" är redan etablerad av rubriken ovanför — undvik "Lägg till i gruppens lista" som blir långt på 360 px).
- Sökdialog-rubrik: "Hitta ett matställe"
- Bekräftelsesteg: "Lägg till [Namn] i listan?"
- Redan tillagt: "Redan i listan" (disabled state, inte toast)
- Toast efter tillägg: "Tillagt i listan"

Undvik "Spara stället", "Lägg till favorit", "Följ" — de blandar ihop personligt och grupp.

## 4. Favorit kontra Spara

"Spara" är fel ord här — det betyder olika saker i olika appar (bokmärke, offline, personlig lista). Rekommendation: **"Favorit" / "Min favorit"** med hjärt-ikon, fylld i valt läge, outline i ovalt. Etiketten på knappen:
- Ovalt: "Favorit" (outline hjärta)
- Valt: "Favorit" (fyllt hjärta, salvia eller terrakotta-fill)

Undvik "Min favorit" som knapptext — "Min" tillför inget när kontexten redan är den inloggade användarens vy. Använd däremot "Dina favoriter" som sektionsrubrik i profilvyn. Skilj tydligt genom placering: favorit-hjärtat är en liten toggle uppe till höger på detaljsidan, aldrig i samma knapp-rad som Registrera besök och Välj som nästa stopp.

## 5. Nästa stopp

Hypotesen stämmer i huvudsak. "Nästa" + gnistor läser som AI-rekommendation. Använd konsekvent **"Nästa stopp"** som fras, och byt gnist-ikonen mot **flagga** (Lucide `Flag`) eller **pin med stjärna** — flagga är tydligare som "här ska vi".

Terminologi per tillstånd:
- Detaljsida, inte valt: knapp "Välj som nästa stopp"
- Detaljsida, valt: statusrad ovanför primärhandlingen: "🚩 Valt som nästa stopp · Byt / Ta bort" (byt/ta bort som ghost-länkar, inte knappar)
- Hem, tomt: "Inget nästa stopp valt än"
- Hem, valt: "Nästa stopp" som liten label, restaurangen som hero

Kritik mot nuvarande detaljsida: Registrera besök, Välj som nästa stopp, Favorit och "Öppna i Maps" konkurrerar. Rekommendation: **Registrera besök är alltid den enda primärhandlingen** (fylld terrakotta, sticky/nederkant på mobil). Välj som nästa stopp blir en sekundär outline-knapp direkt ovanför. Favorit blir toggle i headern. Maps blir en textlänk i adressraden ("Visa i Maps"), inte en knapp.

## 6. Duplicering Hem vs Gruppen

Hypotesen stämmer och bör drivas hårdare:
- **Hem = "Vad gör vi härnäst?"** Fullt handlingskort för nästa stopp med datumplanering och Registrera besök. Progressbar, senaste aktivitet.
- **Gruppen = "Vilka är vi och vad har vi gjort?"** Medlemmar, Gruppens höjdpunkter (gamification), historik, inställningar. **Ingen** Nästa stopp-widget här — inte ens kompakt. En rad "Nästa stopp: [Namn] →" som länk till Hem räcker inte, den skapar bara ny duplicering. Ta bort helt.

Enda undantaget: om det finns ett bekräftat datum inom 7 dagar kan Gruppen visa en diskret informationsrad högst upp ("Ni ses på Kaffebar X på torsdag"), utan handlingsknappar. Det är då kalenderinfo, inte planering.

## 7. Kompakt datumplanering på Hem

Detta är största enskilda vinsten. Nuvarande kort är överbelastat. Rekommenderad hierarki:

**Tillstånd A – inget datum:**
En rad under nästa stopp-hero:
`📅 Ingen dag planerad · Föreslå datum`
"Föreslå datum" som ghost-länk, inte outline-knapp.

**Tillstånd B – aktivt förslag:**
```
📅 Torsdag 6 nov, 19:00
   3 passar · 1 osäker · Svara →
```
En rad. "Svara" (eller "Ändra mitt svar" om användaren redan svarat) öppnar bottom sheet med hela detaljvyn: svarsalternativ, namnlistor per svar, och för behöriga: Bekräfta / Ändra datum / Ta bort.

**Tillstånd C – bekräftat:**
```
✅ Torsdag 6 nov, 19:00 · Bekräftat
```
En rad, salvia checkmark. Tap öppnar sheet med "Ändra" och "Ta bort" för behöriga. Ingen svarssammanställning behövs efter bekräftelse — beslutet är fattat.

Regler:
- **Namn på vem som svarat vad hör hemma i sheet**, inte på Hem. På Hem räcker aggregat.
- **Nollvärden döljs.** Visa inte "0 passar inte" när ingen svarat nej.
- **Destruktiva åtgärder (Ta bort förslaget) placeras längst ned i sheet som ghost-text**, aldrig som synlig knapp på Hem-kortet.
- **"Föreslaget av X"** hör hemma i sheet, inte på Hem-raden. Vem som föreslog är sällan kritisk info för dagen.
- **Bekräfta-knappen är sheet-primär**, inte inline på kortet.

Detta gör Nästa stopp-kortet till: hero (bild/emoji + namn + adress), en planeringsrad, en Registrera besök-knapp. Tre element, inte sju.

## 8. Hypoteser jag delvis ifrågasätter

- **"Min favorit"** som exakt term: "Favorit" räcker och läser bättre i knappar.
- **Kompakt nästa-stopp på Gruppen**: skulle helt ta bort det, inte krympa det. Halvvägslösningar duplicerar ändå.
- **Färgpaletten**: håller med om riktningen men problemet idag är inte färgerna utan **antalet färgade ytor per skärm**. Ändra användningsreglerna innan ni ändrar tokens.
- **Ikonbyte gnistor → flagga**: värt att göra, men mindre viktigt än att ta bort duplicerade badges och statustexter runt Nästa stopp.

## 9. Prioritering

**P0 – största tydlighetsvinst, minst risk:**
1. Kollapsa datumkortet till en rad + bottom sheet enligt tillstånd A/B/C ovan.
2. Ta bort Nästa stopp-widgeten från Gruppen helt.
3. Byt "Spara" → "Favorit" med hjärt-ikon och flytta till header-toggle på detaljsidan.
4. Byt gnist-ikonen till flagga och etablera "Nästa stopp" som konsekvent term.

**P1 – språk och hierarki:**
5. Copy-svep: "Lägg till i listan", "Hitta ett matställe", "Välj som nästa stopp", tom-lista-texter.
6. Regler för färgade ytor: max en primärfärg per vy, ta bort kort-i-kort, låt typografi bära hierarkin.
7. Detaljsidans knapp-rad: en primär (Registrera besök), en sekundär (Välj som nästa stopp), resten som ghost/länk/toggle.

**P2 – finslip:**
8. Badge-städning: ta bort statusbadges där rubriken redan säger samma sak.
9. Gruppens höjdpunkter: säkerställ att det inte konkurrerar visuellt med medlemslistan.
10. Aktivitetsraderna på Hem: dämpa färg/ikoner så de läser som logg, inte som handling.

## 10. Föreslagen första iteration (liten, hög utväxling)

En sammanhållen "tydlighetsrunda" som ryms i en release utan att röra datamodell eller RPC:er:

- **Datumkort → en rad + bottom sheet** (P0 #1)
- **Ta bort Nästa stopp från Gruppen** (P0 #2)
- **"Favorit" med hjärt-toggle i header, bort från knapp-raden** (P0 #3)
- **Copy-svep enligt P1 #5**
- **Regel: max en fylld primärfärg-knapp per vy** — praktiskt innebär det att "Slumpa" blir sekundär outline, "Bekräfta datum" blir sheet-primär (inte kort-primär), etc.

Detta är fem sammanhållna ändringar som tillsammans tar bort det dominerande "allt skriker samtidigt"-intrycket utan att kräva ny arkitektur, nya komponenter eller ompaketering av data. Gnist→flagga och full färgtokens-review kan följa i nästa iteration när grundhierarkin sitter.

---

Ingen kod, inga filer, inga migrationer, inga texter eller inställningar har ändrats. Detta dokument är rådgivande underlag inför en eventuell framtida designiteration.
