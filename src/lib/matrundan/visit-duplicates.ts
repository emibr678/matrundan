import { z } from "zod";
import { rpcClient } from "./rpc-client";

const strongVisitDuplicateCandidateSchema = z.object({
  visitId: z.string().min(1),
  visitedOn: z.string().min(1),
  mealType: z.string().min(1),
  alreadyVisibleInTargetGroup: z.boolean(),
});

export type StrongVisitDuplicateCandidate = z.infer<typeof strongVisitDuplicateCandidateSchema>;

const nullableStrongVisitDuplicateCandidateSchema = strongVisitDuplicateCandidateSchema.nullable();

export async function findRegistrationVisitDuplicate(
  groupId: string,
  placeId: string,
  visitedOn: string,
  mealType: string,
): Promise<StrongVisitDuplicateCandidate | null> {
  return rpcClient.call(
    "find_registration_visit_duplicate_v1",
    {
      _group_id: groupId,
      _place_id: placeId,
      _visited_on: visitedOn,
      _meal_type: mealType,
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
    "find_share_visit_duplicate_v1",
    {
      _visit_id: visitId,
      _target_group_id: targetGroupId,
    },
    nullableStrongVisitDuplicateCandidateSchema,
    "Kunde inte kontrollera om besöket redan finns i gruppen.",
  );
}
