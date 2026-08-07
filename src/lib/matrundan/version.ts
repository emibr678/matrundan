import {
  CHANGELOG as CHANGELOG_THROUGH_1_26_1,
  type ChangelogEntry,
} from "./version-through-1-26-1";

export { APP_NAME, formatRating } from "./version-through-1-26-1";
export type { ChangelogEntry };

const VERSION_1_27_0_CHANGELOG: ChangelogEntry = {
  version: "1.27.0",
  date: "2026-08-07",
  summary: "Platskandidater känns igen tydligare före och efter att de läggs till.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Sökresultat och tillagda matställen använder samma visuella platsidentitet utan att blanda ihop vyernas olika uppgifter.",
        "Kandidatkort prioriterar namn, kategori, läge, adress och tillgänglig praktisk information i en mobilvänlig hierarki.",
        "Webbplats, platsval och tillägg är separata tryckytor, medan öppettider bara markeras när leverantören faktiskt har sådan data.",
      ],
    },
  ],
};

const VERSION_1_26_5_CHANGELOG: ChangelogEntry = {
  version: "1.26.5",
  date: "2026-08-06",
  summary: "Öppna inbjudningslänkar kan användas av flera personer tills de stängs.",
  sections: [
    {
      kind: "Rättat",
      items: [
        "Nya öppna inbjudningslänkar kan användas av flera personer tills de återkallas eller går ut.",
        "E-postbundna inbjudningar förblir engångslänkar för den angivna adressen.",
        "Redan aktiva medlemmar skapar varken dubbla medlemskap eller nya anslutningshändelser när de öppnar länken igen.",
      ],
    },
  ],
};

const VERSION_1_26_4_CHANGELOG: ChangelogEntry = {
  version: "1.26.4",
  date: "2026-08-06",
  summary: "Server- och lagringsvakter för sökområden och besöksfoton är återställda.",
  sections: [
    {
      kind: "Rättat",
      items: [
        "Nya breda kommun-, läns-, region- och landsområden blockeras åter på servern utan att befintliga sparade områden raderas.",
        "Besöksfoton skyddas åter av en privat Storage-bucket med högst 1,5 MB och endast JPEG.",
      ],
    },
  ],
};

const VERSION_1_26_3_CHANGELOG: ChangelogEntry = {
  version: "1.26.3",
  date: "2026-08-06",
  summary:
    "Exempelgruppen visar fler verkliga produktfall med stabila scenarier och regressionsskydd.",
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
  VERSION_1_27_0_CHANGELOG,
  VERSION_1_26_5_CHANGELOG,
  VERSION_1_26_4_CHANGELOG,
  VERSION_1_26_3_CHANGELOG,
  VERSION_1_26_2_CHANGELOG,
  ...CHANGELOG_THROUGH_1_26_1,
];

const currentRelease = CHANGELOG[0];
if (!currentRelease) throw new Error("Matrundans versionshistorik är tom.");

export const APP_VERSION = currentRelease.version;
export const APP_VERSION_DATE = currentRelease.date;
