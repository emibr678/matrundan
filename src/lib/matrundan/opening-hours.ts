export const OPENING_HOURS_DAY_CODES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

export type OpeningHoursDayCode = (typeof OPENING_HOURS_DAY_CODES)[number];

export interface OpeningHoursDay {
  code: OpeningHoursDayCode;
  label: string;
  intervals: string[];
  closed: boolean;
  known: boolean;
}

export interface OpeningHoursSchedule {
  days: OpeningHoursDay[];
  partiallyParsed: boolean;
}

export const OPENING_HOURS_DAY_LABEL: Record<OpeningHoursDayCode, string> = {
  Mo: "Måndag",
  Tu: "Tisdag",
  We: "Onsdag",
  Th: "Torsdag",
  Fr: "Fredag",
  Sa: "Lördag",
  Su: "Söndag",
};

const JS_DAY_TO_OSM: OpeningHoursDayCode[] = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const WEEKDAY_TO_OSM: Record<string, OpeningHoursDayCode> = {
  Mon: "Mo",
  Tue: "Tu",
  Wed: "We",
  Thu: "Th",
  Fri: "Fr",
  Sat: "Sa",
  Sun: "Su",
};

function normalizedTime(value: string): string {
  const [hours, minutes] = value.split(":");
  return minutes === "00" ? String(Number(hours)) : `${Number(hours)}:${minutes}`;
}

function validClockTime(hours: string, minutes: string): boolean {
  const hour = Number(hours);
  const minute = Number(minutes);
  return hour >= 0 && hour <= 24 && minute >= 0 && minute <= 59 && (hour < 24 || minute === 0);
}

function normalizedInterval(value: string): string | null {
  const match = value.trim().match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, fromHour, fromMinute, toHour, toMinute] = match;
  if (!validClockTime(fromHour, fromMinute) || !validClockTime(toHour, toMinute)) return null;
  return `${normalizedTime(`${fromHour}:${fromMinute}`)}–${normalizedTime(`${toHour}:${toMinute}`)}`;
}

function normalizedUserInterval(value: string): string | null {
  const match = value
    .trim()
    .replace(/[−—-]/g, "–")
    .match(/^(\d{1,2})(?::(\d{2}))?\s*–\s*(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, fromHour, fromMinute = "00", toHour, toMinute = "00"] = match;
  if (!validClockTime(fromHour, fromMinute) || !validClockTime(toHour, toMinute)) return null;
  return `${normalizedTime(`${fromHour}:${fromMinute}`)}–${normalizedTime(`${toHour}:${toMinute}`)}`;
}

function expandDayToken(token: string): OpeningHoursDayCode[] | null {
  const range = token.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
  if (!range) return null;
  const start = OPENING_HOURS_DAY_CODES.indexOf(range[1] as OpeningHoursDayCode);
  const end = range[2] ? OPENING_HOURS_DAY_CODES.indexOf(range[2] as OpeningHoursDayCode) : start;
  if (start < 0 || end < 0) return null;
  if (end >= start) return OPENING_HOURS_DAY_CODES.slice(start, end + 1);
  return [...OPENING_HOURS_DAY_CODES.slice(start), ...OPENING_HOURS_DAY_CODES.slice(0, end + 1)];
}

function expandDays(value: string): OpeningHoursDayCode[] | null {
  const result: OpeningHoursDayCode[] = [];
  for (const token of value.split(",")) {
    const expanded = expandDayToken(token);
    if (!expanded) return null;
    for (const day of expanded) if (!result.includes(day)) result.push(day);
  }
  return result;
}

function emptyDays(): Record<OpeningHoursDayCode, OpeningHoursDay> {
  return OPENING_HOURS_DAY_CODES.reduce<Record<OpeningHoursDayCode, OpeningHoursDay>>(
    (result, code) => {
      result[code] = {
        code,
        label: OPENING_HOURS_DAY_LABEL[code],
        intervals: [],
        closed: false,
        known: false,
      };
      return result;
    },
    {} as Record<OpeningHoursDayCode, OpeningHoursDay>,
  );
}

export function parseOpeningHours(value: string | null | undefined): OpeningHoursSchedule | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;

  const days = emptyDays();
  if (raw === "24/7") {
    for (const day of OPENING_HOURS_DAY_CODES) {
      days[day] = { ...days[day], intervals: ["Dygnet runt"], known: true };
    }
    return {
      days: OPENING_HOURS_DAY_CODES.map((day) => days[day]),
      partiallyParsed: false,
    };
  }

  let unparsedClauseCount = 0;
  let parsedClauseCount = 0;
  const clauses = raw
    .split(";")
    .map((clause) => clause.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const match = clause.match(
      /^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:(?:-|,)(?:Mo|Tu|We|Th|Fr|Sa|Su))*)\s+(.+)$/,
    );
    if (!match) {
      unparsedClauseCount += 1;
      continue;
    }

    const expandedDays = expandDays(match[1]);
    if (!expandedDays) {
      unparsedClauseCount += 1;
      continue;
    }

    const hours = match[2].trim();
    if (/^(off|closed)$/i.test(hours)) {
      for (const day of expandedDays) {
        days[day] = { ...days[day], intervals: [], closed: true, known: true };
      }
      parsedClauseCount += 1;
      continue;
    }

    const intervals = hours.split(",").map(normalizedInterval);
    if (intervals.some((interval) => interval == null)) {
      unparsedClauseCount += 1;
      continue;
    }

    for (const day of expandedDays) {
      days[day] = {
        ...days[day],
        intervals: [...days[day].intervals, ...(intervals as string[])],
        closed: false,
        known: true,
      };
    }
    parsedClauseCount += 1;
  }

  return {
    days: OPENING_HOURS_DAY_CODES.map((day) => days[day]),
    partiallyParsed: parsedClauseCount === 0 || unparsedClauseCount > 0,
  };
}

export function openingHoursDayInput(day: OpeningHoursDay): string {
  if (!day.known) return "";
  if (day.closed) return "Stängt";
  return day.intervals.join(", ");
}

export function buildOpeningHoursScheduleFromInputs(
  inputs: Record<OpeningHoursDayCode, string>,
): OpeningHoursSchedule | null {
  const hasAnyValue = OPENING_HOURS_DAY_CODES.some((code) => inputs[code].trim().length > 0);
  if (!hasAnyValue) return null;

  const days = OPENING_HOURS_DAY_CODES.map<OpeningHoursDay>((code) => {
    const value = inputs[code].trim();
    if (!value) {
      return {
        code,
        label: OPENING_HOURS_DAY_LABEL[code],
        intervals: [],
        closed: false,
        known: false,
      };
    }
    if (/^(stängt|stangd|stang|closed|off)$/i.test(value)) {
      return {
        code,
        label: OPENING_HOURS_DAY_LABEL[code],
        intervals: [],
        closed: true,
        known: true,
      };
    }
    if (/^(dygnet runt|24\/7)$/i.test(value)) {
      return {
        code,
        label: OPENING_HOURS_DAY_LABEL[code],
        intervals: ["Dygnet runt"],
        closed: false,
        known: true,
      };
    }

    const intervals = value.split(",").map(normalizedUserInterval);
    if (intervals.some((interval) => interval == null)) {
      throw new Error(
        `${OPENING_HOURS_DAY_LABEL[code]} har ett ogiltigt tidsformat. Använd till exempel 11–22, 11:30–14 eller Stängt.`,
      );
    }
    return {
      code,
      label: OPENING_HOURS_DAY_LABEL[code],
      intervals: intervals as string[],
      closed: false,
      known: true,
    };
  });

  return { days, partiallyParsed: false };
}

export function isOpeningHoursSchedule(value: unknown): value is OpeningHoursSchedule {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OpeningHoursSchedule>;
  if (!Array.isArray(candidate.days) || candidate.days.length !== 7) return false;
  if (typeof candidate.partiallyParsed !== "boolean") return false;
  const seen = new Set<OpeningHoursDayCode>();
  for (const rawDay of candidate.days) {
    if (!rawDay || typeof rawDay !== "object") return false;
    const day = rawDay as Partial<OpeningHoursDay>;
    if (!OPENING_HOURS_DAY_CODES.includes(day.code as OpeningHoursDayCode)) return false;
    if (seen.has(day.code as OpeningHoursDayCode)) return false;
    if (
      !Array.isArray(day.intervals) ||
      !day.intervals.every((item) => typeof item === "string")
    ) {
      return false;
    }
    if (typeof day.closed !== "boolean" || typeof day.known !== "boolean") return false;
    seen.add(day.code as OpeningHoursDayCode);
  }
  return seen.size === 7;
}

function dayCodeForDate(date: Date, timezone?: string | null): OpeningHoursDayCode {
  if (timezone) {
    try {
      const weekday = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        timeZone: timezone,
      }).format(date);
      const code = WEEKDAY_TO_OSM[weekday];
      if (code) return code;
    } catch {
      /* Ogiltig tidszon faller tillbaka till enhetens lokala datum. */
    }
  }
  return JS_DAY_TO_OSM[date.getDay()];
}

export function openingHoursForDate(
  schedule: OpeningHoursSchedule,
  date = new Date(),
  timezone?: string | null,
): OpeningHoursDay {
  const dayCode = dayCodeForDate(date, timezone);
  return schedule.days.find((day) => day.code === dayCode) ?? schedule.days[0];
}

export function openingHoursDaySummary(day: OpeningHoursDay): string {
  if (!day.known) return "Ingen uppgift";
  if (day.closed) return "Stängt";
  return day.intervals.join(", ") || "Ingen uppgift";
}
