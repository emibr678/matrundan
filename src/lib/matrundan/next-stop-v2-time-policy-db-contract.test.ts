import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  "supabase/migrations/20260816222500_next_stop_v2_time_after_selection.sql",
).text();

describe("tidspolicy för Nästa stopp v2", () => {
  test("tid kräver både dag och ett bestämt nästa stopp", () => {
    expect(migration).toContain("_planned_time IS NOT NULL AND _planned_date IS NULL");
    expect(migration).toContain("_planned_time IS NOT NULL AND _selected_place_id IS NULL");
    expect(migration).toContain("Bestäm ett nästa stopp innan du lägger till en tid");
  });

  test("ett dagbyte rensar tid innan legacy-spegeln uppdateras", () => {
    expect(migration).toContain("_current_date IS DISTINCT FROM _planned_date");
    expect(migration).toContain("_effective_time := NULL");
    expect(migration).toContain("_planned_date,\n    _effective_time,");
  });

  test("att öppna valet igen rensar tid men bevarar dagen", () => {
    expect(migration).toContain("IF _place_id IS NULL THEN\n    _planned_time := NULL;");
    expect(migration).toContain("SET planned_time = _planned_time,");
    expect(migration).not.toContain("SET planned_date = NULL");
  });

  test("arkivering av valt ställe rensar tid utan att rensa dagen", () => {
    expect(migration).toContain("_was_selected boolean := false");
    expect(migration).toContain(
      "planned_time = CASE WHEN _was_selected THEN NULL ELSE planned_time END",
    );
    expect(migration).not.toContain("planned_date = CASE WHEN _was_selected");
  });
});
