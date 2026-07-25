import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  APP_NAME,
  APP_VERSION,
  APP_VERSION_DATE,
  CHANGELOG,
} from "@/lib/matrundan/version";

/**
 * "Om Matrundan" – aktuell version, kort sammanfattning och full
 * versionshistorik. Datat kommer från en enda källa (`version.ts`) så
 * ingen manuell synk mellan flera ställen behövs.
 */
export function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const current = CHANGELOG[0];
  const rest = CHANGELOG.slice(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-2xl">
              🍽️
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-display text-2xl">
                Om {APP_NAME}
              </DialogTitle>
              <DialogDescription>
                {APP_NAME} {APP_VERSION} · {APP_VERSION_DATE}
              </DialogDescription>
            </div>
            <Badge variant="outline" className="rounded-full">
              v{APP_VERSION}
            </Badge>
          </div>
        </DialogHeader>

        <section className="mt-2 space-y-2">
          <h3 className="text-sm font-medium">Vad är nytt</h3>
          {current.summary ? (
            <p className="text-sm text-muted-foreground">{current.summary}</p>
          ) : null}
          <div className="space-y-3">
            {current.sections.map((s) => (
              <div key={s.kind}>
                <div className="text-xs font-medium text-muted-foreground">
                  {s.kind}
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
                  {s.items.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {rest.length > 0 ? (
          <section className="mt-4">
            <h3 className="mb-1 text-sm font-medium">Tidigare versioner</h3>
            <Accordion type="single" collapsible>
              {rest.map((entry) => (
                <AccordionItem key={entry.version} value={entry.version}>
                  <AccordionTrigger className="py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        v{entry.version}
                      </Badge>
                      <span className="text-muted-foreground">{entry.date}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {entry.summary ? (
                      <p className="mb-2 text-sm text-muted-foreground">
                        {entry.summary}
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      {entry.sections.map((s) => (
                        <div key={s.kind}>
                          <div className="text-xs font-medium text-muted-foreground">
                            {s.kind}
                          </div>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
                            {s.items.map((it, i) => (
                              <li key={i}>{it}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
