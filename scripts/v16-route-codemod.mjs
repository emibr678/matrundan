import { readFile, writeFile } from "node:fs/promises";

const path = "src/routes/gruppen.tsx";
let source = await readFile(path, "utf8");

source = source.replace(
  'import { GeoapifyLocationInput } from "@/components/matrundan/GeoapifyLocationInput";\n',
  "",
);
source = source.replace(
  'import { GroupHighlights } from "@/components/matrundan/GroupHighlights";\n',
  'import { GroupHighlights } from "@/components/matrundan/GroupHighlights";\nimport { GroupSettingsSectionV16 } from "@/components/matrundan/GroupSettingsSectionV16";\n',
);
source = source.replace('import { Switch } from "@/components/ui/switch";\n', "");
source = source.replace(/\n\s*updateGroupSettings,/, "");

const invocationPattern = /<GroupSettingsSection\s+[\s\S]*?\/>/;
if (!invocationPattern.test(source)) {
  throw new Error("Kunde inte hitta GroupSettingsSection-anropet");
}
source = source.replace(
  invocationPattern,
  `<GroupSettingsSectionV16
                groupId={activeGroupId}
                initialName={state.group.name}
                initialEmoji={state.group.emoji}
                initialSearchAreas={state.group.searchAreas ?? []}
                initialRadius={state.group.defaultSearchRadiusKm ?? 1}
                initialHome={state.group.homeLocation ?? null}
                initialShareCounts={state.group.sharedVisitsCountForProgression ?? true}
              />`,
);

const componentPattern = /function GroupSettingsSection\([\s\S]*?\nfunction GroupStatusSection\(\)/;
if (!componentPattern.test(source)) {
  throw new Error("Kunde inte hitta gamla GroupSettingsSection-komponenten");
}
source = source.replace(componentPattern, "function GroupStatusSection()");

await writeFile(path, source);
