import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "@/components/matrundan/AppShell";
import {
  LEAFLET_CSS_ID,
  LEAFLET_CSS_INTEGRITY,
  LEAFLET_CSS_URL,
  LEAFLET_SCRIPT_ID,
  LEAFLET_SCRIPT_INTEGRITY,
  LEAFLET_SCRIPT_URL,
} from "@/lib/matrundan/leaflet-global";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-6xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 font-display text-xl">Sidan hittades inte</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Länken kanske är gammal. Gå tillbaka till Matrundans hemvy.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Till Hem
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl">Något gick snett</h1>
        <p className="mt-2 text-sm text-muted-foreground">Prova att ladda om sidan.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Försök igen
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Matrundan – gruppens matställeslista" },
      {
        name: "description",
        content:
          "Matrundan är en privat matställeslista för vänner och familj. Lägg till, välj nästa stopp, registrera besök och spara gruppens egna betyg.",
      },
      { property: "og:title", content: "Matrundan – gruppens matställeslista" },
      {
        property: "og:description",
        content:
          "En privat, mysig matställeslista. Lägg till, välj, besök och betygsätt tillsammans.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: AppShell,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="sv">
      <head>
        <HeadContent />
        <link
          id={LEAFLET_CSS_ID}
          rel="stylesheet"
          href={LEAFLET_CSS_URL}
          integrity={LEAFLET_CSS_INTEGRITY}
          crossOrigin="anonymous"
        />
        <script
          id={LEAFLET_SCRIPT_ID}
          src={LEAFLET_SCRIPT_URL}
          integrity={LEAFLET_SCRIPT_INTEGRITY}
          crossOrigin="anonymous"
          defer
        />
      </head>
      <body>
        <RootProviders>{children}</RootProviders>
        <Scripts />
      </body>
    </html>
  );
}

function RootProviders({ children }: { children: ReactNode }) {
  const { queryClient } = Route.useRouteContext();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
