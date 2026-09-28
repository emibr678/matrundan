import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { APP_NAME, APP_VERSION, APP_VERSION_DATE, CHANGELOG } from "@/lib/matrundan/version";

export function AboutContent() {
  const current = CHANGELOG[0];
  const rest = CHANGELOG.slice(1);

  return (
    <div className="space-y-5">
      <section className="space-y-4">
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            Matrundan är till för vänner, familjer och andra grupper som vill upptäcka, prova och
            minnas matställen tillsammans.
          </p>
          <p>
            Varje grupp har sitt eget innehåll, synligt bara för gruppens medlemmar. Matrundan är
            inte en offentlig restaurangkatalog eller betygssajt.
          </p>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {APP_NAME} är ett kostnadsfritt hobbyprojekt utan garanterad support. Läs mer om hur
          uppgifter hanteras under{" "}
          <a
            className="font-medium text-foreground underline underline-offset-4"
            href="/integritet"
          >
            Integritet
          </a>
          .
        </p>
      </section>

      <div className="border-t" />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Vad är nytt</h3>
            <p className="text-xs text-muted-foreground">{APP_VERSION_DATE}</p>
          </div>
          <Badge variant="outline" className="rounded-full">
            v{APP_VERSION}
          </Badge>
        </div>
        {current.summary ? (
          <p className="text-sm text-muted-foreground">{current.summary}</p>
        ) : null}
        <div className="space-y-3">
          {current.sections.map((section) => (
            <div key={section.kind}>
              <div className="text-xs font-medium text-muted-foreground">{section.kind}</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {rest.length > 0 ? (
        <section>
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
                    <p className="mb-2 text-sm text-muted-foreground">{entry.summary}</p>
                  ) : null}
                  <div className="space-y-2">
                    {entry.sections.map((section) => (
                      <div key={section.kind}>
                        <div className="text-xs font-medium text-muted-foreground">
                          {section.kind}
                        </div>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
                          {section.items.map((item) => (
                            <li key={item}>{item}</li>
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
    </div>
  );
}
