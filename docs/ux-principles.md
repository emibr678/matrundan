# UX- och copyprinciper

Det här dokumentet beskriver **vad** Matrundans produktnära UX, interaktion och
copy ska optimera för. Det kompletterar
[visual-review.md](./visual-review.md), som beskriver **hur** renderad UX granskas,
och [development-workflow.md](./development-workflow.md), som beskriver **när**
beslut, implementation och verifiering sker.

Målet är inte så lite UI eller text som möjligt. Matrundan ska kännas
**självklart, lugnt och varmt** och hjälpa gruppen genom den gemensamma matresan
utan att göra användaren till administratör av systemet.

Principerna är beslutsstöd, inte ett designsystem eller komponentbibliotek.

## 1. Utgå från användarens uppgift, inte systemmodellen

UI ska tala om grupper, ställen, besök, deltagare och handlingar som människor
förstår. Providers, RPC-versioner, lagringsmodell, overrides, kanoniska länkar och
andra implementationdetaljer ska normalt stanna under huven.

Skriv hellre `Lägg till ett ställe som saknas`, `Gruppens egen uppgift` eller
`Jag var med` än copy som kräver förståelse av OpenStreetMap, providerstatus eller
intern datamodell.

## 2. Gör det vanliga fallet självförklarande, enkelt och lugnt

Bra defaults, automation, tydligt state och naturlig mapping ska bära förståelsen
före extra instruktioner eller steg.

Självförklarande betyder inte textlöst. När state redan visar **vad som är sant**
kan en kort mening fortfarande hjälpa användaren förstå **vad den ska göra**,
minska osäkerhet eller ge flödet rätt ton. `Alex · Du` kan till exempel visa vem
användaren är, medan `Välj alla som var med.` fortfarande kan orientera uppgiften.

Undvik att förklara sådant UI redan visar, exempelvis varför registreraren redan
är vald som deltagare.

## 3. Låt text förtjäna sin plats

Produktcopy ska göra minst en sak väl: orientera uppgiften, hjälpa ett aktuellt
beslut, förklara en verklig konsekvens, minska relevant osäkerhet eller bidra till
Matrundans lugna och varma ton. Skriv naturlig svenska med vardagliga verb.

Teknisk implementation är normalt inte produktcopy. Lägg hellre en kort,
handlingsnära rad nära rätt kontroll än permanent text om metadata, backendflöden
eller intern datastruktur som användaren inte behöver agera på.

## 4. Visa sekundära val när de blir relevanta

Använd progressive disclosure för sekundära, sällsynta, tekniska och
situationsstyrda behov. Kärnan ska vara synlig; undantag ska vara lätta att hitta
när de behövs men inte permanent dominera huvudflödet.

Ett typiskt mönster är `Lägg till gäst` → kompakt inlinekomplettering → kollaps
när handlingen är klar. Kontextuell integritets- eller hjälpcopy visas när den
faktiskt behövs, inte överallt hela tiden.

## 5. Designa bort innan du organiserar

När en vy blir tät är första frågan vad som kan tas bort, härledas, slås samman
eller flyttas — inte vilket nytt kort, accordion eller meny som kan organisera
allt.

Varje state bör ha en tydlig primär handling. Sekundära handlingar ska vara
möjliga att hitta men visuellt underordnade huvuduppgiften.

## 6. Var konsekvent, inte uniform

Återanvänd samma begrepp, identitet, interaktionsmönster och visuella språk där
det hjälper igenkänning. Gör inte olika vyer identiska när deras uppgifter skiljer
sig.

Skapa och redigera ett besök ska exempelvis kännas som samma flöde, samtidigt som
redigeringsläget får ha de semantiska skillnader som ett redan existerande besök
kräver.

## 7. Gör härledda resultat och status begripliga

Synliga resultat och systemstatus ska kunna förstås utifrån det användaren ser.
Härledda värden kommer naturligt efter sitt underlag och ska vara tydliga utan att
konkurrera med inputen.

Undvik dold viktning, automatiska slutsatser som presenteras som användarens
sanning och statusfärger som överdriver ett problem. Ett tydligt exempel är
detaljbetyg → automatiskt helhetsbetyg.

## 8. Bevara kontext och kontinuitet

Låt användaren fortsätta där den redan befinner sig och återanvänd samma verkliga
objekt och etablerade flöde. Undvik parallella administrativa produkter eller att
tvinga användaren att leta upp samma ställe eller besök igen för en närliggande
handling.

## 9. Respektera användarens uppmärksamhet

Påminnelser, pending-signaler, gamification och sociala interaktioner ska vara
varma, diskreta och sekundära. Att mer data eller fler funktioner finns betyder
inte att fler badges, filter, notiser eller lika starka kontroller ska visas.

Fler möjligheter kräver tydligare prioritering.

## 10. Designa för Matrundans verkliga sammanhang

Gruppens gemensamma matresa är primär:
**samla → välja → besöka → minnas → välja igen**. Sökning, karta, statistik,
rekommendationer och gamification stödjer den resan men får inte ta över den.

Mobil är en designförutsättning, inte en efterkontroll. Relevanta huvudflöden ska
fungera vid 360 px med tangentbord, längre svensk text, realistiska namn och data
samt flera deltagare utan att bli tunga eller få horisontell overflow.

## Etablerade mönster

Följande mönster har återkommit tillräckligt för att vara användbara utanför en
enskild feature:

- **State först, copy sedan.** Visa valt state, `Du` eller ett härlett resultat
  genom beteende och presentation; använd copy för orientering eller konsekvens,
  inte för att dokumentera state.
- **Sekundära undantag hålls kollapsade.** Gäster, extra metadata och liknande
  öppnas när de behövs och lämnas inte permanent stora efter avslutad handling.
- **Inline före ny dialog när kontexten är liten.** Undvik dialog-i-dialog för en
  enkel komplettering som kan göras nära den aktuella kontrollen.
- **Ett visuellt attribut har en huvudsaklig betydelse.** Om färg betyder `vald`
  ska samma färg inte samtidigt behöva betyda `jag` när en lågmäld etikett kan
  uttrycka det senare.
- **Härledda värden kommer efter sitt underlag.** Read-only-resultat ska vara
  begripliga men inte konkurrera med det användaren faktiskt matar in.
- **Tekniska implementationdetaljer stannar normalt under huven.** Exponera dem
  bara när användaren behöver dem för ett verkligt beslut eller en handling.

## När en lokal lärdom blir en princip

Feature-Issuet äger den aktuella lokala UX-sanningen och PR:n äger
implementationsevidensen. Det här dokumentet ska bara bära generaliserade,
varaktiga lärdomar.

När en UX-/copydiskussion, preview eller faktisk användning leder till ett
materiellt nytt beslut:

1. uppdatera relevant Issue-body till det som gäller nu;
2. lägg en kort daterad beslutskommentar när varför, ett ersatt antagande eller
   ett viktigt fynd har framtida värde;
3. uppdatera inte detta dokument för varje lokal justering;
4. lyft hit lärdomen först när den är återanvändbar eller flera observationer
   pekar på samma princip;
5. låt Issue och PR behålla konkreta exempel och historik — här hör
generaliseringen hemma.

## Avgränsning

Det här dokumentet är inte:

- ett komplett designsystem eller komponentbibliotek;
- en katalog med spacing-, färg- eller typografitokens;
- en skärmspecifikation för varje vy;
- en generell webb- eller WCAG-handbok;
- ett arkiv över alla historiska UX-beslut.

Nya konkreta UI-problem ska hanteras i rätt feature-/bugg-Issue. De ska inte
smygimplementeras bara för att en princip gör dem synliga.
