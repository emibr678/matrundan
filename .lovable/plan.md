# Paket 3B – uppdelad leverans

Paket 3B enligt din specifikation, men uppdelat i två sekventiella steg under samma paket. Ingen scope-förändring — bara säkrare leverans så att en trasig migration inte lämnar dig utan väg tillbaka. Version bumpas till **0.7.0** först när steg 2 är grönt och publicerat.

## Steg 3B-1 – Datamodell, migration, secure read, uppdaterade skrivflöden

Ingen synlig UI-förändring för slutanvändaren i det här steget utöver att data fortsätter fungera. All klient läser via ny säker RPC.

**Migration (en fil, atomisk):**
- Skapa nya tabeller: `group_places`, `visit_group_links`, `review_group_visibility`.
- Backfilla från nuvarande `places.group_id`, `visits.group_id`, `reviews.group_id/place_id`, `place_sources.group_id`.
- Verifiera row counts i migrationen med `RAISE EXCEPTION` om mismatch.
- Släpp gamla kolumner + tillhörande triggers/policies (`places_immutable_cols`, `visits_immutable_cols`, `reviews_immutable_cols`, `place_sources_immutable_cols`, `activity.validate_activity_refs` uppdateras).
- Lägg till `groups.shared_visits_count_for_progression bool default true`.
- Ny RLS: canonical `places`/`visits`/`reviews`/`visit_participants` är otillgängliga direkt för `authenticated` (endast läsning via secure RPC). `group_places`, `visit_group_links`, `review_group_visibility`, `favorites`, `group_next_place`, `activity` behåller gruppscoped SELECT via `has_membership`.
- Uppdatera `create_place`, `create_visit_with_review`, `toggle_favorite`, `set_next_place` till nya modellen (originalkoppling via `visit_group_links`, review-visibility i original=true/true).
- Uppdatera `update_group_settings` med nya boolean-parametern.

**Ny secure read-RPC:**
- `get_group_app_state(_group_id uuid) returns jsonb` – SECURITY DEFINER, låst search_path.
- Kräver aktivt medlemskap.
- Filtrerar deltagare, reviews (`rating_visible`), kommentarer (`comment_visible`), räknar externa deltagare, maskerar `source_group_id`.

**Live-repository:**
- Rewrite `live-repository.ts` att kalla enbart `get_group_app_state` + `groups`/`memberships` (för listan över egna grupper).
- Uppdatera `types.ts`: `Visit` får `groupLinkType`, `linkedBy`, `linkedAt`, `externalParticipantCount`, `countsForProgression`.
- Store/selectors: `hasVisited`, `visitedCounts`, place-status baseras nu på synliga besök i gruppen.

**Verifiering:**
- `bunx tsgo --noEmit`, `bun run build`.
- SQL-verifiering före/efter (1→1 mappning av existerande 1 place/1 visit/1 review).
- Demo-läge oförändrat.

## Steg 3B-2 – Share/unlink/visibility + UI + gruppinställning + v0.7.0

**Nya RPC:er:**
- `share_visit_to_group(_visit_id, _target_group_id, _share_own_comment bool default false)`.
- `remove_shared_visit_from_group(_visit_id, _group_id)`.
- `set_review_group_visibility(_review_id, _group_id, _rating_visible bool, _comment_visible bool)`.

**UI:**
- `VisitDetailSheet` – sekundär action `Lägg till i annan grupp` (endast om current user är participant och har annan aktiv grupp). Ny `ShareVisitDialog` med preview av deltagare/ratings/kommentarer och "Dela min kommentar"-switch.
- Delat besök i målgruppen: badge `Delat besök`, "+N utanför gruppen", `Ta bort från gruppen`-action för link creator/owner/admin med AlertDialog.
- Egen review-visibility: switch på besöksdetalj för att visa/dölja egen kommentar per grupp.
- Gruppinställningar (owner/admin): sektion `Delade besök` med switch `Räkna delade besök i progression`.

**Docs/version:**
- Bumpa `APP_VERSION` till `0.7.0`, datum, changelog-entry.
- Uppdatera README.
- Publicera till `https://matrundan.lovable.app`.

## Utanför scope (bekräftat)
- Ingen Geoapify.
- Ingen gamification/nivåer/badges.
- Ingen dubblettsammanslagning av canonical places bortom det migreringen kräver.

## Frågor jag inte kommer gissa på
- Om något manuellt Cloud-steg krävs för published-deploy utöver att köra `preview_ui--publish`: jag redovisar det direkt istället för att hitta på en åtgärd.

---

**Bekräfta att jag ska starta med Steg 3B-1** (migration + backend + secure read) så kör jag den direkt i nästa tur och rapporterar innan Steg 3B-2. Om du hellre vill att jag kör allt i ett svep trots risken, säg till.
