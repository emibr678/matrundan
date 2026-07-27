# Utvecklings- och felsökningsflöde

Detta dokument beskriver hur godkänd implementation, felsökning, verifiering, merge och Lovable-synk ska genomföras för Matrundan.

Målet är att minska väntetid och repetitivt arbete utan att sänka kvaliteten eller skyddet för gruppdata.

## 1. Faser

Arbetet ska alltid beskrivas som en av följande faser:

1. produktdiskussion;
2. planering;
3. godkänd implementation;
4. verifiering;
5. merge;
6. publicering.

Implementation kräver uttryckligt godkännande. Publicering kräver ett separat uttryckligt godkännande även när implementationen är mergad.

När ett godkänt scope är färdigimplementerat, granskat och har grön relevant CI får agenten markera PR:n som redo och merga till `main`.

## 2. Arbetsyta och Git

En fungerande checkout ska återanvändas.

Normalt arbetssätt:

```bash
git fetch origin --prune
git switch <befintlig-branch>
git pull --ff-only
```

Skapa en ny branch från aktuell `main` när en ny godkänd uppgift börjar:

```bash
git fetch origin --prune
git switch main
git pull --ff-only
git switch -c agent/<beskrivande-namn>
```

Klona endast när:

- arbetsmiljön är ny och saknar checkout;
- den tidigare checkouten har försvunnit;
- checkoutens tillstånd inte går att verifiera eller återställa säkert.

En ny tillfällig CI-runner behöver alltid checkout. Det är inte samma sak som att en beständig utvecklingsmiljö ska klona repot vid varje iteration.

Använd en branch per sammanhängande uppgift. Skapa inte en ny PR för varje felsökningshypotes.

## 3. Diagnostik före fix

Vid en icke-trivial bugg ska arbetet börja med reproduktion och bevis.

1. Reproducera felet i den relevanta miljön.
2. Samla runtime-data som skiljer fungerande och trasigt beteende.
3. Klassificera felet, exempelvis data, layout, renderering, nätverk, behörighet, miljö eller integration.
4. Formulera en hypotes som kan falsifieras.
5. Gör minsta riktade diagnostik eller kodändring.
6. Kontrollera resultatet innan nästa hypotes.
7. Implementera den slutliga fixen först när grundorsaken stöds av observerade data.
8. Ta bort tillfällig diagnostik som inte ska vara permanent.

För kartproblem bör diagnostik i första hand visa:

- containerns och canvasens verkliga mått;
- MapLibre-status, lager och källor;
- resurs- och nätverksstatus;
- WebGL- och workerstatus;
- skillnaden mellan isolerad komponent och produktflöde;
- faktisk previewmiljö och enhet.

## 4. Lokal iteration

Flera små iterationer ska göras i samma checkout innan push.

```text
reproducera
→ diagnostik
→ lokal ändring
→ riktad kontroll
→ lokal justering
→ sammanhängande commit
→ push
```

Pusha när:

- det finns en sammanhängande kandidatfix;
- en Lovable-preview behövs för verklig enhetstestning;
- en viktig diagnostisk checkpoint behöver bevaras;
- uppgiften är redo för CI eller granskning.

Pusha inte varje experiment. Skapa inte commits enbart för att trigga ett workflow.

GitHub Actions ska verifiera kod. Workflows ska inte användas som fjärrstyrd editor som patchar produktkod, skapar commits eller pushar tillbaka till samma branch.

## 5. Kanoniska kommandon

Installera beroenden en gång per beständig arbetsyta eller när `bun.lock` ändras:

```bash
bun install --frozen-lockfile
```

Kontrollera ändrade filer under iteration:

```bash
bunx prettier --check <ändrade filer>
bunx eslint <ändrade kodfiler>
bun run verify:fast
```

`verify:fast` kör TypeScript och produktionsbuild.

Kör fokuserade tester när de är relevanta:

```bash
bun test <relevant testfil>
bun run test:map
```

Inför en färdig releasekandidat:

```bash
bun run verify:full
```

`verify:full` kör formatkontroll, full ESLint, TypeScript och produktionsbuild. Browserkontroller körs dessutom när huvudflöden eller kartan har ändrats.

## 6. CI-nivåer

Draft-PR använder snabb CI:

- Prettier på ändrade filer;
- ESLint på ändrade kodfiler;
- TypeScript;
- produktionsbuild.

När PR:n markeras redo, eller när `main` uppdateras, används full CI:

- alla snabba kontroller;
- mobil Chromium för UI-ändringar;
- WebKit/iPhone och desktop Chromium för kartrelaterade ändringar.

Det innebär att dyr browserinstallation och browsermatris inte upprepas efter varje liten push till en draft-PR.

En manuell `workflow_dispatch` kör full verifiering.

## 7. PR och merge

En PR ska vara draft medan implementation eller diagnostik pågår.

Innan den markeras redo ska följande vara tydligt:

- godkänt scope;
- faktisk grundorsak eller motivering;
- ändrade filer;
- utförda kontroller;
- manuella teststeg;
- sådant som inte kunde verifieras;
- om publicering ingår eller inte.

Mergning får ske när:

- implementationen håller godkänt scope;
- diffen är granskad;
- relevant CI är grön;
- inga kända blockerare återstår.

Använd inte force-push, rebase, amend eller squash på historik som redan har synkats till Lovable.

## 8. Lovable, preview och leveranskvitto

Efter varje push som är avsedd att testas ska ChatGPT-svaret innehålla:

```text
Fas:
Branch:
Commit:
PR:
CI:
Lovable-synk:
Preview:
Testa:
Ej verifierat:
Publicering:
```

Projektets previeworigin är:

`https://id-preview--d389634e-227c-4689-85ed-8714fdc602f7.lovable.app`

Den publika appen är:

`https://matrundan.lovable.app`

Skilj alltid mellan:

- previewlänken finns;
- Lovable har synkat aktuell commit;
- previewn har laddats;
- funktionen har verifierats;
- funktionen har verifierats på verklig mobil enhet;
- ändringen har publicerats.

Skriv inte att synk eller verifiering är klar utan faktisk bekräftelse.

## 9. Antimönster

Undvik:

- upprepade kloner i samma beständiga arbetsyta;
- nya branches eller PR:er för varje hypotes;
- många commits med namn som `Changes`, `x` eller `Work in progress`;
- commits som endast triggar workflows;
- självmodifierande GitHub Actions-workflows;
- full browsermatris efter varje diagnostikändring;
- global skrivande formattering när bara ett fåtal filer ändrats;
- parallella verktyg för samma kontroll, exempelvis både `tsgo` och `tsc`;
- att blanda produktfix, CI-ombyggnad och publicering i samma PR.
