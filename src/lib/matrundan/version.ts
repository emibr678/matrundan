import {
  CHANGELOG as CHANGELOG_THROUGH_1_26_1,
  type ChangelogEntry,
} from "./version-through-1-26-1";

export { APP_NAME, formatRating } from "./version-through-1-26-1";
export type { ChangelogEntry };

const VERSION_1_26_3_CHANGELOG: ChangelogEntry = {
  version: "1.26.3",
  date: "2026-08-06",
  summary: "Exempelgruppen visar fler verkliga produktfall med stabila scenarier och regressionsskydd.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Exempelgruppen täcker nu återbesök, foto, gäst, tidigare medlem, delat besök, arkiverat ställe och flera omdömen i samma riktiga produktflöden.",
        "Providerställe, begränsad platsinformation och ett långt mobilscenario gör fler tillstånd möjliga att granska utan externa anrop.",
        "Exempeldata byggs från en uttrycklig referenstid och får en ny sessionsversion så gamla flikdata inte döljer nya scenarier.",
      ],
    },
  ],
};

const VERSION_1_26_2_CHANGELOG: ChangelogEntry = {
  version: "1.26.2",
  date: "2026-08-06",
  summary: "Platsuppgifter kan kontrolleras samlat i ett kompakt och konsekvent flöde.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Adress visas över en kompakt delad rad för webbplats och öppettider, med vertikalt centrerade tryckytor.",
        "En gemensam kontroll jämför adress och kartposition, webbplats och öppettider utan att lägga till en permanent fjärde rad.",
        "Exempelgruppen använder samma upplevelse med lokala, deterministiska uppgifter och utan externa kartanrop.",
        "Nästa stopp visas utan den tidigare klippta röda markeringen bakom kortets överkant.",
      ],
    },
  ],
};

export const CHANGELOG: ChangelogEntry[] = [
  VERSION_1_26_3_CHANGELOG,
  VERSION_1_26_2_CHANGELOG,
  ...CHANGELOG_THROUGH_1_26_1,
];

const currentRelease = CHANGELOG[0];
if (!currentRelease) throw new Error("Matrundans versionshistorik är tom.");

export const APP_VERSION = currentRelease.version;
export const APP_VERSION_DATE = currentRelease.date;
