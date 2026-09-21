import { deriveReviewOverall } from "./review-model";
import type { AppState, Place, Visit, VisitParticipant, VisibleReview } from "./types";
import { APP_VERSION } from "./version";

export const EXAMPLE_TIME_ZONE = "Europe/Stockholm";
const DAY_MS = 24 * 60 * 60 * 1000;

export const EXAMPLE_IDS = {
  group: "example-stockholm",
  members: {
    alex: "m1",
    sam: "m2",
    robin: "m3",
    kim: "m4",
    noor: "m5",
    formerLina: "former-lina",
    guestAya: "guest-aya",
  },
  places: {
    providerBistro: "p1",
    repeatCafe: "p2",
    guestReviews: "p3",
    archivedBakery: "p4",
    nextStop: "p5",
    formerMemberHistory: "p6",
    limitedInfo: "p7",
    externalError: "p8",
    sharedVisit: "p9",
    longLayout: "p10",
  },
  visits: {
    repeatCafeLatest: "v1",
    guestReviews: "v2",
    formerMemberHistory: "v3",
    providerBistroFirst: "v4",
    archivedHistory: "v5",
    repeatCafeEarlier: "v6",
    limitedInfo: "v7",
    providerBistroReturn: "v8",
    sharedVisit: "v9",
    providerBistroLunch: "v10",
  },
  nextStopProposal: "proposal-example-1",
} as const;

type ExamplePlaceInput = Omit<
  Place,
  | "canonicalCategory"
  | "categoryOverride"
  | "canonicalCuisines"
  | "cuisinesOverride"
  | "collectionStatus"
  | "archivedAt"
  | "archivedBy"
> &
  Partial<
    Pick<
      Place,
      | "canonicalCategory"
      | "categoryOverride"
      | "canonicalCuisines"
      | "cuisinesOverride"
      | "collectionStatus"
      | "archivedAt"
      | "archivedBy"
    >
  >;

type ExampleVisitInput = Omit<Visit, "linkType" | "countsForProgression"> &
  Partial<Pick<Visit, "linkType" | "countsForProgression">>;

function requireValidNow(now: Date): Date {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("Exempelgruppens referenstid måste vara ett giltigt datum.");
  }
  return now;
}

function shifted(now: Date, days: number): Date {
  return new Date(requireValidNow(now).getTime() + days * DAY_MS);
}

function timestamp(now: Date, daysFromNow: number): string {
  return shifted(now, daysFromNow).toISOString();
}

function stockholmCalendarDate(now: Date, daysFromNow: number): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: EXAMPLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(shifted(now, daysFromNow));
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function exampleIsoTimestamp(now: Date): string {
  return requireValidNow(now).toISOString();
}

function examplePlace(input: ExamplePlaceInput): Place {
  return {
    ...input,
    canonicalCategory: input.canonicalCategory ?? input.category,
    categoryOverride: input.categoryOverride ?? null,
    canonicalCuisines: input.canonicalCuisines ?? input.cuisines,
    cuisinesOverride: input.cuisinesOverride ?? null,
    collectionStatus: input.collectionStatus ?? "active",
    archivedAt: input.archivedAt ?? null,
    archivedBy: input.archivedBy ?? null,
  };
}

function exampleVisit(input: ExampleVisitInput): Visit {
  return {
    ...input,
    linkType: input.linkType ?? "original",
    countsForProgression: input.countsForProgression ?? true,
  };
}

function activeParticipant(id: string, name: string, avatar: string): VisitParticipant {
  return { id, name, avatar, avatarImage: null, status: "active" };
}

function historicalReview(
  id: string,
  userId: string,
  comment: string,
  taste: number,
  value: number,
  service: number,
): VisibleReview {
  const reviewModel = "food_v0_3d" as const;
  const overall = deriveReviewOverall(reviewModel, { taste, value, service });
  if (overall == null) throw new Error("Exempelgruppens historiska omdöme är ofullständigt.");

  return {
    id,
    userId,
    overall,
    taste,
    value,
    service,
    atmosphere: null,
    reviewModel,
    comment,
    ratingVisible: true,
    commentVisible: true,
  };
}

/**
 * Bygger den publika, interaktiva exempelgruppen från en explicit referenstid.
 *
 * Varje datapost ska bära ett namngivet scenario. Buildern hålls medvetet liten:
 * den är en produktfixture, inte en generell fabrik för hela testsviten.
 */
export function buildExampleState(nowInput: Date): AppState {
  const now = requireValidNow(nowInput);
  const { members, places, visits } = EXAMPLE_IDS;

  const examplePlaces: Place[] = [
    examplePlace({
      id: places.providerBistro,
      name: "Rundans Bistro",
      category: "restaurang",
      cuisines: ["Svenskt/nordiskt", "Husmanskost"],
      occasions: ["middag"],
      address: "Exempelgatan 12",
      area: "Södermalm",
      city: "Stockholm",
      lat: 59.3109,
      lng: 18.074,
      addedBy: members.sam,
      addedAt: timestamp(now, -150),
      photo: "🍽️",
      notes: "Ett klassiskt stopp när hela gänget kan ses över middag.",
      origin: "provider",
      sources: [
        {
          provider: "geoapify",
          providerPlaceId: "example-provider-rundans-bistro",
          status: "active",
          firstSeenAt: timestamp(now, -150),
          lastSeenAt: timestamp(now, -1),
          validFrom: timestamp(now, -150),
          validTo: null,
        },
      ],
    }),
    examplePlace({
      id: places.repeatCafe,
      name: "Kardemummaköket",
      category: "café",
      cuisines: ["Kaffe", "Bakverk"],
      occasions: ["snabbt", "avslappnat"],
      address: "Provsmakarvägen 4",
      area: "Vasastan",
      city: "Stockholm",
      lat: 59.3408,
      lng: 18.0501,
      addedBy: members.robin,
      addedAt: timestamp(now, -138),
      photo: "☕",
      origin: "manual",
    }),
    examplePlace({
      id: places.guestReviews,
      name: "Tacoateljén",
      category: "restaurang",
      cuisines: ["Mexikanskt/latinamerikanskt", "Tacos"],
      occasions: ["avslappnat"],
      address: "Smakgränd 2",
      area: "Norrmalm",
      city: "Stockholm",
      lat: 59.335,
      lng: 18.0571,
      addedBy: members.sam,
      addedAt: timestamp(now, -112),
      photo: "🌮",
      origin: "manual",
    }),
    examplePlace({
      id: places.archivedBakery,
      name: "Brödverket 47",
      category: "bageri",
      cuisines: ["Surdeg", "Bakverk"],
      occasions: ["snabbt", "avslappnat"],
      address: "Degvägen 47",
      area: "Vasastan",
      city: "Stockholm",
      lat: 59.3406,
      lng: 18.0359,
      addedBy: members.kim,
      addedAt: timestamp(now, -94),
      photo: "🥐",
      origin: "manual",
      collectionStatus: "archived",
      archivedAt: timestamp(now, -12),
      archivedBy: members.sam,
    }),
    examplePlace({
      id: places.nextStop,
      name: "Gröna Terrassen",
      category: "restaurang",
      cuisines: ["Vegetariskt/veganskt"],
      occasions: ["avslappnat", "middag"],
      address: "Utsiktsgränd 23",
      area: "Södermalm",
      city: "Stockholm",
      lat: 59.3172,
      lng: 18.091,
      addedBy: members.alex,
      addedAt: timestamp(now, -20),
      photo: "🌿",
      notes: "Nästa stopp – utsikten och det vegetariska utbudet känns rätt för gänget.",
      origin: "manual",
    }),
    examplePlace({
      id: places.formerMemberHistory,
      name: "Köttbulleklubben",
      category: "restaurang",
      cuisines: ["Svenskt/nordiskt", "Husmanskost"],
      occasions: ["middag"],
      address: "Rundagatan 30",
      area: "Södermalm",
      city: "Stockholm",
      lat: 59.312,
      lng: 18.0814,
      addedBy: members.noor,
      addedAt: timestamp(now, -70),
      photo: "🧆",
      origin: "manual",
    }),
    examplePlace({
      id: places.limitedInfo,
      name: "Falafelfredag",
      category: "snabbmat",
      cuisines: ["Falafel", "Vegetariskt/veganskt"],
      occasions: ["snabbt", "avslappnat"],
      address: "",
      area: "Södermalm",
      city: "Stockholm",
      addedBy: members.kim,
      addedAt: timestamp(now, -48),
      photo: "🥙",
      notes: "Ett manuellt ställe där adress, webbplats och öppettider behöver kompletteras.",
      origin: "manual",
    }),
    examplePlace({
      id: places.externalError,
      name: "Smakhallen",
      category: "snabbmat",
      cuisines: ["Street food", "Internationellt"],
      occasions: ["snabbt"],
      address: "Exempelallén 25",
      area: "Norrmalm",
      city: "Stockholm",
      lat: 59.3361,
      lng: 18.0643,
      addedBy: members.alex,
      addedAt: timestamp(now, -34),
      photo: "🍜",
      origin: "manual",
    }),
    examplePlace({
      id: places.sharedVisit,
      name: "Kvartersbordet",
      category: "pub",
      cuisines: ["Svenskt/nordiskt", "Husmanskost", "Pubmat"],
      occasions: ["avslappnat", "middag"],
      address: "Gängets väg 4",
      area: "Södermalm",
      city: "Stockholm",
      lat: 59.3143,
      lng: 18.0777,
      addedBy: members.noor,
      addedAt: timestamp(now, -58),
      photo: "🍺",
      origin: "shared",
    }),
    examplePlace({
      id: places.longLayout,
      name: "Det lilla långbordet vid Tegelbackens gröna gård",
      category: "restaurang",
      cuisines: ["Medelhavsmat", "Smårätter"],
      occasions: ["avslappnat", "middag"],
      address: "Sankt Eriksgatan 123, gårdshuset längst in till vänster",
      area: "Vasastan",
      city: "Stockholm",
      lat: 59.3402,
      lng: 18.0368,
      addedBy: members.robin,
      addedAt: timestamp(now, -4),
      photo: "🍲",
      notes: "Ett avsiktligt layoutfall med långt men naturligt namn och lång adress.",
      origin: "manual",
    }),
  ];

  const exampleVisits: Visit[] = [
    exampleVisit({
      id: visits.repeatCafeLatest,
      placeId: places.repeatCafe,
      date: timestamp(now, -6),
      meal: "fika",
      participantIds: [members.alex, members.robin],
      overall: 5,
      taste: 5,
      value: 4,
      service: 5,
      comment: "En lugn fredagsfika och en riktigt bra kardemummabulle.",
      createdBy: members.alex,
      photos: [
        {
          url: "/demo-visit-photo.svg",
          uploadedBy: members.robin,
          mimeType: "image/svg+xml",
          byteSize: 5240,
          width: 1200,
          height: 800,
          createdAt: timestamp(now, -6),
          updatedAt: timestamp(now, -6),
        },
        {
          url: "/demo-visit-photo-2.svg",
          uploadedBy: members.alex,
          mimeType: "image/svg+xml",
          byteSize: 4380,
          width: 1200,
          height: 800,
          createdAt: timestamp(now, -5),
          updatedAt: timestamp(now, -5),
        },
      ],
      photo: {
        url: "/demo-visit-photo.svg",
        uploadedBy: members.robin,
        mimeType: "image/svg+xml",
        byteSize: 5240,
        width: 1200,
        height: 800,
        createdAt: timestamp(now, -6),
        updatedAt: timestamp(now, -6),
      },
    }),
    exampleVisit({
      id: visits.guestReviews,
      placeId: places.guestReviews,
      date: timestamp(now, -15),
      meal: "middag",
      participantIds: [members.alex, members.sam, members.kim],
      participants: [
        activeParticipant(members.alex, "Alex", "🦊"),
        activeParticipant(members.sam, "Sam", "🐻"),
        activeParticipant(members.kim, "Kim", "🦉"),
        {
          id: members.guestAya,
          name: "Aya",
          avatar: "🌻",
          avatarImage: null,
          status: "guest",
        },
      ],
      overall: 4.5,
      taste: 4.5,
      value: 4,
      service: 4,
      comment: "Tacos runt bordet och lagom stökig fredagskänsla.",
      createdBy: members.sam,
      visibleReviews: [
        historicalReview(
          "review-v2-alex",
          members.alex,
          "Smakerna satt och det var lätt att dela runt bordet.",
          5,
          4,
          5,
        ),
        historicalReview(
          "review-v2-sam",
          members.sam,
          "Bra tempo och generösa portioner.",
          4,
          4,
          3,
        ),
      ],
    }),
    exampleVisit({
      id: visits.formerMemberHistory,
      placeId: places.formerMemberHistory,
      date: timestamp(now, -29),
      meal: "middag",
      participantIds: [
        members.alex,
        members.sam,
        members.robin,
        members.kim,
        members.noor,
        members.formerLina,
      ],
      participants: [
        activeParticipant(members.alex, "Alex", "🦊"),
        activeParticipant(members.sam, "Sam", "🐻"),
        activeParticipant(members.robin, "Robin", "🐝"),
        activeParticipant(members.kim, "Kim", "🦉"),
        activeParticipant(members.noor, "Noor", "🐿️"),
        {
          id: members.formerLina,
          name: "Lina",
          avatar: "🦋",
          avatarImage: null,
          status: "left",
        },
      ],
      overall: 4,
      taste: 4,
      value: 3,
      service: 4,
      comment: "Första kvällen på länge med hela gänget samlat.",
      createdBy: members.noor,
    }),
    exampleVisit({
      id: visits.providerBistroFirst,
      placeId: places.providerBistro,
      date: timestamp(now, -47),
      meal: "middag",
      participantIds: [members.sam, members.robin, members.noor],
      overall: 4,
      taste: 4,
      value: 4,
      service: 4,
      createdBy: members.robin,
    }),
    exampleVisit({
      id: visits.archivedHistory,
      placeId: places.archivedBakery,
      date: timestamp(now, -62),
      meal: "frukost",
      participantIds: [members.alex, members.kim],
      overall: 5,
      taste: 5,
      value: 4,
      service: 4,
      comment: "Tidigt, varmt bröd och nästan ingen kö.",
      createdBy: members.sam,
    }),
    exampleVisit({
      id: visits.repeatCafeEarlier,
      placeId: places.repeatCafe,
      date: timestamp(now, -96),
      meal: "fika",
      participantIds: [members.alex, members.sam, members.robin],
      overall: 4,
      taste: 5,
      value: 3,
      service: 4,
      comment: "Återbesöket gjorde Kardemummaköket till ett av gruppens fikafavoriter.",
      createdBy: members.robin,
    }),
    exampleVisit({
      id: visits.limitedInfo,
      placeId: places.limitedInfo,
      date: timestamp(now, -23),
      meal: "lunch",
      participantIds: [members.sam, members.noor],
      overall: 4,
      taste: 4,
      value: 5,
      service: 4,
      createdBy: members.noor,
    }),
    exampleVisit({
      id: visits.providerBistroReturn,
      placeId: places.providerBistro,
      date: timestamp(now, -11),
      meal: "middag",
      participantIds: [members.alex, members.sam, members.noor],
      overall: 4,
      taste: 5,
      value: 3,
      service: 4,
      comment: "Återbesöket bekräftade att bistron fungerar för en större middag.",
      createdBy: members.alex,
    }),
    exampleVisit({
      id: visits.providerBistroLunch,
      placeId: places.providerBistro,
      date: timestamp(now, -35),
      meal: "lunch",
      participantIds: [members.sam, members.robin],
      overall: 5,
      taste: 5,
      value: 5,
      service: 5,
      createdBy: members.sam,
      visibleReviews: [
        historicalReview(
          "review-v10-sam",
          members.sam,
          "En ovanligt bra lunch som gör bistron värd en omväg mitt på dagen.",
          5,
          5,
          5,
        ),
      ],
    }),
    exampleVisit({
      id: visits.sharedVisit,
      placeId: places.sharedVisit,
      date: timestamp(now, -18),
      meal: "kväll",
      participantIds: [members.sam],
      participants: [activeParticipant(members.sam, "Sam", "🐻")],
      externalParticipantCount: 2,
      overall: 4,
      taste: 4,
      value: 4,
      service: 4,
      comment: "Ett delat besök där personer utanför gruppen förblir anonyma.",
      createdBy: members.sam,
      linkedBy: members.alex,
      linkedAt: timestamp(now, -17),
      linkType: "shared",
      countsForProgression: false,
      visibleReviews: [
        historicalReview(
          "review-v9-sam",
          members.sam,
          "Trevligt kvartersställe och enkelt att mötas.",
          4,
          4,
          4,
        ),
      ],
    }),
  ];

  return {
    version: APP_VERSION,
    currentUserId: members.alex,
    group: {
      id: EXAMPLE_IDS.group,
      name: "Fredagsgänget",
      emoji: "🍝",
      city: "Stockholm",
      createdAt: timestamp(now, -240),
      ownerId: members.alex,
      lifecycleStatus: "active",
      archivedAt: null,
      archivedBy: null,
      sharedVisitsCountForProgression: false,
      homeLocation: { label: "Stockholm", verified: false },
      searchAreas: [
        {
          id: "example-search-area-stockholm",
          label: "Stockholm",
          lat: 59.3293,
          lng: 18.0686,
          provider: "demo",
          placeId: "example-stockholm-centre",
        },
      ],
      defaultSearchRadiusKm: 5,
    },
    members: [
      { id: members.alex, name: "Alex", avatar: "🦊", role: "ägare" },
      { id: members.sam, name: "Sam", avatar: "🐻", role: "admin" },
      { id: members.robin, name: "Robin", avatar: "🐝", role: "medlem" },
      { id: members.kim, name: "Kim", avatar: "🦉", role: "medlem" },
      { id: members.noor, name: "Noor", avatar: "🐿️", role: "medlem" },
    ],
    places: examplePlaces,
    visits: exampleVisits,
    favorites: [
      { memberId: members.alex, placeId: places.repeatCafe },
      { memberId: members.robin, placeId: places.repeatCafe },
      { memberId: members.alex, placeId: places.nextStop },
      { memberId: members.sam, placeId: places.guestReviews },
      { memberId: members.kim, placeId: places.archivedBakery },
      { memberId: members.noor, placeId: places.limitedInfo },
      { memberId: members.sam, placeId: places.providerBistro },
    ],
    activity: [
      {
        id: "a1",
        kind: "visited",
        memberId: members.alex,
        placeId: places.repeatCafe,
        visitId: visits.repeatCafeLatest,
        at: timestamp(now, -6),
        text: "Alex registrerade ett besök på Kardemummaköket",
        target: {
          kind: "visit",
          placeId: places.repeatCafe,
          visitId: visits.repeatCafeLatest,
        },
      },
      {
        id: "a2",
        kind: "next-picked",
        memberId: members.sam,
        placeId: places.nextStop,
        at: timestamp(now, -3),
        text: "Sam valde Gröna Terrassen som nästa stopp",
        target: { kind: "place", placeId: places.nextStop },
      },
      {
        id: "a3",
        kind: "added",
        memberId: members.robin,
        placeId: places.longLayout,
        at: timestamp(now, -4),
        text: "Robin la till Det lilla långbordet vid Tegelbackens gröna gård",
        target: { kind: "place", placeId: places.longLayout },
      },
      {
        id: "a4",
        kind: "visited",
        memberId: members.sam,
        placeId: places.sharedVisit,
        visitId: visits.sharedVisit,
        at: timestamp(now, -17),
        text: "Sam delade ett besök på Kvartersbordet med gruppen",
        target: {
          kind: "visit",
          placeId: places.sharedVisit,
          visitId: visits.sharedVisit,
        },
      },
      {
        id: "a5",
        kind: "member-joined",
        memberId: members.noor,
        at: timestamp(now, -180),
        text: "Noor gick med i gänget",
        target: { kind: "member", memberId: members.noor },
      },
    ],
    nextPlaceId: places.nextStop,
    nextStopDateProposal: {
      id: EXAMPLE_IDS.nextStopProposal,
      placeId: places.nextStop,
      date: stockholmCalendarDate(now, 8),
      time: "18:30",
      createdBy: members.sam,
      status: "active",
      createdAt: timestamp(now, -2),
      updatedAt: timestamp(now, -1),
      confirmedAt: null,
      confirmedBy: null,
      cancelledAt: null,
      cancelledBy: null,
      responses: [
        { memberId: members.sam, response: "fits", updatedAt: timestamp(now, -2) },
        { memberId: members.robin, response: "unsure", updatedAt: timestamp(now, -1) },
        { memberId: members.kim, response: "not_fits", updatedAt: timestamp(now, -1) },
      ],
    },
  };
}
