import { CHANGELOG as PREVIOUS_CHANGELOG, type ChangelogEntry } from "./version-history";

export { APP_NAME, formatRating } from "./version-history";
export type { ChangelogEntry };

export const APP_VERSION = "0.19.1";
export const APP_VERSION_DATE = "2026-07-29";

const PACKAGE_5D_CHANGELOG: ChangelogEntry = {
  version: "0.15.0",
  date: "2026-07-28",
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

const PACKAGE_6A_CHANGELOG: ChangelogEntry = {
  version: "0.16.0",
  date: APP_VERSION_DATE,
  summary:
    "Tydligare huvudvyer, naturligare språk och en lugnare handlingshierarki genom gruppens matresa.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Hem fokuserar på nästa stopp och progression medan gruppens aktivitet samlas på Gruppen.",
        "Gruppen visar inte längre en duplicerad version av nästa stopp och medlemsraderna har färre överflödiga etiketter.",
        "Matställen förklarar listans syfte, prioriterar sökningen före topplistan och använder Lägg till ställe konsekvent.",
        "Matställets detaljsida skiljer tydligare mellan nästa stopp, personlig favorit och den externa Maps-länken.",
        "Flaggan ersätter den otydliga glittersymbolen för nästa stopp.",
      ],
    },
    {
      kind: "Rättat",
      items: [
        "De uppdaterade huvudvyerna och detaljsidan är regressionsskyddade mot horisontell overflow vid 360 px.",
      ],
    },
  ],
};

const PACKAGE_6A_1_CHANGELOG: ChangelogEntry = {
  version: "0.16.1",
  date: APP_VERSION_DATE,
  summary: "Tydligare Google Maps-länk och bättre placerad hantering på matställets detaljsida.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Google Maps har åter en egen tydligt namngiven länk i stället för att vara gömd i adressen.",
        "Hantera ställe ligger nu diskret intill Om stället i stället för ensam i huvudkortets åtgärdsyta.",
      ],
    },
  ],
};

const PACKAGE_6B_CHANGELOG: ChangelogEntry = {
  version: "0.17.0",
  date: APP_VERSION_DATE,
  summary: "Lugnare datumplanering och ett enklare besöksflöde med mer tillförlitliga betyg.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Hem visar datumet och svarsläget på en kompakt rad; svar, namn och hantering öppnas först i Planera nästa stopp.",
        "Bekräftade datum visas utan den tidigare tunga svarssammanställningen på Hem.",
        "Ett besök kräver nu att användaren aktivt väljer helhetsbetyg i stället för att börja på ett förvalt betyg.",
        "Besöksdialogen har en enda sparaknapp; möjligheten att lägga till besöket i en annan grupp erbjuds efter att besöket har sparats.",
      ],
    },
    {
      kind: "Rättat",
      items: [
        "Datumplaneringen och besöksdialogen är regressionsskyddade mot horisontell overflow vid 360 px.",
      ],
    },
  ],
};

const PACKAGE_6C_CHANGELOG: ChangelogEntry = {
  version: "0.18.0",
  date: APP_VERSION_DATE,
  summary:
    "Tydligare sammanhangskategorier som gör det möjligt att uppskatta både enkla favoriter och större matupplevelser på sina egna villkor.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Passar för använder nu Snabbt & enkelt, Vardag & häng samt Middag & upplevelse.",
        "En mobilvänlig förklaring visar att kategorierna beskriver typen av besök, inte hur bra stället är, och ger exempel för varje val.",
        "Nya ställen får inte längre Vardag & häng automatiskt; användaren väljer aktivt minst ett sammanhang och kan välja flera.",
        "Samma benämningar och hjälp används när ett ställe läggs till, hanteras, filtreras och visas.",
      ],
    },
    {
      kind: "Rättat",
      items: [
        "Kategoriväljaren och dess förklaring är regressionsskyddade mot horisontell overflow vid 360 px.",
      ],
    },
  ],
};

const PACKAGE_6D_CHANGELOG: ChangelogEntry = {
  version: "0.19.0",
  date: APP_VERSION_DATE,
  summary:
    "En skarpare sammanhangsmodell och topplistor som jämför matställen inom rätt sorts besök.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Topplistan kan växla mellan Snabbt & smidigt, Vardag & häng och Något särskilt.",
        "Ett ställe rankas bara i sitt primära sammanhang, baserat på gruppens synliga medelbetyg.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Varje ställe får ett obligatoriskt Passar bäst för och högst ett frivilligt Passar också för.",
        "Sammanhangen heter nu Snabbt & smidigt, Vardag & häng och Något särskilt.",
        "Hjälptexten förklarar att sammanhang inte är en kvalitets- eller prisstege.",
        "Befintliga sparade val tolkas i ordning som primärt och sekundärt utan att produktionsrader skrivs om.",
      ],
    },
    {
      kind: "Rättat",
      items: [
        "Den tidigare fria flervalsmodellen har ersatts med den beslutade primära och valfria sekundära klassificeringen.",
      ],
    },
  ],
};

const PACKAGE_6E_CHANGELOG: ChangelogEntry = {
  version: APP_VERSION,
  date: APP_VERSION_DATE,
  summary:
    "En sista UX-polering som gör progression, sökning och Passar för-valen lugnare och tydligare.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Hem visar gruppens progression utan ett redundant procenttal eller intern copy om aktiva ställen.",
        "Sökning döljer topplistan medan användaren letar efter ett specifikt ställe, så resultatet hamnar direkt under sökverktygen.",
        "Passar för förklaras som olika sorters besök i stället för med det abstrakta ordet sammanhang.",
        "Det frivilliga Passar också för öppnas först efter en uttrycklig handling och visar inte längre alternativet Inget andra sammanhang.",
      ],
    },
    {
      kind: "Rättat",
      items: [
        "Progressionsraden på Hem kan inte längre klistra ihop bråk och procenttal på smala skärmar.",
      ],
    },
  ],
};

export const CHANGELOG: ChangelogEntry[] = [
  PACKAGE_6E_CHANGELOG,
  PACKAGE_6D_CHANGELOG,
  PACKAGE_6C_CHANGELOG,
  PACKAGE_6B_CHANGELOG,
  PACKAGE_6A_1_CHANGELOG,
  PACKAGE_6A_CHANGELOG,
  PACKAGE_5D_CHANGELOG,
  ...PREVIOUS_CHANGELOG,
];
