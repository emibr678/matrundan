import { CHANGELOG as CHANGELOG_THROUGH_1_19, type ChangelogEntry } from "./version-through-1-19";

export { APP_NAME, formatRating } from "./version-through-1-19";
export type { ChangelogEntry };

const VERSION_1_20_2_CHANGELOG: ChangelogEntry = {
  version: "1.20.2",
  date: "2026-08-03",
  summary: "Exempelgruppen speglar medlemsflöden och sökområden tar mindre plats.",
  sections: [
    {
      kind: "Rättat",
      items: [
        "Ägaren i exempelgruppen kan använda samma medlemshantering som i en riktig grupp, med lokalt sparade rolländringar, ägarbyte och borttagning.",
        "Medlemsprofiler kan öppnas direkt från medlemslistan i gruppinställningarna i både exempel- och live-läge.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Sökområden visas med mindre gemensamma pills i både Matställen och Gruppinställningar.",
        "När fem vanliga sökområden redan är valda visar gruppinställningarna en kompakt förklaring i stället för ett stort avstängt sökfält.",
      ],
    },
  ],
};

const VERSION_1_20_1_CHANGELOG: ChangelogEntry = {
  version: "1.20.1",
  date: "2026-08-03",
  summary: "Tydligare vägar från exempelgruppen och säkrare medlemshantering.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Exempelgruppen använder Stockholm konsekvent och låter användaren välja mellan Google och e-post innan en egen grupp skapas.",
        "Ägare och administratörer hanterar medlemmar genom tydliga textval med stora tryckytor och bekräftelse före roll- eller åtkomständringar.",
        "Kontoregistreringen lovar inte längre att e-postbekräftelse alltid kan hoppas över.",
      ],
    },
    {
      kind: "Rättat",
      items: [
        "TanStack Starts standardiserade CSRF-skydd används för serverfunktioner när projektets egen startkonfiguration är aktiv.",
      ],
    },
  ],
};

const VERSION_1_20_0_CHANGELOG: ChangelogEntry = {
  version: "1.20.0",
  date: "2026-08-02",
  summary: "Rapporterade fel är enklare att granska och följa på mobil.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Ägare och administratörer hanterar rapporterade fel på en egen sida med kompakta filter och tydliga arbetsköer.",
        "Rättelseförslag öppnas i en fokuserad detaljpanel som visar bara det steg och de handlingar som är relevanta just nu.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "OpenStreetMap förklaras först när ett rättelseförslag faktiskt kan skickas, med tydlig information om vad som blir offentligt.",
        "Tekniska OSM-statusar har ersatts med begripliga formuleringar som Att granska, Redo att skicka och Väntar på granskning.",
        "Skickade rättelseförslag visar en tydlig länk till ärendet utan att upprepa tidigare gransknings- och publiceringskontroller.",
      ],
    },
  ],
};

export const CHANGELOG: ChangelogEntry[] = [
  VERSION_1_20_2_CHANGELOG,
  VERSION_1_20_1_CHANGELOG,
  VERSION_1_20_0_CHANGELOG,
  ...CHANGELOG_THROUGH_1_19,
];

const currentRelease = CHANGELOG[0];
if (!currentRelease) throw new Error("Matrundans versionshistorik är tom.");

export const APP_VERSION = currentRelease.version;
export const APP_VERSION_DATE = currentRelease.date;
