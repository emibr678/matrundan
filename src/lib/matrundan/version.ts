import {
  CHANGELOG as CHANGELOG_THROUGH_1_38_11,
  type ChangelogEntry,
} from "./version-through-1-38-11";

export { APP_NAME, formatRating } from "./version-through-1-38-11";
export type { ChangelogEntry };

const VERSION_1_38_12_CHANGELOG: ChangelogEntry = {
  version: "1.38.12",
  date: "2026-09-11",
  summary: "Besök kan beskrivas tydligare med Något att dricka och Hämtmat.",
  sections: [
    {
      kind: "Nytt",
      items: [
        "Tillfället Något att dricka kan väljas för besök där gruppen främst gick ut för dryck, och Hämtmat kan markeras separat när maten inte åts på plats.",
      ],
    },
    {
      kind: "Förbättrat",
      items: [
        "På plats förblir normalfallet utan extra etikett, medan Hämtmat visas tillsammans med tillfället i besökshistoriken. Äldre besök med tillfället Kväll förblir läsbara men Kväll kan inte längre väljas för nya besök.",
      ],
    },
  ],
};

export const CHANGELOG: ChangelogEntry[] = [
  VERSION_1_38_12_CHANGELOG,
  ...CHANGELOG_THROUGH_1_38_11,
];

const currentRelease = CHANGELOG[0];
if (!currentRelease) throw new Error("Matrundans versionshistorik är tom.");

export const APP_VERSION = currentRelease.version;
export const APP_VERSION_DATE = currentRelease.date;
