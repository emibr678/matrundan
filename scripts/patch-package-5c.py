from pathlib import Path

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f'Kunde inte hitta ersättning i {path}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


write('src/lib/matrundan/visit-photo.ts', r'''import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { rpcClient } from "./rpc-client";
import type { Role, Visit } from "./types";

export const VISIT_PHOTO_BUCKET = "visit-photos";
export const VISIT_PHOTO_MAX_INPUT_BYTES = 15 * 1024 * 1024;
export const VISIT_PHOTO_MAX_EDGE = 1600;
export const VISIT_PHOTO_TARGET_BYTES = 700 * 1024;
export const VISIT_PHOTO_MAX_STORED_BYTES = 1_500_000;

export interface PreparedVisitPhoto {
  blob: Blob;
  mimeType: "image/jpeg";
  byteSize: number;
  width: number;
  height: number;
}

export function canManageVisitPhoto(
  visit: Pick<Visit, "linkType" | "participantIds">,
  currentUserId: string,
  role: Role | null | undefined,
  groupArchived: boolean,
) {
  if (groupArchived || visit.linkType === "shared") return false;
  return (
    visit.participantIds.includes(currentUserId) || role === "ägare" || role === "admin"
  );
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bilden kunde inte läsas. Välj en annan bild."));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Bilden kunde inte komprimeras."))),
      "image/jpeg",
      quality,
    );
  });
}

export async function prepareVisitPhoto(file: File): Promise<PreparedVisitPhoto> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Välj en bildfil.");
  }
  if (file.size > VISIT_PHOTO_MAX_INPUT_BYTES) {
    throw new Error("Bilden är för stor. Välj en bild under 15 MB.");
  }

  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("Bilden saknar giltiga dimensioner.");
  }

  const initialScale = Math.min(
    1,
    VISIT_PHOTO_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight),
  );
  let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
  let height = Math.max(1, Math.round(image.naturalHeight * initialScale));
  let lastBlob: Blob | null = null;

  for (let sizeAttempt = 0; sizeAttempt < 4; sizeAttempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Bilden kunde inte bearbetas i den här webbläsaren.");
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.86, 0.76, 0.66, 0.56]) {
      const blob = await canvasBlob(canvas, quality);
      lastBlob = blob;
      if (blob.size <= VISIT_PHOTO_TARGET_BYTES) {
        return {
          blob,
          mimeType: "image/jpeg",
          byteSize: blob.size,
          width,
          height,
        };
      }
    }

    width = Math.max(1, Math.round(width * 0.82));
    height = Math.max(1, Math.round(height * 0.82));
  }

  if (!lastBlob || lastBlob.size > VISIT_PHOTO_MAX_STORED_BYTES) {
    throw new Error("Bilden kunde inte komprimeras tillräckligt. Välj en mindre bild.");
  }
  return {
    blob: lastBlob,
    mimeType: "image/jpeg",
    byteSize: lastBlob.size,
    width,
    height,
  };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Bilden kunde inte sparas i exempelgruppen."));
    reader.readAsDataURL(blob);
  });
}

function uniquePhotoPath(groupId: string, visitId: string) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${groupId}/${visitId}/${id}.jpg`;
}

const OPTIONAL_PATH = z.string().nullable();

async function removeStoragePath(path: string) {
  const { error } = await supabase.storage.from(VISIT_PHOTO_BUCKET).remove([path]);
  if (error) console.error("[Matrundan] Kunde inte städa besöksfoto:", error);
}

export async function liveSaveVisitPhoto(
  groupId: string,
  visitId: string,
  photo: PreparedVisitPhoto,
): Promise<void> {
  const storagePath = uniquePhotoPath(groupId, visitId);
  const { error: uploadError } = await supabase.storage
    .from(VISIT_PHOTO_BUCKET)
    .upload(storagePath, photo.blob, {
      cacheControl: "3600",
      contentType: photo.mimeType,
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message || "Kunde inte ladda upp fotot.");

  try {
    const previousPath = await rpcClient.call(
      "upsert_visit_photo",
      {
        _group_id: groupId,
        _visit_id: visitId,
        _storage_path: storagePath,
        _mime_type: photo.mimeType,
        _byte_size: photo.byteSize,
        _width: photo.width,
        _height: photo.height,
      },
      OPTIONAL_PATH,
      "Servern kunde inte koppla fotot till besöket.",
    );
    if (previousPath && previousPath !== storagePath) await removeStoragePath(previousPath);
  } catch (error) {
    await removeStoragePath(storagePath);
    throw error;
  }
}

export async function liveDeleteVisitPhoto(groupId: string, visitId: string): Promise<void> {
  const previousPath = await rpcClient.call(
    "delete_visit_photo",
    { _group_id: groupId, _visit_id: visitId },
    OPTIONAL_PATH,
    "Servern kunde inte ta bort fotot från besöket.",
  );
  if (previousPath) await removeStoragePath(previousPath);
}

export async function createSignedVisitPhotoUrls(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;

  const { data, error } = await supabase.storage
    .from(VISIT_PHOTO_BUCKET)
    .createSignedUrls(unique, 6 * 60 * 60);
  if (error) {
    console.error("[Matrundan] Kunde inte signera besöksbilder:", error);
    return result;
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) result.set(item.path, item.signedUrl);
  }
  return result;
}
''')

write('src/components/matrundan/VisitPhotoField.tsx', r'''import * as React from "react";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function VisitPhotoField({
  file,
  onFileChange,
  existingUrl,
  disabled = false,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  existingUrl?: string;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setPreviewUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const shownUrl = previewUrl ?? existingUrl;

  return (
    <div className="space-y-2">
      <div>
        <Label htmlFor={inputId}>Foto från besöket (frivilligt)</Label>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Bilden beskärs inte, men komprimeras och platsmetadata tas bort innan den sparas.
        </p>
      </div>

      {shownUrl ? (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted">
          <img
            src={shownUrl}
            alt={file ? "Förhandsvisning av valt besöksfoto" : "Foto från besöket"}
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 text-sm text-muted-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ImagePlus className="h-6 w-6" />
          Lägg till ett minne från besöket
        </button>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        aria-label="Välj foto från besöket"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          onFileChange(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1 sm:flex-none"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {shownUrl ? <RotateCcw className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
          {shownUrl ? "Välj en annan bild" : "Välj foto"}
        </Button>
        {file ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={disabled}
            onClick={() => onFileChange(null)}
          >
            <X className="h-4 w-4" /> Ta bort valt foto
          </Button>
        ) : null}
      </div>
    </div>
  );
}
''')

write('src/components/matrundan/VisitPhotoManager.tsx', r'''import * as React from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/matrundan/store";
import type { Visit } from "@/lib/matrundan/types";
import { VisitPhotoField } from "./VisitPhotoField";

export function VisitPhotoManager({ visit, canManage }: { visit: Visit; canManage: boolean }) {
  const { saveVisitPhoto, deleteVisitPhoto, submitting } = useStore();
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const disabled = busy || submitting;

  if (!canManage && !visit.photo?.url) return null;

  async function save() {
    if (!file || disabled) return;
    setBusy(true);
    try {
      await saveVisitPhoto(visit.id, file);
      setFile(null);
      toast.success(visit.photo ? "Fotot är ersatt." : "Fotot är sparat.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara fotot.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (disabled) return;
    setBusy(true);
    try {
      await deleteVisitPhoto(visit.id);
      setFile(null);
      toast.success("Fotot är borttaget.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte ta bort fotot.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Foto från besöket</h3>
      {canManage ? (
        <div className="space-y-3">
          <VisitPhotoField
            file={file}
            onFileChange={setFile}
            existingUrl={visit.photo?.url}
            disabled={disabled}
          />
          {file ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                disabled={disabled}
                onClick={() => setFile(null)}
              >
                Avbryt byte
              </Button>
              <Button type="button" className="min-h-11" disabled={disabled} onClick={save}>
                {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Spara foto
              </Button>
            </div>
          ) : visit.photo ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={remove}
            >
              {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Ta bort foto
            </Button>
          ) : null}
        </div>
      ) : visit.photo?.url ? (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted">
          <img
            src={visit.photo.url}
            alt="Foto från besöket"
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
      ) : null}
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Fotot är privat för den här gruppen och följer inte med om besöket delas vidare.
      </p>
    </section>
  );
}
''')

write('src/lib/matrundan/visit-photo.test.ts', r'''import { describe, expect, test } from "bun:test";
import { canManageVisitPhoto } from "./visit-photo";

const originalVisit = { linkType: "original" as const, participantIds: ["member-1"] };

describe("behörighet för besöksfoto", () => {
  test("faktisk deltagare får hantera foto", () => {
    expect(canManageVisitPhoto(originalVisit, "member-1", "medlem", false)).toBe(true);
  });

  test("admin får hantera foto även utan deltagande", () => {
    expect(canManageVisitPhoto(originalVisit, "admin-1", "admin", false)).toBe(true);
  });

  test("vanlig medlem utan deltagande nekas", () => {
    expect(canManageVisitPhoto(originalVisit, "member-2", "medlem", false)).toBe(false);
  });

  test("delat besök och arkiverad grupp är alltid skrivskyddade", () => {
    expect(
      canManageVisitPhoto({ linkType: "shared", participantIds: ["member-1"] }, "member-1", "ägare", false),
    ).toBe(false);
    expect(canManageVisitPhoto(originalVisit, "member-1", "ägare", true)).toBe(false);
  });
});
''')

write('public/demo-visit-photo.svg', r'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" role="img" aria-labelledby="title desc">
  <title id="title">Fiktivt matminne från Fredagsgänget</title>
  <desc id="desc">Ett varmt illustrerat cafébord med kaffe och kardemummabulle.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4d9b1"/>
      <stop offset="1" stop-color="#b8684b"/>
    </linearGradient>
    <radialGradient id="coffee" cx="45%" cy="35%" r="70%">
      <stop offset="0" stop-color="#8f573b"/>
      <stop offset="1" stop-color="#3e241d"/>
    </radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#4a261d" flood-opacity=".24"/>
    </filter>
  </defs>
  <rect width="1200" height="800" fill="url(#bg)"/>
  <circle cx="1060" cy="110" r="180" fill="#f8edcf" opacity=".35"/>
  <circle cx="110" cy="690" r="230" fill="#7f9b75" opacity=".28"/>
  <rect x="110" y="150" width="980" height="540" rx="70" fill="#f7edda" opacity=".82" filter="url(#shadow)"/>
  <ellipse cx="420" cy="455" rx="220" ry="150" fill="#d7b995"/>
  <ellipse cx="420" cy="440" rx="196" ry="128" fill="#fff8ea"/>
  <path d="M300 455c36-102 180-135 248-35 48 71-17 145-105 143-91-2-174-39-143-108Z" fill="#bc7948"/>
  <path d="M330 450c26-63 116-83 165-27 35 41-8 86-70 84-62-1-117-21-95-57Z" fill="#e7a764"/>
  <path d="M370 408c34 30 62 58 82 99M423 395c28 38 50 73 63 107M478 404c19 31 32 61 38 91" fill="none" stroke="#8e4d30" stroke-width="13" stroke-linecap="round" opacity=".7"/>
  <g transform="translate(660 260)" filter="url(#shadow)">
    <ellipse cx="170" cy="255" rx="190" ry="55" fill="#b89172" opacity=".5"/>
    <rect x="20" y="40" width="275" height="230" rx="35" fill="#f4efe5"/>
    <ellipse cx="158" cy="60" rx="137" ry="55" fill="#fff"/>
    <ellipse cx="158" cy="62" rx="110" ry="39" fill="url(#coffee)"/>
    <path d="M292 95h42c78 0 78 125 0 125h-42" fill="none" stroke="#f4efe5" stroke-width="32" stroke-linecap="round"/>
    <path d="M106 42c-20-42 28-50 12-92M164 35c-14-43 30-48 19-94M218 44c-12-38 28-48 19-84" fill="none" stroke="#fff5e5" stroke-width="12" stroke-linecap="round" opacity=".75"/>
  </g>
  <text x="145" y="110" fill="#51352d" font-family="system-ui, sans-serif" font-size="34" font-weight="700">Fredagsfika i Stockholm</text>
  <text x="148" y="742" fill="#51352d" font-family="system-ui, sans-serif" font-size="25" opacity=".8">Fiktiv exempelbild · privata minnen stannar i gruppen</text>
</svg>
''')

write('supabase/migrations/20260728093000_package_5c_visit_photos.sql', r'''BEGIN;

-- Paket 5C: ett privat foto per besök och ursprungsgrupp.
-- Besöket förblir kanoniskt, men fotot följer aldrig automatiskt med till en mottagargrupp.

CREATE TABLE public.visit_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL,
  group_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  mime_type text NOT NULL CHECK (mime_type = 'image/jpeg'),
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 1500000),
  width integer NOT NULL CHECK (width > 0 AND width <= 4000),
  height integer NOT NULL CHECK (height > 0 AND height <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visit_media_visit_group_unique UNIQUE (visit_id, group_id),
  CONSTRAINT visit_media_visit_group_fk
    FOREIGN KEY (visit_id, group_id)
    REFERENCES public.visit_group_links(visit_id, group_id)
    ON DELETE CASCADE
);

CREATE INDEX visit_media_group_idx ON public.visit_media(group_id);
CREATE TRIGGER trg_visit_media_updated_at
  BEFORE UPDATE ON public.visit_media
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.visit_media ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.visit_media FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.visit_media TO authenticated;
GRANT ALL ON public.visit_media TO service_role;

CREATE POLICY "visit_media group members read"
  ON public.visit_media FOR SELECT TO authenticated
  USING (public.has_membership(group_id, auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('visit-photos', 'visit-photos', false, 1500000, ARRAY['image/jpeg']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.visit_photo_path_group(_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN NULLIF(split_part(_name, '/', 1), '')::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.visit_photo_path_visit(_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN NULLIF(split_part(_name, '/', 2), '')::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_visit_photo(
  _group_id uuid,
  _visit_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _group_id IS NOT NULL
    AND _visit_id IS NOT NULL
    AND _user_id IS NOT NULL
    AND public.group_is_active(_group_id)
    AND EXISTS (
      SELECT 1
      FROM public.visit_group_links vgl
      WHERE vgl.group_id = _group_id
        AND vgl.visit_id = _visit_id
        AND vgl.link_type = 'original'
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.visit_participants vp
        WHERE vp.visit_id = _visit_id AND vp.user_id = _user_id
      )
      OR public.has_group_role(_group_id, _user_id, ARRAY['owner','admin'])
    );
$function$;

REVOKE ALL ON FUNCTION public.visit_photo_path_group(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.visit_photo_path_visit(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_visit_photo(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.visit_photo_path_group(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.visit_photo_path_visit(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_visit_photo(uuid, uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "visit photos members read" ON storage.objects;
CREATE POLICY "visit photos members read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'visit-photos'
    AND EXISTS (
      SELECT 1 FROM public.visit_media vm
      WHERE vm.storage_path = name
        AND public.has_membership(vm.group_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "visit photos allowed upload" ON storage.objects;
CREATE POLICY "visit photos allowed upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'visit-photos'
    AND public.can_manage_visit_photo(
      public.visit_photo_path_group(name),
      public.visit_photo_path_visit(name),
      auth.uid()
    )
  );

DROP POLICY IF EXISTS "visit photos allowed delete" ON storage.objects;
CREATE POLICY "visit photos allowed delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'visit-photos'
    AND public.can_manage_visit_photo(
      public.visit_photo_path_group(name),
      public.visit_photo_path_visit(name),
      auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.upsert_visit_photo(
  _group_id uuid,
  _visit_id uuid,
  _storage_path text,
  _mime_type text,
  _byte_size integer,
  _width integer,
  _height integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _previous_path text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_manage_visit_photo(_group_id, _visit_id, _uid) THEN
    RAISE EXCEPTION 'Du saknar behörighet att ändra fotot för det här besöket';
  END IF;
  IF public.visit_photo_path_group(_storage_path) IS DISTINCT FROM _group_id
     OR public.visit_photo_path_visit(_storage_path) IS DISTINCT FROM _visit_id
     OR lower(right(_storage_path, 4)) <> '.jpg' THEN
    RAISE EXCEPTION 'Ogiltig lagringssökväg för besöksfoto';
  END IF;
  IF _mime_type <> 'image/jpeg' THEN RAISE EXCEPTION 'Endast komprimerade JPEG-bilder stöds'; END IF;
  IF _byte_size <= 0 OR _byte_size > 1500000 THEN RAISE EXCEPTION 'Fotot är för stort'; END IF;
  IF _width <= 0 OR _height <= 0 OR _width > 4000 OR _height > 4000 THEN
    RAISE EXCEPTION 'Ogiltiga bilddimensioner';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'visit-photos' AND name = _storage_path
  ) THEN
    RAISE EXCEPTION 'Den uppladdade bilden saknas';
  END IF;

  SELECT storage_path INTO _previous_path
  FROM public.visit_media
  WHERE visit_id = _visit_id AND group_id = _group_id
  FOR UPDATE;

  INSERT INTO public.visit_media (
    visit_id, group_id, storage_path, uploaded_by, mime_type, byte_size, width, height
  ) VALUES (
    _visit_id, _group_id, _storage_path, _uid, _mime_type, _byte_size, _width, _height
  )
  ON CONFLICT (visit_id, group_id) DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    uploaded_by = EXCLUDED.uploaded_by,
    mime_type = EXCLUDED.mime_type,
    byte_size = EXCLUDED.byte_size,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    updated_at = now();

  RETURN _previous_path;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_visit_photo(_group_id uuid, _visit_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _previous_path text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_manage_visit_photo(_group_id, _visit_id, _uid) THEN
    RAISE EXCEPTION 'Du saknar behörighet att ta bort fotot för det här besöket';
  END IF;

  DELETE FROM public.visit_media
  WHERE visit_id = _visit_id AND group_id = _group_id
  RETURNING storage_path INTO _previous_path;

  RETURN _previous_path;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_visit_photo(uuid, uuid, text, text, integer, integer, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_visit_photo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_visit_photo(uuid, uuid, text, text, integer, integer, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_visit_photo(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_group_app_state_v5c(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
  _visits jsonb;
BEGIN
  _result := public.get_group_app_state_v4b(_group_id);

  SELECT COALESCE(
    jsonb_agg(
      visit_item || jsonb_build_object(
        'photo', (
          SELECT jsonb_build_object(
            'storagePath', vm.storage_path,
            'uploadedBy', vm.uploaded_by,
            'mimeType', vm.mime_type,
            'byteSize', vm.byte_size,
            'width', vm.width,
            'height', vm.height,
            'updatedAt', vm.updated_at
          )
          FROM public.visit_media vm
          WHERE vm.visit_id = (visit_item->>'id')::uuid
            AND vm.group_id = _group_id
        )
      )
      ORDER BY ordinal
    ),
    '[]'::jsonb
  )
  INTO _visits
  FROM jsonb_array_elements(COALESCE(_result->'visits', '[]'::jsonb))
    WITH ORDINALITY AS visit_rows(visit_item, ordinal);

  RETURN jsonb_set(_result, '{visits}', COALESCE(_visits, '[]'::jsonb), true);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_group_app_state_v5c(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_app_state_v5c(uuid) TO authenticated;

COMMIT;
''')

# types.ts
replace_once(
    'src/lib/matrundan/types.ts',
    'export interface Visit {\n',
    '''export interface VisitPhoto {\n  /** Kortlivad signerad URL i live-läge eller data-/asset-URL i demo. */\n  url?: string;\n  storagePath?: string;\n  uploadedBy: string;\n  mimeType: string;\n  byteSize: number;\n  width: number;\n  height: number;\n  updatedAt: string;\n}\n\nexport interface Visit {\n''',
)
replace_once(
    'src/lib/matrundan/types.ts',
    '  createdBy: string;\n  /** original = besöket registrerades i denna grupp; shared = tillagt från annan grupp. */',
    '  createdBy: string;\n  /** Privat foto för just den aktiva gruppens koppling till besöket. */\n  photo?: VisitPhoto | null;\n  /** original = besöket registrerades i denna grupp; shared = tillagt från annan grupp. */',
)

# store.tsx
replace_once(
    'src/lib/matrundan/store.tsx',
    'import { APP_VERSION } from "./version";\n',
    '''import { APP_VERSION } from "./version";\nimport {\n  blobToDataUrl,\n  canManageVisitPhoto,\n  liveDeleteVisitPhoto,\n  liveSaveVisitPhoto,\n  prepareVisitPhoto,\n} from "./visit-photo";\n''',
)
replace_once(
    'src/lib/matrundan/store.tsx',
    '  addVisit: (visit: Omit<Visit, "id">) => Promise<Visit>;\n  setNext:',
    '  addVisit: (visit: Omit<Visit, "id">) => Promise<Visit>;\n  saveVisitPhoto: (visitId: string, file: File) => Promise<void>;\n  deleteVisitPhoto: (visitId: string) => Promise<void>;\n  setNext:',
)
replace_once(
    'src/lib/matrundan/store.tsx',
    '''        return visit;\n      },\n\n      setNext: async (placeId) => {''',
    '''        return visit;\n      },\n\n      saveVisitPhoto: async (visitId, file) => {\n        const visit = state.visits.find((item) => item.id === visitId);\n        if (!visit) throw new Error("Besöket finns inte.");\n        const role = state.members.find((member) => member.id === state.currentUserId)?.role;\n        if (\n          !canManageVisitPhoto(\n            visit,\n            state.currentUserId,\n            role,\n            state.group.lifecycleStatus === "archived",\n          )\n        ) {\n          throw new Error("Du saknar behörighet att ändra fotot för det här besöket.");\n        }\n        const prepared = await prepareVisitPhoto(file);\n        if (mode === "live") {\n          await runLive((groupId) => liveSaveVisitPhoto(groupId, visitId, prepared));\n          return;\n        }\n        assertDemoWritable(state, demoReadOnly);\n        const url = await blobToDataUrl(prepared.blob);\n        const updatedAt = new Date().toISOString();\n        setState((current) => ({\n          ...current,\n          visits: current.visits.map((item) =>\n            item.id === visitId\n              ? {\n                  ...item,\n                  photo: {\n                    url,\n                    uploadedBy: current.currentUserId,\n                    mimeType: prepared.mimeType,\n                    byteSize: prepared.byteSize,\n                    width: prepared.width,\n                    height: prepared.height,\n                    updatedAt,\n                  },\n                }\n              : item,\n          ),\n        }));\n      },\n\n      deleteVisitPhoto: async (visitId) => {\n        const visit = state.visits.find((item) => item.id === visitId);\n        if (!visit) throw new Error("Besöket finns inte.");\n        const role = state.members.find((member) => member.id === state.currentUserId)?.role;\n        if (\n          !canManageVisitPhoto(\n            visit,\n            state.currentUserId,\n            role,\n            state.group.lifecycleStatus === "archived",\n          )\n        ) {\n          throw new Error("Du saknar behörighet att ta bort fotot för det här besöket.");\n        }\n        if (mode === "live") {\n          await runLive((groupId) => liveDeleteVisitPhoto(groupId, visitId));\n          return;\n        }\n        assertDemoWritable(state, demoReadOnly);\n        setState((current) => ({\n          ...current,\n          visits: current.visits.map((item) =>\n            item.id === visitId ? { ...item, photo: null } : item,\n          ),\n        }));\n      },\n\n      setNext: async (placeId) => {''',
)

# live-repository.ts
replace_once(
    'src/lib/matrundan/live-repository.ts',
    'import { APP_VERSION } from "./version";\n',
    'import { APP_VERSION } from "./version";\nimport { createSignedVisitPhotoUrls } from "./visit-photo";\n',
)
replace_once(
    'src/lib/matrundan/live-repository.ts',
    '  reviews: ReviewRow[];\n};',
    '''  reviews: ReviewRow[];\n  photo: {\n    storagePath: string;\n    uploadedBy: string;\n    mimeType: string;\n    byteSize: number;\n    width: number;\n    height: number;\n    updatedAt: string;\n  } | null;\n};''',
)
replace_once(
    'src/lib/matrundan/live-repository.ts',
    '''  const { data, error } = await supabase.rpc("get_group_app_state_v4b" as "get_group_app_state", {\n    _group_id: groupId,\n  });\n  if (error || !data) {\n    console.error("[Matrundan] get_group_app_state_v4b:", error);''',
    '''  const { data, error } = await supabase.rpc("get_group_app_state_v5c" as "get_group_app_state", {\n    _group_id: groupId,\n  });\n  if (error || !data) {\n    console.error("[Matrundan] get_group_app_state_v5c:", error);''',
)
replace_once(
    'src/lib/matrundan/live-repository.ts',
    '  const visits: Visit[] = p.visits.map((v) => {\n',
    '''  const signedPhotoUrls = await createSignedVisitPhotoUrls(\n    p.visits.flatMap((visit) => (visit.photo?.storagePath ? [visit.photo.storagePath] : [])),\n  );\n\n  const visits: Visit[] = p.visits.map((v) => {\n''',
)
replace_once(
    'src/lib/matrundan/live-repository.ts',
    '      createdBy: v.createdBy,\n      linkType: v.linkType,',
    '''      createdBy: v.createdBy,\n      photo: v.photo\n        ? {\n            ...v.photo,\n            url: signedPhotoUrls.get(v.photo.storagePath),\n          }\n        : null,\n      linkType: v.linkType,''',
)

# VisitDialog.tsx
replace_once(
    'src/components/matrundan/VisitDialog.tsx',
    'import { ShareVisitDialog } from "./ShareVisitDialog";\n',
    'import { ShareVisitDialog } from "./ShareVisitDialog";\nimport { VisitPhotoField } from "./VisitPhotoField";\n',
)
replace_once(
    'src/components/matrundan/VisitDialog.tsx',
    '  const { addVisit, state, getPlace, submitting, mode } = useStore();',
    '  const { addVisit, saveVisitPhoto, state, getPlace, submitting, mode } = useStore();',
)
replace_once(
    'src/components/matrundan/VisitDialog.tsx',
    '  const [showDetails, setShowDetails] = React.useState(false);\n',
    '  const [showDetails, setShowDetails] = React.useState(false);\n  const [photoFile, setPhotoFile] = React.useState<File | null>(null);\n',
)
replace_once(
    'src/components/matrundan/VisitDialog.tsx',
    '      setShowDetails(false);\n',
    '      setShowDetails(false);\n      setPhotoFile(null);\n',
)
replace_once(
    'src/components/matrundan/VisitDialog.tsx',
    '''      toast.success("Besök registrerat", { description: place.name });\n      onOpenChange(false);\n      if (thenShare && activeGroupId && created?.id) {''',
    '''      let photoError: Error | null = null;\n      if (photoFile && created?.id) {\n        try {\n          await saveVisitPhoto(created.id, photoFile);\n        } catch (error) {\n          photoError = error instanceof Error ? error : new Error("Fotot kunde inte sparas.");\n        }\n      }\n      toast.success("Besök registrerat", { description: place.name });\n      onOpenChange(false);\n      if (photoError) {\n        toast.warning("Besöket sparades utan foto.", { description: photoError.message });\n      }\n      if (thenShare && activeGroupId && created?.id) {''',
)
replace_once(
    'src/components/matrundan/VisitDialog.tsx',
    '''          <div className="space-y-1.5">\n            <Label htmlFor="comment">Kommentar (frivilligt)</Label>''',
    '''          <VisitPhotoField file={photoFile} onFileChange={setPhotoFile} disabled={isBusy} />\n\n          <div className="space-y-1.5">\n            <Label htmlFor="comment">Kommentar (frivilligt)</Label>''',
)

# VisitDetailSheet.tsx
replace_once(
    'src/components/matrundan/VisitDetailSheet.tsx',
    'import { EditReviewDialog } from "./EditReviewDialog";\n',
    '''import { EditReviewDialog } from "./EditReviewDialog";\nimport { VisitPhotoManager } from "./VisitPhotoManager";\nimport { canManageVisitPhoto } from "@/lib/matrundan/visit-photo";\n''',
)
replace_once(
    'src/components/matrundan/VisitDetailSheet.tsx',
    '  const canShare = !groupArchived && isLive && !!visit && isParticipant && activeGroupCount >= 2;\n',
    '''  const canShare = !groupArchived && isLive && !!visit && isParticipant && activeGroupCount >= 2;\n  const currentRole = state.members.find((member) => member.id === state.currentUserId)?.role;\n  const canManagePhoto = !!visit && canManageVisitPhoto(\n    visit,\n    state.currentUserId,\n    currentRole,\n    groupArchived,\n  );\n''',
)
replace_once(
    'src/components/matrundan/VisitDetailSheet.tsx',
    '              <div className="space-y-4 p-5">\n                <Card className="rounded-2xl border-border/70 p-4">',
    '              <div className="space-y-4 p-5">\n                <VisitPhotoManager visit={visit} canManage={canManagePhoto} />\n\n                <Card className="rounded-2xl border-border/70 p-4">',
)

# Place detail visit thumbnail
replace_once(
    'src/routes/matstallen.$placeId.tsx',
    '''                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-lg">\n                      {author?.avatar ?? "🙂"}\n                    </div>''',
    '''                    {visit.photo?.url ? (\n                      <img\n                        src={visit.photo.url}\n                        alt=""\n                        className="h-16 w-20 shrink-0 rounded-xl border border-border/70 object-cover"\n                      />\n                    ) : (\n                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-lg">\n                        {author?.avatar ?? "🙂"}\n                      </div>\n                    )}''',
)

# Example photo
replace_once(
    'src/lib/matrundan/example-data.ts',
    '      comment: "En lugn fredagsfika och en riktigt bra kardemummabulle.",\n      createdBy: "m1",',
    '''      comment: "En lugn fredagsfika och en riktigt bra kardemummabulle.",\n      createdBy: "m1",\n      photo: {\n        url: "/demo-visit-photo.svg",\n        uploadedBy: "m1",\n        mimeType: "image/svg+xml",\n        byteSize: 5240,\n        width: 1200,\n        height: 800,\n        updatedAt: daysAgo(6),\n      },''',
)

write('tests/e2e/package-5c.spec.ts', r'''import { expect, test, type Page } from "@playwright/test";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAD0lEQVR4nGP4z8DAwMAAAAYAAeIhvDMAAAAASUVORK5CYII=",
  "base64",
);

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(metrics.scroll, `${context}: ingen horisontell overflow`).toBeLessThanOrEqual(metrics.client);
}

test("ett besöksfoto sparas privat i demosessionen och kan tas bort", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript(() => {
    localStorage.removeItem("matrundan.state.v1");
    sessionStorage.clear();
  });
  await page.goto("/matstallen/p2?demo=1");

  await page.getByRole("button", { name: "Registrera besök" }).first().click();
  const visitDialog = page.getByRole("dialog", { name: "Registrera besök" });
  await expect(visitDialog).toBeVisible();
  await visitDialog.getByLabel("Välj foto från besöket").setInputFiles({
    name: "fredagsfika.png",
    mimeType: "image/png",
    buffer: PNG_1PX,
  });
  await expect(visitDialog.getByAltText("Förhandsvisning av valt besöksfoto")).toBeVisible();
  await expectNoHorizontalOverflow(page, "Besöksdialog med bildförhandsvisning");

  await visitDialog.getByRole("button", { name: "Spara besök" }).click();
  await expect(visitDialog).toBeHidden();

  const newestVisit = page.getByRole("button", { name: /Öppna besök av Alex/ }).first();
  await newestVisit.click();
  await expect(page.getByAltText("Foto från besöket").first()).toBeVisible();
  await expect(page.getByText(/Fotot är privat för den här gruppen/)).toBeVisible();
  await expectNoHorizontalOverflow(page, "Besöksdetalj med foto");

  await page.reload();
  await page.getByRole("button", { name: /Öppna besök av Alex/ }).first().click();
  await expect(page.getByAltText("Foto från besöket").first()).toBeVisible();

  await page.getByRole("button", { name: "Ta bort foto" }).click();
  await expect(page.getByAltText("Foto från besöket")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Lägg till ett minne från besöket/ })).toBeVisible();
});
''')

print('Paket 5C-patch applicerad.')
