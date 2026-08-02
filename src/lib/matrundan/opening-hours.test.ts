import { describe, expect, test } from "bun:test";

import {
  openingHoursDaySummary,
  openingHoursForDate,
  parseOpeningHours,
} from "./opening-hours";

describe("öppettider från OSM", () => {
  test("normaliserar vanliga veckointervall och stängda dagar", () => {
    const schedule = parseOpeningHours("Mo-Fr 11:00-22:00; Sa 12:00-23:30; Su off");
    expect(schedule).not.toBeNull();
    expect(schedule?.days[0].intervals).toEqual(["11–22"]);
    expect(schedule?.days[5].intervals).toEqual(["12–23:30"]);
    expect(schedule?.days[6].closed).toBe(true);
    expect(schedule?.partiallyParsed).toBe(false);
  });

  test("bevarar flera intervall och tider efter midnatt utan att gissa öppet nu", () => {
    const schedule = parseOpeningHours("Mo-Fr 11:00-14:00,17:00-22:00; Sa-Su 17:00-02:00");
    expect(schedule?.days[0].intervals).toEqual(["11–14", "17–22"]);
    expect(schedule?.days[5].intervals).toEqual(["17–2"]);
  });

  test("hanterar dygnet runt", () => {
    const schedule = parseOpeningHours("24/7");
    expect(schedule?.days.every((day) => day.intervals[0] === "Dygnet runt")).toBe(true);
  });

  test("markerar specialregler utan falsk säkerhet", () => {
    const schedule = parseOpeningHours("Mo-Fr 11:00-22:00; PH off");
    expect(schedule?.specialRules).toEqual(["PH off"]);
    expect(schedule?.partiallyParsed).toBe(true);
  });

  test("ger dagens sammanfattning utan realtidsstatus", () => {
    const schedule = parseOpeningHours("Mo 11:00-22:00; Tu off");
    expect(schedule).not.toBeNull();
    const monday = openingHoursForDate(schedule!, new Date("2026-08-03T12:00:00+02:00"));
    const tuesday = openingHoursForDate(schedule!, new Date("2026-08-04T12:00:00+02:00"));
    expect(openingHoursDaySummary(monday)).toBe("11–22");
    expect(openingHoursDaySummary(tuesday)).toBe("Stängt");
  });
});
