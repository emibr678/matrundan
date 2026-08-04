import { CHANGELOG as CHANGELOG_THROUGH_1_19, type ChangelogEntry } from "./version-through-1-19";

export { APP_NAME, formatRating } from "./version-through-1-19";
export type { ChangelogEntry };

const VERSION_1_25_7_CHANGELOG: ChangelogEntry = {
  version: "1.25.7",
  date: "2026-08-05",
  summary: "Platsdetaljen håller adress, webbplats och tomstatus tätare.",
  sections: [
    {
      kind: "Rättat",
      items: [
        "Adress och webbplats ligger på samma obrutna rad under ställets namn, medan en lång adress krymper och radbryts inom sitt eget utrymme.",
        "Tomläget under Besök är lägre och mer diskret när gruppen ännu saknar registrerade besök.",
      ],
    },
  ],
};

const VERSION_1_25_6_CHANGELOG: ChangelogEntry = {
  version: "1.25.6",
  date: "2026-08-04",
  summary: "Platsdetaljen håller länkar och tomstatus mer kompakt.",
  sections: [
    {
      kind: "Rättat",
      items: [
        "Adress och webbplats radbryts som en sammanhållen responsiv grupp utan stora vertikala glapp.",
        "Den dubbla tomstatusen ovanför besöksknapparna visas inte längre när gruppen saknar besök.",
      ],
    },
  ],
};

const VERSION_1_25_5_CHANGELOG: ChangelogEntry = {
  version: "1.25.5",
  date: "2026-08-04",
  summary: "Platskortet ger namn och adress bättre utrymme på mobil.",
  sections: [
    {
      kind: "Rättat",
      items: [
        "Favoritknappen ligger på raden med Tillbaka och tar inte längre plats från ställets namn, adress eller webbplats.",
        "Platsbilden är mindre på de smalaste mobilerna och återgår till full storlek på bredare skärmar.",
        "Långa namn och adresser får en jämnare, responsiv layout utan onödiga glipor eller sammanpressning.",
      ],
    },
  ],
};

const VERSION_1_25_4_CHANGELOG: ChangelogEntry = {
  version: "1.25.4",
  date: "2026-08-04",
  summary: "Adress och webbplats håller ihop bättre på både mobil och desktop.",
  sections: [
    {
      kind: "Rättat",
      items: [
        "Adressens externa länksymbol följer den sista textraden när adressen bryts på mobil.",
        "Adress och webbplats använder samma responsiva länkmönster och behåller en kompakt bredd på desktop.",
      ],
    },
  ],
};

const VERSION_1_25_3_CHANGELOG: ChangelogEntry = {
  version: "1.25.3",
  date: "2026-08-04",
  summary: "Platsdetaljens praktiska information är kompaktare och lättare att överblicka.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Adress och webbplats ligger tätare som en sammanhållen informationsgrupp.",
        "Öppettider visas som en lugn rad i platskortet i stället för som ett tungt kort i kortet.",
        "Utfällda öppettider undviker dubblerade rubriker, statusrader och tomma meddelanden.",
      ],
    },
  ],
};

const VERSION_1_25_2_CHANGELOG: ChangelogEntry = {
  version: "1.25.2",
  date: "2026-08-04",
  summary:
    "Platsdetaljen samlar identitet, praktisk information och gruppens handlingar tydligare.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Adressen har samma tydliga länkstil som webbplatsen och öppnar fortfarande Google Maps.",
        "Favorit är en kompakt hjärtknapp i platskortets övre högra hörn i stället för en egen rad.",
        "Öppettider ligger tillsammans med ställets identitet och kan fortfarande fällas ut för veckoschema och underhåll.",
        "Den dubblerade statusen Nytt för gruppen visas inte längre på detaljsidan när grupprelationen redan förklarar besökshistoriken.",
      ],
    },
  ],
};

const VERSION_1_25_1_CHANGELOG: ChangelogEntry = {
  version: "1.25.1",
  date: "2026-08-04",
  summary: "Platsdetaljen sätter gruppens besök och nästa stopp före praktiska uppgifter.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Platsdetaljen sammanfattar gruppens antal besök, senaste besök och deltagare direkt under ställets identitet.",
        "Registrera besök och Föreslå som nästa stopp ligger före favorit och öppettider i mobilens läsordning.",
        "Webbplatsen visas diskret under den klickbara adressen och kan läggas till direkt för gruppen när den saknas.",
        "En tillagd webbplats skapar ett privat granskningsunderlag men publiceras aldrig externt automatiskt.",
        "Öppettider visas i en egen kompakt utfällbar rad och tidigare besökta ställen använder Registrera besök igen.",
      ],
    },
  ],
};

const VERSION_1_25_0_CHANGELOG: ChangelogEntry = {
  version: "1.25.0",
  date: "2026-08-04",
  summary: "Gruppval, platsinformation och appinformation är enklare och lugnare på mobil.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Den kombinerade profil- och gruppmenyn visar aktiv grupp i sidhuvudet och hanterar långa gruppnamn utan en extra rad under Matrundan.",
        "Platsdetaljen prioriterar betyg, handlingar och besök medan webbplats och öppettider visas kompakt och adressen öppnar Google Maps.",
        "Nya uppgifter om webbplats eller öppettider kan jämföras direkt med gruppens nuvarande värden utan att något skrivs över automatiskt.",
        "Om Matrundan visar syfte, aktuell version och tidigare uppdateringar direkt i gruppinställningarna.",
        "Interna notifieringsköer och äldre appstatusfunktioner har fått striktare anropsrättigheter i databasen.",
      ],
    },
    {
      kind: "Rättat",
      items: [
        "Teknisk ändringsinformation och manuell informationskontroll belastar inte längre platsens vardagsvy, och rapportering av fel ligger som en diskret slutåtgärd.",
      ],
    },
  ],
};

const VERSION_1_24_0_CHANGELOG: ChangelogEntry = {
  version: "1.24.0",
  date: "2026-08-04",
  summary: "Mobilvyerna visar tydligare gruppkontext, topplistor och redigeringsvägar.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Aktiv grupp visas diskret under Matrundan i sidhuvudet med stöd för långa grupp- och profilnamn.",
        "Topplistan visar alla betygsatta ställen som standard och kan sedan filtreras på Passar för.",
        "Statuspills, redigering av ställesuppgifter, sökresultatens vyval och redigering av eget omdöme är tydligare på mobil.",
        "Besöksdetaljen leder vidare till stället utan en dubblerad Maps-knapp.",
        "Praktiska uppgifter använder ett enklare Hur vet du det-flöde och skiljer tydligt på att kontrollera kartdata och att välja att använda den.",
      ],
    },
  ],
};

const VERSION_1_23_0_CHANGELOG: ChangelogEntry = {
  version: "1.23.0",
  date: "2026-08-03",
  summary: "Gruppinställningarna får en lugnare meny med tydliga undersidor.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Gruppinställningarna öppnar en kompakt meny för grupp och sökning, medlemmar och inbjudningar, underhåll, status och appinformation.",
        "Långa formulär och administrativa verktyg ligger på egna undersidor med tillbaka-navigering och rollanpassad synlighet.",
        "Osparade ändringar i grupp- och sökinställningarna skyddas innan användaren lämnar vyn.",
        "Gruppens aktivitet har en tydlig väg till den gemensamma besökshistoriken.",
      ],
    },
  ],
};

const VERSION_1_22_0_CHANGELOG: ChangelogEntry = {
  version: "1.22.0",
  date: "2026-08-03",
  summary: "Webbplats, öppettider och Google Maps samlas i ett tydligare praktiskt flöde.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Webbplats, öppettider och Google Maps visas som jämbördiga rader under Praktiskt.",
        "Redigeringen använder kortare copy, fältvis återgång till kartdata och ett kompakt privat underlag för ändringen.",
      ],
    },
    {
      kind: "Rättat",
      items: [
        "Öppettider är inte längre visuellt indragna under webbplatsen, och återgång till kartdata skapar inget nytt granskningsunderlag.",
      ],
    },
  ],
};

const VERSION_1_21_1_CHANGELOG: ChangelogEntry = {
  version: "1.21.1",
  date: "2026-08-03",
  summary: "Senaste besöket och besöksaktivitet öppnar samma gemensamma detaljvy.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Hela kortet Senast tillsammans öppnar det specifika besöket, medan Alla besök leder till gruppens samlade historik.",
        "Besöksrader i gruppens aktivitet öppnar samma besöksdetalj som Hem och besökshistoriken.",
      ],
    },
  ],
};

const VERSION_1_21_0_CHANGELOG: ChangelogEntry = {
  version: "1.21.0",
  date: "2026-08-03",
  summary: "Besök får korrekta gäster, tydligare nästa handling och en samlad historik.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Besök kan innehålla namngivna gäster utan att de blir gruppmedlemmar eller får progression.",
        "Gruppens alla besök kan öppnas från Hem i en gemensam historik med det senaste först.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Matställen visar hur många av gruppens medlemmar som har varit där, nästa stopp beskrivs som ett förslag och Hem visar om du själv har svarat på datumet.",
        "Exempelgruppen visar en avsiktlig demokarta och förklarar att användaren testar som Alex, gruppens ägare.",
        "Topplistan visar antal besök och redigeringsvägarna har mer specifika namn.",
        "Gästnamn visas bara i besökets ursprungsgrupp. Vid delning ser andra grupper endast ett anonymt antal personer utanför gruppen.",
        "Endast valda faktiska gruppmedlemmar får deltagarprogression; registreraren får ingen automatisk kredit.",
      ],
    },
    {
      kind: "Rättat",
      items: [
        "Dialoger och paneler annonserar Stäng på svenska och varje stjärnbetyg är kopplat till sin kategori.",
        "Samma kommentar visas inte längre både som gemensam besökskommentar och som användarens eget omdöme.",
      ],
    },
  ],
};

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
  VERSION_1_25_7_CHANGELOG,
  VERSION_1_25_6_CHANGELOG,
  VERSION_1_25_5_CHANGELOG,
  VERSION_1_25_4_CHANGELOG,
  VERSION_1_25_3_CHANGELOG,
  VERSION_1_25_2_CHANGELOG,
  VERSION_1_25_1_CHANGELOG,
  VERSION_1_25_0_CHANGELOG,
  VERSION_1_24_0_CHANGELOG,
  VERSION_1_23_0_CHANGELOG,
  VERSION_1_22_0_CHANGELOG,
  VERSION_1_21_1_CHANGELOG,
  VERSION_1_21_0_CHANGELOG,
  VERSION_1_20_2_CHANGELOG,
  VERSION_1_20_1_CHANGELOG,
  VERSION_1_20_0_CHANGELOG,
  ...CHANGELOG_THROUGH_1_19,
];

const currentRelease = CHANGELOG[0];
if (!currentRelease) throw new Error("Matrundans versionshistorik är tom.");

export const APP_VERSION = currentRelease.version;
export const APP_VERSION_DATE = currentRelease.date;
