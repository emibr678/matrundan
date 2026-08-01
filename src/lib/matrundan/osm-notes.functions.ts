import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  composeOsmNoteText,
  findOsmNoteByReference,
  parseOsmNoteFeature,
  type OsmNoteSnapshot,
} from "./osm-notes";
import { APP_VERSION } from "./version";

const OSM_API_BASE = "https://api.openstreetmap.org/api/0.6";
const REQUEST_TIMEOUT_MS = 12_000;
const APP_URL = "https://matrundan.lovable.app";

interface RpcResponse {
  data: unknown;
  error: { message?: string } | null;
}

type RpcCall = (fn: string, args?: Record<string, unknown>) => Promise<RpcResponse>;

type OsmErrorCode =
  | "moderation_zone"
  | "rate_limit"
  | "rejected"
  | "unavailable"
  | "timeout"
  | "malformed";

class OsmRequestError extends Error {
  constructor(
    message: string,
    readonly code: OsmErrorCode,
    readonly definitive: boolean,
  ) {
    super(message);
  }
}

const prepareSchema = z.object({
  reportId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  publicText: z.string().min(20).max(1000),
  publicReference: z.string().regex(/^MR-[A-Z0-9]{10}$/),
});

const refreshSchema = z.object({
  reportId: z.string().uuid(),
  noteId: z.string().regex(/^[1-9][0-9]*$/),
  publicReference: z.string().regex(/^MR-[A-Z0-9]{10}$/),
});

export interface OsmNoteActionResult {
  noteId: string;
  noteUrl: string;
  status: "open" | "closed" | "hidden" | "unknown";
  createdAt: string | null;
  closedAt: string | null;
  checkedAt: string;
}

function headers(includeJson = false): HeadersInit {
  return {
    accept: "application/json",
    ...(includeJson ? { "content-type": "application/json" } : {}),
    "user-agent": `Matrundan/${APP_VERSION} (+${APP_URL})`,
    referer: APP_URL,
  };
}

async function fetchWithTimeout(url: URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new OsmRequestError(
        "OpenStreetMap tog för lång tid på sig. Publiceringen kan fortfarande ha nått fram.",
        "timeout",
        false,
      );
    }
    throw new OsmRequestError(
      "Kunde inte nå OpenStreetMap. Publiceringen kan fortfarande ha nått fram.",
      "unavailable",
      false,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new OsmRequestError("OpenStreetMap svarade med ett oväntat format.", "malformed", false);
  }
}

function throwForStatus(response: Response, operation: "create" | "read"): void {
  if (response.ok) return;
  if (response.status === 429) {
    throw new OsmRequestError(
      "OpenStreetMap används mycket just nu. Försök igen senare.",
      "rate_limit",
      true,
    );
  }
  if (operation === "create" && response.status === 403) {
    throw new OsmRequestError(
      "OpenStreetMap tillåter inte anonyma anteckningar på den här platsen.",
      "moderation_zone",
      true,
    );
  }
  if (operation === "create" && response.status === 400) {
    throw new OsmRequestError(
      "OpenStreetMap avvisade anteckningens text eller kartposition.",
      "rejected",
      true,
    );
  }
  throw new OsmRequestError(
    `OpenStreetMap svarade med status ${response.status}.`,
    "unavailable",
    response.status >= 400 && response.status < 500,
  );
}

async function searchExistingNote(
  publicReference: string,
  lat: number,
  lng: number,
): Promise<OsmNoteSnapshot | null> {
  const url = new URL(`${OSM_API_BASE}/notes/search.json`);
  url.searchParams.set("q", publicReference);
  url.searchParams.set("closed", "-1");
  url.searchParams.set("limit", "10");
  const response = await fetchWithTimeout(url, { method: "GET", headers: headers() });
  throwForStatus(response, "read");
  return findOsmNoteByReference(await responseJson(response), publicReference, lat, lng);
}

async function createAnonymousNote(
  lat: number,
  lng: number,
  publicText: string,
): Promise<OsmNoteSnapshot> {
  const response = await fetchWithTimeout(new URL(`${OSM_API_BASE}/notes.json`), {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({ lat, lon: lng, text: publicText }),
  });
  throwForStatus(response, "create");
  try {
    return parseOsmNoteFeature(await responseJson(response));
  } catch (error) {
    if (error instanceof OsmRequestError) throw error;
    throw new OsmRequestError(
      "OpenStreetMap svarade med ett oväntat note-format.",
      "malformed",
      false,
    );
  }
}

async function readNote(noteId: string): Promise<OsmNoteSnapshot> {
  const response = await fetchWithTimeout(new URL(`${OSM_API_BASE}/notes/${noteId}.json`), {
    method: "GET",
    headers: headers(),
  });
  if (response.status === 410) {
    return { id: noteId, status: "hidden", createdAt: null, closedAt: null };
  }
  if (response.status === 404) {
    return { id: noteId, status: "unknown", createdAt: null, closedAt: null };
  }
  throwForStatus(response, "read");
  try {
    return parseOsmNoteFeature(await responseJson(response));
  } catch (error) {
    if (error instanceof OsmRequestError) throw error;
    throw new OsmRequestError(
      "OpenStreetMap svarade med ett oväntat note-format.",
      "malformed",
      false,
    );
  }
}

function toResult(note: OsmNoteSnapshot): OsmNoteActionResult {
  return {
    noteId: note.id,
    noteUrl: `https://www.openstreetmap.org/note/${note.id}`,
    status: note.status,
    createdAt: note.createdAt,
    closedAt: note.closedAt,
    checkedAt: new Date().toISOString(),
  };
}

async function callAdminRpc(fn: string, args: Record<string, unknown>): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as RpcCall;
  const { error } = await rpc(fn, args);
  if (error) throw new Error(error.message ?? "Kunde inte spara OSM-statusen.");
}

export const publishAnonymousOsmNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        groupId: z.string().uuid(),
        reportId: z.string().uuid(),
        publicText: z.string().min(20).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<OsmNoteActionResult> => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as RpcCall;
    const prepared = await rpc("prepare_place_data_report_osm_submission_v1", {
      _group_id: data.groupId,
      _report_id: data.reportId,
      _public_text: data.publicText,
    });
    if (prepared.error) {
      throw new Error(prepared.error.message ?? "Kunde inte förbereda OSM-publiceringen.");
    }
    const submission = prepareSchema.parse(prepared.data);
    const finalText = composeOsmNoteText(submission.publicText, submission.publicReference);

    try {
      const existing = await searchExistingNote(
        submission.publicReference,
        submission.lat,
        submission.lng,
      );
      const note =
        existing ?? (await createAnonymousNote(submission.lat, submission.lng, finalText));
      await callAdminRpc("complete_place_data_report_osm_submission_v1", {
        _report_id: submission.reportId,
        _public_reference: submission.publicReference,
        _note_id: note.id,
        _note_status: note.status,
        _note_created_at: note.createdAt,
        _note_closed_at: note.closedAt,
        _public_text: finalText,
      });
      return toResult(note);
    } catch (error) {
      if (error instanceof OsmRequestError && error.definitive) {
        await callAdminRpc("fail_place_data_report_osm_submission_v1", {
          _report_id: submission.reportId,
          _public_reference: submission.publicReference,
          _error_code: error.code,
        });
      }
      throw error instanceof Error ? error : new Error("Kunde inte publicera till OpenStreetMap.");
    }
  });

export const refreshOsmNoteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        groupId: z.string().uuid(),
        reportId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<OsmNoteActionResult> => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as RpcCall;
    const refresh = await rpc("get_place_data_report_osm_refresh_v1", {
      _group_id: data.groupId,
      _report_id: data.reportId,
    });
    if (refresh.error) {
      throw new Error(refresh.error.message ?? "Kunde inte läsa OSM-kopplingen.");
    }
    const tracking = refreshSchema.parse(refresh.data);
    const note = await readNote(tracking.noteId);
    await callAdminRpc("update_place_data_report_osm_status_v1", {
      _report_id: tracking.reportId,
      _public_reference: tracking.publicReference,
      _note_id: tracking.noteId,
      _note_status: note.status,
      _note_closed_at: note.closedAt,
    });
    return toResult(note);
  });
