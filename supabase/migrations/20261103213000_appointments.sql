-- Randevu ve Kayıt Takip Merkezi. No legacy/AppSheet rows are modified.
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  legacy_id bigint,
  school_unit text not null default 'aksam'
    check (school_unit in ('aksam','ilkokul','anasinifi','ortak')),
  contact_name text not null check (length(btrim(contact_name)) between 2 and 200),
  education_status text not null default '',
  age integer check (age between 0 and 120),
  grade text not null default '',
  aol_credits integer check (aol_credits between 0 and 500),
  quote_amount numeric(12,2) check (quote_amount >= 0),
  city text not null default '',
  district text not null default '',
  contact_phone text not null default '',
  staff_name text not null default '',
  assigned_to uuid references auth.users(id),
  meeting_date date,
  first_contact_note text not null default '',
  appointment_date date,
  appointment_time time without time zone,
  branch text not null default '',
  result text not null default 'beklemede'
    check (result in ('ilk_randevu','beklemede','dusunecek','olumsuz','kayit','iptal','tekrar_aranacak')),
  followup_date date,
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint appointments_legacy_unique unique (workspace_id,legacy_id)
);
create index if not exists appointments_ws_date_idx on public.appointments (workspace_id,appointment_date,appointment_time);
create index if not exists appointments_ws_status_idx on public.appointments (workspace_id,result);
create index if not exists appointments_ws_created_idx on public.appointments (workspace_id,created_at desc);
create index if not exists appointments_ws_created_by_idx on public.appointments (workspace_id,created_by);

alter table public.appointments enable row level security;
revoke all on table public.appointments from public, anon, authenticated;
grant select, insert, update on table public.appointments to authenticated;
grant all on table public.appointments to service_role;

create policy appointments_read on public.appointments for select to authenticated
using (
  private.has_workspace_role(workspace_id,ARRAY['owner','manager']::text[])
  or (
    private.has_workspace_role(workspace_id,ARRAY['member']::text[])
    and (created_by = (select auth.uid()) or assigned_to = (select auth.uid()))
  )
);
create policy appointments_add on public.appointments for insert to authenticated
with check (
  private.has_workspace_role(workspace_id,ARRAY['owner','manager','member']::text[])
  and created_by=(select auth.uid())
  and (deleted_at is null and deleted_by is null)
);
create policy appointments_edit on public.appointments for update to authenticated
using (
  private.has_workspace_role(workspace_id,ARRAY['owner','manager']::text[])
  or (
    private.has_workspace_role(workspace_id,ARRAY['member']::text[])
    and created_by=(select auth.uid())
    and deleted_at is null
  )
)
with check (
  (
    private.has_workspace_role(workspace_id,ARRAY['owner','manager']::text[])
    or (private.has_workspace_role(workspace_id,ARRAY['member']::text[])
      and created_by=(select auth.uid()) and deleted_at is null)
  )
  and updated_by=(select auth.uid())
);
-- No DELETE grant: UI archives instead of destroying records.
comment on table public.appointments is 'Ortak Takip: AppSheet uyumlu randevu kaydı; school and workspace scoped, soft-delete only.';
