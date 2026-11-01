-- Backup automático semanal da estrutura e dos registos Edshoop.
-- Execute DEPOIS de schema.sql. Requer a extensão pg_cron habilitada no Supabase.
create extension if not exists pg_cron;

create or replace function public.edshoop_scheduled_backup()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
begin
  snapshot := jsonb_build_object(
    'version', 1,
    'created_at', now(),
    'products', coalesce((select jsonb_agg(to_jsonb(p)) from public.products p), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(to_jsonb(c)) from public.categories c), '[]'::jsonb),
    'platforms', coalesce((select jsonb_agg(to_jsonb(a)) from public.affiliate_platforms a), '[]'::jsonb),
    'settings', coalesce((select jsonb_agg(to_jsonb(s)) from public.site_settings s), '[]'::jsonb)
  );
  insert into public.admin_backups(created_by, backup_json)
  values (null, snapshot);
end;
$$;

revoke all on function public.edshoop_scheduled_backup() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'edshoop-weekly-backup') then
    perform cron.schedule(
      'edshoop-weekly-backup',
      '0 3 * * 1',
      'select public.edshoop_scheduled_backup();'
    );
  end if;
end $$;

-- Agenda o backup para todas as segundas-feiras às 03:00 UTC.
-- As imagens propriamente ditas ficam no Storage; o snapshot guarda os seus URLs.
