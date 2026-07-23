import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { RatingInput } from "./Rating";
import { useStore } from "@/lib/matrundan/store";

const MEALS = ["frukost", "lunch", "fika", "middag", "kväll"] as const;
const MEAL_LABEL: Record<(typeof MEALS)[number], string> = {
  frukost: "Frukost",
  lunch: "Lunch",
  fika: "Fika",
  middag: "Middag",
  kväll: "Kväll",
};

export function VisitDialog({
  open,
  onOpenChange,
  placeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  placeId: string | null;
}) {
  const { addVisit, state, getPlace } = useStore();
  const place = placeId ? getPlace(placeId) : undefined;

  const [meal, setMeal] = React.useState<(typeof MEALS)[number]>("middag");
  const [date, setDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [overall, setOverall] = React.useState(4);
  const [participants, setParticipants] = React.useState<string[]>([state.currentUserId]);
  const [taste, setTaste] = React.useState(0);
  const [value, setValue] = React.useState(0);
  const [service, setService] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [showDetails, setShowDetails] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setMeal("middag");
      setDate(new Date().toISOString().slice(0, 10));
      setOverall(4);
      setParticipants([state.currentUserId]);
      setTaste(0);
      setValue(0);
      setService(0);
      setComment("");
      setShowDetails(false);
    }
  }, [open, state.currentUserId]);

  if (!place) return null;

  const toggleParticipant = (id: string) =>
    setParticipants((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const submit = () => {
    if (participants.length === 0) {
      toast.error("Välj minst en deltagare");
      return;
    }
    if (overall < 1) {
      toast.error("Ge ett helhetsbetyg");
      return;
    }
    addVisit({
      placeId: place.id,
      date: new Date(date).toISOString(),
      meal,
      participantIds: participants,
      overall,
      taste: taste || undefined,
      value: value || undefined,
      service: service || undefined,
      comment: comment.trim() || undefined,
      createdBy: state.currentUserId,
    });
    toast.success("Besök registrerat", { description: place.name });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Registrera besök</DialogTitle>
          <DialogDescription>
            {place.name} · {place.address}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Datum</Label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tillfälle</Label>
              <Select value={meal} onValueChange={(v) => setMeal(v as typeof meal)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEALS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MEAL_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Deltagare</Label>
            <div className="flex flex-wrap gap-2">
              {state.members.map((m) => {
                const active = participants.includes(m.id);
                return (
                  <button key={m.id} type="button" onClick={() => toggleParticipant(m.id)}>
                    <Badge
                      variant={active ? "default" : "outline"}
                      className="cursor-pointer gap-1 rounded-full px-3 py-1"
                    >
                      <span>{m.avatar}</span>
                      <span>{m.name}</span>
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-secondary/60 p-4">
            <RatingInput value={overall} onChange={setOverall} label="Helhetsbetyg" size={32} />
          </div>

          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-medium"
              >
                <span>Detaljbetyg (frivilligt)</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="grid gap-3">
                <RatingInput value={taste} onChange={setTaste} label="Smak" />
                <RatingInput value={value} onChange={setValue} label="Prisvärdhet" />
                <RatingInput value={service} onChange={setService} label="Service" />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-1.5">
            <Label htmlFor="comment">Kommentar (frivilligt)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="En liten minnesnotering…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={submit}>Spara besök</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
