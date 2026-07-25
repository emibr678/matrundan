/**
 * Live-repository: läser en grupps tillstånd från Supabase och mappar det
 * till appens interna AppState-format.
 *
 * OBS: I Paket 1 är detta ett read-only lager. Skrivflöden (lägg till, besök,
 * favorit, nästa stopp) hanteras fortfarande bara i demo-läget; i live-läget
 * inaktiveras de i UI:t och store-mutationerna no-op:ar med toast.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  Activity,
  AppState,
  Favorite,
  Group,
  Member,
  Occasion,
  Place,
  PlaceCategory,
  Role,
  Visit,
} from "./types";
import { APP_VERSION } from "./version";

const ROLE_LABEL: Record<string, Role> = {
  owner: "ägare",
  admin: "admin",
  member: "medlem",
};

function memberAvatar(displayName: string | null | undefined): string {
  // Enkel deterministisk fallback tills profiler har riktiga bilder.
  const pool = ["🦊", "🐻", "🐝", "🦉", "🐿️", "🦔", "🐧", "🦆", "🐢", "🦩"];
  const key = (displayName ?? "?").charCodeAt(0) || 0;
  return pool[key % pool.length];
}

export async function loadLiveState(groupId: string): Promise<AppState | null> {
  const { data: userData } = await supabase.auth.getUser();
  const currentUserId = userData.user?.id;
  if (!currentUserId) return null;

  const [groupRes, membersRes, placesRes, visitsRes, participantsRes, reviewsRes, favRes, nextRes, activityRes] =
    await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase
        .from("memberships")
        .select("user_id, role, joined_at, profiles(id, display_name, avatar_url)")
        .eq("group_id", groupId),
      supabase.from("places").select("*").eq("group_id", groupId),
      supabase.from("visits").select("*").eq("group_id", groupId),
      supabase
        .from("visit_participants")
        .select("visit_id, user_id, visits!inner(group_id)")
        .eq("visits.group_id", groupId),
      supabase.from("reviews").select("*").eq("group_id", groupId),
      supabase.from("favorites").select("*").eq("group_id", groupId),
      supabase.from("group_next_place").select("*").eq("group_id", groupId).maybeSingle(),
      supabase
        .from("activity")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (groupRes.error || !groupRes.data) {
    console.error("[Matrundan] kunde inte läsa grupp:", groupRes.error);
    return null;
  }

  const groupRow = groupRes.data;
  const group: Group = {
    id: groupRow.id,
    name: groupRow.name,
    emoji: groupRow.emoji ?? "🍽️",
    city: groupRow.home_location_label ?? "",
    createdAt: groupRow.created_at,
    ownerId: groupRow.created_by,
  };

  const members: Member[] = (membersRes.data ?? []).map((row) => {
    const p = (row as {
      profiles: { id: string; display_name: string | null; avatar_url: string | null } | null;
    }).profiles;
    const id = p?.id ?? (row as { user_id: string }).user_id;
    const name = p?.display_name?.trim() || "Medlem";
    return {
      id,
      name,
      // Paket 1: alltid deterministisk emoji-fallback. Riktig bildrendering
      // av profiles.avatar_url kommer i ett senare paket – vi vill inte att
      // en URL råkar renderas som text i medlemslistan.
      avatar: memberAvatar(name),
      role: ROLE_LABEL[(row as { role: string }).role] ?? "medlem",
    };
  });

  const places: Place[] = (placesRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category as PlaceCategory,
    cuisines: p.cuisines ?? [],
    occasions: (p.occasions ?? []) as Occasion[],
    address: p.address ?? "",
    city: p.city ?? "",
    area: p.area ?? undefined,
    lat: p.lat ?? undefined,
    lng: p.lng ?? undefined,
    addedBy: p.added_by,
    addedAt: p.created_at,
    notes: p.notes ?? undefined,
    photo: p.photo_url ?? undefined,
  }));

  const participantsByVisit = new Map<string, string[]>();
  for (const row of participantsRes.data ?? []) {
    const vId = (row as { visit_id: string }).visit_id;
    const uId = (row as { user_id: string }).user_id;
    if (!participantsByVisit.has(vId)) participantsByVisit.set(vId, []);
    participantsByVisit.get(vId)!.push(uId);
  }

  // Sammanställ betyg per besök: helhet = medel av deltagarnas overall, detaljer = medel om finns.
  const reviewsByVisit = new Map<string, { overall: number[]; taste: number[]; value: number[]; service: number[]; comment?: string }>();
  for (const r of reviewsRes.data ?? []) {
    const key = r.visit_id;
    if (!reviewsByVisit.has(key)) {
      reviewsByVisit.set(key, { overall: [], taste: [], value: [], service: [] });
    }
    const bucket = reviewsByVisit.get(key)!;
    bucket.overall.push(r.overall);
    if (r.taste != null) bucket.taste.push(r.taste);
    if (r.value != null) bucket.value.push(r.value);
    if (r.service != null) bucket.service.push(r.service);
    if (r.comment && !bucket.comment) bucket.comment = r.comment;
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

  const visits: Visit[] = (visitsRes.data ?? []).map((v) => {
    const bucket = reviewsByVisit.get(v.id);
    return {
      id: v.id,
      placeId: v.place_id,
      date: v.visited_on,
      meal: v.meal_type as Visit["meal"],
      participantIds: participantsByVisit.get(v.id) ?? [],
      overall: bucket?.overall.length ? avg(bucket.overall)! : 0,
      taste: avg(bucket?.taste ?? []),
      value: avg(bucket?.value ?? []),
      service: avg(bucket?.service ?? []),
      comment: bucket?.comment,
      createdBy: v.created_by,
    };
  });

  const favorites: Favorite[] = (favRes.data ?? []).map((f) => ({
    memberId: f.user_id,
    placeId: f.place_id,
  }));

  const activity: Activity[] = (activityRes.data ?? []).map((a) => ({
    id: a.id,
    kind: (a.kind as Activity["kind"]) ?? "added",
    memberId: a.actor_id ?? currentUserId,
    placeId: a.place_id ?? undefined,
    visitId: a.visit_id ?? undefined,
    at: a.created_at,
    text: (a.payload as { text?: string } | null)?.text ?? "Aktivitet",
  }));

  return {
    version: APP_VERSION,
    currentUserId,
    group,
    members,
    places,
    visits,
    favorites,
    activity,
    nextPlaceId: nextRes.data?.place_id ?? null,
  };
}
