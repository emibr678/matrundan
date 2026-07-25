/**
 * Enda källan för appens version och versionshistorik.
 *
 * README och CHANGELOG.md speglar denna information för externa läsare.
 * I gränssnittet läses versionen och nyheterna direkt härifrån (t.ex. i
 * "Om Matrundan"-vyn), så det finns inte flera oberoende källor att
 * hålla synkade manuellt.
 */

export const APP_NAME = "Matrundan";
export const APP_VERSION = "0.7.1";
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
      "Dela besök mellan grupper utan att duplicera – med tydlig kontroll över vem som ser vad.",
    sections: [
      {
        kind: "Nytt",
        items: [
          "Lägg till ett besök i en annan grupp där du är medlem: matstället kopplas in om det saknas och besöket dyker upp i den andra gruppens historik.",
          "Delade besök visas med en tydlig badge; personer utanför gruppen räknas anonymt som +N.",
          "Ta bort ett delat besök från en grupp utan att röra originalet eller matstället.",
          "Gruppinställning: räkna delade besök i progression (av/på).",
          "Styr synligheten av din egen kommentar per grupp – betyget visas alltid, kommentaren kan du dölja.",
        ],
      },
      {
        kind: "Förbättrat",
        items: [
          "Ny datamodell med kanoniska matställen och besök: samma besök kan finnas i flera grupper utan att data dupliceras.",
          "All läsning av delade tabeller sker via en säker read-model; källgrupp och externa personers identitet läcker aldrig ut.",
          "Aggregat (snittbetyg, detaljbetyg) baseras bara på recensioner som är synliga i gruppen.",
          "Tidigare medlemmar räknas som grupprelevanta i historiken – deras deltagande och betyg syns kvar och märks diskret ”Tidigare medlem”. Endast helt utomstående räknas anonymt som +N.",
          "Härdad rättighetskontroll: matställessynligheten använder alltid inloggad användares ID (går inte att prova mot andras), och en tidigare medlem kan inte längre ta bort ett delat besök efter att ha lämnat gruppen. Aktivitetsposten för ett delat besök städas atomiskt i målgruppen.",
        ],
      },
    ],
  },
  {
    version: "0.6.1",
    date: "2026-07-25",
    summary:
      "Mobilfixar och renare utloggning – ingen live-data blir kvar när du loggar ut.",
    sections: [
      {
        kind: "Rättat",
        items: [
          "Långa gruppnamn och medlemsnamn tvingar inte längre horisontell scroll på små telefoner.",
          "Grupphero och medlemsrader är kompaktare på mobil så innehållet ryms utan att kapas.",
          "Efter utloggning laddas demo-läget rent – tidigare gruppens data ligger inte kvar.",
        ],
      },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-07-25",
    summary:
      "Riktiga inbjudningar, medlemshantering och profil i live-läget – utan att någon historik försvinner.",

    sections: [
      {
        kind: "Nytt",
        items: [
          "Bjud in via engångslänk (öppen eller e-postbunden); länken visas bara vid skapandet.",
          "Egen sida för att gå med i gruppen: /inbjudan/<token> med tydliga tillstånd för giltig, utgången, återkallad och redan använd.",
          "Uppdatera din profil: namn och valfri emoji-avatar.",
          "Redigera gruppens namn, emoji och hemområde (ägare/admin).",
          "Ägaren kan utse/demotera admins och överföra ägarskapet.",
          "Admin kan ta bort vanliga medlemmar; alla utom ägaren kan lämna gruppen själv.",
          "Skapa ytterligare grupp från kontomenyn även om du redan är medlem.",
        ],
      },
      {
        kind: "Förbättrat",
        items: [
          "Historiska medlemskap bevaras (status active/left); den som lämnar eller tas bort förlorar åtkomsten direkt men syns kvar i äldre besök när det senare stöds.",
          "Alla känsliga skrivningar går genom nya SECURITY DEFINER-RPC:er; klienten kan inte längre redigera roller, medlemsstatus eller inbjudningar direkt.",
          "Inbjudningens råa token lagras aldrig i databasen – bara SHA-256-hash. Matrundan skickar inte e-post själv, men fyller i ett förslag i din e-postklient.",
        ],
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-07-25",
    summary:
      "Skrivflödena är live: lägg till, besök, betyg, favoriter och nästa stopp sparas i Supabase.",
    sections: [
      {
        kind: "Nytt",
        items: [
          "Lägg till matställe direkt i gruppen i live-läge.",
          "Registrera besök atomärt tillsammans med helhetsbetyg, deltagare och valfria detaljbetyg.",
          "Markera personliga favoriter och sätt/byt/rensa gruppens nästa stopp.",
          "Aktivitetsflödet uppdateras automatiskt vid varje skrivning.",
        ],
      },
      {
        kind: "Förbättrat",
        items: [
          "Alla skrivningar går genom SECURITY DEFINER-RPC:er med serverside-validering.",
          "Vyerna laddas om automatiskt efter en lyckad mutation – ingen manuell refresh.",
          "Tydliga laddnings- och feltillstånd på ”Lägg till” och ”Spara besök”.",
        ],
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-07-25",
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
