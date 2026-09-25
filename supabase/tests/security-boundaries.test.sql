BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(17);

-- Helt syntetiska identiteter och rader. Testerna ska aldrig bero på live-data.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'owner-a@example.invalid', '{"full_name":"Owner A"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'member-a@example.invalid', '{"full_name":"Member A"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333', 'owner-b@example.invalid', '{"full_name":"Owner B"}'::jsonb),
  ('44444444-4444-4444-8444-444444444444', 'delete-me@example.invalid', '{"full_name":"Delete Me"}'::jsonb);

INSERT INTO public.profiles (id, display_name)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'Owner A'),
  ('22222222-2222-4222-8222-222222222222', 'Member A'),
  ('33333333-3333-4333-8333-333333333333', 'Owner B'),
  ('44444444-4444-4444-8444-444444444444', 'Delete Me')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.groups (id, name, created_by)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Grupp A', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Grupp B', '33333333-3333-4333-8333-333333333333');

INSERT INTO public.memberships (group_id, user_id, role, status)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'owner', 'active');

INSERT INTO public.places (id, name, category, address, city, added_by)
VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Syntetiskt ställe',
  'restaurang',
  'Testgatan 1',
  'Teststad',
  '11111111-1111-4111-8111-111111111111'
);

INSERT INTO public.group_places (group_id, place_id, added_by)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '11111111-1111-4111-8111-111111111111'
);

INSERT INTO public.visits (id, place_id, visited_on, meal_type, created_by)
VALUES (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  DATE '2026-09-01',
  'middag',
  '11111111-1111-4111-8111-111111111111'
);

INSERT INTO public.visit_group_links (visit_id, group_id, link_type, linked_by)
VALUES (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'original',
  '11111111-1111-4111-8111-111111111111'
);

INSERT INTO public.visit_participants (visit_id, user_id)
VALUES
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '22222222-2222-4222-8222-222222222222');

INSERT INTO public.visit_media (
  id, visit_id, group_id, storage_path, uploaded_by,
  mime_type, byte_size, width, height
)
VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd/22222222-2222-4222-8222-222222222222.jpg',
  '22222222-2222-4222-8222-222222222222',
  'image/jpeg',
  1234,
  800,
  600
);

INSERT INTO storage.objects (bucket_id, name, owner)
VALUES (
  'visit-photos',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd/22222222-2222-4222-8222-222222222222.jpg',
  '22222222-2222-4222-8222-222222222222'
);

SELECT ok(
  NOT pg_catalog.has_table_privilege('anon', 'public.group_places', 'SELECT')
  AND NOT pg_catalog.has_table_privilege('authenticated', 'public.group_places', 'SELECT'),
  'group_places has no direct client read grant'
);

SELECT ok(
  NOT pg_catalog.has_table_privilege('authenticated', 'public.notification_outbox', 'SELECT'),
  'notification outbox remains server-only'
);

SELECT ok(
  pg_catalog.has_table_privilege('authenticated', 'public.activity', 'SELECT')
  AND NOT pg_catalog.has_table_privilege('authenticated', 'public.activity', 'TRUNCATE'),
  'intended activity read survives while historical broad privileges are removed'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_default_acl defaults
    WHERE defaults.defaclrole = (
      SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'postgres'
    )
      AND defaults.defaclnamespace = (
        SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public'
      )
      AND defaults.defaclobjtype = 'f'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_default_acl defaults
    CROSS JOIN LATERAL pg_catalog.aclexplode(defaults.defaclacl) acl
    LEFT JOIN pg_catalog.pg_roles granted_role
      ON granted_role.oid = acl.grantee
    WHERE defaults.defaclrole = (
      SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'postgres'
    )
      AND defaults.defaclnamespace = (
        SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public'
      )
      AND defaults.defaclobjtype = 'f'
      AND (
        acl.grantee = 0
        OR granted_role.rolname IN ('anon', 'authenticated', 'service_role')
      )
  ),
  'future public functions start without client or service-role execute grants'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

SELECT throws_ok(
  $$SELECT public.get_group_app_state_v5n('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'P0001',
  'Du är inte medlem i gruppen',
  'direct route/deep-link cannot read another group through the current group-state RPC'
);

SET LOCAL request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

SELECT throws_ok(
  $$SELECT public.archive_group('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'P0001',
  'Endast gruppens ägare kan arkivera gruppen',
  'regular member cannot use owner-only group administration'
);

SELECT throws_ok(
  $$SELECT public.set_member_role(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '22222222-2222-4222-8222-222222222222',
      'admin'
    )$$,
  'P0001',
  'Endast ägaren kan ändra roller',
  'client-supplied target user cannot escalate the caller role'
);

SELECT throws_ok(
  $$SELECT public.share_visit_to_group_v4(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      false,
      false,
      false
    )$$,
  'P0001',
  'Du är inte aktiv medlem i målgruppen',
  'client-supplied target group cannot create a cross-group share without membership'
);

SELECT ok(
  public.can_manage_own_visit_photo(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ),
  'actual participant can manage their own visit photo in the source group'
);

SELECT results_eq(
  $$SELECT count(*)::bigint
    FROM storage.objects
    WHERE bucket_id = 'visit-photos'
      AND name = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd/22222222-2222-4222-8222-222222222222.jpg'$$,
  ARRAY[1::bigint],
  'group member can read the private object linked to their group'
);

SET LOCAL request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

SELECT ok(
  NOT public.can_manage_own_visit_photo(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ),
  'non-member cannot manage a photo by supplying another group and visit'
);

SELECT results_eq(
  $$SELECT count(*)::bigint
    FROM storage.objects
    WHERE bucket_id = 'visit-photos'
      AND name = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd/22222222-2222-4222-8222-222222222222.jpg'$$,
  ARRAY[0::bigint],
  'non-member cannot read the private storage object'
);

RESET ROLE;

INSERT INTO public.notification_preferences (user_id, notification_type, push_enabled)
VALUES ('44444444-4444-4444-8444-444444444444', 'review_added', true);

INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label)
VALUES (
  '44444444-4444-4444-8444-444444444444',
  'https://push.example.invalid/synthetic-delete-user',
  'synthetic-p256dh',
  'synthetic-auth',
  'synthetic-device'
);

INSERT INTO public.notification_outbox (
  user_id, group_id, notification_type, title, body, url, dedupe_key
)
VALUES (
  '44444444-4444-4444-8444-444444444444',
  NULL,
  'review_added',
  'Syntetisk titel',
  'Syntetisk text',
  '/',
  'security-test-delete-user'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';

SELECT lives_ok(
  $$SELECT public.prepare_own_account_deletion('{}'::jsonb, false)$$,
  'account deletion preparation completes for a user without owned groups'
);

RESET ROLE;

SELECT results_eq(
  $$SELECT count(*)::bigint
    FROM public.push_subscriptions
    WHERE user_id = '44444444-4444-4444-8444-444444444444'$$,
  ARRAY[0::bigint],
  'account deletion removes push endpoints and Web Push key material'
);

SELECT results_eq(
  $$SELECT count(*)::bigint
    FROM public.notification_preferences
    WHERE user_id = '44444444-4444-4444-8444-444444444444'$$,
  ARRAY[0::bigint],
  'account deletion removes notification preferences'
);

SELECT results_eq(
  $$SELECT count(*)::bigint
    FROM public.notification_outbox
    WHERE user_id = '44444444-4444-4444-8444-444444444444'$$,
  ARRAY[0::bigint],
  'account deletion removes queued notification content'
);

SELECT results_eq(
  $$SELECT count(*)::bigint
    FROM public.profiles
    WHERE id = '44444444-4444-4444-8444-444444444444'
      AND display_name = 'Tidigare medlem'
      AND avatar_url IS NULL
      AND avatar_emoji IS NULL
      AND deleted_at IS NOT NULL$$,
  ARRAY[1::bigint],
  'account deletion keeps only the anonymized historical profile shell'
);

SELECT * FROM finish();
ROLLBACK;
