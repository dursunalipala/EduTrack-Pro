-- Applied to Supabase on 2026-11-13 (migration name:
-- fix_appointment_guard_for_appsheet_service_role_updates).
-- Fix: service_role AppSheet/Sheets sync updates were rejected with SQLSTATE 42501
-- because public.appointments_guard_changes planned a call into the private schema
-- even on ordinary field updates. Keep permission checks for non-service roles.
create or replace function public.appointments_guard_changes()
returns trigger language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if tg_op='UPDATE' then
    if new.workspace_id is distinct from old.workspace_id
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.source_record_id is distinct from old.source_record_id then
      raise exception 'Sabit kayıt alanları değiştirilemez';
    end if;
    if (new.deleted_at is distinct from old.deleted_at
        or new.deleted_by is distinct from old.deleted_by) then
      if current_user <> 'service_role' then
        if not private.has_workspace_role(
          old.workspace_id,array['owner','manager']::text[]
        ) then
          raise exception 'Arşivleme yetkisi gerekli';
        end if;
      end if;
    end if;
    new.updated_at=now();
  end if;
  return new;
end
$function$;
