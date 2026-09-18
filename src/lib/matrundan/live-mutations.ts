/**
 * Live-mutationer: tunna wrappers över Supabase RPC:er som utför alla
 * skrivningar atomärt (matställe, besök+review, favorit och nästa stopp).
 *
 * Klienten skickar aldrig aktivitetsposter direkt – databasfunktionerna
 * ansvarar för att skapa dem tillsammans med den egentliga skrivningen,
 * så aktivitetsflödet håller sig konsekvent med gruppens data.
 */
import { z } from "zod";
import type { BulkPlaceAddResult, ProviderPlaceBatchInput } from "./bulk-place-add";
import { MAX_BULK_PLACE_COUNT } from "./bulk-place-add";
import { createManualPlaceFromFallback, reuseManualPlaceInGroup } from "./reusable-manual-places";
import type { Occasion, Place, Visit } from "./types";
import { rpcClient } from "./rpc-client";
import { flushNotificationOutbox } from "./notifications.functions";
import { visitMealHasScore } from "./visit-context";

/**
 * Interna mutationshintar för det manuella tilläggsflödet. De lagras aldrig på
 * Place och är bara till för att låta Store behålla sin etablerade reload-väg
 * efter lyckade live-mutationer.
 */
export type ManualPlaceMutationHints = {
  reusePlaceId?: string;
  declinedReusablePlaceIds?: string[];
};

export type VisitMutationInput = Omit<Visit, "id"> & {
  /** Endast när Passar för saknas och behöver frysas tillsammans med en ny review. */
  reviewOccasions?: Occasion[];
};

export interface VisitEditGuestInput {
  /** UUID för en redan registrerad privat gäst. Null betyder ny gäst. */
  id: string | null;
  name: string;
}

export interface VisitEditOwnReviewInput {
  id: string;
  overall: number | null;
  taste: number | null;
  value: number | null;
  service: number | null;
  atmosphere: number | null;
  comment: string | null;
}

export interface VisitEditMutationInput {
  visitedOn: string;
  meal: Visit["meal"];
  isTakeaway: boolean;
  /** Grupprelevanta deltagare. Cross-group-identiteter bevaras server-side. */
  participantIds: string[];
  guests: VisitEditGuestInput[];
  ownReview?: VisitEditOwnReviewInput | null;
}

/**
 * Notiser köas av databasen. Vi puffar på utskicket direkt efter en händelse
 * så mottagaren normalt får den inom någon sekund; det schemalagda jobbet är
 * bara ett skyddsnät om detta anrop misslyckas.
 */
function scheduleNotificationFlush(): void {
  void flushNotificationOutbox().catch(() => {
    /* notiser får aldrig blockera eller fela själva skrivningen */
  });
}

const ID_SCHEMA = z.string().min(1);
const BULK_PLACE_ADD_RESULT_SCHEMA = z.object({
  items: z.array(
    z.object({
      externalId: z.string().min(1),
      name: z.string(),
      status: z.enum(["added", "restored", "existing", "failed"]),
      placeId: z.string().nullable().optional(),
      message: z.string().nullable().optional(),
    }),
  ),
  added: z.number().int().nonnegative(),
  restored: z.number().int().nonnegative(),
  existing: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

/** Utelämna null-fält så RPC-argumenten blir konsekventa. */
function nn<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

function isMissingNextStopV2(error: unknown): boolean {
  return error instanceof Error && /could not find the function|schema cache/i.test(error.message);
}

export async function liveCreatePlace(
  groupId: string,
  input: Omit<Place, "id" | "addedAt"> & ManualPlaceMutationHints,
): Promise<string> {
  if (input.origin === "manual" || input.origin == null) {
    if (input.reusePlaceId) {
      if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
        throw new Error("Välj en verifierad plats innan ett befintligt matställe återanvänds.");
      }
      const result = await reuseManualPlaceInGroup(groupId, {
        placeId: input.reusePlaceId,
        name: input.name,
        category: input.category,
        address: input.address ?? "",
        city: input.city ?? "",
        lat: input.lat!,
        lng: input.lng!,
        occasions: input.occasions ?? [],
        notes: input.notes,
      });
      return result.placeId;
    }

    const result = await createManualPlaceFromFallback(groupId, {
      name: input.name,
      category: input.category,
      cuisines: input.cuisines ?? [],
      occasions: input.occasions ?? [],
      address: input.address ?? "",
      area: input.area,
      city: input.city ?? "",
      lat: input.lat,
      lng: input.lng,
      notes: input.notes,
      photo: input.photo,
      declinedPlaceIds: input.declinedReusablePlaceIds,
    });
    return result.placeId;
  }

  // Defensiv kompatibilitet för äldre anrop som inte är manuella. Provider-
  // flödet använder normalt liveCreateOrLinkProviderPlace med provider-ID.
  return rpcClient.call(
    "create_place_v4b",
    {
      _group_id: groupId,
      _name: input.name,
      _category: input.category,
      _cuisines: input.cuisines ?? [],
      _occasions: input.occasions ?? [],
      _address: input.address ?? "",
      _area: nn(input.area),
      _city: input.city ?? "",
      _lat: nn(input.lat),
      _lng: nn(input.lng),
      _notes: nn(input.notes),
      _photo_url: nn(input.photo),
    },
    ID_SCHEMA,
    "Kunde inte skapa matstället.",
  );
}

export async function liveCreateVisitWithReview(
  groupId: string,
  input: VisitMutationInput,
): Promise<string> {
  const visitedOn = input.date.length >= 10 ? input.date.slice(0, 10) : input.date;
  const guestNames = (input.participants ?? [])
    .filter((participant) => participant.status === "guest")
    .map((participant) => participant.name.trim())
    .filter(Boolean);
  const registrarParticipates = input.participantIds.includes(input.createdBy);
  const scored = visitMealHasScore(input.meal);
  const visitId = await rpcClient.call(
    "create_visit_with_review_v5",
    {
      _group_id: groupId,
      _place_id: input.placeId,
      _visited_on: visitedOn,
      _meal_type: input.meal,
      _participant_ids: input.participantIds ?? [],
      _is_takeaway: scored && input.isTakeaway === true,
      _taste: registrarParticipates && scored ? nn(input.taste) : null,
      _value: registrarParticipates && scored ? nn(input.value) : null,
      _service: registrarParticipates && scored ? nn(input.service) : null,
      _atmosphere: registrarParticipates && scored ? nn(input.atmosphere) : null,
      _comment: registrarParticipates ? nn(input.comment) : null,
      _guest_names: guestNames,
      _review_occasions: input.reviewOccasions ?? null,
    },
    ID_SCHEMA,
    "Kunde inte registrera besöket.",
  );
  scheduleNotificationFlush();
  return visitId;
}

export async function liveUpdateVisit(
  groupId: string,
  visitId: string,
  input: VisitEditMutationInput,
): Promise<void> {
  const visitedOn =
    input.visitedOn.length >= 10 ? input.visitedOn.slice(0, 10) : input.visitedOn;

  await rpcClient.callVoid("update_visit_v1", {
    _group_id: groupId,
    _visit_id: visitId,
    _visited_on: visitedOn,
    _meal_type: input.meal,
    _participant_ids: input.participantIds,
    _is_takeaway: input.meal === "dryck" ? false : input.isTakeaway,
    _guests: input.guests.map((guest) => ({ id: guest.id, name: guest.name })),
    _update_own_review: Boolean(input.ownReview),
    _review_id: input.ownReview?.id ?? null,
    _review_overall: input.ownReview?.overall ?? null,
    _review_taste: input.ownReview?.taste ?? null,
    _review_value: input.ownReview?.value ?? null,
    _review_service: input.ownReview?.service ?? null,
    _review_atmosphere: input.ownReview?.atmosphere ?? null,
    _review_comment: input.ownReview?.comment ?? null,
  });
}

export async function liveDeleteOriginalVisit(groupId: string, visitId: string): Promise<void> {
  await rpcClient.callVoid("delete_original_visit", {
    _group_id: groupId,
    _visit_id: visitId,
  });
}

export async function liveToggleFavorite(groupId: string, placeId: string): Promise<boolean> {
  return rpcClient.call(
    "toggle_favorite",
    {
      _group_id: groupId,
      _place_id: placeId,
    },
    z.boolean(),
  );
}

/**
 * Kompatibilitetsadapter för äldre vyer som fortfarande använder setNext.
 * Ett placeId blir ett v2-förslag: det första får automatiskt fokus och senare
 * förslag skrivs inte över. Null behåller den gamla betydelsen "rensa nästa
 * stopp" och går därför direkt via set_next_place. Om v2-RPC:n ännu inte är
 * driftsatt faller ett placeId tillfälligt tillbaka till legacy-semantiken.
 */
export async function liveSetNextPlace(groupId: string, placeId: string | null): Promise<void> {
  if (!placeId) {
    await rpcClient.callVoid("set_next_place", {
      _group_id: groupId,
      _place_id: null,
    });
    scheduleNotificationFlush();
    return;
  }

  try {
    await rpcClient.call(
      "propose_next_stop_place_v2",
      { _group_id: groupId, _place_id: placeId },
      ID_SCHEMA,
      "Kunde inte lägga till förslaget.",
    );
  } catch (error) {
    if (!isMissingNextStopV2(error)) throw error;
    await rpcClient.callVoid("set_next_place", {
      _group_id: groupId,
      _place_id: placeId,
    });
  }
  scheduleNotificationFlush();
}

/**
 * Skapa eller länka in ett externt (Geoapify-)matställe i gruppen.
 * Dubbletter förhindras i databasen via unikt index på (provider, provider_place_id).
 */
export async function liveCreateOrLinkProviderPlace(
  groupId: string,
  input: {
    provider: string;
    providerPlaceId: string;
    name: string;
    category: string;
    cuisines: string[];
    occasions: string[];
    address: string;
    area?: string;
    city: string;
    lat?: number;
    lng?: number;
    notes?: string;
    photo?: string;
    raw: unknown;
  },
): Promise<string> {
  return rpcClient.call(
    "create_or_link_provider_place_v4b",
    {
      _group_id: groupId,
      _provider: input.provider,
      _provider_place_id: input.providerPlaceId,
      _name: input.name,
      _category: input.category,
      _cuisines: input.cuisines ?? [],
      _occasions: input.occasions ?? [],
      _address: input.address ?? "",
      _area: nn(input.area),
      _city: input.city ?? "",
      _lat: nn(input.lat),
      _lng: nn(input.lng),
      _notes: nn(input.notes),
      _photo_url: nn(input.photo),
      _raw: input.raw ?? {},
    },
    ID_SCHEMA,
    "Kunde inte lägga till matstället.",
  );
}

export async function liveCreateOrLinkProviderPlacesBatch(
  groupId: string,
  items: ProviderPlaceBatchInput[],
): Promise<BulkPlaceAddResult> {
  if (items.length === 0) throw new Error("Välj minst ett matställe.");
  if (items.length > MAX_BULK_PLACE_COUNT) {
    throw new Error(`Högst ${MAX_BULK_PLACE_COUNT} matställen kan läggas till samtidigt.`);
  }

  return rpcClient.call(
    "create_or_link_provider_places_batch_v1",
    {
      _group_id: groupId,
      _items: items.map((item) => ({
        externalId: item.externalId,
        provider: item.provider,
        providerPlaceId: item.providerPlaceId,
        name: item.name,
        category: item.category,
        cuisines: item.cuisines,
        address: item.address,
        area: nn(item.area),
        city: item.city,
        lat: nn(item.lat),
        lng: nn(item.lng),
        raw: item.raw ?? {},
      })),
    },
    BULK_PLACE_ADD_RESULT_SCHEMA,
    "Kunde inte tolka resultatet från masstillägget.",
  );
}
