create table if not exists public.meetings (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 organization_id uuid references public.hr_organizations(id),
 type text not null check (type in ('board','partners','school_management','teachers','department','mem','other')),
 title text not null check(length(trim(title)) between 3 and 240),
 description text not null default '',
 status text not null default 'requested' check(status in ('requested','scheduled','in_progress','minutes_pending','completed','cancelled')),
 starts_at timestamptz, ends_at timestamptz,
 location text, meeting_url text check(meeting_url is null or meeting_url ~ '^https://'),
 external_organizer text, chair_user_id uuid references auth.users(id),
 created_by uuid not null references auth.users(id) default auth.uid(),
 agenda_deadline timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 check(ends_at is null or starts_at is null or ends_at>starts_at)
);
create table if not exists public.meeting_participants (
 meeting_id uuid not null references public.meetings(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 invitation_status text not null default 'invited' check(invitation_status in ('invited','accepted','declined')),
 attendance text not null default 'unknown' check(attendance in ('unknown','present','absent','excused')),
 primary key(meeting_id,user_id)
);
create table if not exists public.meeting_agenda (
 id uuid primary key default gen_random_uuid(),
 meeting_id uuid not null references public.meetings(id) on delete cascade,
 proposed_by uuid not null references auth.users(id) default auth.uid(),
 title text not null check(length(trim(title)) between 3 and 240),
 description text not null default '',
 status text not null default 'proposed' check(status in ('proposed','accepted','rejected','deferred')),
 sort_order integer not null default 0,
 duration_minutes integer check(duration_minutes between 1 and 480),
 created_at timestamptz not null default now()
);
create table if not exists public.meeting_minutes (
 meeting_id uuid primary key references public.meetings(id) on delete cascade,
 draft_text text not null default '',
 approved_text text,
 status text not null default 'draft' check(status in ('draft','review','approved')),
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 updated_at timestamptz not null default now()
);
create table if not exists public.meeting_decisions (
 id uuid primary key default gen_random_uuid(),
 meeting_id uuid not null references public.meetings(id) on delete cascade,
 agenda_id uuid references public.meeting_agenda(id) on delete set null,
 decision_number text,
 decision_text text not null check(length(trim(decision_text))>=3),
 status text not null default 'draft' check(status in ('draft','approved','in_progress','awaiting_review','completed','cancelled')),
 due_date date, accountable_user_id uuid references auth.users(id),
 approved_by uuid references auth.users(id), approved_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.meeting_decision_tasks (
 decision_id uuid not null references public.meeting_decisions(id) on delete cascade,
 task_id uuid not null references public.tasks(id) on delete cascade,
 primary key(decision_id,task_id)
);
create table if not exists public.meeting_directives (
 id uuid primary key default gen_random_uuid(),
 meeting_id uuid not null references public.meetings(id) on delete cascade,
 source_authority text not null default '',
 official_reference text,
 directive_text text not null,
 due_date date, responsible_user_id uuid references auth.users(id),
 status text not null default 'received' check(status in ('received','assigned','in_progress','submitted','verified')),
 evidence_reference text, created_at timestamptz not null default now()
);
create index if not exists meetings_workspace_start_idx on public.meetings(workspace_id,starts_at desc);
create index if not exists meeting_decisions_status_idx on public.meeting_decisions(status,due_date);
create index if not exists meeting_directives_due_idx on public.meeting_directives(due_date);
create or replace function public.can_manage_meeting(p_meeting uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.meetings m join public.workspace_members wm on wm.workspace_id=m.workspace_id and wm.user_id=(select auth.uid()) and wm.is_active
 where m.id=p_meeting and (wm.role in ('owner','manager') or m.chair_user_id=(select auth.uid())))
$$;
create or replace function public.can_view_meeting(p_meeting uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.meetings m join public.workspace_members wm on wm.workspace_id=m.workspace_id and wm.user_id=(select auth.uid()) and wm.is_active
 where m.id=p_meeting and (wm.role='owner' or m.created_by=(select auth.uid()) or m.chair_user_id=(select auth.uid())
 or exists(select 1 from public.meeting_participants mp where mp.meeting_id=m.id and mp.user_id=(select auth.uid()))))
$$;
alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.meeting_agenda enable row level security;
alter table public.meeting_minutes enable row level security;
alter table public.meeting_decisions enable row level security;
alter table public.meeting_decision_tasks enable row level security;
alter table public.meeting_directives enable row level security;
create policy meetings_select on public.meetings for select to authenticated using (
 exists(select 1 from public.workspace_members wm where wm.workspace_id=meetings.workspace_id and wm.user_id=(select auth.uid()) and wm.is_active)
 and (created_by=(select auth.uid()) or chair_user_id=(select auth.uid()) or exists(select 1 from public.workspace_members wm where wm.workspace_id=meetings.workspace_id and wm.user_id=(select auth.uid()) and wm.is_active and wm.role='owner') or exists(select 1 from public.meeting_participants mp where mp.meeting_id=meetings.id and mp.user_id=(select auth.uid())))
);
create policy meetings_insert on public.meetings for insert to authenticated with check (
 created_by=(select auth.uid()) and exists(select 1 from public.workspace_members wm where wm.workspace_id=meetings.workspace_id and wm.user_id=(select auth.uid()) and wm.is_active and wm.role in ('owner','manager','member'))
);
create policy meetings_update on public.meetings for update to authenticated using (public.can_manage_meeting(id)) with check (public.can_manage_meeting(id));
create policy meeting_participants_select on public.meeting_participants for select to authenticated using (public.can_view_meeting(meeting_id));
create policy meeting_participants_insert on public.meeting_participants for insert to authenticated with check (public.can_manage_meeting(meeting_id));
create policy meeting_participants_update on public.meeting_participants for update to authenticated using (public.can_manage_meeting(meeting_id)) with check (public.can_manage_meeting(meeting_id));
create policy meeting_participants_delete on public.meeting_participants for delete to authenticated using (public.can_manage_meeting(meeting_id));
create policy meeting_agenda_select on public.meeting_agenda for select to authenticated using (public.can_view_meeting(meeting_id));
create policy meeting_agenda_insert on public.meeting_agenda for insert to authenticated with check (proposed_by=(select auth.uid()) and public.can_view_meeting(meeting_id));
create policy meeting_agenda_update on public.meeting_agenda for update to authenticated using (public.can_manage_meeting(meeting_id)) with check (public.can_manage_meeting(meeting_id));
create policy meeting_minutes_select on public.meeting_minutes for select to authenticated using (public.can_view_meeting(meeting_id));
create policy meeting_minutes_insert on public.meeting_minutes for insert to authenticated with check (public.can_manage_meeting(meeting_id));
create policy meeting_minutes_update on public.meeting_minutes for update to authenticated using (public.can_manage_meeting(meeting_id)) with check (public.can_manage_meeting(meeting_id));
create policy meeting_decisions_select on public.meeting_decisions for select to authenticated using (public.can_view_meeting(meeting_id));
create policy meeting_decisions_insert on public.meeting_decisions for insert to authenticated with check (public.can_manage_meeting(meeting_id));
create policy meeting_decisions_update on public.meeting_decisions for update to authenticated using (public.can_manage_meeting(meeting_id)) with check (public.can_manage_meeting(meeting_id));
create policy meeting_decision_tasks_select on public.meeting_decision_tasks for select to authenticated using (exists(select 1 from public.meeting_decisions d where d.id=decision_id and public.can_view_meeting(d.meeting_id)));
create policy meeting_decision_tasks_insert on public.meeting_decision_tasks for insert to authenticated with check (exists(select 1 from public.meeting_decisions d where d.id=decision_id and public.can_manage_meeting(d.meeting_id)));
create policy meeting_directives_select on public.meeting_directives for select to authenticated using (public.can_view_meeting(meeting_id));
create policy meeting_directives_insert on public.meeting_directives for insert to authenticated with check (public.can_manage_meeting(meeting_id));
create policy meeting_directives_update on public.meeting_directives for update to authenticated using (public.can_manage_meeting(meeting_id)) with check (public.can_manage_meeting(meeting_id));
grant select,insert,update on public.meetings,public.meeting_participants,public.meeting_agenda,public.meeting_minutes,public.meeting_decisions,public.meeting_directives to authenticated;
grant select,insert on public.meeting_decision_tasks to authenticated;
revoke all on function public.can_manage_meeting(uuid),public.can_view_meeting(uuid) from public,anon;
grant execute on function public.can_manage_meeting(uuid),public.can_view_meeting(uuid) to authenticated;