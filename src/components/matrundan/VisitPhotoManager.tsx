import * as React from "react";
import { ImagePlus, Loader2, MoreHorizontal, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

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
  const { state, memberById, saveVisitPhoto, deleteVisitPhoto, submitting } = useStore();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const viewerRef = React.useRef<HTMLDivElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerIndex, setViewerIndex] = React.useState(0);

  const photos = getVisitPhotos(visit);
  const ownPhoto = getOwnVisitPhoto(visit, state.currentUserId);
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
        {photos.length === 1 ? "Bild från besöket" : "Bilder från besöket"}
      </h3>

      {photos.length > 0 ? (
        <div className="min-w-0">
          <div
            className={
              photos.length > 1 ? "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1" : "block"
            }
            aria-label={photos.length > 1 ? "Bilder från besöket, svep för fler" : undefined}
          >
            {photos.map((photo, index) => {
              const owner = photoOwner(visit, photo, memberById);
              const own = photo.uploadedBy === state.currentUserId;
              const canRemove = canDeleteVisitPhoto(
                visit,
                photo.uploadedBy,
                state.currentUserId,
                currentRole,
                groupArchived,
              );
              return (
                <div
                  key={`${photo.uploadedBy}:${photo.storagePath ?? photo.updatedAt}`}
                  className={photos.length > 1 ? "w-full shrink-0 snap-center" : "w-full"}
                >
                  <GalleryImage
                    photo={photo}
                    alt={`Bild från ${owner.name}`}
                    count={photos.length}
                    index={index}
                    onOpen={() => {
                      setViewerIndex(index);
                      setViewerOpen(true);
                    }}
                  />
                  <div className="mt-2 flex min-h-9 items-center justify-between gap-2 px-1">
                    <OwnerBadge {...owner} own={own} />
                    {canRemove && !own ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-muted-foreground"
                            disabled={disabled}
                            aria-label={`Fler bildalternativ för ${owner.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => void remove(photo)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Ta bort bild
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {photos.length > 1 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Svep mellan deltagarnas bilder.
            </p>
          ) : null}
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

      {file && previewUrl ? (
        <div className={photos.length > 0 ? "mt-3 space-y-2" : "space-y-2"}>
          <div className="overflow-hidden rounded-2xl border border-primary/20 bg-muted">
            <img
              src={previewUrl}
              alt="Förhandsvisning av din valda bild"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={disabled}
              onClick={clearSelection}
            >
              <X className="h-4 w-4" />
              Avbryt
            </Button>
            <Button
              type="button"
              className="min-h-11"
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
        </div>
      ) : canContribute ? (
        <div className={photos.length > 0 ? "mt-3 flex flex-wrap gap-2" : "mt-1"}>
          <Button
            type="button"
            variant={photos.length > 0 ? "outline" : "secondary"}
            className={photos.length > 0 ? "min-h-11" : "min-h-24 w-full border border-dashed"}
            disabled={disabled}
            onClick={choosePhoto}
          >
            <ImagePlus className="h-4 w-4" />
            {ownPhoto ? "Byt din bild" : "Lägg till din bild"}
          </Button>
          {ownPhoto ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 text-muted-foreground hover:text-destructive"
              disabled={disabled}
              onClick={() => void remove(ownPhoto)}
            >
              {disabled ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Ta bort din bild
            </Button>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Varje deltagare kan lägga till en privat bild från besöket. Bilderna stannar i den här
        gruppen och följer inte med om besöket delas vidare.
      </p>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Bilder från besöket</DialogTitle>
            <DialogDescription>
              {photos.length > 1
                ? "Svep mellan deltagarnas bilder."
                : "Bild från det gemensamma besöket."}
            </DialogDescription>
          </DialogHeader>
          <div ref={viewerRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto">
            {photos.map((photo, index) => {
              const owner = photoOwner(visit, photo, memberById);
              return (
                <div
                  key={`viewer:${photo.uploadedBy}:${photo.storagePath ?? photo.updatedAt}`}
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
                    {photos.length > 1 ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {index + 1} / {photos.length}
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
