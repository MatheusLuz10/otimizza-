create table if not exists buildings (
  id bigint primary key generated always as identity,
  name text not null unique,
  address text,
  observations text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  synced_at timestamptz
);

create table if not exists ctos (
  id bigint primary key generated always as identity,
  code text not null unique,
  building_id bigint not null references buildings(id) on delete cascade,
  floor text,
  power text,
  ports integer,
  splitter text,
  technical_info text,
  observations text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  synced_at timestamptz
);

create index if not exists idx_buildings_updated_at on buildings(updated_at desc);
create index if not exists idx_ctos_building_id on ctos(building_id);
create index if not exists idx_ctos_updated_at on ctos(updated_at desc);

alter table buildings enable row level security;
alter table ctos enable row level security;

drop policy if exists "allow_public_buildings_select" on buildings;
drop policy if exists "allow_public_buildings_insert" on buildings;
drop policy if exists "allow_public_buildings_update" on buildings;
drop policy if exists "allow_public_buildings_delete" on buildings;

create policy "allow_public_buildings_select"
  on buildings for select
  using (true);

create policy "allow_public_buildings_insert"
  on buildings for insert
  with check (true);

create policy "allow_public_buildings_update"
  on buildings for update
  using (true)
  with check (true);

create policy "allow_public_buildings_delete"
  on buildings for delete
  using (true);

drop policy if exists "allow_public_ctos_select" on ctos;
drop policy if exists "allow_public_ctos_insert" on ctos;
drop policy if exists "allow_public_ctos_update" on ctos;
drop policy if exists "allow_public_ctos_delete" on ctos;

create policy "allow_public_ctos_select"
  on ctos for select
  using (true);

create policy "allow_public_ctos_insert"
  on ctos for insert
  with check (true);

create policy "allow_public_ctos_update"
  on ctos for update
  using (true)
  with check (true);

create policy "allow_public_ctos_delete"
  on ctos for delete
  using (true);
