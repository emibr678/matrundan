import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { rpcClient } from "./rpc-client";
import type { Role, Visit, VisitPhoto } from "./types";

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

function isGroupAdmin(role: Role | null | undefined) {
  return role === "ägare" || role === "admin";
}

export function getVisitPhotos(visit: Pick<Visit, "photos" | "photo">): VisitPhoto[] {
  const photos = visit.photos?.length ? visit.photos : visit.photo ? [visit.photo] : [];
  return [...photos].sort((a, b) => {
    const aCreated = a.createdAt ?? a.updatedAt;
    const bCreated = b.createdAt ?? b.updatedAt;
    return aCreated.localeCompare(bCreated) || a.uploadedBy.localeCompare(b.uploadedBy);
  });
}

export function getOwnVisitPhoto(
  visit: Pick<Visit, "photos" | "photo">,
  currentUserId: string,
): VisitPhoto | undefined {
  return getVisitPhotos(visit).find((photo) => photo.uploadedBy === currentUserId);
}

export function representativeVisitPhoto(
  visit: Pick<Visit, "photos" | "photo">,
): VisitPhoto | null {
  return getVisitPhotos(visit)[0] ?? null;
}

function canContributeVisitPhoto(
  visit: Pick<Visit, "linkType" | "participantIds">,
  currentUserId: string,
  _role: Role | null | undefined,
  groupArchived: boolean,
) {
  if (groupArchived || visit.linkType === "shared") return false;
  return visit.participantIds.includes(currentUserId);
}

export function canAddOrReplaceVisitPhoto(
  visit: Pick<Visit, "linkType" | "participantIds" | "photos" | "photo">,
  currentUserId: string,
  role: Role | null | undefined,
  groupArchived: boolean,
) {
  return canContributeVisitPhoto(visit, currentUserId, role, groupArchived);
}

export function canDeleteVisitPhoto(
  visit: Pick<Visit, "linkType" | "photos" | "photo">,
  targetUploadedBy: string,
  currentUserId: string,
  role: Role | null | undefined,
  groupArchived: boolean,
) {
  if (groupArchived || visit.linkType === "shared") return false;
  const targetExists = getVisitPhotos(visit).some((photo) => photo.uploadedBy === targetUploadedBy);
  if (!targetExists) return false;
  return targetUploadedBy === currentUserId || isGroupAdmin(role);
}

/** Samlad klientindikator för äldre anrop och generella affordances. */
export function canManageVisitPhoto(
  visit: Pick<Visit, "linkType" | "participantIds" | "photos" | "photo">,
  currentUserId: string,
  role: Role | null | undefined,
  groupArchived: boolean,
) {
  return (
    canAddOrReplaceVisitPhoto(visit, currentUserId, role, groupArchived) ||
    getVisitPhotos(visit).some((photo) =>
      canDeleteVisitPhoto(visit, photo.uploadedBy, currentUserId, role, groupArchived),
    )
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
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${groupId}/${visitId}/${id}.jpg`;
}

const OPTIONAL_PATH = z.string().nullable();

export async function removeVisitPhotoStoragePaths(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  const { error } = await supabase.storage.from(VISIT_PHOTO_BUCKET).remove(unique);
  if (error) console.error("[Matrundan] Kunde inte städa besöksfoto:", error);
}

async function removeStoragePath(path: string) {
  await removeVisitPhotoStoragePaths([path]);
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

export async function liveDeleteVisitPhoto(
  groupId: string,
  visitId: string,
  uploadedBy: string,
): Promise<void> {
  const previousPath = await rpcClient.call(
    "delete_visit_photo_v2",
    { _group_id: groupId, _visit_id: visitId, _uploaded_by: uploadedBy },
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
