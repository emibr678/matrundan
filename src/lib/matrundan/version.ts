/**
 * Enda källan för appens version och versionshistorik.
 *
 * README och CHANGELOG.md speglar denna information för externa läsare.
 * I gränssnittet läses versionen och nyheterna direkt härifrån (t.ex. i
 * "Om Matrundan"-vyn), så det finns inte flera oberoende källor att
 * hålla synkade manuellt.
 */

export const APP_NAME = "Matrundan";
export const APP_VERSION = "0.5.0";
export const APP_VERSION_DATE = "2026-07-25";

export interface ChangelogEntry {
  version: string;
  date: string;
  /** Kort användarvänlig sammanfattning som visas överst. */
  summary?: string;
  sections: {
    kind: "Nytt" | "Förbättrat" | "Rättat";
    items: string[];
  }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: APP_VERSION,
    date: APP_VERSION_DATE,
    summary: "Enklare och varmare: mindre tävling, tydligare sök.",
    sections: [
      {
        kind: "Förbättrat",
        items: [
          "Sökningen är nu ett enda fält – ”Sök matställe eller ort”. Gruppens stad används som dold bias, så du behöver inte ställa in något för att komma igång.",
          "”Denna månad” i Gruppen sammanfattar nu gänget som helhet (antal besök och månadens högst betygsatta ställe) istället för att peka ut en individ.",
          "Medlemsprofilen fokuserar på nyckeltal (Besök, Provade, Föreslagna) plus neutrala ”Smakspår”.",
        ],
      },
      {
        kind: "Rättat",
        items: [
          "Tog bort nivåsystem, XP-progressbar och nivå-emblem på medlemskort. För en privat grupp blev det mest en dubblett av gruppens gemensamma räknare.",
          "Tog bort utmärkelserna Utforskare, Kritiker och Månadens matvän – de belönade administrativt beteende eller kändes konstiga i ett litet gäng.",
          "Tog bort ”Nära/Överallt”-toggeln och kartvyn ur ”Lägg till matställe”. Kartan får en riktig hemvist senare när Geoapify kopplas in.",
        ],
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-07-25",
    summary:
      "Autocomplete-sök på plats, nivåer och utmärkelser i gruppen.",
    sections: [
      {
        kind: "Nytt",
        items: [
          "Nivåer per grupp – från Nyfiken till Matrundanmästare – baserat på antal unika ställen du provat.",
          "Utmärkelser: Utforskare, Kritiker, Stammis, Varieté och Månadens matvän.",
          "”Denna månad”-höjdpunkt i Gruppen som lyfter fram månadens matvän.",
        ],
      },
      {
        kind: "Förbättrat",
        items: [
          "Plats-sökningen använder nu autocomplete istället för ”Område, Stad”. Ett unikt namn som ”Gamla Enskede” räcker.",
          "Två sökområden ersätter radievalet: ”Nära vald plats” eller ”Överallt”.",
          "Medlemskort i Gruppen visar diskret nivå-emblem.",
        ],
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-07-24",
    summary:
      "Medlemsprofiler, geografisk utforskning, tydligare betyg och navigerbar aktivitet.",
    sections: [
      {
        kind: "Nytt",
        items: [
          "Klickbara medlemsprofiler med besök, favoriter och smakprofil.",
          "Geografisk sökning med gemensamt platsfält, sökradie och kartprototyp.",
          "Djuplänkade besök från aktivitetsflödet och besökslistan.",
          "Vyn ”Om Matrundan” med aktuell version och versionshistorik.",
        ],
      },
      {
        kind: "Förbättrat",
        items: [
          "Tydligare informationshierarki för gruppens helhetsbetyg och detaljbetyg.",
          "Klickbart ”Nästa stopp”-kort som öppnar matstället direkt.",
          "Rena URL:er när profiler och besök stängs.",
          "Konsekvent svensk talformatering på betyg.",
        ],
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-07-23",
    summary: "Responsiv layout, socialt gruppfokus och registrerade besök.",
    sections: [
      {
        kind: "Nytt",
        items: [
          "Registrering av besök med deltagare och valfria detaljbetyg.",
          "Gruppvyn med gänget, delade favoriter och aktivitet.",
          "Filter och sortering i matställeslistan.",
        ],
      },
      {
        kind: "Förbättrat",
        items: [
          "Bottennavigation på mobil och topmeny på desktop.",
          "Tillgänglighet: aria-pressed, större träffytor och bättre fokus.",
        ],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-07-23",
    summary: "Första Lovable-prototypen med grundflödet lägg till → besök → betygsätt.",
    sections: [
      {
        kind: "Nytt",
        items: [
          "Lokal demodata i localStorage.",
          "Provider-arkitektur för framtida platssökning.",
        ],
      },
    ],
  },
];

export function formatRating(value: number): string {
  if (!value || Number.isNaN(value)) return "–";
  return value.toLocaleString("sv-SE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
