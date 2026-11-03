-- ============================================================
-- Ads providers + Email templates/deliveries/logging
-- ============================================================

-- Ad providers: each placement can now source its code from either
-- Adsterra or Google Ads (AdSense).
alter table public.ad_settings add column if not exists provider text not null default 'adsterra';
alter table public.ad_settings alter column provider set default 'adsterra';
update public.ad_settings set provider = 'adsterra' where provider is null or provider = '';

-- ============================================================
-- Email templates (editable from the admin console)
-- ============================================================
create table if not exists public.email_templates (
    key text primary key,
    subject text not null default '',
    body_html text not null default '',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;

drop policy if exists "Admins and moderators can read email templates" on public.email_templates;
create policy "Admins and moderators can read email templates"
on public.email_templates for select
to authenticated
using (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator')
);

drop policy if exists "Admins and moderators can insert email templates" on public.email_templates;
create policy "Admins and moderators can insert email templates"
on public.email_templates for insert
to authenticated
with check (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator')
);

drop policy if exists "Admins and moderators can update email templates" on public.email_templates;
create policy "Admins and moderators can update email templates"
on public.email_templates for update
to authenticated
using (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator')
)
with check (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator')
);

drop trigger if exists update_email_templates_updated_at on public.email_templates;
create trigger update_email_templates_updated_at
before update on public.email_templates
for each row execute function public.update_updated_at_column();

-- ============================================================
-- Email deliveries (log of every sent email + open tracking)
-- ============================================================
create table if not exists public.email_deliveries (
    id uuid primary key default gen_random_uuid(),
    "to" text not null,
    subject text not null default '',
    template_key text,
    status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
    error text,
    opened_at timestamptz,
    idempotency_key text,
    created_at timestamptz not null default now()
);

create index if not exists email_deliveries_created_at_idx on public.email_deliveries (created_at desc);
create index if not exists email_deliveries_status_idx on public.email_deliveries (status);
create unique index if not exists email_deliveries_idempotency_key_idx on public.email_deliveries (idempotency_key) where idempotency_key is not null;

alter table public.email_deliveries enable row level security;

drop policy if exists "Admins and moderators can read email deliveries" on public.email_deliveries;
create policy "Admins and moderators can read email deliveries"
on public.email_deliveries for select
to authenticated
using (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator')
);

-- ============================================================
-- Open tracking: record_email_open(delivery_id)
-- Safe (idempotent, only ever sets opened_at once) and callable
-- by the anon key from the email-open edge function.
-- ============================================================
create or replace function public.record_email_open(delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.email_deliveries
    set opened_at = coalesce(opened_at, now())
    where id = delivery_id
      and opened_at is null;
end;
$$;

revoke all on function public.record_email_open(uuid) from public;
grant execute on function public.record_email_open(uuid) to anon, authenticated, service_role;