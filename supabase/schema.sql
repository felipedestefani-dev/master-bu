-- Master Bu — cole no SQL Editor do Supabase.
-- Crie o administrador em Authentication > Users (e-mail e senha).
-- O site usa só a chave anon/public. A service_role não entra no frontend.
-- Não há tabela de clientes.

create table if not exists public.sets (
  id text primary key,
  name text not null,
  code text not null,
  sort integer not null default 0,
  constraint sets_id_ok check (id ~ '^[A-Za-z0-9-]{1,40}$'),
  constraint sets_name_len check (char_length(name) between 1 and 80),
  constraint sets_code_ok check (code ~ '^[A-Za-z0-9]{1,12}$')
);

create table if not exists public.products (
  id text primary key,
  kind text not null check (kind in ('single', 'sealed')),
  name text not null,
  set_id text not null references public.sets (id) on delete restrict,
  number text not null default '',
  rarity text not null default '',
  condition text not null default 'NM',
  lang text not null default 'PT',
  finish text not null default 'Normal',
  qty integer not null default 1,
  price numeric(12, 2) not null default 0,
  image text not null default '',
  constraint products_id_ok check (id ~ '^[A-Za-z0-9-]{1,48}$'),
  constraint products_name_len check (char_length(name) between 1 and 120),
  constraint products_number_len check (char_length(number) <= 24),
  constraint products_rarity_len check (char_length(rarity) <= 40),
  constraint products_condition_len check (char_length(condition) between 1 and 24),
  constraint products_lang_ok check (char_length(lang) between 1 and 8 and lang = upper(lang)),
  constraint products_finish_len check (char_length(finish) between 1 and 40),
  constraint products_qty_ok check (qty between 0 and 9999),
  constraint products_price_ok check (price >= 0),
  constraint products_image_ok check (
    image = ''
    or (
      char_length(image) <= 500
      and image ~* '^(https?://|/assets/|assets/)'
      and image !~ '[ <>"'']'
    )
    or (
      char_length(image) <= 1500000
      and image like 'data:image/jpeg;base64,%'
    )
  )
);

create table if not exists public.banners (
  id text primary key,
  image text not null default '',
  href text not null default '#/',
  label text not null default '',
  scroll text not null default '',
  sort integer not null default 0,
  constraint banners_id_ok check (id ~ '^[A-Za-z0-9_-]{1,80}$'),
  constraint banners_label_len check (char_length(label) <= 120),
  constraint banners_scroll_len check (char_length(scroll) <= 40),
  constraint banners_href_ok check (
    char_length(href) <= 500
    and (
      href = '#/'
      or (href like '#/%' and href !~ '[ <>"'']')
      or href ~ '^https://[^[:space:]<>"'']+$'
    )
  ),
  constraint banners_image_ok check (
    image = ''
    or (
      char_length(image) <= 500
      and image ~* '^(https?://|/assets/|assets/)'
      and image !~ '[ <>"'']'
    )
    or (
      char_length(image) <= 1500000
      and image like 'data:image/jpeg;base64,%'
    )
  )
);

create table if not exists public.visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path text not null default '/',
  visitor text not null default '',
  city text not null default '',
  constraint visits_len check (
    char_length(path) <= 120
    and char_length(visitor) <= 64
    and char_length(city) <= 80
  )
);

create index if not exists sets_sort_idx on public.sets (sort);
create index if not exists products_set_id_idx on public.products (set_id);
create index if not exists products_name_idx on public.products (name);
create table if not exists public.tabs (
  id text primary key,
  label text not null,
  href text not null,
  icon text not null,
  sort integer not null default 0,
  constraint tabs_id_ok check (id ~ '^[A-Za-z0-9-]{1,40}$'),
  constraint tabs_label_len check (char_length(label) between 1 and 40),
  constraint tabs_href_ok check (
    char_length(href) <= 500
    and (
      href = '#/'
      or (href like '#/%' and href !~ '[ <>"'']')
      or href ~ '^https://[^[:space:]<>"'']+$'
    )
  ),
  constraint tabs_icon_ok check (
    char_length(icon) <= 80
    and icon ~ '^/assets/icons/[a-z]+\.png$'
  )
);

create index if not exists banners_sort_idx on public.banners (sort);
create index if not exists tabs_sort_idx on public.tabs (sort);

insert into public.tabs (id, label, href, icon, sort) values
  ('inicio', 'Início', '#/', '/assets/icons/home.png', 0),
  ('avulsos', 'Avulsos', '#/avulsos', '/assets/icons/cards.png', 1),
  ('prevenda', 'Pré-venda', '#/prevenda', '/assets/icons/presale.png', 2),
  ('lacrados', 'Lacrados', '#/lacrados', '/assets/icons/sealed.png', 3),
  ('colecoes', 'Coleções', '#/colecoes', '/assets/icons/sets.png', 4),
  ('contato', 'Contato', '#/contato', '/assets/icons/contact.png', 5)
on conflict (id) do nothing;

delete from public.visits a
using public.visits b
where a.id > b.id
  and a.visitor = b.visitor
  and (timezone('America/Sao_Paulo', a.created_at))::date = (timezone('America/Sao_Paulo', b.created_at))::date;

create unique index if not exists visits_visitor_day
  on public.visits (visitor, ((timezone('America/Sao_Paulo', created_at))::date));

insert into public.banners (id, image, href, label, scroll, sort)
values ('__ready', '', '#/', '', '', 1000)
on conflict (id) do nothing;

alter table public.sets enable row level security;
alter table public.products enable row level security;
alter table public.banners enable row level security;
alter table public.tabs enable row level security;
alter table public.visits enable row level security;

drop policy if exists "leitura publica sets" on public.sets;
drop policy if exists "escrita autenticada sets" on public.sets;
drop policy if exists "leitura publica products" on public.products;
drop policy if exists "escrita autenticada products" on public.products;
drop policy if exists "leitura publica banners" on public.banners;
drop policy if exists "escrita autenticada banners" on public.banners;
drop policy if exists "leitura publica tabs" on public.tabs;
drop policy if exists "escrita autenticada tabs" on public.tabs;
drop policy if exists "registrar visita" on public.visits;
drop policy if exists "ler visitas" on public.visits;

create policy "leitura publica sets"
  on public.sets for select
  using (true);

create policy "escrita autenticada sets"
  on public.sets for all
  to authenticated
  using (true)
  with check (true);

create policy "leitura publica products"
  on public.products for select
  using (true);

create policy "escrita autenticada products"
  on public.products for all
  to authenticated
  using (true)
  with check (true);

create policy "leitura publica banners"
  on public.banners for select
  using (true);

create policy "escrita autenticada banners"
  on public.banners for all
  to authenticated
  using (true)
  with check (true);

create policy "leitura publica tabs"
  on public.tabs for select
  using (true);

create policy "escrita autenticada tabs"
  on public.tabs for all
  to authenticated
  using (true)
  with check (true);

create policy "registrar visita"
  on public.visits for insert
  to anon, authenticated
  with check (true);

create policy "ler visitas"
  on public.visits for select
  to authenticated
  using (true);

revoke all on public.sets, public.products, public.banners, public.tabs, public.visits from anon, authenticated;

grant select on public.sets, public.products, public.banners, public.tabs to anon, authenticated;
grant insert, update, delete on public.sets, public.products, public.banners, public.tabs to authenticated;
grant insert on public.visits to anon, authenticated;
grant select on public.visits to authenticated;
grant usage, select on sequence public.visits_id_seq to anon, authenticated;
