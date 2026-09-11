import { z } from "zod";
import { flushNotificationOutbox } from "./notifications.functions";
import { rpcClient } from "./rpc-client";

export interface OwnVisitReviewInput {
  /** Null för scorelösa besök som `Något att dricka`. */
  overall: number | null;
  taste: number | null;
  value: number | null;
  service: number | null;
  comment: string | null;
}

function scheduleNotificationFlush(): void {
  void flushNotificationOutbox().catch(() => {
    /* notiser får aldrig blockera eller fela själva omdömessparningen */
  });
}

export async function saveOwnReviewForVisit(
  groupId: string,
  visitId: string,
  input: OwnVisitReviewInput,
): Promise<string> {
  const reviewId = await rpcClient.call(
    "save_own_review_for_visit_v1",
    {
      _group_id: groupId,
      _visit_id: visitId,
      _overall: input.overall,
      _taste: input.taste,
      _value: input.value,
      _service: input.service,
      _comment: input.comment,
    },
    z.string().min(1),
    "Kunde inte spara ditt omdöme.",
  );
  scheduleNotificationFlush();
  return reviewId;
}

export async function setOwnVisitParticipation(
  groupId: string,
  visitId: string,
  participating: boolean,
): Promise<void> {
  await rpcClient.callVoid("set_own_visit_participation_v1", {
    _group_id: groupId,
    _visit_id: visitId,
    _participating: participating,
  });
}
