import { createFileRoute } from "@tanstack/react-router";
import { Home } from "./index";

export const Route = createFileRoute("/exempel")({
  head: () => ({
    meta: [
      { title: "Fredagsgänget · Exempelgrupp · Matrundan" },
      {
        name: "description",
        content:
          "Utforska Matrundan genom den skrivskyddade exempelgruppen Fredagsgänget i Stockholm.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Home,
});
