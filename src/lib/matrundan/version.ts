import { CHANGELOG as CHANGELOG_THROUGH_1_31, type ChangelogEntry } from "./version-through-1-31";

export { APP_NAME, formatRating } from "./version-through-1-31";
export type { ChangelogEntry };

const VERSION_1_38_11_CHANGELOG: ChangelogEntry = {
  version: "1.38.11",
  date: "2026-09-09",
  summary: "Delade besök kan få rätt deltagare utan att öppna gruppgränserna.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "En gäst på ett delat besök kan kopplas till en medlem som själv bekräftar att hen var med, och mottagargruppen kan föreslå en egen medlem utan att få se privat gästnamn eller ursprungsgrupp.",
        "När ett besök registreras och delas samtidigt kan gästkopplingen fortsätta direkt efter sparandet utan att besöket behöver letas upp igen.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Bekräftat deltagande återanvänder samma kanoniska besök, påverkar deltagarstatistik och progression och undviker att samma person samtidigt räknas som medlem och anonym extern deltagare i en grupp där identiteten får visas.",
      ],
    },
  ],
};

const VERSION_1_38_10_CHANGELOG: ChangelogEntry = {
  version: "1.38.10",
  date: "2026-09-08",
  summary: "Dubblettskydd hjälper gruppen återanvända samma verkliga besök.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Vid registrering och delning varnar Matrundan när samma matställe, datum och tillfälle ser ut att vara samma verkliga besök. Du kan återanvända det befintliga besöket eller uttryckligen ange att det var ett annat besök.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Dubblettkontrollen återanvänder kanoniska besök utan att exponera ursprungsgrupp, andra medlemskap eller privata kommentarer.",
      ],
    },
  ],
};

const VERSION_1_38_9_CHANGELOG: ChangelogEntry = {
  version: "1.38.9",
  date: "2026-09-08",
  summary: "Kommentarer som läggs till i efterhand blir reagerbara i rätt grupp.",
  sections: [
    {
      kind: "Rättat",
      items: [
        "En första kommentar som läggs till när ett befintligt deltagaromdöme redigeras blir synlig och reagerbar i den aktuella gruppen utan att synliggöras i andra grupper eller återöppna en redan explicit dold kommentar.",
      ],
    },
  ],
};

const VERSION_1_38_8_CHANGELOG: ChangelogEntry = {
  version: "1.38.8",
  date: "2026-09-08",
  summary: "Repo- och testunderhåll är tydligare utan att ändra appens användarflöden.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Aktiva interna komponentnamn, testhygien och plattformsdokumentation har städats efter migrationen utan att ändra produktflöden, gruppdata eller användarsynlig UX.",
      ],
    },
  ],
};

const VERSION_1_38_7_CHANGELOG: ChangelogEntry = {
  version: "1.38.7",
  date: "2026-09-06",
  summary: "Kartans interna livscykel är tydligare utan att ändra hur kartan används.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Kartkomponenten städar sina interna klustermarkörer mot samma livscykelinstans och dokumenterar när kameran medvetet följer koordinatinnehåll i stället för objektreferenser. Kartflöde och interaktioner är oförändrade.",
      ],
    },
  ],
};

const VERSION_1_38_6_CHANGELOG: ChangelogEntry = {
  version: "1.38.6",
  date: "2026-09-06",
  summary: "Tekniskt underhåll minskar byggvarningar utan att ändra appens flöden.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Serverfunktioner använder TanStack Starts aktuella validator-API och byggkonfigurationen använder Vites inbyggda TypeScript-sökvägsstöd. Det minskar tekniskt byggbrus utan att ändra användarflöden eller dataregler.",
      ],
    },
  ],
};

const VERSION_1_38_5_CHANGELOG: ChangelogEntry = {
  version: "1.38.5",
  date: "2026-09-06",
  summary: "Lösenordsåterställningen har fått en stabilare teknisk grund.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Lösenordsåterställningen använder nu samma interna konto- och authgräns som övriga kontoflöden utan att ändra lösenordspolicy eller hur sidan används.",
      ],
    },
  ],
};

const VERSION_1_38_4_CHANGELOG: ChangelogEntry = {
  version: "1.38.4",
  date: "2026-09-04",
  summary: "Driftidentiteten pekar konsekvent på den nya produktionsmiljön.",
  sections: [
    {
      kind: "Rättat",
      items: [
        "OpenStreetMap-anrop identifierar nu Matrundan med den aktiva Cloudflare-produktionsadressen i stället för den tidigare Lovable-adressen.",
      ],
    },
  ],
};

const VERSION_1_38_3_CHANGELOG: ChangelogEntry = {
  version: "1.38.3",
  date: "2026-09-03",
  summary: "Driften övervakas automatiskt så större avbrott kan upptäckas tidigare.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Produktionsmiljön får en liten automatisk hälsokontroll som verifierar appens drift och databasanslutning utan att läsa privat grupp- eller användardata.",
      ],
    },
  ],
};

const VERSION_1_38_2_CHANGELOG: ChangelogEntry = {
  version: "1.38.2",
  date: "2026-08-22",
  summary: "Inloggning och drift har flyttats till en portablare teknisk grund.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Google-inloggningen går direkt via Supabase Auth och appens byggkedja använder TanStack Start, Vite och Nitro utan Lovable-specifik auth- eller build-wrapper. Det ändrar inte gruppdata eller hur appen används.",
      ],
    },
  ],
};

const VERSION_1_38_1_CHANGELOG: ChangelogEntry = {
  version: "1.38.1",
  date: "2026-08-20",
  summary: "Omdömeskorten är lugnare och reaktionerna mer mänskliga.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Smak, prisvärdhet och service visas direkt i deltagarens omdöme i stället för bakom en generell Detaljer-kontroll; bara längre kommentarer behöver expanderas.",
        "Reaktionsvalet samlas under en enda Reagera-handling och befintliga reaktioner visar första reagerande personens namn direkt, med hela listan kvar på tryck.",
        "Det egna omdömet har tydliga, lågmälda handlingar för Redigera och kommentarens synlighet i stället för en ensam pennikon och en stor inställningsrad.",
      ],
    },
  ],
};

const VERSION_1_38_0_CHANGELOG: ChangelogEntry = {
  version: "1.38.0",
  date: "2026-08-19",
  summary: "Deltagarnas omdömen får privata, lågmälda reaktioner i gruppen.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Gruppmedlemmar kan reagera med ❤️, 🤤, 🙌 eller 😂 på en deltagares synliga omdömeskommentar utan att skapa en separat diskussion eller social feed.",
        "När en annan deltagare senare lämnar sitt första omdöme på ett befintligt besök kan gruppen få en pushnotis som öppnar rätt grupp, besök och omdöme direkt.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Reaktionerna är privata per grupp även när samma kanoniska besök och omdöme visas i flera grupper, och påverkar aldrig betyg, progression eller ranking.",
        "Besöksdetaljen visar bara befintliga reaktioner med positiva antal och en kompakt Reagera-kontroll; vilka som reagerat visas först när ett reaktionschip öppnas.",
      ],
    },
  ],
};

const VERSION_1_37_0_CHANGELOG: ChangelogEntry = {
  version: "1.37.0",
  date: "2026-08-16",
  summary: "Nästa stopp bevarar gruppens alternativ utan att göra valet till en omröstning.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Det första ställesförslaget blir gruppens nästa stopp direkt, medan senare idéer sparas under Andra förslag utan att skriva över det aktuella stoppet.",
        "Medlemmar kan markera Jag vill hit på både nästa stopp och andra förslag, samtidigt som det framgår vem som föreslog varje ställe.",
        "Nästa stopp kan bära en enkel gemensam dag utan klockslag. På dagen kan medlemmarna svara Jag kan eller Jag kan inte utan att Matrundan blir en full eventplanerare.",
        "En passerad planerad dag följs upp med Blev det av? så ett verkligt besök registreras uttryckligen i stället för att historik gissas fram.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Ett nytt ställesförslag skriver inte längre över gruppens nästa stopp. Gruppen kan välja ett bevarat alternativ uttryckligen medan platsintresse och dagsvar hålls separata.",
        "Hem fokuserar på ett enda nästa stopp och håller övriga förslag i en lågmäld accordion tills gruppen vill titta på dem.",
      ],
    },
  ],
};

const VERSION_1_36_0_CHANGELOG: ChangelogEntry = {
  version: "1.36.0",
  date: "2026-08-16",
  summary: "Aktuella besök som väntar på ditt omdöme blir synliga utan att ta över flödet.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Hem visar en diskret signal för aktuella deltagarbesök där ditt eget omdöme saknas och länkar direkt till samma gemensamma besök.",
        "Besök markerar samma aktuella besök med Ditt omdöme saknas, medan äldre obesvarade besök ligger kvar i historiken utan framträdande påminnelse.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "Påminnelsen följer faktisk deltagarstatus och existensen av ditt kanoniska omdöme, så den försvinner när du lämnar omdöme eller korrigerar att du inte var med.",
      ],
    },
  ],
};

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
        "Besöksdetaljen samlar gruppens sammanfattning och individuella deltagaromdömen i en gemensam hierarki och gör deltagarkorrigeringen mer kompakt i normalfallet.",
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
  VERSION_1_38_11_CHANGELOG,
  VERSION_1_38_10_CHANGELOG,
  VERSION_1_38_9_CHANGELOG,
  VERSION_1_38_8_CHANGELOG,
  VERSION_1_38_7_CHANGELOG,
  VERSION_1_38_6_CHANGELOG,
  VERSION_1_38_5_CHANGELOG,
  VERSION_1_38_4_CHANGELOG,
  VERSION_1_38_3_CHANGELOG,
  VERSION_1_38_2_CHANGELOG,
  VERSION_1_38_1_CHANGELOG,
  VERSION_1_38_0_CHANGELOG,
  VERSION_1_37_0_CHANGELOG,
  VERSION_1_36_0_CHANGELOG,
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