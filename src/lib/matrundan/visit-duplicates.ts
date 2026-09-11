import { z } from "zod";
import type { Visit } from "./types";
import { rpcClient } from "./rpc-client";

const strongVisitDuplicateCandidateSchema = z.object({
  visitId: z.string().min(1),
  visitedOn: z.string().min(1),
  mealType: z.string().min(1),
  alreadyVisibleInTargetGroup: z.boolean(),
});

export type StrongVisitDuplicateCandidate = z.infer<typeof strongVisitDuplicateCandidateSchema>;

const nullableStrongVisitDuplicateCandidateSchema = strongVisitDuplicateCandidateSchema.nullable();

type LocalVisitDuplicateInput = Pick<
  Visit,
  "id" | "placeId" | "date" | "meal" | "isTakeaway" | "participantIds"
>;

export function findLocalRegistrationVisitDuplicate(
  visits: LocalVisitDuplicateInput[],
  currentUserId: string,
  placeId: string,
  visitedOn: string,
  mealType: string,
  isTakeaway = false,
): StrongVisitDuplicateCandidate | null {
  const candidate = visits
    .filter(
      (visit) =>
        visit.placeId === placeId &&
        visit.date.slice(0, 10) === visitedOn &&
        visit.meal === mealType &&
        (visit.isTakeaway === true) === isTakeaway &&
        visit.participantIds.includes(currentUserId),
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];

  if (!candidate) return null;
  return {
    visitId: candidate.id,
    visitedOn,
    mealType: candidate.meal,
    alreadyVisibleInTargetGroup: true,
  };
}

export async function findRegistrationVisitDuplicate(
  groupId: string,
  placeId: string,
  visitedOn: string,
  mealType: string,
  isTakeaway: boolean,
): Promise<StrongVisitDuplicateCandidate | null> {
  return rpcClient.call(
    "find_registration_visit_duplicate_v2",
    {
      _group_id: groupId,
      _place_id: placeId,
      _visited_on: visitedOn,
      _meal_type: mealType,
      _is_takeaway: isTakeaway,
    },
    nullableStrongVisitDuplicateCandidateSchema,
    "Kunde inte kontrollera om besöket redan finns.",
  );
}

export async function findShareVisitDuplicate(
  visitId: string,
  targetGroupId: string,
): Promise<StrongVisitDuplicateCandidate | null> {
  return rpcClient.call(
    "find_share_visit_duplicate_v2",
    {
      _visit_id: visitId,
      _target_group_id: targetGroupId,
    },
    nullableStrongVisitDuplicateCandidateSchema,
    "Kunde inte kontrollera om besöket redan finns i gruppen.",
  );
}
