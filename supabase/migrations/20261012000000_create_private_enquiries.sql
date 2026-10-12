create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_type text not null check (request_type in ('contact', 'quote')),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (
    char_length(email) between 3 and 254
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  phone text check (phone is null or char_length(phone) <= 40),
  subject text not null check (char_length(subject) between 2 and 120),
  message text not null check (char_length(message) between 2 and 5000),
  project_details text check (
    project_details is null or char_length(project_details) <= 3000
  ),
  items jsonb not null default '[]'::jsonb check (
    jsonb_typeof(items) = 'array'
    and jsonb_array_length(items) <= 40
  ),
  consent boolean not null check (consent),
  constraint quote_must_include_products check (
    request_type <> 'quote' or jsonb_array_length(items) > 0
  )
);

create index if not exists enquiries_created_at_desc_idx
  on public.enquiries (created_at desc);

create table if not exists public.enquiry_rate_limits (
  requester_hash text not null check (requester_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  submission_count integer not null check (
    submission_count between 1 and 6
  ),
  primary key (requester_hash, window_start)
);

create index if not exists enquiry_rate_limits_window_start_idx
  on public.enquiry_rate_limits (window_start);

alter table public.enquiries enable row level security;
alter table public.enquiry_rate_limits enable row level security;

revoke all on table public.enquiries
  from public, anon, authenticated;
revoke all on table public.enquiry_rate_limits
  from public, anon, authenticated;

create or replace function public.submit_public_enquiry(
  p_request jsonb,
  p_requester_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_window timestamptz;
  v_count integer;
  v_enquiry_id uuid;
begin
  if p_requester_hash is null
    or p_requester_hash !~ '^[0-9a-f]{64}$'
    or p_request is null
    or jsonb_typeof(p_request) <> 'object'
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid enquiry request.';
  end if;

  v_window := date_bin(
    interval '15 minutes',
    v_now,
    timestamptz '2000-01-01 00:00:00+00'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(p_requester_hash, 1378675309)
  );

  delete from public.enquiry_rate_limits
    where window_start < v_now - interval '1 day';

  insert into public.enquiry_rate_limits (
    requester_hash,
    window_start,
    submission_count
  )
  values (p_requester_hash, v_window, 1)
  on conflict (requester_hash, window_start)
  do update set submission_count =
    least(public.enquiry_rate_limits.submission_count + 1, 6)
  returning submission_count into v_count;

  if v_count > 5 then
    return jsonb_build_object('rate_limited', true);
  end if;

  insert into public.enquiries (
    request_type,
    name,
    email,
    phone,
    subject,
    message,
    project_details,
    items,
    consent
  )
  values (
    p_request->>'request_type',
    p_request->>'name',
    lower(p_request->>'email'),
    nullif(p_request->>'phone', ''),
    p_request->>'subject',
    p_request->>'message',
    nullif(p_request->>'project_details', ''),
    coalesce(p_request->'items', '[]'::jsonb),
    (p_request->>'consent')::boolean
  )
  returning id into v_enquiry_id;

  return jsonb_build_object('reference', left(v_enquiry_id::text, 8));
end;
$$;

revoke all on function public.submit_public_enquiry(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.submit_public_enquiry(jsonb, text)
  to service_role;
