import { z } from "zod";
import type { Occasion } from "./types";
import { flushNotificationOutbox } from "./notifications.functions";
import { rpcClient } from "./rpc-client";

export interface OwnVisitReviewInput {
  /** Används endast av legacy-redigering; nya reviews härleder overall server-side. */
  overall?: number | null;
  taste: number | null;
  value: number | null;
  service: number | null;
  atmosphere?: number | null;
  comment: string | null;
  /** Behövs bara när gruppens Passar för ännu saknas vid en ny på-plats-review. */
  reviewOccasions?: Occasion[];
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
    "save_own_review_for_visit_v2",
    {
      _group_id: groupId,
      _visit_id: visitId,
      _taste: input.taste,
      _value: input.value,
      _service: input.service,
      _atmosphere: input.atmosphere ?? null,
      _comment: input.comment,
      _review_occasions: input.reviewOccasions ?? null,
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
