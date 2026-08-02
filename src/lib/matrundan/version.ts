import { CHANGELOG as CHANGELOG_THROUGH_1_15, type ChangelogEntry } from "./version-through-1-15";

export { APP_NAME, formatRating } from "./version-through-1-15";
export type { ChangelogEntry };

const VERSION_1_17_1_CHANGELOG: ChangelogEntry = {
  version: "1.17.1",
  date: "2026-08-02",
  summary: "Tilläggsflödet och granskningen av platsdata är tydligare på mobil.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Kryss och Tillbaka från en sökträff återgår till samma sökning med bevarad söktext och position, samtidigt som bara ett dialoglager är aktivt.",
        "Ägare och administratörer granskar platsdatarapporter med tydliga handlingar för OpenStreetMap, åtgärdad rapport eller avslut utan åtgärd.",
        "Den offentliga OSM-texten visas först när rapporten uttryckligen har förberetts för OpenStreetMap.",
      ],
    },
  ],
};

const VERSION_1_17_0_CHANGELOG: ChangelogEntry = {
  version: "1.17.0",
  date: "2026-08-02",
  summary: "Öppettider och saknade platsuppgifter är tydligare på matställets detaljsida.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Matställen med en aktiv Geoapify-källa kan visa dagens tider och ett utfällbart veckoschema från kartdatan.",
        "Saknad webbplats eller saknade öppettider visas som lugna, tydliga rader med möjlighet att lämna underlag till gruppens admin.",
        "Felaktiga eller saknade öppettider kan rapporteras som en egen typ av platsdatafel.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Öppettider presenteras utan en osäker Öppet nu-status och med tydlig reservation för specialdagar och inaktuell kartdata.",
        "Extern platsdata hämtas bakom en autentiserad och gruppskyddad servergräns utan att rå leverantörsdata exponeras i klienten.",
      ],
    },
  ],
};

const VERSION_1_16_3_CHANGELOG: ChangelogEntry = {
  version: "1.16.3",
  date: "2026-08-02",
  summary: "Rapportering och återgång i sökflödet fungerar tydligare och robustare.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Kryss och Tillbaka från granskningen av en sökträff återgår till samma sökning i stället för att stänga hela tilläggsflödet.",
        "Den som själv har rapporterat en sökträff kan se att rapporten väntar på granskning utan att andra medlemmars rapporter exponeras.",
        "Ett saknat serverstöd för sökträffsrapportering visas med ett begripligt meddelande i stället för en teknisk funktionssignatur.",
      ],
    },
  ],
};

const VERSION_1_16_2_CHANGELOG: ChangelogEntry = {
  version: "1.16.2",
  date: "2026-08-02",
  summary: "Platsdatakontrollerna är tätare, tydligare och lugnare i söklistan.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Begränsad platsinformation ligger på en kompakt egen rad utan onödigt glapp under Webbplats och Google Maps.",
        "Ingången till rapportering och döljning heter Stängt eller fel uppgifter? och förklarar kort vad som händer.",
        "Den neutrala informationsikonen har tagits bort ur söklistan, medan varningen Kan ha stängt permanent fortfarande visas där när en sådan signal finns.",
      ],
    },
  ],
};

const VERSION_1_16_1_CHANGELOG: ChangelogEntry = {
  version: "1.16.1",
  date: "2026-08-02",
  summary: "Sökning och platsdatakontroller är lugnare och mer konsekventa på mobil.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Granskningen före tillägg visar Webbplats och Google Maps som kompakta länkar tillsammans med matställets uppgifter.",
        "Begränsad platsinformation visas diskret, medan en möjlig permanent stängning fortfarande får en tydlig varning och möjlighet till anonym bekräftelse.",
        "Rapportering och gruppens reversibla döljning ligger bakom den gemensamma ingången Stämmer inte uppgifterna? i stället för att belasta huvudflödet.",
        "Sökområden visas som kompaktare chips och maxgränsen för fem områden förklaras utan ett avstängt sökfält.",
      ],
    },
  ],
};

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
  VERSION_1_17_1_CHANGELOG,
  VERSION_1_17_0_CHANGELOG,
  VERSION_1_16_3_CHANGELOG,
  VERSION_1_16_2_CHANGELOG,
  VERSION_1_16_1_CHANGELOG,
  VERSION_1_16_0_CHANGELOG,
  ...CHANGELOG_THROUGH_1_15,
];

const currentRelease = CHANGELOG[0];
if (!currentRelease) throw new Error("Matrundans versionshistorik är tom.");

export const APP_VERSION = currentRelease.version;
export const APP_VERSION_DATE = currentRelease.date;
