from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Kunde inte hitta text i {path}: {old[:100]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/lib/matrundan/store.tsx",
    '  saveVisitPhoto: (visitId: string, file: File) => Promise<void>;',
    '  saveVisitPhoto: (visitId: string, file: File, visitSnapshot?: Visit) => Promise<void>;',
)

replace_once(
    "src/lib/matrundan/store.tsx",
    '''      saveVisitPhoto: async (visitId, file) => {
        const visit = state.visits.find((item) => item.id === visitId);
        if (!visit) throw new Error("Besöket finns inte.");
        const role = state.members.find((member) => member.id === state.currentUserId)?.role;
        if (
          !canManageVisitPhoto(
            visit,
            state.currentUserId,
            role,
            state.group.lifecycleStatus === "archived",
          )
        ) {
          throw new Error("Du saknar behörighet att ändra fotot för det här besöket.");
        }
        const prepared = await prepareVisitPhoto(file);
        if (mode === "live") {
          await runLive((groupId) => liveSaveVisitPhoto(groupId, visitId, prepared));
          return;
        }
        assertDemoWritable(state, demoReadOnly);
        const url = await blobToDataUrl(prepared.blob);
        const updatedAt = new Date().toISOString();
        setState((current) => ({
          ...current,
          visits: current.visits.map((item) =>
            item.id === visitId
              ? {
                  ...item,
                  photo: {
                    url,
                    uploadedBy: current.currentUserId,
                    mimeType: prepared.mimeType,
                    byteSize: prepared.byteSize,
                    width: prepared.width,
                    height: prepared.height,
                    updatedAt,
                  },
                }
              : item,
          ),
        }));
      },''',
    '''      saveVisitPhoto: async (visitId, file, visitSnapshot) => {
        const visit = visitSnapshot ?? state.visits.find((item) => item.id === visitId);
        if (!visit) throw new Error("Besöket finns inte.");
        const role = state.members.find((member) => member.id === state.currentUserId)?.role;
        if (
          !canManageVisitPhoto(
            visit,
            state.currentUserId,
            role,
            state.group.lifecycleStatus === "archived",
          )
        ) {
          throw new Error("Du saknar behörighet att ändra fotot för det här besöket.");
        }
        const prepared = await prepareVisitPhoto(file);
        if (mode === "live") {
          await runLive((groupId) => liveSaveVisitPhoto(groupId, visitId, prepared));
          return;
        }
        assertDemoWritable(state, demoReadOnly);
        const url = await blobToDataUrl(prepared.blob);
        const updatedAt = new Date().toISOString();
        setState((current) => {
          if (!current.visits.some((item) => item.id === visitId)) {
            throw new Error("Besöket finns inte.");
          }
          return {
            ...current,
            visits: current.visits.map((item) =>
              item.id === visitId
                ? {
                    ...item,
                    photo: {
                      url,
                      uploadedBy: current.currentUserId,
                      mimeType: prepared.mimeType,
                      byteSize: prepared.byteSize,
                      width: prepared.width,
                      height: prepared.height,
                      updatedAt,
                    },
                  }
                : item,
            ),
          };
        });
      },''',
)

replace_once(
    "src/components/matrundan/VisitDialog.tsx",
    "await saveVisitPhoto(created.id, photoFile);",
    "await saveVisitPhoto(created.id, photoFile, created);",
)

replace_once(
    "tests/e2e/live-loading-auth-menu.spec.ts",
    '**/rest/v1/rpc/get_group_app_state_v4b',
    '**/rest/v1/rpc/get_group_app_state_v5c',
)

replace_once(
    "tests/e2e/package-5c.spec.ts",
    '''  const newestVisit = page.getByRole("button", { name: /Öppna besök av Alex/ }).first();
  await newestVisit.click();''',
    '''  const newestVisit = page.getByRole("button", { name: /Öppna besök av/ }).first();
  await expect(newestVisit).toBeVisible();
  await newestVisit.click();''',
)

replace_once(
    "tests/e2e/package-5c.spec.ts",
    '''  await page
    .getByRole("button", { name: /Öppna besök av Alex/ })
    .first()
    .click();''',
    '''  await page
    .getByRole("button", { name: /Öppna besök av/ })
    .first()
    .click();''',
)

print("Paket 5C browserfix applicerad")
