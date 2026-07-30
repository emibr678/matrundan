import { CHANGELOG as PREVIOUS_CHANGELOG, type ChangelogEntry } from "./version-history";

export { APP_NAME, formatRating } from "./version-history";
export type { ChangelogEntry };

export const APP_VERSION = "1.3.0";
export const APP_VERSION_DATE = "2026-07-30";

const VERSION_1_3_0_CHANGELOG: ChangelogEntry = {
  version: APP_VERSION,
  date: APP_VERSION_DATE,
  summary: "Enklare att komma igång med notiser och att lägga appen på hemskärmen.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Ett diskret kort på Hem föreslår att slå på notiser när du är med i en grupp och inte redan har notiser på enheten.",
        "På Android och i datorwebbläsare går det att lägga Matrundan på hemskärmen direkt med en knapp.",
        "På iPhone och iPad visas en kort instruktion för Dela → Lägg till på hemskärmen, som också krävs för notiser.",
        "Min profil har ett eget avsnitt, Appen på mobilen, för den som vill installera appen senare.",
      ],
    },
  ],
};

const VERSION_1_2_0_CHANGELOG: ChangelogEntry = {
  version: "1.2.0",
  date: "2026-07-30",
  summary: "Push-notiser när något händer i dina grupper.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Du kan slå på notiser per enhet under Min profil och välja vilka händelser du vill få notis om.",
        "Notis när någon registrerar ett besök, väljer nästa stopp eller föreslår ett datum.",
        "Notis när du läggs till som deltagare på ett besök och när en ny medlem går med i gruppen.",
        "Matrundan kan läggas till på hemskärmen, vilket krävs för notiser på iPhone och iPad.",
      ],
    },
  ],
};

const VERSION_1_1_2_CHANGELOG: ChangelogEntry = {
  version: "1.1.2",
  date: APP_VERSION_DATE,
  summary: "Tydligare besked när ett lösenord inte accepteras vid kontoregistrering.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Ett lösenord som är för kort eller för lätt att gissa ger nu ett tydligt besked i stället för ett generiskt felmeddelande.",
        "Registreringen visar kraven på lösenordet redan innan du skickar formuläret.",
      ],
    },
  ],
};

const VERSION_1_1_1_CHANGELOG: ChangelogEntry = {
  version: "1.1.1",
  date: "2026-07-30",
  summary: "Enklare kontoregistrering med e-post, utan väntan på bekräftelsemejl.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Nya konton aktiveras direkt vid registrering, så du kommer igång utan bekräftelsemejl.",
        "Om e-postadressen redan har ett konto får du ett tydligt besked och hamnar direkt i inloggningen.",
        "Återställning av lösenord påminner om att mejlet kan hamna i skräpposten.",
      ],
    },
  ],
};

const VERSION_1_1_CHANGELOG: ChangelogEntry = {
  version: "1.1.0",
  date: "2026-07-30",
  summary:
    "Nu går det att skapa konto med e-post och lösenord, för dig som inte vill eller kan använda Google.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Skapa konto och logga in med e-postadress och lösenord vid sidan av Google.",
        "Glömt lösenord skickar en återställningslänk, så du behåller ditt konto och din historik.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Nya lösenord kontrolleras mot kända läckor.",
        "Att logga in med ett annat konto rensar den tidigare sessionen och gruppvalet direkt.",
      ],
    },
  ],
};

const VERSION_1_CHANGELOG: ChangelogEntry = {
  version: "1.0.0",
  date: "2026-07-29",

  summary:
    "Matrundan 1.0 samlar ett tydligare första möte, en helt fiktiv exempelgrupp och självbetjänad kontoradering.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "En publik integritetssida förklarar vilka uppgifter som används, varför de behövs och vad som händer vid kontoradering.",
        "Kontot kan raderas direkt från profilen med ägaröverlåtelse, extra bekräftelse för ensamgrupper och anonymiserad gemensam historik.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Landningssidan prioriterar inloggning och att gå med via en privat inbjudan.",
        "Om Matrundan beskriver appens syfte, tre huvudsteg och att tjänsten är ett kostnadsfritt hobbyprojekt utan garanterad support.",
        "Exempelgruppens matställen, adresser, medlemmar och historik är nu helt fiktiva.",
        "Gruppens arkivering och återaktivering finns under Gruppinställningar.",
      ],
    },
    {
      kind: "Rättat",
      items: [
        "Exempelgruppen länkar inte längre fiktiva ställen till Google Maps.",
        "Copy kring sökområde, exempel/demo och ställesantal är mer konsekvent.",
      ],
    },
  ],
};

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
  version: "0.19.1",
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

const PACKAGE_6F_CHANGELOG: ChangelogEntry = {
  version: "0.20.0",
  date: APP_VERSION_DATE,
  summary:
    "Säkrare korrigeringar av gruppens historik och planering, med radering av felaktiga besök och redigering av datumförslag.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Den som registrerade ett originalbesök, gruppens ägare eller admin kan radera det från besöksdetaljen efter en tydlig konsekvensbekräftelse.",
        "Förslagsställaren, gruppens ägare eller admin kan ändra ett föreslaget eller bekräftat datum utan att först ta bort det.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "När ett datum ändras nollställs tidigare svar och ett bekräftat datum öppnas igen så att gruppen kan ta ställning på nytt.",
        "Besökshistoriken ligger före Om stället och detaljerade betyg på matställets detaljsida.",
        "Lägg till-flödet behåller sökning och utforskning som standard, manuell inmatning som sekundärt val och stöd för flera tillägg i samma omgång.",
      ],
    },
    {
      kind: "Rättat",
      items: [
        "Radering av ett originalbesök tar även bort dess foto, omdömen, deltagarkopplingar, delningar och aktivitet så att progressionen räknas om från den kanoniska historiken.",
      ],
    },
  ],
};

export const CHANGELOG: ChangelogEntry[] = [
  VERSION_1_3_0_CHANGELOG,
  VERSION_1_2_0_CHANGELOG,
  VERSION_1_1_2_CHANGELOG,
  VERSION_1_1_1_CHANGELOG,
  VERSION_1_1_CHANGELOG,
  VERSION_1_CHANGELOG,

  PACKAGE_6F_CHANGELOG,
  PACKAGE_6E_CHANGELOG,
  PACKAGE_6D_CHANGELOG,
  PACKAGE_6C_CHANGELOG,
  PACKAGE_6B_CHANGELOG,
  PACKAGE_6A_1_CHANGELOG,
  PACKAGE_6A_CHANGELOG,
  PACKAGE_5D_CHANGELOG,
  ...PREVIOUS_CHANGELOG,
];
