import { CHANGELOG as CHANGELOG_THROUGH_1_6, type ChangelogEntry } from "./version-through-1-6";

export { APP_NAME, formatRating } from "./version-history";
export type { ChangelogEntry };

const VERSION_1_8_1_CHANGELOG: ChangelogEntry = {
  version: "1.8.1",
  date: "2026-07-31",
  summary: "Renare och mer självklar copy när gruppen lägger till matställen.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Lägg till matställe visar färre instruktioner och låter sökfält, områdesval och handlingar förklara flödet.",
        "Google Maps-knappen heter Öppna i Google Maps och den överflödiga hjälptexten är borttagen.",
        "Valfria uppgifter använder kort och konsekvent copy i både sökresultat och manuellt tillägg.",
      ],
    },
  ],
};

const VERSION_1_8_0_CHANGELOG: ChangelogEntry = {
  version: "1.8.0",
  date: "2026-07-31",
  summary: "Stabilare mobilval och renare platssökning när gruppen letar efter sitt nästa ställe.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Ägare och administratörer kan dölja en felaktig eller inaktuell sökträff enbart för den aktuella gruppen.",
        "Dolda träffar kan återställas under Gruppinställningar utan att det verkliga matstället eller andra grupper påverkas.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Kök och inriktning öppnas som en stabil helskärmsväljare på mobil med låst rubrik, egen resultat-scroll och en tydlig Klar-knapp.",
        "Så fungerar Passar för ryms och går att scrolla även på smala och korta mobilskärmar.",
        "Google Maps-sökningen tar bort dubblerade platsdelar, använder kartposition som reserv och förklarar att rätt verksamhet behöver kontrolleras.",
      ],
    },
    {
      kind: "Rättat",
      items: [
        "Mobilväljaren lämnar inte längre ett tomt vitt lager när tangentbordet stängs i Android WebView.",
        "Geoapify-träffar som uttryckligen är markerade som nedlagda, övergivna eller borttagna filtreras bort.",
      ],
    },
  ],
};

const VERSION_1_7_1_CHANGELOG: ChangelogEntry = {
  version: "1.7.1",
  date: "2026-07-31",
  summary: "Kontrollera ett sökresultat före tillägg och komplettera Passar för när gruppen vet.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Sökresultat öppnas först i en informationsvy där platsen kan kontrolleras i Google Maps innan den läggs till.",
        "Passar för är frivilligt när ett nytt ställe läggs till och kan kompletteras efter ett faktiskt besök.",
      ],
    },
  ],
};

const VERSION_1_7_0_CHANGELOG: ChangelogEntry = {
  version: "1.7.0",
  date: "2026-07-31",
  summary: "Tydligare Passar för-val för snabbt, avslappnat och något extra.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Passar för använder Snabbt och enkelt, Avslappnat och Något extra.",
        "Ett ställe kan ha ett primärt och ett frivilligt sekundärt val, men valet kan lämnas tomt tills gruppen har upplevt stället.",
        "Tidigare Passar för-val nollställs eftersom de gamla kategorierna inte kan översättas säkert.",
      ],
    },
  ],
};

const VERSION_1_6_2_CHANGELOG: ChangelogEntry = {
  version: "1.6.2",
  date: "2026-07-31",
  summary: "Samma enkla sökområdesflöde i sökningen och gruppinställningarna.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Vanliga sökområden i Gruppinställningar väljs i samma återanvändbara platsfält och visas som valbrickor.",
        "Kommuner, län, regioner och länder visas som vägledning men kan inte sparas som ett oprecist punktcentrum.",
      ],
    },
  ],
};

const VERSION_1_6_1_CHANGELOG: ChangelogEntry = {
  version: "1.6.1",
  date: "2026-07-31",
  summary: "Smidigare val av flera sökområden och stabilare markörer på mobilen.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Ett sökområde läggs direkt till som en valbricka när en Geoapify-träff väljs, och samma fält kan användas igen.",
        "Flerområdeskartan använder stabila kategoriikoner i stället för enhetsberoende emoji-markörer.",
        "Live-läsningen kan tillfälligt använda föregående kompatibla read-model om den senaste RPC-funktionen saknas efter en ofullständig databasdriftsättning.",
      ],
    },
  ],
};

export const CHANGELOG: ChangelogEntry[] = [
  VERSION_1_8_1_CHANGELOG,
  VERSION_1_8_0_CHANGELOG,
  VERSION_1_7_1_CHANGELOG,
  VERSION_1_7_0_CHANGELOG,
  VERSION_1_6_2_CHANGELOG,
  VERSION_1_6_1_CHANGELOG,
  ...CHANGELOG_THROUGH_1_6,
];

const currentRelease = CHANGELOG[0];
if (!currentRelease) throw new Error("Matrundans versionshistorik är tom.");

export const APP_VERSION = currentRelease.version;
export const APP_VERSION_DATE = currentRelease.date;
