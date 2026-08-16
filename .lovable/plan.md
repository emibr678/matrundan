# UX-granskning: Nästa stopp v2, bestämt läge (360 px)

Granskat i `src/components/matrundan/NextStopCard.tsx` på featurebranchen (grenen för bestämt stopp, `ScheduleRow`, `ProposalRow`, "Andra förslag"). Endast UX-analys och rekommendation — ingen kod ändras.

## 1) Varför skärmen känns rörig

1. **Dagen får mest visuell tyngd, men stället är produkten.** Kortet inleds med kalenderikon, versal etikett "NÄR?", en textlänk och två textactions — fyra element om planering innan användaren ens sett vilket ställe det gäller. Stället, som är kärnan, kommer först under en divider.
2. **För många actions i samma viktklass.** I bestämt läge finns "Ändra dag", "Kan inte den dagen", "Ändra tid", "Registrera besök", "Ändra nästa stopp" — och i expanderat läge ytterligare "Ta bort", "Går gärna dit", "Byt till". Åtta anrop till handling på en yta gör att inget känns självklart.
3. **Indenteringsfelet är en riktig hierarkimiss, inte bara kosmetik.** Datumraden och actionraden ligger i samma textkolumn men actionknapparna har egen inre padding (`px-1.5`), så "Kan inte den dagen" ser ut att ligga under/inuti datumet i stället för på samma nivå. Ögat läser det som ett underordnat attribut till datumet.
4. **"Andra förslag" är ett eget kort med nästan samma vikt som det bestämda stoppet.** Den visuella kontrasten mellan "detta är bestämt" och "detta är alternativ" är för liten, och när det expanderas dyker en orange primärknapp ("Byt till") upp som konkurrerar direkt med "Registrera besök".
5. **Processmetadata läcker ut.** "Föreslaget av Sam · 3 går gärna dit" plus "Ta bort" i varje alternativrad gör alternativlistan till en liten omröstningsvy, vilket drar produkten mot RSVP-känsla i stället för "kom iväg och äta".

## 2) Hierarkin användaren ska uppfatta på 2–3 sekunder

1. **Var:** Gröna Terrassen (störst, med adress).
2. **När:** Måndag 24 augusti, 18:30 — som en lugn underrad, inte ett eget block.
3. **Gör:** Registrera besök (enda framträdande knapp).
4. Allt annat (kan inte den dagen, ändra, andra förslag) ska vara upptäckbart men tyst.

## 3) Minsta sammanhängande redesign

**Vänd på kortets ordning och slå ihop planeringsraden.**

```text
Nästa stopp
┌────────────────────────────────────────┐
│  Gröna Terrassen                       │  ← störst, överst
│  Storgatan 12, Stockholm               │
│  🗓  Måndag 24 augusti · 18:30      ⋯  │  ← en lugn rad, meny till höger
│  2 kan inte den dagen                  │  ← bara när >0
│                                        │
│  [   Registrera besök   ]              │  ← enda orange
│  Ändra nästa stopp                     │  ← liten, tyst text
└────────────────────────────────────────┘
  Andra förslag (1)                    ⌄    ← ingen kortram, list-nivå
```

Konkreta drag:
- Flytta `PlaceIdentity` (prominent) till kortets topp; ta bort dividern som separerar dag från ställe.
- Ersätt hela `ScheduleRow` med **en rad**: kalenderikon + "Måndag 24 augusti · 18:30". Ingen "NÄR?"-etikett (raden är självförklarande med ikon).
- Samla "Ändra dag", "Lägg till/Ändra tid" och "Kan inte den dagen" i **en `⋯`-meny** på samma rad. Det tar bort tre synliga actions, löser indenteringen (inga inre paddingade knappar i textkolumnen) och håller tiden sekundär enligt låsta regler.
- Behåll "2 kan inte den dagen" som ren text under datumraden, endast när räknaren > 0. Uteblivet svar visas inte.
- "Ändra nästa stopp" som liten ghost-text i muted färg, inte full bredd i primärfärg.
- **Andra förslag:** ta bort det egna kortet. Använd en tyst toggle-rad direkt på sidnivå under kortet, och rendera alternativ som lättare rader (ingen egen kortram, `divide-y` i stället för `space-y` + border).

## 4) Var dag, "Kan inte den dagen" och tid bör bo

- **Dag och tid:** samma rad, i kortet, direkt under adressen. Tiden visas bara som `· 18:30` efter dagen — aldrig som eget fält eller egen rubrik.
- **Ändra dag / Ändra tid:** inte textactions. Lägg dem i `⋯`-menyn på datumraden ("Ändra dag", "Lägg till tid" / "Ändra tid", "Ta bort tid"). "Lägg till tid" visas bara när stopp + dag finns, vilket är redan låst semantik.
- **Kan inte den dagen:** hör till dagen, inte till stället, men förtjänar inte en synlig knapp bredvid datumet. Lägg den som första punkt i samma `⋯`-meny (med markerat läge när den är på), och visa resultatet som text under datumet. Då är signalen kvar men slutar konkurrera med huvudhandlingen.
- Motivering: allt som rör "när" hamnar bakom **ett** enda tryckvänligt mål (44 px) i stället för tre — det är den största enskilda bruskällan i nuläget och det som ger 360 px luft.

## 5) Alternativa förslag när ett stopp är bestämt

- Sänk hela ytan en nivå: ingen `Card`, ingen skugga — bara toggle-raden "Andra förslag (1)" i muted text.
- Per alternativ: namn + adress i normal storlek, ingen `prominent`. Ta bort "Föreslaget av …" i bestämt läge; behåll bara "3 går gärna dit" när det finns (det är gruppens värme, inte process). "Ta bort" flyttas till en `⋯` per rad eller visas bara för egna förslag som liten muted text längst till höger.
- **"Byt till" ska inte vara orange.** Använd `variant="outline"` eller ghost i primärfärg. Endast "Registrera besök" får fylld primärknapp på skärmen. Bekräftelsedialogen ("Byt nästa stopp") behåller riskskyddet, så en lågmäld knapp är tillräcklig.
- "Går gärna dit" behålls som liten outline/toggle — den är frivillig och ska se lika lätt ut som den känns.

## 6) Konkret svensk copy

| Element | Copy |
| --- | --- |
| Sektionsrubrik | `Nästa stopp` |
| Datumrad, med tid | `Måndag 24 augusti · 18:30` |
| Datumrad, utan tid | `Måndag 24 augusti` |
| Ingen dag satt | `Ingen dag bestämd` |
| Blockersignal, resultat | `2 kan inte den dagen` / `1 kan inte den dagen` |
| `⋯`-meny, dag | `Ändra dag` (eller `Lägg till dag`) |
| `⋯`-meny, tid | `Lägg till tid` / `Ändra tid` / `Ta bort tid` |
| `⋯`-meny, block | `Jag kan inte den dagen` / `Jag kan ändå` |
| Huvudhandling | `Registrera besök` |
| Sekundär | `Ändra nästa stopp` |
| Alternativsektion | `Andra förslag (1)` |
| Alternativ, stöd | `Går gärna dit` · `3 går gärna dit` |
| Alternativ, beslut | `Byt till` (flera öppna förslag: `Bestäm`) |
| Alternativ, borttag | `Ta bort` |

## Vad som redan fungerar

Låst semantik sitter rätt: tid finns bara efter bestämt stopp, `Bestäm`/`Byt till` skiljs korrekt, bekräftelsedialogen är kontextuell, och `Registrera besök` är korrekt utpekad som huvudhandling. Problemet är rent visuell viktning och antal synliga actions — ingen ny funktion behövs.

## Avgränsning

Inga nya funktioner, ingen ändrad datamodell, ingen ny semantik. Förslagen berör endast layout, komponentvikt, placering av befintliga actions och copy i `NextStopCard.tsx`.
