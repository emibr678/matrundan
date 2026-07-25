/**
 * Enda källan för appens version och versionshistorik.
 *
 * README och CHANGELOG.md speglar denna information för externa läsare.
 * I gränssnittet läses versionen och nyheterna direkt härifrån (t.ex. i
 * "Om Matrundan"-vyn), så det finns inte flera oberoende källor att
 * hålla synkade manuellt.
 */

export const APP_NAME = "Matrundan";
export const APP_VERSION = "0.4.0";
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
    summary:
      "Supabase-grund: Google-inloggning, riktiga grupper och live-läge sida vid sida med demot.",
    sections: [
      {
        kind: "Nytt",
        items: [
          "Google-inloggning via Lovable Cloud (Supabase Auth).",
          "Riktig datamodell i Supabase med grupper, medlemskap, platser, besök och betyg.",
          "Onboarding för första gruppen med namn, emoji och valfritt hemområde.",
          "Gruppväljare i header när man är med i flera grupper.",
          "Live-läge läser gruppens data från Supabase; demo-läget finns kvar oförändrat.",
        ],
      },
      {
        kind: "Förbättrat",
        items: [
          "Repository-lager separerar demo och live så att vykomponenterna är oförändrade.",
          "Radbrytande RLS: endast gruppmedlemmar ser gruppens data; anonyma har ingen åtkomst.",
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
