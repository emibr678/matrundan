import { createFileRoute } from "@tanstack/react-router";
import { appPageTitle } from "@/lib/app-environment";
import { Home } from "./index";

export const Route = createFileRoute("/exempel")({
  head: () => ({
    meta: [
      { title: appPageTitle("Fredagsgänget · Exempelgrupp") },
      {
        name: "description",
        content:
          "Utforska Matrundan genom den interaktiva och helt fiktiva exempelgruppen Fredagsgänget.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Home,
});
