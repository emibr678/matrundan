import { createFileRoute, Outlet, retainSearchParams } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

const personalJourneySearchSchema = z.object({
  demo: z.literal(1).optional(),
});

export const Route = createFileRoute("/min-matresa")({
  validateSearch: zodValidator(personalJourneySearchSchema),
  search: { middlewares: [retainSearchParams(["demo"])] },
  component: PersonalJourneyLayout,
});

function PersonalJourneyLayout() {
  return <Outlet />;
}
