import {
  CHANGELOG as CHANGELOG_THROUGH_1_15,
  type ChangelogEntry,
} from "./version-through-1-15";

export { APP_NAME, formatRating } from "./version-through-1-15";
export type { ChangelogEntry };

const VERSION_1_16_0_CHANGELOG: ChangelogEntry = {
  version: "1.16.0",
  date: "2026-08-02",
  summary: "Anonyma platsdatasignaler hjälper gruppen att kontrollera osäkra sökträffar.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Sökresultat kan visa en neutral varning om ett matställe kan ha stängt permanent, utan att avslöja vilken grupp eller medlem som lämnat underlaget.",
        "Aktiva medlemmar kan bekräfta att verksamheten verkar permanent stängd eller fortfarande öppen utan att skapa en ny fritextrapport.",
        "Begränsad platsinformation visas när både webbplats och öppettider uttryckligen saknas i leverantörens platsdata.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Motstridiga uppgifter visas som osäkra i stället för att en enskild signal behandlas som ett fast besked.",
        "Äldre underlag tappar automatiskt tyngd och ett nyligt verkligt besök räknas som anonym motbevisning.",
        "Söklistan visar bara den korta stängningssignalen medan förklaring och bekräftelse ligger i granskningsvyn före tillägg.",
      ],
    },
  ],
};

export const CHANGELOG: ChangelogEntry[] = [
  VERSION_1_16_0_CHANGELOG,
  ...CHANGELOG_THROUGH_1_15,
];

const currentRelease = CHANGELOG[0];
if (!currentRelease) throw new Error("Matrundans versionshistorik är tom.");

export const APP_VERSION = currentRelease.version;
export const APP_VERSION_DATE = currentRelease.date;
