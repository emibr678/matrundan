from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"Kunde inte hitta text i {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


replace_once(
    "src/lib/matrundan/version.ts",
    'export const APP_VERSION = "0.13.0";',
    'export const APP_VERSION = "0.14.0";',
)

replace_once(
    "src/lib/matrundan/version.ts",
    '''export const CHANGELOG: ChangelogEntry[] = [
  {
    version: APP_VERSION,
    date: APP_VERSION_DATE,
    summary:
      "Lägg till flera matställen i samma sökomgång utan att förlora sökning, karta eller position.",''',
    '''export const CHANGELOG: ChangelogEntry[] = [
  {
    version: APP_VERSION,
    date: APP_VERSION_DATE,
    summary:
      "Spara ett privat foto från besöket och behåll det som en del av gruppens gemensamma mathistorik.",
    sections: [
      {
        kind: "Nytt",
        items: [
          "Ett valfritt foto kan läggas till när ett besök registreras eller i efterhand från besöksdetaljen.",
          "Fotot visas i besökshistoriken och större i besöksdetaljen, men används aldrig automatiskt som matställets huvudbild.",
        ],
      },
      {
        kind: "Förbättrat",
        items: [
          "Bilder omkodas till komprimerad JPEG med högst 1600 pixlars längsta sida, vilket tar bort EXIF- och platsmetadata före lagring.",
          "Endast faktiska deltagare eller gruppens ägare och administratörer kan lägga till, ersätta eller ta bort ett foto.",
          "Fotot är privat för ursprungsgruppen och följer inte med när det kanoniska besöket delas till en annan grupp.",
          "Fredagsgänget demonstrerar samma fotoflöde lokalt utan att skriva till databas eller Cloud Storage.",
        ],
      },
      {
        kind: "Rättat",
        items: [
          "Besöket sparas alltid före fotot, så ett uppladdningsfel kan inte rulla tillbaka eller förlora den registrerade rundan.",
        ],
      },
    ],
  },
  {
    version: "0.13.0",
    date: "2026-07-28",
    summary:
      "Lägg till flera matställen i samma sökomgång utan att förlora sökning, karta eller position.",''',
)

replace_once(
    "README.md",
    '- Registrering av besök med valfria detaljbetyg och kommentarer.',
    '- Registrering av besök med valfria detaljbetyg, kommentarer och ett privat foto.',
)

replace_once(
    "README.md",
    '''## Status – v0.13.0

Paket 5B gör det möjligt att lägga till flera sökträffar i samma omgång.''',
    '''## Status – v0.14.0

Paket 5C lägger till ett valfritt privat foto per besök. Bilden kan väljas vid
registreringen eller hanteras i efterhand, komprimeras och omkodas innan den
sparas och visas som ett minne i gruppens besökshistorik. Endast faktiska
deltagare eller gruppens ägare och admin får ändra fotot. Det är kopplat till
ursprungsgruppen och följer aldrig automatiskt med när besöket delas vidare.
Fredagsgänget använder samma gränssnitt men lagrar bilden bara lokalt i sessionen.

Paket 5B gör det möjligt att lägga till flera sökträffar i samma omgång.''',
)

replace_once(
    "README.md",
    '''- Registrera besök med deltagare + omdöme atomärt, redigera eget omdöme,
  favoritmarkera och sätta/byta/rensa gruppens nästa stopp.''',
    '''- Registrera besök med deltagare + omdöme atomärt, redigera eget omdöme,
  lägga till ett privat besöksfoto, favoritmarkera och sätta/byta/rensa gruppens
  nästa stopp.''',
)

changelog_entry = '''## [0.14.0] – 2026-07-28

### Nytt

- **Ett privat foto per besök.** Fotot kan väljas vid registreringen eller
  läggas till, ersättas och tas bort i efterhand från besöksdetaljen.
- Historiken visar en diskret miniatyr och besöksdetaljen visar den större
  bilden som en del av gruppens gemensamma minne.

### Förbättrat

- Bilden omkodas till JPEG, begränsas till högst 1600 px på längsta sidan och
  komprimeras mot cirka 700 KB. Omkodningen tar bort EXIF- och GPS-metadata.
- En privat Storage-bucket och `visit_media` kopplar fotot till kombinationen
  besök + ursprungsgrupp. Signerade URL:er skapas bara för den aktiva gruppens
  läsmodell.
- Faktiska deltagare samt gruppens ägare och admin får hantera fotot. Ett delat
  besök och en arkiverad grupp är skrivskyddade.
- Fotot följer inte med till mottagargruppen när ett kanoniskt besök delas.
- Exempelgruppen använder samma UI men lagrar en komprimerad data-URL enbart i
  sin lokala session och skriver aldrig till Cloud Storage.

### Rättat

- Besöket sparas före bilden. Ett bild- eller uppladdningsfel lämnar därför det
  registrerade besöket intakt och visar ett tydligt meddelande.
- Mobilregressionen verifierar val, förhandsvisning, komprimering, persistens,
  visning och borttagning utan horisontell overflow vid 360 px.

'''
replace_once(
    "CHANGELOG.md",
    "## [0.13.0] – 2026-07-28",
    changelog_entry + "## [0.13.0] – 2026-07-28",
)

replace_once(
    "docs/architecture.md",
    '''This document describes the architectural source of truth for Matrundan as of
v0.12.1.''',
    '''This document describes the architectural source of truth for Matrundan as of
v0.14.0.''',
)

replace_once(
    "docs/architecture.md",
    '''Features that inherently require a real backend, such as authentication,
provider-backed persistence, real invitations or permanent file storage, must
remain behind their live boundaries. The example should simulate ordinary
local product flows rather than duplicate UI implementations.''',
    '''Features that inherently require a real backend, such as authentication,
provider-backed persistence, real invitations or permanent file storage, must
remain behind their live boundaries. The example should simulate ordinary
local product flows rather than duplicate UI implementations. Visit photos use
the same UI and domain operations in example mode, but the example adapter
stores a compressed data URL only in the current tab's session instead of
calling Cloud Storage.''',
)

visit_media_section = '''### `visit_media` and private visit photos

A visit photo is private media for one group's relationship to a canonical
visit. `visit_media` is uniquely keyed by `(visit_id, group_id)` and has a
composite foreign key to `visit_group_links`. This preserves canonical visit
identity while preventing a photo from becoming global visit data.

Important invariants:

- the row can exist only for the visit's `original` group link;
- a shared target group never receives the origin group's photo metadata,
  storage path or signed URL;
- all objects live in the private `visit-photos` bucket under a
  `<group>/<visit>/<random>.jpg` path;
- group members may read media only through the active group's read-model and
  short-lived signed URLs;
- only actual participants or the active group's owner/admin may add, replace
  or remove a photo;
- archived groups and shared visit links are read-only;
- the database and Storage policies repeat the permission checks server-side;
- replacing or deleting media must remove the old Storage object on a
  best-effort basis without deleting the canonical visit.

The browser re-encodes accepted images to JPEG before upload, limits the longest
edge to 1600 px and targets a compact file size. Re-encoding strips EXIF and GPS
metadata. The visit is created first and the image is uploaded second, so media
failure never rolls back the real visit.

'''
replace_once(
    "docs/architecture.md",
    "### Sharing a visit\n",
    visit_media_section + "### Sharing a visit\n",
)

replace_once(
    "docs/architecture.md",
    '''`get_group_app_state(_group_id)` is the primary live read boundary.''',
    '''`get_group_app_state_v5c(_group_id)` is the current primary live read boundary.
It layers the group-specific visit-photo projection over the established v4b
read-model rather than reopening direct table reads.''',
)

replace_once(
    "docs/architecture.md",
    '''- calculate or provide only group-visible review data.''',
    '''- calculate or provide only group-visible review data;
- attach visit-photo metadata only for `_group_id`, then resolve private objects
  to short-lived signed URLs in the live repository.''',
)

replace_once(
    "docs/architecture.md",
    '''Database changes require explicit inspection of function definitions, grants,
membership checks and preservation of production rows.''',
    '''Database changes require explicit inspection of function definitions, grants,
membership checks and preservation of production rows. Storage changes must
also verify bucket privacy, MIME/size limits, object-path validation, SELECT and
DELETE policies, signed-URL scoping and the absence of cross-group media in the
read-model.''',
)

print("Paket 5C releaseinformation applicerad")
