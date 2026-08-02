import type { PlaceDataReport } from "./place-data-reports";

export const REPORTED_ERROR_FILTERS = ["review", "ready", "sent", "closed"] as const;
export type ReportedErrorFilter = (typeof REPORTED_ERROR_FILTERS)[number];

export type PlaceDataReportViewState =
  | "review"
  | "ready_to_send"
  | "sending"
  | "sent_pending"
  | "sent_reviewed"
  | "sent_unavailable"
  | "failed"
  | "resolved"
  | "dismissed";

export interface PlaceDataReportView {
  state: PlaceDataReportViewState;
  filter: ReportedErrorFilter;
  label: string;
  summary: string;
  sortDate: string;
}

export const REPORTED_ERROR_FILTER_LABEL: Record<ReportedErrorFilter, string> = {
  review: "Att granska",
  ready: "Redo att skicka",
  sent: "Skickade",
  closed: "Avslutade",
};

function dateOrFallback(value: string | null | undefined, fallback: string): string {
  return value && !Number.isNaN(new Date(value).getTime()) ? value : fallback;
}

export function getPlaceDataReportView(report: PlaceDataReport): PlaceDataReportView {
  if (report.osmSubmissionState === "published") {
    const sortDate = dateOrFallback(report.osmNoteCreatedAt, report.updatedAt);
    if (report.osmNoteStatus === "open") {
      return {
        state: "sent_pending",
        filter: "sent",
        label: "Väntar på granskning",
        summary: "Rättelseförslaget har skickats och väntar på att granskas.",
        sortDate,
      };
    }
    if (report.osmNoteStatus === "closed") {
      return {
        state: "sent_reviewed",
        filter: "sent",
        label: "Granskad i OpenStreetMap",
        summary: "Ärendet har avslutats i OpenStreetMap.",
        sortDate,
      };
    }
    if (report.osmNoteStatus === "hidden") {
      return {
        state: "sent_unavailable",
        filter: "sent",
        label: "Ärendet är inte längre tillgängligt",
        summary: "Rättelseförslaget går inte längre att öppna i OpenStreetMap.",
        sortDate,
      };
    }
    return {
      state: "sent_unavailable",
      filter: "sent",
      label: "Statusen kunde inte hämtas",
      summary: "Matrundan kunde inte kontrollera vad som har hänt med rättelseförslaget.",
      sortDate,
    };
  }

  if (report.osmSubmissionState === "submitting") {
    return {
      state: "sending",
      filter: "ready",
      label: "Publiceringen kunde inte bekräftas",
      summary: "Matrundan kontrollerar om rättelseförslaget redan har skapats.",
      sortDate: report.updatedAt,
    };
  }

  if (report.osmSubmissionState === "failed") {
    return {
      state: "failed",
      filter: "ready",
      label: "Kunde inte skicka förslaget",
      summary: "Kontrollera uppgifterna och försök igen.",
      sortDate: report.updatedAt,
    };
  }

  if (report.status === "ready_for_osm") {
    return {
      state: "ready_to_send",
      filter: "ready",
      label: "Redo att skicka",
      summary: "Rättelseförslaget är förberett och behöver granskas före publicering.",
      sortDate: report.createdAt,
    };
  }

  if (report.status === "open") {
    return {
      state: "review",
      filter: "review",
      label: "Att granska",
      summary: "Kontrollera rapporten och välj nästa steg.",
      sortDate: report.createdAt,
    };
  }

  if (report.status === "resolved") {
    return {
      state: "resolved",
      filter: "closed",
      label: "Åtgärdad",
      summary: "Rapporten är markerad som åtgärdad.",
      sortDate: report.updatedAt,
    };
  }

  return {
    state: "dismissed",
    filter: "closed",
    label: "Avslutad utan åtgärd",
    summary: "Rapporten avslutades utan att skickas vidare.",
    sortDate: report.updatedAt,
  };
}

export function countReportsByFilter(
  reports: PlaceDataReport[],
): Record<ReportedErrorFilter, number> {
  return reports.reduce<Record<ReportedErrorFilter, number>>(
    (counts, report) => {
      counts[getPlaceDataReportView(report).filter] += 1;
      return counts;
    },
    { review: 0, ready: 0, sent: 0, closed: 0 },
  );
}

export function chooseDefaultReportedErrorFilter(
  reports: PlaceDataReport[],
): ReportedErrorFilter {
  const counts = countReportsByFilter(reports);
  return REPORTED_ERROR_FILTERS.find((filter) => counts[filter] > 0) ?? "review";
}

function searchableText(report: PlaceDataReport): string {
  return [
    report.placeName,
    report.placeAddress,
    report.placeCity,
    report.category,
    report.description,
  ]
    .join(" ")
    .toLocaleLowerCase("sv-SE");
}

export function filterAndSortPlaceDataReports(
  reports: PlaceDataReport[],
  filter: ReportedErrorFilter,
  query: string,
): PlaceDataReport[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("sv-SE");
  const ascending = filter === "review" || filter === "ready";

  return reports
    .filter((report) => getPlaceDataReportView(report).filter === filter)
    .filter((report) => !normalizedQuery || searchableText(report).includes(normalizedQuery))
    .sort((a, b) => {
      const aTime = new Date(getPlaceDataReportView(a).sortDate).getTime();
      const bTime = new Date(getPlaceDataReportView(b).sortDate).getTime();
      return ascending ? aTime - bTime : bTime - aTime;
    });
}
