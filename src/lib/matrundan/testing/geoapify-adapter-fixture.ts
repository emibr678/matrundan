import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import type { MultiAreaSearchResponse } from "../geoapify.functions";
import type { PlaceSuggestion } from "../places-provider";
const stockholm = { id: "stockholm", label: "Stockholm", lat: 59.3251172, lng: 18.0710935 };
export type FixtureResponse = { features: unknown[]; status?: number };
export type SearchInput = {
  text: string;
  intentMode?: "auto" | "literal";
  selectedFilter?: { kind: "food-tag" | "category"; id: string };
  centers: Array<typeof stockholm & { searchMode?: "point" | "boundary"; placeId?: string }>;
  radiusKm: 1 | 2 | 5 | 25 | null;
  limit?: number;
  offset?: number;
  areaOffsets?: Record<string, number>;
  streamCursors?: Record<string, import("../geoapify-catalogue-search").SearchStreamCursor>;
  exhaustedAreaIds?: string[];
  searchPhase?: "primary" | "recovery" | "complete" | "hints";
  providerRequestLimit?: number;
  providerCreditLimit?: number;
};

/** Execute the actual server handlers with only framework/auth and HTTP stubs.
 * Each VM has its own provider caches and fixture-only environment; no global
 * mock.module or process.env mutation leaks into other tests. Auth is covered
 * by its own middleware tests, not by this provider contract suite.
 */
export type FixtureContext = {
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null }>;
  };
};

export function adapter(
  response: (url: URL) => FixtureResponse | Promise<FixtureResponse>,
  context?: FixtureContext,
  directory = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
) {
  const calls: URL[] = [];
  const modules = new Map<string, { exports: Record<string, unknown> }>();
  function load(file: string): Record<string, unknown> {
    const cached = modules.get(file);
    if (cached) return cached.exports;
    const module = { exports: {} as Record<string, unknown> };
    modules.set(file, module);
    const source = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    runInNewContext(
      source,
      {
        module,
        exports: module.exports,
        URL,
        AbortController,
        DOMException,
        performance,
        setTimeout,
        clearTimeout,
        process: { env: { GEOAPIFY_API_KEY: "fixture-only-secret" } },
        fetch: async (input: URL) => {
          const url = new URL(input);
          const safe = new URL(url);
          safe.searchParams.delete("apiKey");
          calls.push(safe);
          const result = await response(url);
          const status = result.status ?? 200;
          return { status, ok: status === 200, json: async () => ({ features: result.features }) };
        },
        require: (specifier: string) => {
          if (specifier === "node:async_hooks") return { AsyncLocalStorage };
          if (specifier === "zod") return { z };
          if (specifier === "@/integrations/supabase/auth-middleware")
            return { requireSupabaseAuth: {} };
          if (specifier === "@tanstack/react-start")
            return {
              createServerFn: () => {
                let parse = (input: unknown) => input;
                const builder = {
                  middleware: () => builder,
                  validator: (validate: typeof parse) => {
                    parse = validate;
                    return builder;
                  },
                  handler:
                    (handle: (args: { data: unknown; context?: FixtureContext }) => unknown) =>
                    (args: { data: unknown }) =>
                      handle({ data: parse(args.data), context }),
                };
                return builder;
              },
            };
          if (!specifier.startsWith("."))
            throw new Error(`Unexpected test dependency: ${specifier}`);
          return load(resolve(dirname(file), specifier + ".ts"));
        },
      },
      { filename: file },
    );
    return module.exports;
  }
  const functions = load(resolve(directory, "geoapify.functions.ts"));
  const hintsResponse = (
    input: Pick<SearchInput, "text" | "centers" | "radiusKm"> & { includeDistant?: boolean },
  ) =>
    (
      functions.searchPlaceNameHints as (args: {
        data: typeof input & { groupId: string };
      }) => Promise<import("../geoapify.functions").PlaceNameHintsResponse>
    )({
      data: { ...input, groupId: "38910000-0000-4000-8000-000000000001" },
    });
  return {
    calls,
    hintsResponse,
    hints: async (input: Parameters<typeof hintsResponse>[0]) => (await hintsResponse(input)).hints,
    resolveHint: (input: { placeId: string; name: string; lat: number; lng: number }) =>
      (
        functions.resolvePlaceNameHint as (args: {
          data: typeof input & { groupId: string };
        }) => Promise<PlaceSuggestion>
      )({
        data: { ...input, groupId: "38910000-0000-4000-8000-000000000001" },
      }),
    multi: (input: SearchInput) =>
      (
        functions.geoapifySearchPlacesMulti as (args: {
          data: SearchInput;
        }) => Promise<MultiAreaSearchResponse>
      )({ data: input }),
    discovery: (input: SearchInput) =>
      (
        functions.searchPlaceDiscovery as (args: {
          data: SearchInput & { groupId: string };
        }) => Promise<
          Omit<MultiAreaSearchResponse, "results"> & {
            results: PlaceSuggestion[];
            canConfirm: boolean;
            budgetUsage: { requests: number; reservedCredits: number; limited: boolean };
          }
        >
      )({ data: { ...input, groupId: "38910000-0000-4000-8000-000000000001" } }),
  };
}
