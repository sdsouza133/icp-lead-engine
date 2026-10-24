-- Proves the tenancy functions: creating workspaces, the invitation flow, the member list and
-- time-limited staff access.
begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

-- Fixtures, created as the migration owner -------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'alice@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'bob@example.com'),
  ('00000000-0000-4000-8000-000000000009', 'grace@example.com'),
  ('00000000-0000-4000-8000-00000000000d', 'dave@example.com'),
  ('00000000-0000-4000-8000-00000000000e', 'erin@example.com');

insert into public.platform_staff (user_id, role) values
  ('00000000-0000-4000-8000-00000000000d', 'support'),
  ('00000000-0000-4000-8000-00000000000e', 'admin');

-- Values the test needs to hand to users who cannot read them themselves.
create temp table fixture_values (key text primary key, value text not null);
grant select on fixture_values to authenticated;

-- Creating a workspace (3) -----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated","email":"alice@example.com"}';

select lives_ok(
  $$select public.create_organization('  Acme  ')$$,
  'a signed-in user can create a workspace'
);
select results_eq(
  $$select o.name, m.role::text
    from public.organizations o
    join public.memberships m on m.org_id = o.id and m.user_id = auth.uid()$$,
  $$values ('Acme', 'owner')$$,
  'the creator becomes the owner and the name is trimmed'
);
select throws_ok(
  $$select public.create_organization('   ')$$,
  '23514', null,
  'a blank workspace name is rejected'
);

reset role;

insert into fixture_values (key, value)
select 'org', id::text from public.organizations where name = 'Acme';

-- Inviting and accepting (6) ---------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated","email":"alice@example.com"}';

select lives_ok(
  $$insert into public.invitations (org_id, email, role)
    select value::uuid, 'grace@example.com', 'member' from fixture_values where key = 'org'$$,
  'an owner can invite someone'
);
select throws_ok(
  $$insert into public.invitations (org_id, email, role)
    select value::uuid, 'eve@example.com', 'owner' from fixture_values where key = 'org'$$,
  '23514', null,
  'an invitation cannot grant ownership'
);

reset role;

insert into fixture_values (key, value)
select 'grace-token', token from public.invitations where email = 'grace@example.com';

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated","email":"bob@example.com"}';

select throws_ok(
  $$select public.accept_invitation((select value from fixture_values where key = 'grace-token'))$$,
  '42501', 'This invitation was sent to a different email address.',
  'an invitation only works for the invited email'
);

set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-000000000009","role":"authenticated","email":"grace@example.com"}';

select lives_ok(
  $$select public.accept_invitation((select value from fixture_values where key = 'grace-token'))$$,
  'the invited person can accept'
);
select results_eq(
  $$select m.role::text
    from public.memberships m
    where m.org_id = (select value::uuid from fixture_values where key = 'org')
      and m.user_id = auth.uid()$$,
  $$values ('member')$$,
  'accepting adds the invited role'
);
select throws_ok(
  $$select public.accept_invitation((select value from fixture_values where key = 'grace-token'))$$,
  'P0002', 'This invitation is no longer valid.',
  'an invitation works only once'
);

-- Member list (2) --------------------------------------------------------------------------------

select results_eq(
  $$select email, role::text
    from public.workspace_members((select value::uuid from fixture_values where key = 'org'))$$,
  $$values ('alice@example.com', 'owner'), ('grace@example.com', 'member')$$,
  'members can list their co-members'
);

set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated","email":"bob@example.com"}';

select is_empty(
  $$select * from public.workspace_members((select value::uuid from fixture_values where key = 'org'))$$,
  'outsiders get no member list'
);

-- Staff access (9) -------------------------------------------------------------------------------

set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated","email":"dave@example.com"}';

select is_empty('select id from public.organizations', 'staff without a grant see no workspaces');
select throws_ok(
  $$select public.grant_staff_access(
      (select value::uuid from fixture_values where key = 'org'),
      '00000000-0000-4000-8000-00000000000d', 'Investigating a bug')$$,
  '42501', 'Only staff admins can grant workspace access.',
  'support staff cannot grant themselves access'
);

set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated","email":"erin@example.com"}';

select is_empty('select id from public.organizations', 'staff admins also need a grant');
select throws_ok(
  $$select public.grant_staff_access(
      (select value::uuid from fixture_values where key = 'org'),
      '00000000-0000-4000-8000-00000000000d', 'Investigating a bug', 600)$$,
  '22023', 'Access must last between 5 and 480 minutes.',
  'a grant lasts at most 8 hours'
);
select lives_ok(
  $$select public.grant_staff_access(
      (select value::uuid from fixture_values where key = 'org'),
      '00000000-0000-4000-8000-00000000000d', 'Investigating a bug', 30)$$,
  'a staff admin can grant time-limited access'
);

set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated","email":"dave@example.com"}';

select results_eq(
  'select name from public.organizations',
  $$values ('Acme')$$,
  'granted staff can read the workspace'
);

update public.organizations set name = 'Edited by staff' where name = 'Acme';

reset role;

select is(
  (select count(*)::int from public.organizations where name = 'Acme'),
  1,
  'granted staff cannot change the workspace'
);
select is(
  (select count(*)::int from public.audit_log where action = 'staff_access.granted'),
  1,
  'grants are written to the audit log'
);

update public.staff_access_grants
set starts_at = now() - interval '2 hours', expires_at = now() - interval '1 hour';

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated","email":"dave@example.com"}';

select is_empty('select id from public.organizations', 'an expired grant gives no access');

reset role;

select * from finish();

rollback;
