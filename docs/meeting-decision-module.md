# Toplantı ve Karar Yönetimi — uygulama planı

Durum: geliştirme dalı, canlıya alınmadı.

## Kapsam
Toplantı merkezi ve türleri; toplantı talepleri; katılımcı gündem önerileri; Google Meet/Zoom URL ve duyuru; tutanak/karar kayıtları; karar-görev ilişkisi; MEM toplantıları ve resmî talimatlar; takvim/bildirim; PDF/Excel rapor; onay gerektiren AI tutanak taslağı; karar performans analizi.

## Mevcut sistem
Render static site srv-dbhkcg7f3r2c73d4ngng; GitHub dursunalipala/EduTrack-Pro main, publishPath ortak-takip; Supabase gnwliizxuryfnpqrynym. Mevcut public.tasks, calendar_events, user_notifications, notification_queue, workspace_members, team_access_settings, hr_organizations ve hr_org_access yeniden kullanılacak.

## Önerilen veri modeli
- meeting_types: workspace_id, code, title, enabled, settings
- meetings: workspace_id, organization_id, type_id, title, status, scheduled_start/end, location, meeting_url, chair_user_id, created_by, agenda_deadline, visibility, external_organizer
- meeting_participants: meeting_id, user_id, attendance, invitation_status
- meeting_agenda: meeting_id, proposed_by, title, description, order_index, status, duration_minutes
- meeting_minutes: meeting_id, draft_text, approved_text, status, approved_by, approved_at, revision
- meeting_decisions: meeting_id, agenda_id, decision_number, text, status, due_date, accountable_user_id, approved_by, approved_at
- meeting_decision_tasks: decision_id, task_id, unique(decision_id,task_id)
- meeting_directives: meeting_id, source_authority, official_reference, directive_text, due_date, responsible_user_id, status, evidence_reference
- meeting_documents: meeting_id, storage_path, document_type, uploaded_by
- meeting_audit: meeting_id, actor_id, action, old_value, new_value, created_at

All tables require workspace-scoped RLS, active membership checks, organization-level permissions and audit logging. Sensitive meeting contents must not leak through task descriptions, calendar details or notification previews. Prefer private Storage and signed access. No unreviewed AI-generated decision may be approved automatically.

## State machines
meeting: requested > scheduled > in_progress > minutes_pending > completed | cancelled
agenda: proposed > accepted | rejected | deferred
minutes: draft > review > approved
decision: draft > approved > in_progress > awaiting_review > completed | cancelled
directive: received > assigned > in_progress > submitted > verified

## Integration behavior
Only approved decisions create tasks after authorized confirmation; use idempotent linking to prevent duplicates. Meeting calendar records link to calendar_events; avoid duplicate notifications. External Google Calendar/Meet integration requires per-account authorization and explicit user action. Reports export only records authorized for the requesting user.

## Acceptance tests
1. Owner creates meeting, member submits agenda, chair approves it.
2. Organization A manager cannot see organization B confidential minutes.
3. Member cannot approve their own restricted decision without permission.
4. Approved decision creates one task, retries do not duplicate.
5. Task completion updates decision progress, but does not bypass approval.
6. MEM directive carries official reference, deadline, evidence and submission state.
7. Mobile/tablet/desktop navigation works; PDF Turkish glyphs and Excel exports verified.
8. Unauthorized users cannot fetch records through Supabase REST API.
9. AI drafts remain drafts until authorized review.
10. Google Meet URL is validated and displayed only to invitees.

## Implementation sequence
1. Inspect frontend navigation, existing permissions and tasks API.
2. Create database migration and RLS policies on development workflow; verify policies.
3. Build standalone meeting-module.js/css and integrate navigation.
4. Wire task/calendar/notifications and reports.
5. Test across roles and devices; deploy after tests.
