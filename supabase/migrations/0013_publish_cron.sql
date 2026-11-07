-- Posting Instagram terjadwal: pg_cron memanggil /api/cron/publish tiap 10 menit.
-- Kuncinya dibuat acak di dalam database (Vault) dan dibaca aplikasi lewat RPC service_role.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'publish_cron_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'publish_cron_key', 'Kunci cron posting Instagram');
  end if;
end $$;

create or replace function public.publish_cron_key() returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'publish_cron_key' limit 1
$$;
revoke all on function public.publish_cron_key() from public, anon, authenticated;
grant execute on function public.publish_cron_key() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'publish-instagram';
select cron.schedule('publish-instagram', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://socialmedia-ai-puce.vercel.app/api/cron/publish',
    headers := jsonb_build_object('Authorization', 'Bearer ' || public.publish_cron_key(), 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);
