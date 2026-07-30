/**
 * Live-mutationer: tunna wrappers över Supabase RPC:er som utför alla
 * skrivningar atomärt (matställe, besök+review, favorit, nästa stopp och datumförslag).
 *
 * Klienten skickar aldrig aktivitetsposter direkt – databasfunktionerna
 * ansvarar för att skapa dem tillsammans med den egentliga skrivningen,
 * så aktivitetsflödet håller sig konsekvent med gruppens data.
 */
import { z } from "zod";
import type { NextStopDateResponseValue, Place, Visit } from "./types";
import { rpcClient } from "./rpc-client";
import { flushNotificationOutbox } from "./notifications.functions";

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

/** Utelämna null-fält så RPC-argumenten blir konsekventa. */
function nn<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

export async function liveCreatePlace(
  groupId: string,
  input: Omit<Place, "id" | "addedAt">,
): Promise<string> {
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
  input: Omit<Visit, "id">,
): Promise<string> {
  const visitedOn = input.date.length >= 10 ? input.date.slice(0, 10) : input.date;
  const visitId = await rpcClient.call(
    "create_visit_with_review",
    {
      _group_id: groupId,
      _place_id: input.placeId,
      _visited_on: visitedOn,
      _meal_type: input.meal,
      _participant_ids: input.participantIds ?? [],
      _overall: input.overall,
      _taste: nn(input.taste),
      _value: nn(input.value),
      _service: nn(input.service),
      _comment: nn(input.comment),
    },
    ID_SCHEMA,
    "Kunde inte registrera besöket.",
  );
  scheduleNotificationFlush();
  return visitId;
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

export async function liveSetNextPlace(groupId: string, placeId: string | null): Promise<void> {
  await rpcClient.callVoid("set_next_place", {
    _group_id: groupId,
    _place_id: placeId,
  });
  scheduleNotificationFlush();
}

export async function liveProposeNextStopDate(
  groupId: string,
  date: string,
  time: string | null,
): Promise<string> {
  const proposalId = await rpcClient.call(
    "propose_next_stop_date",
    {
      _group_id: groupId,
      _proposed_date: date,
      _proposed_time: nn(time),
    },
    ID_SCHEMA,
    "Kunde inte föreslå datumet.",
  );
  scheduleNotificationFlush();
  return proposalId;
}

export async function liveRespondNextStopDate(
  groupId: string,
  proposalId: string,
  response: NextStopDateResponseValue,
): Promise<void> {
  await rpcClient.callVoid("respond_next_stop_date", {
    _group_id: groupId,
    _proposal_id: proposalId,
    _response: response,
  });
}

export async function liveSetNextStopDateStatus(
  groupId: string,
  proposalId: string,
  status: "confirmed" | "cancelled",
): Promise<void> {
  await rpcClient.callVoid("set_next_stop_date_status", {
    _group_id: groupId,
    _proposal_id: proposalId,
    _status: status,
  });
}

export async function liveUpdateNextStopDateProposal(
  groupId: string,
  proposalId: string,
  date: string,
  time: string | null,
): Promise<void> {
  await rpcClient.callVoid("update_next_stop_date_proposal", {
    _group_id: groupId,
    _proposal_id: proposalId,
    _proposed_date: date,
    _proposed_time: nn(time),
  });
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
