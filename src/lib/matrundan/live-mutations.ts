/**
 * Live-mutationer: tunna wrappers över Supabase RPC:er som utför alla
 * skrivningar atomärt (matställe, besök+review, favorit, nästa stopp).
 *
 * Klienten skickar aldrig aktivitetsposter direkt – databasfunktionerna
 * ansvarar för att skapa dem tillsammans med den egentliga skrivningen,
 * så aktivitetsflödet håller sig konsekvent med gruppens data.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Place, Visit } from "./types";

function toRpcError(error: unknown): Error {
  const message =
    (error as { message?: string } | null)?.message ??
    "Något gick fel mot servern. Försök igen.";
  return new Error(message);
}

/** Utelämna null-fält så Supabase-typerna (som förväntar undefined) blir nöjda. */
function nn<T>(v: T | null | undefined): T | undefined {
  return v === null ? undefined : v;
}

export async function liveCreatePlace(
  groupId: string,
  input: Omit<Place, "id" | "addedAt">,
): Promise<string> {
  const { data, error } = await supabase.rpc("create_place", {
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
  });
  if (error) throw toRpcError(error);
  if (!data) throw new Error("Kunde inte skapa matstället.");
  return data as string;
}

export async function liveCreateVisitWithReview(
  groupId: string,
  input: Omit<Visit, "id">,
): Promise<string> {
  const visitedOn = input.date.length >= 10 ? input.date.slice(0, 10) : input.date;
  const { data, error } = await supabase.rpc("create_visit_with_review", {
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
  });
  if (error) throw toRpcError(error);
  if (!data) throw new Error("Kunde inte registrera besöket.");
  return data as string;
}

export async function liveToggleFavorite(
  groupId: string,
  placeId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("toggle_favorite", {
    _group_id: groupId,
    _place_id: placeId,
  });
  if (error) throw toRpcError(error);
  return Boolean(data);
}

export async function liveSetNextPlace(
  groupId: string,
  placeId: string | null,
): Promise<void> {
  // set_next_place tar emot NULL för att rensa – Supabase-typgenereringen
  // markerar dock _place_id som required, så vi castar bort undefined här.
  const { error } = await supabase.rpc("set_next_place", {
    _group_id: groupId,
    _place_id: placeId as unknown as string,
  });
  if (error) throw toRpcError(error);
}
