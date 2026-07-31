import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  FOOD_TAG_GROUP_LABEL,
  FOOD_TAGS,
  findFoodTag,
  foodTagSearchValue,
  normalizeFoodTags,
  type FoodTagGroup,
} from "@/lib/matrundan/food-tags";
import { cn } from "@/lib/utils";

interface FoodTagMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  description?: string;
}

interface FoodTagOptionsProps {
  knownLabels: Set<string>;
  onToggle: (label: string) => void;
  mobile?: boolean;
}

const GROUPS: FoodTagGroup[] = ["cuisine", "specialty"];

function FoodTagOptions({ knownLabels, onToggle, mobile = false }: FoodTagOptionsProps) {
  return (
    <Command className={cn(mobile && "flex min-h-0 flex-1 flex-col rounded-none")}>
      <CommandInput placeholder="Sök kök eller inriktning…" />
      <CommandList
        className={cn(
          mobile
            ? "min-h-0 flex-1 max-h-none overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "max-h-[min(22rem,60vh)]",
        )}
      >
        <CommandEmpty>Ingen matchande etikett.</CommandEmpty>
        {GROUPS.map((group) => (
          <CommandGroup key={group} heading={FOOD_TAG_GROUP_LABEL[group]}>
            {FOOD_TAGS.filter((tag) => tag.group === group).map((tag) => {
              const active = knownLabels.has(tag.label);
              return (
                <CommandItem
                  key={tag.id}
                  value={foodTagSearchValue(tag)}
                  onSelect={() => onToggle(tag.label)}
                  className={cn(mobile && "min-h-11 py-2.5")}
                >
                  <Check className={cn("h-4 w-4", active ? "opacity-100" : "opacity-0")} />
                  <span>{tag.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
}

export function FoodTagMultiSelect({
  value,
  onChange,
  disabled = false,
  id = "food-tags",
  label = "Kök och inriktning",
  description,
}: FoodTagMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const selected = React.useMemo(() => normalizeFoodTags(value), [value]);
  const knownLabels = React.useMemo(
    () =>
      new Set(selected.filter((item) => findFoodTag(item)).map((item) => findFoodTag(item)!.label)),
    [selected],
  );

  function toggle(labelValue: string) {
    const tag = findFoodTag(labelValue);
    if (!tag) return;
    const exists = knownLabels.has(tag.label);
    onChange(
      exists
        ? selected.filter((item) => findFoodTag(item)?.label !== tag.label)
        : [...selected, tag.label],
    );
  }

  function remove(item: string) {
    onChange(selected.filter((candidate) => candidate !== item));
  }

  const trigger = (
    <Button
      id={id}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      className="min-h-11 w-full min-w-0 justify-between gap-2 overflow-hidden px-3 text-left font-normal"
    >
      <span className="min-w-0 flex-1 truncate">
        {selected.length > 0
          ? `${selected.length} ${selected.length === 1 ? "val" : "valda"}`
          : "Välj kök och inriktning"}
      </span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  return (
    <div className="min-w-0 space-y-2">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {isMobile ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>{trigger}</DialogTrigger>
          <DialogContent
            data-testid="food-tag-mobile-dialog"
            className="left-0 top-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none"
          >
            <div className="flex min-h-0 h-full flex-col">
              <DialogHeader className="shrink-0 border-b px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] pr-12 text-left">
                <DialogTitle>{label}</DialogTitle>
                <DialogDescription>
                  Sök eller bläddra. Du kan välja flera alternativ och stänga när du är klar.
                </DialogDescription>
              </DialogHeader>
              <FoodTagOptions knownLabels={knownLabels} onToggle={toggle} mobile />
              <div className="shrink-0 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                <Button type="button" className="min-h-11 w-full" onClick={() => setOpen(false)}>
                  Klar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-0"
          >
            <FoodTagOptions knownLabels={knownLabels} onToggle={toggle} />
          </PopoverContent>
        </Popover>
      )}

      {selected.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-1.5" aria-label="Valda kök och inriktningar">
          {selected.map((item) => {
            const known = Boolean(findFoodTag(item));
            return (
              <Badge
                key={item}
                variant={known ? "secondary" : "outline"}
                className="max-w-full gap-1 rounded-full pr-1"
              >
                <span className="truncate">{item}</span>
                {!disabled ? (
                  <button
                    type="button"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => remove(item)}
                    aria-label={`Ta bort ${item}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </Badge>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
