## Mål

Nya medlemmar ska inte behöva leta i profilen för att hitta notiser, och de ska få enkel, plattformsanpassad hjälp att lägga Matrundan på hemskärmen. Allt sker som en diskret, avfärdbar uppmaning i befintlig design – inga popup-avbrott mitt i ett flöde.

## 1. Notisfråga vid rätt tillfälle

En ny, låg-intensiv kort ("Slå på notiser") visas överst på Hem-vyn i live-läget när alla dessa gäller:

- användaren är inloggad och medlem i minst en grupp
- webbläsaren stödjer push (befintlig `checkPushSupport`)
- ingen prenumeration finns på den här enheten
- användaren har inte avfärdat kortet tidigare på den här enheten

Kortet har kort text ("Få veta när gruppen registrerar ett besök eller väljer nästa stopp"), en primärknapp "Slå på notiser" som kör befintliga `enablePushOnThisDevice()`, samt "Inte nu". Vid lyckad aktivering: bekräftelse och kortet försvinner permanent. Vid "Inte nu": göms i 30 dagar, sedan får man frågan en gång till.

Extra utlösare: direkt efter att man tackat ja till en inbjudan eller skapat sin första grupp visas samma kort högst upp – det är då nyttan är tydligast.

Ingen webbläsardialog visas förrän användaren själv trycker på knappen (best practice; annars riskerar man permanent "blockerad").

## 2. Installera på hemskärmen

Appen har redan manifest, ikoner och service worker, så installation fungerar tekniskt. Det som saknas är vägledning.

- **Android/Chrome/Edge:** vi fångar webbläsarens `beforeinstallprompt`-händelse och visar en egen "Lägg till Matrundan på hemskärmen"-knapp. Trycket öppnar det riktiga installationsförslaget – ett klick, ingen instruktion behövs.
- **iOS Safari:** ingen sådan händelse finns, så vi visar i stället en kort bildbeskrivning: "Tryck på Dela-ikonen och välj Lägg till på hemskärmen". Detta är dessutom ett krav för att notiser alls ska fungera på iPhone, så texten kopplar ihop de två.
- **Övriga/redan installerad:** inget visas.

Var det syns:
1. Samma diskreta kort-plats på Hem (visas en gång, kan avfärdas, återkommer inte om appen redan är installerad).
2. En permanent post i profildialogen ("Appen på mobilen") så att den som avfärdat kortet kan hitta tillbaka.
3. En rad i notisavsnittet på iPhone som förklarar varför installation krävs innan notiser kan slås på.

## 3. Copy och ton

Svensk, varm och kort text i befintlig stil. Inga utropstecken, ingen påträngande upprepning: max ett kort åt gången, notisfrågan prioriteras före installationsförslaget utom på iPhone där installation måste komma först.

## Tekniska detaljer

- Ny komponent `src/components/matrundan/AppNudges.tsx` som väljer vilket kort som ska visas, renderad överst i Hem-vyn (`src/routes/index.tsx`) inom live-läget.
- Ny hjälpfil `src/lib/matrundan/install-prompt.ts`: lyssnar på `beforeinstallprompt`, exponerar `useInstallPrompt()` med `canPrompt`, `promptInstall()` och plattformsdetektering; återanvänder `isIosLike`/`isInstalledApp` från `notifications.ts`.
- Avfärdningsstatus i `localStorage` under `matrundan.nudges.v1` (enhetslokalt, ingen databasändring).
- Återanvänder befintliga `checkPushSupport`, `currentDeviceEndpoint` och `enablePushOnThisDevice` – ingen ny server- eller databaslogik, inga nya RPC:er, inga migrationer.
- Ingen offline-cachning eller ny service worker; `push-sw.js` lämnas orörd.
- Version bumpas till v1.3.0 med poster i `version.ts`, `CHANGELOG.md` och README.

## Verifiering

- `bun run verify:changed` samt typecheck och build.
- Playwright vid 360 px: korten får inte orsaka horisontell overflow, knappar minst 44 px.
- Manuell kontroll på Android av installationsknappen; iOS-instruktionen verifieras visuellt (kan inte automattestas här).
