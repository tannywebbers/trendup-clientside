-- ============================================================
-- Communications: announcements + email campaigns
-- ============================================================

-- Expand staff roles (mirrors TrendUp role set: owner, administrator,
-- moderator, support, finance, user). Must run outside a BEGIN block;
-- Postgres 12+ allows ALTER TYPE ... ADD VALUE inside a DO block.
do $$
begin
  alter type public.app_role add value if not exists 'owner';
  alter type public.app_role add value if not exists 'administrator';
  alter type public.app_role add value if not exists 'support';
  alter type public.app_role add value if not exists 'finance';
exception when duplicate_object then null;
end $$;

-- ============================================================
-- Announcements (durable, dismissible, fan-out on send)
-- ============================================================
create table if not exists public.announcements (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    message text not null,
    type text not null default 'announcement' check (type in ('announcement', 'info', 'warning', 'promotion')),
    "status" text not null default 'draft' check (status in ('draft', 'sent')),
    audience text not null default 'all' check (audience in ('all', 'active', 'banned')),
    show_in_dashboard boolean not null default false,
    starts_at timestamptz,
    ends_at timestamptz,
    sent_at timestamptz,
    recipient_count integer not null default 0,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create index if not exists announcements_created_at_idx on public.announcements (created_at desc);
create index if not exists announcements_status_idx on public.announcements (status);

drop policy if exists "Anyone can read active announcements" on public.announcements;
create policy "Anyone can read active announcements"
on public.announcements for select
to authenticated
using (status = 'sent');

drop policy if exists "Staff can read all announcements" on public.announcements;
create policy "Staff can read all announcements"
on public.announcements for select
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));

drop policy if exists "Staff can insert announcements" on public.announcements;
create policy "Staff can insert announcements"
on public.announcements for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));

drop policy if exists "Staff can update announcements" on public.announcements;
create policy "Staff can update announcements"
on public.announcements for update
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));

drop policy if exists "Staff can delete announcements" on public.announcements;
create policy "Staff can delete announcements"
on public.announcements for delete
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));

drop trigger if exists update_announcements_updated_at on public.announcements;
create trigger update_announcements_updated_at
before update on public.announcements
for each row execute function public.update_updated_at_column();

-- ============================================================
-- Email campaigns (compose + send bulk email to users)
-- ============================================================
create table if not exists public.email_campaigns (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    subject text not null,
    body_html text not null,
    "status" text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
    audience text not null default 'all' check (audience in ('all', 'active', 'verified')),
    recipient_count integer not null default 0,
    last_error text,
    sent_at timestamptz,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.email_campaigns enable row level security;

create index if not exists email_campaigns_created_at_idx on public.email_campaigns (created_at desc);

drop policy if exists "Staff can read email campaigns" on public.email_campaigns;
create policy "Staff can read email campaigns"
on public.email_campaigns for select
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));

drop policy if exists "Staff can insert email campaigns" on public.email_campaigns;
create policy "Staff can insert email campaigns"
on public.email_campaigns for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));

drop policy if exists "Staff can update email campaigns" on public.email_campaigns;
create policy "Staff can update email campaigns"
on public.email_campaigns for update
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));

drop policy if exists "Staff can delete email campaigns" on public.email_campaigns;
create policy "Staff can delete email campaigns"
on public.email_campaigns for delete
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));

drop trigger if exists update_email_campaigns_updated_at on public.email_campaigns;
create trigger update_email_campaigns_updated_at
before update on public.email_campaigns
for each row execute function public.update_updated_at_column();