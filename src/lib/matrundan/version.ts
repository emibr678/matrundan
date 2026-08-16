import { CHANGELOG as CHANGELOG_THROUGH_1_31, type ChangelogEntry } from "./version-through-1-31";

export { APP_NAME, formatRating } from "./version-through-1-31";
export type { ChangelogEntry };

const VERSION_1_35_1_CHANGELOG: ChangelogEntry = {
  version: "1.35.1",
  date: "2026-08-16",
  summary: "Versionshistoriken beskriver registrerardeltagandet konsekvent.",
  sections: [
    {
      kind: "Rättat",
      items: [
        "Versionshistoriken beskriver nu korrekt att den som registrerar ett nytt besök alltid räknas som faktisk deltagare och lämnar sitt eget omdöme.",
      ],
    },
  ],
};

const VERSION_1_35_0_CHANGELOG: ChangelogEntry = {
  version: "1.35.0",
  date: "2026-08-15",
  summary: "Gemensamma besök samlar gängets omdömen i en tydlig deltagarvy.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Besöksdetaljen samlar gruppens betygssammanfattning och deltagarnas egna omdömen i samma yta i stället för flera konkurrerande sektioner.",
        "Ditt omdöme ligger tillsammans med övriga deltagares omdömen, med en enda tydlig kompletteringsknapp när du ännu inte har svarat och kompakt redigering när omdömet finns.",
        "Flera omdömen visas kompakt med valfria detaljer, medan deltagarkorrigering är sekundär i normalfallet och tydligare när du markerat att du inte var med.",
      ],
    },
  ],
};

const VERSION_1_34_0_CHANGELOG: ChangelogEntry = {
  version: "1.34.0",
  date: "2026-08-14",
  summary: "Faktiska deltagare kan komplettera och korrigera samma gemensamma besök.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "En deltagare som saknar eget omdöme kan lägga till helhet, smak, service, prisvärdhet och valfri kommentar på samma kanoniska besök utan att registrera ett nytt besök.",
        "Den som felaktigt lagts till på ett besök kan välja Jag var inte med och senare återställa Jag var med; progression och synliga deltagaromdömen följer den korrigerade deltagarsanningen.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Den som registrerar ett nytt besök räknas alltid som faktisk deltagare och lämnar sitt eget omdöme i samma flöde. Andra deltagare kan fortfarande korrigera sin närvaro.",
      ],
    },
  ],
};

const VERSION_1_33_0_CHANGELOG: ChangelogEntry = {
  version: "1.33.0",
  date: "2026-08-13",
  summary: "Matrundan har en gemensam varumärkesmarkering och konsekvent identitet i hela appen.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Matrundans egna varumärkesytor använder samma transparenta markering och ordmärke i landning, exempelgrupp och inloggat läge i stället för en generisk tallriksemoji.",
        "Om Matrundan återanvänder samma dialog och varumärkesmarkering oavsett var den öppnas.",
        "Installeringsikoner för PWA och favicon ligger kvar separat och används inte som inline-märke i appens gränssnitt.",
        "Grupp- och matställeemojis behåller sin innehållsbetydelse och påverkas inte av varumärkesändringen.",
      ],
    },
  ],
};

const VERSION_1_32_0_CHANGELOG: ChangelogEntry = {
  version: "1.32.0",
  date: "2026-08-13",
  summary:
    "Gruppinställningarna är ordnade efter tydliga uppgifter och appinformationen ligger separat.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Gruppinställningarna är uppdelade i Gruppen, Sökområden, Medlemmar och inbjudningar, Matställen, Besök och progression samt Gruppstatus.",
        "Gruppnamn och symbol sparas separat från sökområden och sökavstånd, så en ändring inte behöver skriva om den andra delen.",
        "Dolda sökträffar ligger kvar som gruppspecifikt matställeunderhåll, medan den tidigare informationen om en gruppspecifik rapportkö har tagits bort eftersom handläggningen sker globalt i Platsunderhåll.",
        "Sällan använda och destruktiva gruppåtgärder ligger samlade sist under Gruppstatus utan att ändra befintliga roller eller behörigheter.",
        "Om Matrundan med aktuell version och versionshistorik ligger i profil- och inloggningsmenyn i stället för bland gruppens inställningar.",
      ],
    },
  ],
};

export const CHANGELOG: ChangelogEntry[] = [
  VERSION_1_35_1_CHANGELOG,
  VERSION_1_35_0_CHANGELOG,
  VERSION_1_34_0_CHANGELOG,
  VERSION_1_33_0_CHANGELOG,
  VERSION_1_32_0_CHANGELOG,
  ...CHANGELOG_THROUGH_1_31,
];

const currentRelease = CHANGELOG[0];
if (!currentRelease) throw new Error("Matrundans versionshistorik är tom.");

export const APP_VERSION = currentRelease.version;
export const APP_VERSION_DATE = currentRelease.date;
