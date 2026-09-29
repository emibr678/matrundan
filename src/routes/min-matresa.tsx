import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/min-matresa")({
  component: PersonalJourneyLayout,
});

function PersonalJourneyLayout() {
  return <Outlet />;
}
