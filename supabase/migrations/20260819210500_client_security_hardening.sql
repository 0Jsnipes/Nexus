-- Client-facing security hardening for Nexus.
-- Keep security-sensitive controls enforced server-side, not only in the UI.

-- New workspaces require an owner/admin approval before join-code requests
-- become active memberships. Existing workspaces are hardened to match.
alter table public.workspaces
  alter column require_approval set default true;

update public.workspaces
set require_approval = true
where require_approval is false;

-- Enforce upload size limits at Supabase Storage even when a caller bypasses
-- the web client. Public profile media is limited to passive raster formats.
update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
where id = 'nexus-public';

update storage.buckets
set file_size_limit = 52428800
where id = 'nexus';
