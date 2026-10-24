-- Proves workspaces are isolated from each other and roles are enforced by row-level security.
-- Writes are attempted as a signed-in user, then checked as the migration owner.
begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

-- Fixtures, created as the migration owner (row-level security does not apply) -------------------

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'alice@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'bob@example.com'),
  ('00000000-0000-4000-8000-00000000000c', 'carol@example.com'),
  ('00000000-0000-4000-8000-00000000000f', 'frank@example.com');

insert into public.organizations (id, name, created_by) values
  ('10000000-0000-4000-8000-00000000000a', 'Org A', '00000000-0000-4000-8000-00000000000a'),
  ('10000000-0000-4000-8000-00000000000b', 'Org B', '00000000-0000-4000-8000-00000000000b');

insert into public.memberships (org_id, user_id, role) values
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'owner'),
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000f', 'admin'),
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000c', 'member'),
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', 'owner');

insert into public.invitations (org_id, email, role) values
  ('10000000-0000-4000-8000-00000000000a', 'pending-a@example.com', 'member'),
  ('10000000-0000-4000-8000-00000000000b', 'pending-b@example.com', 'member');

insert into public.audit_log (org_id, action) values
  ('10000000-0000-4000-8000-00000000000a', 'test.event-a'),
  ('10000000-0000-4000-8000-00000000000b', 'test.event-b');

-- Row-level security is on for every table (6) ---------------------------------------------------

select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.organizations'::regclass),
  'organizations has row-level security on'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.memberships'::regclass),
  'memberships has row-level security on'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.invitations'::regclass),
  'invitations has row-level security on'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.platform_staff'::regclass),
  'platform_staff has row-level security on'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.staff_access_grants'::regclass),
  'staff_access_grants has row-level security on'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.audit_log'::regclass),
  'audit_log has row-level security on'
);

-- Anonymous visitors get nothing (2) -------------------------------------------------------------

set local role anon;

select throws_ok(
  'select id from public.organizations',
  '42501', null,
  'anonymous visitors cannot read workspaces'
);
select throws_ok(
  $$select public.create_organization('Nope')$$,
  '42501', null,
  'anonymous visitors cannot create workspaces'
);

reset role;

-- Alice owns Org A (8) ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated","email":"alice@example.com"}';

select results_eq(
  'select id from public.organizations',
  $$values ('10000000-0000-4000-8000-00000000000a'::uuid)$$,
  'an owner sees only their own workspace'
);
select results_eq(
  'select user_id from public.memberships order by user_id',
  $$values
    ('00000000-0000-4000-8000-00000000000a'::uuid),
    ('00000000-0000-4000-8000-00000000000c'::uuid),
    ('00000000-0000-4000-8000-00000000000f'::uuid)$$,
  'an owner sees only their own workspace''s memberships'
);
select results_eq(
  'select email from public.invitations',
  $$values ('pending-a@example.com')$$,
  'an owner sees only their own workspace''s invitations'
);
select results_eq(
  'select action from public.audit_log',
  $$values ('test.event-a')$$,
  'an owner sees only their own workspace''s audit log'
);
select throws_ok(
  $$insert into public.memberships (org_id, user_id, role)
    values ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000a', 'owner')$$,
  '42501', null,
  'nobody can add a membership directly'
);
select throws_ok(
  $$insert into public.invitations (org_id, email)
    values ('10000000-0000-4000-8000-00000000000b', 'mallory@example.com')$$,
  '42501', null,
  'an owner cannot invite people into another workspace'
);

update public.organizations set name = 'Taken over'
where id = '10000000-0000-4000-8000-00000000000b';
update public.organizations set name = 'Org A renamed'
where id = '10000000-0000-4000-8000-00000000000a';

reset role;

select is(
  (select name from public.organizations where id = '10000000-0000-4000-8000-00000000000b'),
  'Org B',
  'an owner cannot rename another workspace'
);
select is(
  (select name from public.organizations where id = '10000000-0000-4000-8000-00000000000a'),
  'Org A renamed',
  'an owner can rename their own workspace'
);

-- Carol is a plain member of Org A (5) -----------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated","email":"carol@example.com"}';

select results_eq(
  'select id from public.organizations',
  $$values ('10000000-0000-4000-8000-00000000000a'::uuid)$$,
  'a member sees their workspace'
);
select is_empty('select id from public.audit_log', 'a member cannot read the audit log');
select is_empty('select id from public.invitations', 'a member cannot see invitations');

update public.organizations set name = 'Carol was here'
where id = '10000000-0000-4000-8000-00000000000a';
update public.memberships set role = 'owner'
where org_id = '10000000-0000-4000-8000-00000000000a'
  and user_id = '00000000-0000-4000-8000-00000000000c';

reset role;

select is(
  (select name from public.organizations where id = '10000000-0000-4000-8000-00000000000a'),
  'Org A renamed',
  'a member cannot rename the workspace'
);
select is(
  (select role::text from public.memberships
   where org_id = '10000000-0000-4000-8000-00000000000a'
     and user_id = '00000000-0000-4000-8000-00000000000c'),
  'member',
  'a member cannot promote themselves'
);

-- Frank is an admin of Org A (4) -----------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000f","role":"authenticated","email":"frank@example.com"}';

select throws_ok(
  $$update public.memberships set role = 'owner'
    where org_id = '10000000-0000-4000-8000-00000000000a'
      and user_id = '00000000-0000-4000-8000-00000000000c'$$,
  '42501', null,
  'an admin cannot make anyone an owner'
);

update public.memberships set role = 'admin'
where org_id = '10000000-0000-4000-8000-00000000000a'
  and user_id = '00000000-0000-4000-8000-00000000000a';
update public.memberships set role = 'admin'
where org_id = '10000000-0000-4000-8000-00000000000a'
  and user_id = '00000000-0000-4000-8000-00000000000c';

reset role;

select is(
  (select role::text from public.memberships
   where org_id = '10000000-0000-4000-8000-00000000000a'
     and user_id = '00000000-0000-4000-8000-00000000000a'),
  'owner',
  'an admin cannot change an owner''s role'
);
select is(
  (select role::text from public.memberships
   where org_id = '10000000-0000-4000-8000-00000000000a'
     and user_id = '00000000-0000-4000-8000-00000000000c'),
  'admin',
  'an admin can promote a member to admin'
);
select is(
  (select count(*)::int from public.audit_log where action = 'membership.role_changed'),
  1,
  'role changes are written to the audit log'
);

-- The last owner cannot step down or leave (2) ---------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated","email":"alice@example.com"}';

select throws_ok(
  $$update public.memberships set role = 'admin'
    where org_id = '10000000-0000-4000-8000-00000000000a'
      and user_id = '00000000-0000-4000-8000-00000000000a'$$,
  'P0001', 'A workspace must keep at least one owner.',
  'the last owner cannot step down'
);
select throws_ok(
  $$delete from public.memberships
    where org_id = '10000000-0000-4000-8000-00000000000a'
      and user_id = '00000000-0000-4000-8000-00000000000a'$$,
  'P0001', 'A workspace must keep at least one owner.',
  'the last owner cannot leave'
);

-- Anyone else can leave (2) ----------------------------------------------------------------------

set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated","email":"carol@example.com"}';

delete from public.memberships
where org_id = '10000000-0000-4000-8000-00000000000a'
  and user_id = '00000000-0000-4000-8000-00000000000c';

reset role;

select is(
  (select count(*)::int from public.memberships
   where org_id = '10000000-0000-4000-8000-00000000000a'
     and user_id = '00000000-0000-4000-8000-00000000000c'),
  0,
  'a member can leave a workspace'
);
select is(
  (select count(*)::int from public.audit_log where action = 'membership.removed'),
  1,
  'leaving is written to the audit log'
);

-- Bob owns Org B and sees only it (1) ------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated","email":"bob@example.com"}';

select results_eq(
  'select id from public.organizations',
  $$values ('10000000-0000-4000-8000-00000000000b'::uuid)$$,
  'another owner sees only their own workspace'
);

reset role;

select * from finish();

rollback;
