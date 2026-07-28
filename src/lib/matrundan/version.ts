import { CHANGELOG as PREVIOUS_CHANGELOG, type ChangelogEntry } from "./version-history";

export { APP_NAME, formatRating } from "./version-history";
export type { ChangelogEntry };

export const APP_VERSION = "0.15.0";
export const APP_VERSION_DATE = "2026-07-28";

const PACKAGE_5D_CHANGELOG: ChangelogEntry = {
  version: APP_VERSION,
  date: APP_VERSION_DATE,
  summary:
    "Föreslå och bekräfta när gruppen ska besöka sitt nästa stopp, med tydliga svar från varje medlem.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "En medlem kan föreslå ett datum och en valfri tid direkt på gruppens aktuella nästa stopp.",
        "Varje aktiv medlem kan svara Passar, Passar inte eller Osäker och ändra sitt svar medan förslaget är öppet.",
        "Gruppen kan se svarens antal och vilka aktiva medlemmar som valt respektive alternativ.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Förslagsställaren, gruppens ägare eller en administratör kan bekräfta eller ta bort datumet; ingen majoritet bekräftar automatiskt.",
        "Ett datumförslag stängs automatiskt när nästa stopp byts, tas bort eller registreras som besökt.",
        "Datumförslag och svar är privata för gruppen och skrivs genom validerade RPC-anrop med aktivt medlemskap.",
        "Fredagsgänget använder samma gränssnitt och sparar datumplaneringen tillfälligt i webbläsarsessionen.",
      ],
    },
    {
      kind: "Rättat",
      items: [
        "Planeringsflödet är verifierat på 360 px utan horisontell overflow, inklusive omladdning och återställning i demo.",
      ],
    },
  ],
};

export const CHANGELOG: ChangelogEntry[] = [PACKAGE_5D_CHANGELOG, ...PREVIOUS_CHANGELOG];
