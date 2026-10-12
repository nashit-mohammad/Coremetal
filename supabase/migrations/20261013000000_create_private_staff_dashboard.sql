create extension if not exists pgcrypto with schema extensions;
alter extension pgcrypto set schema extensions;

create table if not exists public.dashboard_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (
    char_length(email) between 3 and 254
    and email = lower(email)
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  password_hash text not null,
  role text not null check (role in ('admin', 'staff')),
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  password_changed_at timestamptz
);

create table if not exists public.dashboard_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.dashboard_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists dashboard_sessions_user_id_idx
  on public.dashboard_sessions (user_id);
create index if not exists dashboard_sessions_expires_at_idx
  on public.dashboard_sessions (expires_at);

create table if not exists public.dashboard_login_limits (
  attempt_hash text not null check (attempt_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  attempts integer not null check (attempts between 1 and 26),
  primary key (attempt_hash, window_start)
);

create index if not exists dashboard_login_limits_window_start_idx
  on public.dashboard_login_limits (window_start);

alter table public.enquiries
  add column if not exists status text not null default 'open'
    check (status in ('open', 'contacted', 'closed')),
  add column if not exists updated_at timestamptz;

update public.enquiries
  set updated_at = created_at
  where updated_at is null;

alter table public.enquiries
  alter column updated_at set default now(),
  alter column updated_at set not null,
  add column if not exists status_changed_by uuid
    references public.dashboard_users(id) on delete set null;

create index if not exists enquiries_status_created_at_idx
  on public.enquiries (status, created_at desc);

create table if not exists public.enquiry_status_history (
  id bigint generated always as identity primary key,
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  previous_status text check (
    previous_status is null or previous_status in ('open', 'contacted', 'closed')
  ),
  new_status text not null check (new_status in ('open', 'contacted', 'closed')),
  changed_by uuid not null references public.dashboard_users(id),
  changed_at timestamptz not null default now()
);

alter table public.enquiries enable row level security;
alter table public.enquiry_rate_limits enable row level security;
alter table public.dashboard_users enable row level security;
alter table public.dashboard_sessions enable row level security;
alter table public.dashboard_login_limits enable row level security;
alter table public.enquiry_status_history enable row level security;

revoke all on table public.enquiries
  from public, anon, authenticated;
revoke all on table public.enquiry_rate_limits
  from public, anon, authenticated;
revoke all on table public.dashboard_users
  from public, anon, authenticated;
revoke all on table public.dashboard_sessions
  from public, anon, authenticated;
revoke all on table public.dashboard_login_limits
  from public, anon, authenticated;
revoke all on table public.enquiry_status_history
  from public, anon, authenticated;
revoke all on sequence public.enquiry_status_history_id_seq
  from public, anon, authenticated;

create or replace function public.dashboard_session_user(p_token_hash text)
returns table (
  user_id uuid,
  email text,
  role text,
  must_change_password boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email, u.role, u.must_change_password
  from public.dashboard_sessions s
  join public.dashboard_users u on u.id = s.user_id
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > now()
    and u.is_active
$$;

create or replace function public.bootstrap_dashboard_admins(p_admins jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin jsonb;
  v_email text;
  v_password text;
  v_result jsonb := '[]'::jsonb;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('coremetal-dashboard-bootstrap', 0)
  );

  if exists (
    select 1 from public.dashboard_users where role = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'Dashboard is already initialized.';
  end if;
  if jsonb_typeof(p_admins) <> 'array' or jsonb_array_length(p_admins) <> 3 then
    raise exception using errcode = '22023', message = 'Exactly three initial administrators are required.';
  end if;

  for v_admin in select value from jsonb_array_elements(p_admins)
  loop
    v_email := lower(v_admin->>'email');
    v_password := v_admin->>'password';
    if v_email is null
      or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      or v_password is null
      or char_length(v_password) < 14
      or char_length(v_password) > 72
      or octet_length(v_password) > 72
    then
      raise exception using errcode = '22023', message = 'An administrator account is invalid.';
    end if;

    insert into public.dashboard_users (email, password_hash, role)
    values (v_email, extensions.crypt(v_password, extensions.gen_salt('bf', 12)), 'admin');

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'email', v_email,
      'role', 'admin'
    ));
  end loop;

  return v_result;
end;
$$;

create or replace function public.authenticate_dashboard_user(
  p_email text,
  p_password text,
  p_token_hash text,
  p_email_attempt_hash text,
  p_ip_attempt_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.dashboard_users%rowtype;
  v_attempt_count integer;
  v_window timestamptz;
  v_attempt_hash text;
begin
  if p_email is null or p_password is null
    or char_length(p_password) > 72
    or octet_length(p_password) > 72
    or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_email_attempt_hash is null or p_email_attempt_hash !~ '^[0-9a-f]{64}$'
    or p_ip_attempt_hash is null or p_ip_attempt_hash !~ '^[0-9a-f]{64}$'
  then
    return null;
  end if;

  v_window := date_bin(
    interval '15 minutes',
    now(),
    timestamptz '2000-01-01 00:00:00+00'
  );
  for v_attempt_hash in
    select distinct candidate
    from unnest(array[p_email_attempt_hash, p_ip_attempt_hash]) as hashes(candidate)
    order by candidate
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_attempt_hash, 20817));
  end loop;
  delete from public.dashboard_login_limits
    where window_start < now() - interval '1 day';
  delete from public.dashboard_sessions
    where expires_at < now()
      or revoked_at < now() - interval '30 days';
  for v_attempt_hash in
    select distinct candidate
    from unnest(array[p_email_attempt_hash, p_ip_attempt_hash]) as hashes(candidate)
  loop
    insert into public.dashboard_login_limits (attempt_hash, window_start, attempts)
      values (v_attempt_hash, v_window, 1)
      on conflict (attempt_hash, window_start)
      do update set attempts = least(public.dashboard_login_limits.attempts + 1, 26)
      returning attempts into v_attempt_count;
    if v_attempt_count > (case
      when v_attempt_hash = p_email_attempt_hash then 10
      else 25
    end) then
      return jsonb_build_object('rate_limited', true);
    end if;
  end loop;

  select * into v_user
    from public.dashboard_users u
    where u.email = lower(p_email) and u.is_active;

  if not found then
    perform extensions.crypt(p_password, '$2a$12$C6UzMDM.H6dfI/f/IKcEe.');
    return null;
  end if;
  if extensions.crypt(p_password, v_user.password_hash) <> v_user.password_hash then
    return null;
  end if;

  delete from public.dashboard_login_limits
    where attempt_hash = p_email_attempt_hash
      and window_start = v_window;
  insert into public.dashboard_sessions (token_hash, user_id, expires_at)
    values (p_token_hash, v_user.id, now() + interval '12 hours');

  return jsonb_build_object(
    'email', v_user.email,
    'role', v_user.role,
    'must_change_password', v_user.must_change_password,
    'expires_at', now() + interval '12 hours'
  );
end;
$$;

create or replace function public.dashboard_is_initialized()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.dashboard_users where role = 'admin')
$$;

create or replace function public.get_dashboard_user(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'email', u.email,
    'role', u.role,
    'must_change_password', u.must_change_password,
    'expires_at', s.expires_at
  )
  from public.dashboard_sessions s
  join public.dashboard_users u on u.id = s.user_id
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > now()
    and u.is_active
$$;

create or replace function public.revoke_dashboard_session(p_token_hash text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.dashboard_sessions
    set revoked_at = now()
    where token_hash = p_token_hash and revoked_at is null
  returning true
$$;

create or replace function public.change_dashboard_password(
  p_token_hash text,
  p_current_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_password_hash text;
begin
  select * into v_session
    from public.dashboard_session_user(p_token_hash);
  if not found
    or p_new_password is null
    or char_length(p_new_password) < 14
    or char_length(p_new_password) > 72
    or octet_length(p_new_password) > 72
  then
    return false;
  end if;

  select u.password_hash into v_password_hash
    from public.dashboard_users u
    where u.id = v_session.user_id;

  if not v_session.must_change_password
    and (
      p_current_password is null
      or extensions.crypt(p_current_password, v_password_hash) <> v_password_hash
    )
  then
    return false;
  end if;

  update public.dashboard_users
    set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 12)),
        must_change_password = false,
        password_changed_at = now()
    where id = v_session.user_id;

  update public.dashboard_sessions
    set revoked_at = now()
    where user_id = v_session.user_id
      and token_hash <> p_token_hash
      and revoked_at is null;
  return true;
end;
$$;

create or replace function public.list_dashboard_enquiries(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user record;
  v_result jsonb;
begin
  select * into v_user from public.dashboard_session_user(p_token_hash);
  if not found then
    raise exception using errcode = '42501', message = 'A valid staff session is required.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb)
    into v_result
    from public.enquiries e;
  return v_result;
end;
$$;

create or replace function public.update_enquiry_status(
  p_token_hash text,
  p_enquiry_id uuid,
  p_new_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user record;
  v_enquiry public.enquiries%rowtype;
begin
  select * into v_user from public.dashboard_session_user(p_token_hash);
  if not found then
    raise exception using errcode = '42501', message = 'A valid staff session is required.';
  end if;
  if p_new_status not in ('open', 'contacted', 'closed') then
    raise exception using errcode = '22023', message = 'Invalid enquiry status.';
  end if;

  select * into v_enquiry
    from public.enquiries e
    where e.id = p_enquiry_id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Enquiry not found.';
  end if;

  if v_enquiry.status <> p_new_status then
    insert into public.enquiry_status_history (
      enquiry_id, previous_status, new_status, changed_by
    ) values (
      v_enquiry.id, v_enquiry.status, p_new_status, v_user.user_id
    );

    update public.enquiries
      set status = p_new_status,
          updated_at = now(),
          status_changed_by = v_user.user_id
      where id = v_enquiry.id
      returning * into v_enquiry;
  end if;
  return to_jsonb(v_enquiry);
end;
$$;

create or replace function public.list_dashboard_users(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user record;
  v_result jsonb;
begin
  select * into v_user from public.dashboard_session_user(p_token_hash);
  if not found or v_user.role <> 'admin' then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'role', u.role,
    'is_active', u.is_active,
    'must_change_password', u.must_change_password,
    'created_at', u.created_at,
    'password_changed_at', u.password_changed_at
  ) order by u.created_at), '[]'::jsonb)
    into v_result
    from public.dashboard_users u;
  return v_result;
end;
$$;

create or replace function public.create_dashboard_user(
  p_token_hash text,
  p_email text,
  p_password text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_user public.dashboard_users%rowtype;
begin
  select * into v_actor from public.dashboard_session_user(p_token_hash);
  if not found or v_actor.role <> 'admin' then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;
  if p_email is null or lower(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_password is null or char_length(p_password) < 14
    or char_length(p_password) > 72 or octet_length(p_password) > 72
    or p_role not in ('admin', 'staff')
  then
    raise exception using errcode = '22023', message = 'The new staff account is invalid.';
  end if;

  insert into public.dashboard_users (email, password_hash, role)
    values (
      lower(p_email),
      extensions.crypt(p_password, extensions.gen_salt('bf', 12)),
      p_role
    )
    returning * into v_user;

  return jsonb_build_object(
    'id', v_user.id,
    'email', v_user.email,
    'role', v_user.role,
    'must_change_password', v_user.must_change_password,
    'created_at', v_user.created_at
  );
end;
$$;

create or replace function public.reset_dashboard_user_password(
  p_token_hash text,
  p_user_id uuid,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
begin
  select * into v_actor from public.dashboard_session_user(p_token_hash);
  if not found or v_actor.role <> 'admin' then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;
  if p_new_password is null
    or char_length(p_new_password) < 14
    or char_length(p_new_password) > 72
    or octet_length(p_new_password) > 72
  then
    raise exception using errcode = '22023', message = 'The new password does not meet the minimum requirements.';
  end if;

  update public.dashboard_users
    set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 12)),
        must_change_password = true,
        password_changed_at = null
    where id = p_user_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Staff account not found.';
  end if;

  update public.dashboard_sessions
    set revoked_at = now()
    where user_id = p_user_id and revoked_at is null;
  return true;
end;
$$;

create or replace function public.set_dashboard_user_active(
  p_token_hash text,
  p_user_id uuid,
  p_is_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_target public.dashboard_users%rowtype;
  v_active_admins integer;
begin
  select * into v_actor from public.dashboard_session_user(p_token_hash);
  if not found or v_actor.role <> 'admin' then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('coremetal-dashboard-admin-accounts', 0)
  );
  if p_is_active is null then
    raise exception using errcode = '22023', message = 'An account state is required.';
  end if;

  select * into v_target
    from public.dashboard_users u
    where u.id = p_user_id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Staff account not found.';
  end if;
  if not p_is_active and p_user_id = v_actor.user_id then
    raise exception using errcode = '22023', message = 'Administrators cannot disable their own account.';
  end if;

  if not p_is_active and v_target.is_active and v_target.role = 'admin' then
    select count(*) into v_active_admins
      from public.dashboard_users u
      where u.role = 'admin' and u.is_active;
    if v_active_admins <= 1 then
      raise exception using errcode = '22023', message = 'At least one active administrator is required.';
    end if;
  end if;

  update public.dashboard_users set is_active = p_is_active where id = p_user_id;
  if not p_is_active then
    update public.dashboard_sessions
      set revoked_at = now()
      where user_id = p_user_id and revoked_at is null;
  end if;
  return true;
end;
$$;

revoke all on function public.dashboard_session_user(text)
  from public, anon, authenticated;
revoke all on function public.bootstrap_dashboard_admins(jsonb)
  from public, anon, authenticated;
revoke all on function public.authenticate_dashboard_user(text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.dashboard_is_initialized()
  from public, anon, authenticated;
revoke all on function public.get_dashboard_user(text)
  from public, anon, authenticated;
revoke all on function public.revoke_dashboard_session(text)
  from public, anon, authenticated;
revoke all on function public.change_dashboard_password(text, text, text)
  from public, anon, authenticated;
revoke all on function public.list_dashboard_enquiries(text)
  from public, anon, authenticated;
revoke all on function public.update_enquiry_status(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.list_dashboard_users(text)
  from public, anon, authenticated;
revoke all on function public.create_dashboard_user(text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.reset_dashboard_user_password(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.set_dashboard_user_active(text, uuid, boolean)
  from public, anon, authenticated;

grant execute on function public.dashboard_session_user(text) to service_role;
grant execute on function public.bootstrap_dashboard_admins(jsonb) to service_role;
grant execute on function public.authenticate_dashboard_user(text, text, text, text, text) to service_role;
grant execute on function public.dashboard_is_initialized() to service_role;
grant execute on function public.get_dashboard_user(text) to service_role;
grant execute on function public.revoke_dashboard_session(text) to service_role;
grant execute on function public.change_dashboard_password(text, text, text) to service_role;
grant execute on function public.list_dashboard_enquiries(text) to service_role;
grant execute on function public.update_enquiry_status(text, uuid, text) to service_role;
grant execute on function public.list_dashboard_users(text) to service_role;
grant execute on function public.create_dashboard_user(text, text, text, text) to service_role;
grant execute on function public.reset_dashboard_user_password(text, uuid, text) to service_role;
grant execute on function public.set_dashboard_user_active(text, uuid, boolean) to service_role;
