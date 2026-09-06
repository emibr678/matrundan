import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const serverOnlyRestriction = {
  name: "server-only",
  message:
    "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
};

const intentionalRefreshExports = [
  "usePlacePracticalInfo",
  "badgeVariants",
  "buttonVariants",
  "setPendingInvitePath",
  "consumePendingInvitePath",
  "useSession",
  "useStore",
  "formatDate",
  "googleMapsUrl",
];

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": ["error", { paths: [serverOnlyRestriction] }],
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          // These named helpers are intentionally colocated with their component/provider module.
          // Keep the rule active for every other non-component export instead of disabling it per file.
          allowExportNames: intentionalRefreshExports,
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}", "src/routes/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            serverOnlyRestriction,
            {
              name: "@/integrations/supabase/client",
              message:
                "UI och routes ska använda en domänadapter eller repository under src/lib/matrundan i stället för Supabase-klienten direkt.",
            },
            {
              name: "@/integrations/lovable",
              message:
                "UI och routes ska använda sessions- eller integrationsadaptern i stället för Lovable-klienten direkt.",
            },
          ],
          patterns: [
            {
              group: ["**/integrations/supabase/client", "**/integrations/lovable"],
              message:
                "Externa klienter får inte importeras direkt i UI eller routes. Använd en namngiven adapter eller repository.",
            },
          ],
        },
      ],
    },
  },
);
