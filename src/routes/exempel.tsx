import { createFileRoute } from "@tanstack/react-router";
import { Home } from "./index";

export const Route = createFileRoute("/exempel")({
  head: () => ({
    meta: [
      { title: "Fredagsgänget · Exempelgrupp · Matrundan" },
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
