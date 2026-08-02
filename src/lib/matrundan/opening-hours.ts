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
  raw: string;
  days: OpeningHoursDay[];
  specialRules: string[];
  partiallyParsed: boolean;
}

const DAY_LABEL: Record<OpeningHoursDayCode, string> = {
  Mo: "Måndag",
  Tu: "Tisdag",
  We: "Onsdag",
  Th: "Torsdag",
  Fr: "Fredag",
  Sa: "Lördag",
  Su: "Söndag",
};

const JS_DAY_TO_OSM: OpeningHoursDayCode[] = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function normalizedTime(value: string): string {
  const [hours, minutes] = value.split(":");
  return minutes === "00" ? String(Number(hours)) : `${Number(hours)}:${minutes}`;
}

function normalizedInterval(value: string): string | null {
  const match = value.trim().match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, fromHour, fromMinute, toHour, toMinute] = match;
  const valid =
    [fromHour, toHour].every((hour) => Number(hour) >= 0 && Number(hour) <= 24) &&
    [fromMinute, toMinute].every((minute) => Number(minute) >= 0 && Number(minute) <= 59);
  if (!valid) return null;
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
  return Object.fromEntries(
    OPENING_HOURS_DAY_CODES.map((code) => [
      code,
      { code, label: DAY_LABEL[code], intervals: [], closed: false, known: false },
    ]),
  ) as Record<OpeningHoursDayCode, OpeningHoursDay>;
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
      raw,
      days: OPENING_HOURS_DAY_CODES.map((day) => days[day]),
      specialRules: [],
      partiallyParsed: false,
    };
  }

  const specialRules: string[] = [];
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
      specialRules.push(clause);
      continue;
    }

    const expandedDays = expandDays(match[1]);
    if (!expandedDays) {
      specialRules.push(clause);
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
      specialRules.push(clause);
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

  if (parsedClauseCount === 0) {
    return {
      raw,
      days: OPENING_HOURS_DAY_CODES.map((day) => days[day]),
      specialRules: specialRules.length ? specialRules : [raw],
      partiallyParsed: true,
    };
  }

  return {
    raw,
    days: OPENING_HOURS_DAY_CODES.map((day) => days[day]),
    specialRules,
    partiallyParsed: specialRules.length > 0,
  };
}

export function openingHoursForDate(
  schedule: OpeningHoursSchedule,
  date = new Date(),
): OpeningHoursDay {
  return schedule.days.find((day) => day.code === JS_DAY_TO_OSM[date.getDay()]) ?? schedule.days[0];
}

export function openingHoursDaySummary(day: OpeningHoursDay): string {
  if (!day.known) return "Ingen uppgift";
  if (day.closed) return "Stängt";
  return day.intervals.join(", ") || "Ingen uppgift";
}
