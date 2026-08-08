import {
  CHANGELOG as CHANGELOG_THROUGH_1_26_1,
  type ChangelogEntry,
} from "./version-through-1-26-1";

export { APP_NAME, formatRating } from "./version-through-1-26-1";
export type { ChangelogEntry };

const VERSION_1_29_0_CHANGELOG: ChangelogEntry = {
  version: "1.29.0",
  date: "2026-08-08",
  summary:
    "Saknade matställen kan läggas till enklare och återanvända en säker befintlig platsidentitet.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Sökningen är huvudvägen i Lägg till ställen och den manuella vägen visas som den sekundära handlingen Lägg till ett ställe som saknas.",
        "Fallbackformuläret prioriterar namn, kategori, kök eller inriktning och ett sammanhållet verifierat platsval utan teknisk OpenStreetMap-copy.",
        "Verifierat namn och plats kan matchas konservativt mot redan kända kanoniska Matrundan-ställen utan att andra gruppers medlemskap eller privata metadata exponeras.",
        "Ett valt befintligt ställe återanvänder samma platsidentitet; osäkra kandidater slås aldrig ihop automatiskt och kan uttryckligen avböjas.",
        "Nya verifierade manuella ställen utan aktiv extern källa skapar ett privat systeminternt underlag för senare källmatchning, utan automatisk extern publicering.",
        "Exempelgruppen kan återaktivera det arkiverade Brödverket 47 från fallbackflödet med samma lokala platsidentitet och utan externa anrop.",
      ],
    },
  ],
};

const VERSION_1_28_0_CHANGELOG: ChangelogEntry = {
  version: "1.28.0",
  date: "2026-08-07",
  summary:
    "Lägg till ställen får tydligare geografi, intelligent sökning och stegvis fler resultat.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Sök i visar geografifältet före valda områden och beskriver punktavståndet som Sök inom X km.",
        "Kända kök, inriktningar och typer som sushi, pasta och café tolkas semantiskt i stället för att enbart matchas mot verksamhetsnamn.",
        "Matställessökningen kan skilja generella köks- och typförslag från specifika verksamheter utan att ett platsval ändrar sökområdet.",
        "En ny sökning behåller redan visade träffar medan den laddar och visar en diskret status i stället för att tömma resultatytan.",
        "Varje listsida med sökträffar fylls med upp till 20 faktiskt visningsbara träffar och Visa fler ger upp till nästa 20 utan att kasta om redan visade.",
        "Att ta bort det sista sökområdet på mobil lämnar kvar fliken Sök utan att formuläret för manuellt tillägg blinkar fram.",
        "Kortlivad återanvändning av identiska provideranrop minskar onödiga Geoapify-anrop utan långlivad klientcache.",
        "Exempel- och demoläget använder samma sökintent med deterministiska lokala matställen och utan externa provideranrop.",
      ],
    },
  ],
};

const VERSION_1_27_1_CHANGELOG: ChangelogEntry = {
  version: "1.27.1",
  date: "2026-08-07",
  summary: "Geografiska sökträffar visas med naturliga svenska namn och tydlig kontext.",
  sections: [
    {
      kind: "Rättat",
      items: [
        "Geografisk autocomplete visar kort platsnamn med svensk resulttyp och relevant ort, kommun eller län i stället för rå providertext.",
        "Breda kommun-, läns- och regionträffar förklaras tydligt men förblir ovalbara så länge sökområden använder punkt och radie.",
        "Exempel- och demoläget använder samma autocompletepresentation utan externa Geoapify-anrop.",
      ],
    },
  ],
};

const VERSION_1_27_0_CHANGELOG: ChangelogEntry = {
  version: "1.27.0",
  date: "2026-08-07",
  summary: "Platsdetaljen känns igen före och efter att ett matställe läggs till.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Lägg till i gruppen och den tillagda platsdetaljen delar visuellt språk för platsidentitet, adress och praktisk information.",
        "Sökresultatlistan behåller sin tidigare kompakta utformning och förändras inte av platsdetaljens nya uttryck.",
        "Förhandsdetaljen behåller kök och inriktning, Passar för, gruppanteckning och rapportering utan att visa besöks- eller nästa-stopp-handlingar.",
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
        "Nya breda kommun-, län-, region- och landsområden blockeras åter på servern utan att befintliga sparade områden raderas.",
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
  VERSION_1_29_0_CHANGELOG,
  VERSION_1_28_0_CHANGELOG,
  VERSION_1_27_1_CHANGELOG,
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
