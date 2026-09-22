import * as React from "react";
import { ImagePlus, Loader2, MoreHorizontal, Save, Share2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/matrundan/store";
import type { Visit, VisitPhoto } from "@/lib/matrundan/types";
import { ShareOwnVisitPhotoDialog } from "./ShareOwnVisitPhotoDialog";
import {
  canAddOrReplaceVisitPhoto,
  canDeleteVisitPhoto,
  getOwnVisitPhoto,
  getVisitPhotos,
} from "@/lib/matrundan/visit-photo";

function photoOwner(
  visit: Visit,
  photo: VisitPhoto,
  memberById: ReturnType<typeof useStore>["memberById"],
) {
  const participant = visit.participants?.find((item) => item.id === photo.uploadedBy);
  const member = memberById(photo.uploadedBy);
  return {
    name: participant?.name ?? member?.name ?? "Deltagare",
    avatar: participant?.avatar ?? member?.avatar ?? "🙂",
    avatarImage: participant?.avatarImage ?? member?.avatarImage ?? null,
  };
}

function OwnerBadge({
  name,
  avatar,
  avatarImage,
  own,
}: {
  name: string;
  avatar?: string | null;
  avatarImage?: string | null;
  own: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {avatarImage ? (
        <img src={avatarImage} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-sm"
          aria-hidden="true"
        >
          {avatar ?? "🙂"}
        </span>
      )}
      <span className="min-w-0 truncate text-xs font-medium">
        {name}
        {own ? <span className="font-normal text-muted-foreground"> · Din bild</span> : null}
      </span>
    </div>
  );
}

function GalleryImage({
  photo,
  alt,
  count,
  index,
  onOpen,
}: {
  photo: VisitPhoto;
  alt: string;
  count: number;
  index: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative block w-full overflow-hidden rounded-2xl border border-border/70 bg-muted text-left focus:outline-none focus:ring-2 focus:ring-ring"
      aria-label={`Öppna ${alt.slice(0, 1).toLocaleLowerCase("sv-SE")}${alt.slice(1)}`}
    >
      {photo.url ? (
        <img src={photo.url} alt={alt} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="grid aspect-[4/3] w-full place-items-center px-4 text-center text-sm text-muted-foreground">
          Bilden kunde inte visas.
        </div>
      )}
      {count > 1 ? (
        <span className="absolute bottom-2 right-2 rounded-full bg-background/85 px-2 py-1 text-[11px] font-medium shadow-sm backdrop-blur">
          {index + 1} / {count}
        </span>
      ) : null}
    </button>
  );
}

export function VisitPhotoManager({ visit }: { visit: Visit }) {
  const { state, mode, memberById, saveVisitPhoto, deleteVisitPhoto, submitting } = useStore();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLDivElement>(null);
  const viewerRef = React.useRef<HTMLDivElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerIndex, setViewerIndex] = React.useState(0);
  const [pendingDeletePhoto, setPendingDeletePhoto] = React.useState<VisitPhoto | null>(null);
  const [shareOwnPhotoOpen, setShareOwnPhotoOpen] = React.useState(false);

  const photos = getVisitPhotos(visit);
  const ownPhoto = getOwnVisitPhoto(visit, state.currentUserId);
  const galleryPhotos: VisitPhoto[] = photos.map((photo) =>
    photo.uploadedBy === state.currentUserId && previewUrl ? { ...photo, url: previewUrl } : photo,
  );
  if (previewUrl && !ownPhoto) {
    galleryPhotos.push({
      url: previewUrl,
      uploadedBy: state.currentUserId,
      mimeType: file?.type || "image/jpeg",
      byteSize: file?.size ?? 0,
      width: 0,
      height: 0,
      updatedAt: "preview",
    });
  }
  const pendingDeleteOwner = pendingDeletePhoto
    ? photoOwner(visit, pendingDeletePhoto, memberById).name
    : "deltagaren";
  const currentRole = state.members.find((member) => member.id === state.currentUserId)?.role;
  const groupArchived = state.group.lifecycleStatus === "archived";
  const canContribute = canAddOrReplaceVisitPhoto(
    visit,
    state.currentUserId,
    currentRole,
    groupArchived,
  );
  const disabled = busy || submitting;

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setPreviewUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  React.useEffect(() => {
    if (!previewUrl || ownPhoto) return;
    const frame = window.requestAnimationFrame(() => {
      const container = galleryRef.current;
      const target = container?.lastElementChild as HTMLElement | null;
      if (!container || !target) return;
      container.scrollTo({
        left: target.offsetLeft - container.offsetLeft,
        behavior: "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ownPhoto, previewUrl]);

  React.useEffect(() => {
    if (!viewerOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const container = viewerRef.current;
      const target = container?.children.item(viewerIndex) as HTMLElement | null;
      if (!container || !target) return;
      container.scrollTo({
        left: target.offsetLeft - container.offsetLeft,
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [viewerIndex, viewerOpen]);

  if (photos.length === 0 && !canContribute) return null;

  function choosePhoto() {
    if (!disabled) inputRef.current?.click();
  }

  function clearSelection() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function save() {
    if (!file || disabled || !canContribute) return;
    setBusy(true);
    try {
      await saveVisitPhoto(visit.id, file, visit);
      clearSelection();
      toast.success(ownPhoto ? "Din bild är uppdaterad." : "Din bild är sparad.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara bilden.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo: VisitPhoto) {
    if (disabled) return;
    const allowed = canDeleteVisitPhoto(
      visit,
      photo.uploadedBy,
      state.currentUserId,
      currentRole,
      groupArchived,
    );
    if (!allowed) return;

    setBusy(true);
    try {
      await deleteVisitPhoto(visit.id, photo.uploadedBy);
      if (photo.uploadedBy === state.currentUserId) clearSelection();
      toast.success(
        photo.uploadedBy === state.currentUserId
          ? "Din bild är borttagen."
          : "Bilden är borttagen.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte ta bort bilden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`visit-photos-${visit.id}`} className="min-w-0">
      <h3 id={`visit-photos-${visit.id}`} className="mb-2 text-sm font-medium">
        {galleryPhotos.length === 1 ? "Bild från besöket" : "Bilder från besöket"}
      </h3>

      {galleryPhotos.length > 0 ? (
        <div className="min-w-0">
          <div
            ref={galleryRef}
            className={
              galleryPhotos.length > 1
                ? "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
                : "block"
            }
            aria-label={galleryPhotos.length > 1 ? "Bilder från besöket" : undefined}
          >
            {galleryPhotos.map((photo, index) => {
              const owner = photoOwner(visit, photo, memberById);
              const own = photo.uploadedBy === state.currentUserId;
              const isEditingOwnPhoto = own && !!file && !!previewUrl;
              const canRemove = canDeleteVisitPhoto(
                visit,
                photo.uploadedBy,
                state.currentUserId,
                currentRole,
                groupArchived,
              );
              const canShareOwnPhoto = own && mode === "live" && !groupArchived;
              return (
                <div
                  key={`${photo.uploadedBy}:${photo.storagePath ?? photo.deliveryToken ?? photo.updatedAt}`}
                  role="group"
                  aria-label={`Bild från ${owner.name}${own ? ", din bild" : ""}`}
                  className={galleryPhotos.length > 1 ? "w-full shrink-0 snap-center" : "w-full"}
                >
                  <GalleryImage
                    photo={photo}
                    alt={`Bild från ${owner.name}`}
                    count={galleryPhotos.length}
                    index={index}
                    onOpen={() => {
                      setViewerIndex(index);
                      setViewerOpen(true);
                    }}
                  />
                  <div className="mt-2 flex min-h-9 items-center justify-between gap-2 px-1">
                    <OwnerBadge {...owner} own={own} />
                    {!isEditingOwnPhoto && (canRemove || (own && canContribute) || canShareOwnPhoto) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-muted-foreground"
                            disabled={disabled}
                            aria-label={
                              own
                                ? "Fler alternativ för din bild"
                                : `Fler bildalternativ för ${owner.name}`
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {own && canContribute ? (
                            <DropdownMenuItem onSelect={choosePhoto}>
                              <ImagePlus className="h-4 w-4" />
                              Byt bild
                            </DropdownMenuItem>
                          ) : null}
                          {canShareOwnPhoto ? (
                            <DropdownMenuItem onSelect={() => setShareOwnPhotoOpen(true)}>
                              <Share2 className="h-4 w-4" />
                              Dela din bild
                            </DropdownMenuItem>
                          ) : null}
                          {canRemove ? (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setPendingDeletePhoto(photo)}
                            >
                              <Trash2 className="h-4 w-4" />
                              {own ? "Ta bort din bild" : "Ta bort bild"}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                  {isEditingOwnPhoto ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11 flex-1"
                        disabled={disabled}
                        onClick={clearSelection}
                      >
                        <X className="h-4 w-4" />
                        Avbryt
                      </Button>
                      <Button
                        type="button"
                        className="min-h-11 flex-1"
                        disabled={disabled}
                        onClick={() => void save()}
                      >
                        {disabled ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {ownPhoto ? "Spara ny bild" : "Spara bild"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label={ownPhoto ? "Välj en ny bild från besöket" : "Välj bild från besöket"}
        className="sr-only"
        disabled={disabled || !canContribute}
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />

      {canContribute && !ownPhoto && !file ? (
        <div className={photos.length > 0 ? "mt-3" : "mt-1"}>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={disabled}
            onClick={choosePhoto}
          >
            <ImagePlus className="h-4 w-4" />
            Lägg till din bild
          </Button>
        </div>
      ) : null}

      <AlertDialog
        open={pendingDeletePhoto != null}
        onOpenChange={(open) => {
          if (!open && !busy) setPendingDeletePhoto(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDeletePhoto?.uploadedBy === state.currentUserId
                ? "Ta bort din bild?"
                : `Ta bort ${pendingDeleteOwner}s bild?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeletePhoto?.uploadedBy === state.currentUserId
                ? "Bilden försvinner från det här besöket för gruppen. Det går inte att ångra."
                : `Du tar bort en bild som ${pendingDeleteOwner} har lagt till. Bilden försvinner från besöket för hela gruppen och det går inte att ångra.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !pendingDeletePhoto}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                const target = pendingDeletePhoto;
                if (!target) return;
                void remove(target).then(() => setPendingDeletePhoto(null));
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Ta bort bild
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareOwnVisitPhotoDialog
        visitId={visit.id}
        currentGroupId={state.group.id}
        open={shareOwnPhotoOpen}
        onOpenChange={setShareOwnPhotoOpen}
        onShared={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("matrundan:reload"));
          }
        }}
      />

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Bilder från besöket</DialogTitle>
            <DialogDescription>
              {galleryPhotos.length > 1
                ? "Flera deltagare har lagt till bilder."
                : "Bild från det gemensamma besöket."}
            </DialogDescription>
          </DialogHeader>
          <div ref={viewerRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto">
            {galleryPhotos.map((photo, index) => {
              const owner = photoOwner(visit, photo, memberById);
              return (
                <div
                  key={`viewer:${photo.uploadedBy}:${photo.storagePath ?? photo.deliveryToken ?? photo.updatedAt}`}
                  className="w-full shrink-0 snap-center"
                >
                  <div className="overflow-hidden rounded-2xl bg-muted">
                    {photo.url ? (
                      <img
                        src={photo.url}
                        alt={`Bild från ${owner.name}`}
                        className="max-h-[68vh] w-full object-contain"
                      />
                    ) : (
                      <div className="grid min-h-64 place-items-center px-4 text-center text-sm text-muted-foreground">
                        Bilden kunde inte visas.
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 px-1">
                    <OwnerBadge {...owner} own={photo.uploadedBy === state.currentUserId} />
                    {galleryPhotos.length > 1 ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {index + 1} / {galleryPhotos.length}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
