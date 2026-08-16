# Visual review tests

## Snabb smoke check under GUI-iteration

Kör bara berörda demosökvägar i 360 px Chromium:

```bash
bun run test:visual-smoke -- /matstallen?demo=1
```

Lägg till desktop när ändringen påverkar layout eller hierarki där:

```bash
bun run test:visual-smoke -- /matstallen?demo=1 /matstallen/p7?demo=1 --desktop
```

Smoke-kommandot kör endast den generiska route-capture-specen, startar Vite via Playwright och gör ingen extra produktionsbuild. Bilderna är temporära och skrivs till den git-ignorerade katalogen `visual-review/`.

## Full visuell granskningsmatris

Kör den bredare kandidatkontrollen lokalt med:

```bash
bun run test:visual-review
```

Den gör först produktionsbuild och kör därefter hela `tests/visual-review` i 360 px och desktop. Ange egna komma- eller radseparerade demosökvägar med `VISUAL_REVIEW_PATHS` när den generiska route-capture-specen ska begränsas.

GitHub-workflowen **Visual review artifacts** är fortsatt opt-in och används när ett beständigt granskningsunderlag ger värde. Se `docs/visual-review.md` för reviewnivåer och artifactprinciper.
