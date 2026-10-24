-- Tenancy: workspaces (organizations), memberships with roles, invitations, platform staff with
-- time-limited access grants, and an audit log. Every table sits behind row-level security.
-- Writes that span several tables go through security definer functions.

-- Access-check helpers live in a schema the Data API does not expose.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.org_role as enum ('owner', 'admin', 'member');
create type public.staff_role as enum ('admin', 'support');

-- Tables ----------------------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is
  'Client workspaces. Every tenant table carries an org_id that points here.';

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role public.org_role not null default 'member' check (role <> 'owner'),
  -- Two random UUIDs give 244 random bits without depending on pgcrypto.
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index invitations_org_id_idx on public.invitations (org_id);
create unique index invitations_one_open_per_email_idx
  on public.invitations (org_id, email)
  where accepted_at is null;

create table public.platform_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.staff_role not null,
  created_at timestamptz not null default now()
);

comment on table public.platform_staff is
  'Your team. Rows are added by an operator with the service key, never through the app.';

create table public.staff_access_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  staff_user_id uuid not null references public.platform_staff (user_id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at and expires_at <= starts_at + interval '8 hours')
);

create index staff_access_grants_staff_org_idx
  on public.staff_access_grants (staff_user_id, org_id, expires_at);

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_org_id_created_at_idx on public.audit_log (org_id, created_at desc);

-- Access checks ---------------------------------------------------------------------------------
-- Security definer so policies can read memberships and grants without recursing through their
-- own row-level security. search_path is pinned so a caller cannot shadow the tables.

create function private.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
  );
$$;

create function private.has_org_role(p_org_id uuid, p_roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create function private.is_staff_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_staff s
    where s.user_id = (select auth.uid())
      and s.role = 'admin'
  );
$$;

-- Staff, admins included, see a workspace only while they hold an unexpired, unrevoked grant.
create function private.has_staff_access(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_access_grants g
    where g.org_id = p_org_id
      and g.staff_user_id = (select auth.uid())
      and g.revoked_at is null
      and now() >= g.starts_at
      and now() < g.expires_at
  );
$$;

create function private.can_read_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_member(p_org_id) or private.has_staff_access(p_org_id);
$$;

revoke all on all functions in schema private from public;
grant execute on function
  private.is_org_member(uuid),
  private.has_org_role(uuid, public.org_role[]),
  private.is_staff_admin(),
  private.has_staff_access(uuid),
  private.can_read_org(uuid)
  to authenticated;

-- Triggers --------------------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function private.set_updated_at();

-- A workspace always keeps at least one owner. Cascades from deleting the workspace itself or a
-- user account are allowed, so account deletion can never be blocked.
create function private.ensure_org_keeps_an_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removing_owner boolean;
begin
  if tg_op = 'DELETE' then
    v_removing_owner := old.role = 'owner';
  else
    v_removing_owner := old.role = 'owner' and new.role <> 'owner';
  end if;

  if v_removing_owner then
    -- Serialize owner changes per workspace so two owners cannot demote each other at once.
    perform 1 from public.organizations o where o.id = old.org_id for update;

    if not exists (
         select 1
         from public.memberships m
         where m.org_id = old.org_id
           and m.role = 'owner'
           and m.user_id <> old.user_id
       )
       and exists (select 1 from public.organizations o where o.id = old.org_id)
       and exists (select 1 from auth.users u where u.id = old.user_id)
    then
      raise exception 'A workspace must keep at least one owner.'
        using errcode = 'P0001', hint = 'Make someone else an owner first.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger memberships_keep_an_owner
  before update of role or delete on public.memberships
  for each row execute function private.ensure_org_keeps_an_owner();

create function private.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (org_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    -- Null when the whole workspace is being deleted, so the cascade does not fail.
    (select o.id from public.organizations o where o.id = old.org_id),
    (select auth.uid()),
    case when tg_op = 'DELETE' then 'membership.removed' else 'membership.role_changed' end,
    'membership',
    old.user_id::text,
    case
      when tg_op = 'DELETE' then jsonb_build_object('role', old.role)
      else jsonb_build_object('from', old.role, 'to', new.role)
    end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger memberships_audit_role_change
  after update of role on public.memberships
  for each row
  when (old.role is distinct from new.role)
  execute function private.audit_membership_change();

create trigger memberships_audit_removal
  after delete on public.memberships
  for each row execute function private.audit_membership_change();

-- Row-level security ----------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.platform_staff enable row level security;
alter table public.staff_access_grants enable row level security;
alter table public.audit_log enable row level security;

create policy "members and granted staff read workspaces"
  on public.organizations for select to authenticated
  using (private.can_read_org(id));

create policy "owners and admins rename workspaces"
  on public.organizations for update to authenticated
  using (private.has_org_role(id, array['owner', 'admin']::public.org_role[]))
  with check (private.has_org_role(id, array['owner', 'admin']::public.org_role[]));

create policy "members and granted staff read memberships"
  on public.memberships for select to authenticated
  using (private.can_read_org(org_id));

create policy "owners change any role; admins change non-owners"
  on public.memberships for update to authenticated
  using (
    private.has_org_role(org_id, array['owner']::public.org_role[])
    or (private.has_org_role(org_id, array['admin']::public.org_role[]) and role <> 'owner')
  )
  with check (
    private.has_org_role(org_id, array['owner']::public.org_role[])
    or (private.has_org_role(org_id, array['admin']::public.org_role[]) and role <> 'owner')
  );

create policy "members leave; owners and admins remove others"
  on public.memberships for delete to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_org_role(org_id, array['owner']::public.org_role[])
    or (private.has_org_role(org_id, array['admin']::public.org_role[]) and role <> 'owner')
  );

create policy "owners and admins read invitations"
  on public.invitations for select to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "owners and admins invite"
  on public.invitations for insert to authenticated
  with check (
    private.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    and invited_by = (select auth.uid())
  );

create policy "owners and admins revoke invitations"
  on public.invitations for delete to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "staff read their own row; staff admins read all"
  on public.platform_staff for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff_admin());

create policy "staff read their grants; staff admins read all"
  on public.staff_access_grants for select to authenticated
  using (staff_user_id = (select auth.uid()) or private.is_staff_admin());

create policy "owners and staff admins read the audit log"
  on public.audit_log for select to authenticated
  using (
    private.has_org_role(org_id, array['owner']::public.org_role[])
    or (
      -- Like any workspace data, a workspace's audit trail needs an active grant. Rows whose
      -- workspace was deleted (org_id is null) stay readable by staff admins.
      private.is_staff_admin()
      and (org_id is null or private.has_staff_access(org_id))
    )
  );

-- Table privileges: nothing for anonymous visitors, and signed-in users may only write the
-- columns listed here. Everything else goes through the functions below.

revoke all on table
  public.organizations,
  public.memberships,
  public.invitations,
  public.platform_staff,
  public.staff_access_grants,
  public.audit_log
  from anon, authenticated;

grant select on table
  public.organizations,
  public.memberships,
  public.invitations,
  public.platform_staff,
  public.staff_access_grants,
  public.audit_log
  to authenticated;

grant update (name) on table public.organizations to authenticated;
grant update (role), delete on table public.memberships to authenticated;
grant insert (org_id, email, role), delete on table public.invitations to authenticated;

-- Functions callable through the Data API ------------------------------------------------------

create function public.create_organization(p_name text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to create a workspace.' using errcode = '42501';
  end if;

  insert into public.organizations (name, created_by)
  values (btrim(p_name), (select auth.uid()))
  returning * into v_org;

  insert into public.memberships (org_id, user_id, role)
  values (v_org.id, (select auth.uid()), 'owner');

  insert into public.audit_log (org_id, actor_user_id, action, target_type, target_id)
  values (v_org.id, (select auth.uid()), 'organization.created', 'organization', v_org.id::text);

  return v_org;
end;
$$;

create function public.accept_invitation(p_token text)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations;
  v_membership public.memberships;
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to accept an invitation.' using errcode = '42501';
  end if;

  select * into v_invitation
  from public.invitations i
  where i.token = p_token
  for update;

  if not found or v_invitation.accepted_at is not null or v_invitation.expires_at <= now() then
    raise exception 'This invitation is no longer valid.' using errcode = 'P0002';
  end if;

  if v_invitation.email <> v_email then
    raise exception 'This invitation was sent to a different email address.'
      using errcode = '42501';
  end if;

  -- Someone who is already a member keeps their current role.
  insert into public.memberships (org_id, user_id, role)
  values (v_invitation.org_id, (select auth.uid()), v_invitation.role)
  on conflict (org_id, user_id) do nothing
  returning * into v_membership;

  if not found then
    select * into v_membership
    from public.memberships m
    where m.org_id = v_invitation.org_id
      and m.user_id = (select auth.uid());
  end if;

  update public.invitations
  set accepted_at = now(), accepted_by = (select auth.uid())
  where id = v_invitation.id;

  insert into public.audit_log (org_id, actor_user_id, action, target_type, target_id)
  values (
    v_invitation.org_id, (select auth.uid()), 'invitation.accepted', 'invitation',
    v_invitation.id::text
  );

  return v_membership;
end;
$$;

-- Member list with emails for people who can read the workspace. auth.users is not exposed, so
-- this is the only way the app sees co-members' emails.
create function public.workspace_members(p_org_id uuid)
returns table (user_id uuid, email text, role public.org_role, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = p_org_id
    and private.can_read_org(p_org_id)
  order by m.role, u.email;
$$;

create function public.grant_staff_access(
  p_org_id uuid,
  p_staff_user_id uuid,
  p_reason text,
  p_minutes integer default 60
)
returns public.staff_access_grants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.staff_access_grants;
begin
  if not private.is_staff_admin() then
    raise exception 'Only staff admins can grant workspace access.' using errcode = '42501';
  end if;

  if p_minutes is null or p_minutes < 5 or p_minutes > 480 then
    raise exception 'Access must last between 5 and 480 minutes.' using errcode = '22023';
  end if;

  insert into public.staff_access_grants (org_id, staff_user_id, granted_by, reason, expires_at)
  values (
    p_org_id, p_staff_user_id, (select auth.uid()), btrim(p_reason),
    now() + make_interval(mins => p_minutes)
  )
  returning * into v_grant;

  insert into public.audit_log (org_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    p_org_id, (select auth.uid()), 'staff_access.granted', 'staff_access_grant', v_grant.id::text,
    jsonb_build_object(
      'staff_user_id', p_staff_user_id, 'minutes', p_minutes, 'reason', btrim(p_reason)
    )
  );

  return v_grant;
end;
$$;

create function public.revoke_staff_access(p_grant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  if not private.is_staff_admin() then
    raise exception 'Only staff admins can revoke workspace access.' using errcode = '42501';
  end if;

  update public.staff_access_grants g
  set revoked_at = now()
  where g.id = p_grant_id
    and g.revoked_at is null
  returning g.org_id into v_org_id;

  if found then
    insert into public.audit_log (org_id, actor_user_id, action, target_type, target_id)
    values (
      v_org_id, (select auth.uid()), 'staff_access.revoked', 'staff_access_grant',
      p_grant_id::text
    );
  end if;
end;
$$;

revoke execute on function
  public.create_organization(text),
  public.accept_invitation(text),
  public.workspace_members(uuid),
  public.grant_staff_access(uuid, uuid, text, integer),
  public.revoke_staff_access(uuid)
  from public, anon;

grant execute on function
  public.create_organization(text),
  public.accept_invitation(text),
  public.workspace_members(uuid),
  public.grant_staff_access(uuid, uuid, text, integer),
  public.revoke_staff_access(uuid)
  to authenticated;
