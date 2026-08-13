import {
  CHANGELOG as CHANGELOG_THROUGH_1_31,
  type ChangelogEntry,
} from "./version-through-1-31";

export { APP_NAME, formatRating } from "./version-through-1-31";
export type { ChangelogEntry };

const VERSION_1_32_0_CHANGELOG: ChangelogEntry = {
  version: "1.32.0",
  date: "2026-08-13",
  summary: "Gruppinställningarna är ordnade efter tydliga uppgifter och appinformationen ligger separat.",
  sections: [
    {
      kind: "Förbättrat",
      items: [
        "Gruppinställningarna är uppdelade i Gruppen, Sökområden, Medlemmar och inbjudningar, Matställen och rapporter, Besök och progression samt Gruppstatus.",
        "Gruppnamn och symbol sparas separat från sökområden och sökavstånd, så en ändring inte behöver skriva om den andra delen.",
        "Sällan använda och destruktiva gruppåtgärder ligger samlade sist under Gruppstatus utan att ändra befintliga roller eller behörigheter.",
        "Om Matrundan med aktuell version och versionshistorik ligger i profil- och inloggningsmenyn i stället för bland gruppens inställningar.",
      ],
    },
  ],
};

export const CHANGELOG: ChangelogEntry[] = [VERSION_1_32_0_CHANGELOG, ...CHANGELOG_THROUGH_1_31];

const currentRelease = CHANGELOG[0];
if (!currentRelease) throw new Error("Matrundans versionshistorik är tom.");

export const APP_VERSION = currentRelease.version;
export const APP_VERSION_DATE = currentRelease.date;
